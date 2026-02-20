import { db } from '../db/database';
import { aiService, CMETopic, CMEQuestion, TestSession, ClinicalData } from './aiService';
import { apiClient } from './apiClient';

export interface CMEProgress {
  userId: string;
  topicId: string;
  completed: boolean;
  score?: number;
  timeSpent: number;
  attempts: number;
  lastAttempt: Date;
  certificateEarned: boolean;
}

export interface CMECertificate {
  id: string;
  userId: string;
  topicId: string;
  issuedAt: Date;
  validUntil: Date;
  score: number;
  creditsEarned: number;
}

class CMEService {
  // Helper: push entity to server via sync API
  private async pushToServer(entityType: string, entityId: string, payload: any): Promise<void> {
    try {
      await apiClient.post('/sync/push', {
        changes: [{
          entityType,
          entityId,
          action: 'upsert',
          payload
        }]
      });
    } catch (error) {
      console.warn(`Failed to push ${entityType} to server:`, error);
    }
  }

  // Helper: pull CME topics from server
  private async pullTopicsFromServer(): Promise<CMETopic[]> {
    try {
      const response = await apiClient.get('/sync/cme-topics');
      if (Array.isArray(response)) {
        for (const topic of response) {
          try {
            const parsed = {
              ...topic,
              learningObjectives: typeof topic.learning_objectives === 'string' ? JSON.parse(topic.learning_objectives) : (topic.learning_objectives || topic.learningObjectives || []),
              keyPoints: typeof topic.key_points === 'string' ? JSON.parse(topic.key_points) : (topic.key_points || topic.keyPoints || []),
              clinicalPearls: typeof topic.clinical_pearls === 'string' ? JSON.parse(topic.clinical_pearls) : (topic.clinical_pearls || topic.clinicalPearls || []),
              questions: typeof topic.questions === 'string' ? JSON.parse(topic.questions) : (topic.questions || []),
              generatedFrom: typeof topic.generated_from === 'string' ? JSON.parse(topic.generated_from) : (topic.generated_from || topic.generatedFrom || {}),
              weekOf: topic.week_of || topic.weekOf,
              estimatedDuration: topic.estimated_duration || topic.estimatedDuration || 30,
            };
            const existing = await db.cmeTopics.get(topic.id);
            if (existing) {
              await db.cmeTopics.update(topic.id, parsed);
            } else {
              await db.cmeTopics.add(parsed);
            }
          } catch (e) {
            console.warn('Error syncing CME topic to local:', e);
          }
        }
        return response;
      }
    } catch (error) {
      console.warn('Failed to pull CME topics from server:', error);
    }
    return [];
  }

  /**
   * Generate weekly CME topic based on clinical data from the application
   */
  async generateWeeklyTopic(): Promise<CMETopic> {
    // Gather clinical data from the last week
    const clinicalData = await this.gatherRecentClinicalData();
    
    // Generate topic using AI
    const topic = await aiService.generateWeeklyCMETopic(clinicalData);
    
    // Store in database
    await this.storeCMETopic(topic);

    // Push to server for cross-device sync
    await this.pushToServer('cme_topics', topic.id, {
      ...topic,
      learning_objectives: topic.learningObjectives,
      key_points: topic.keyPoints,
      clinical_pearls: topic.clinicalPearls,
      generated_from: topic.generatedFrom,
      week_of: topic.weekOf,
      estimated_duration: topic.estimatedDuration,
    });

    return topic;
  }

  /**
   * Get all available CME topics
   */
  async getAllTopics(): Promise<CMETopic[]> {
    try {
      // Try server first for cross-device sync
      await this.pullTopicsFromServer();
    } catch (error) {
      console.warn('Server pull failed for CME topics, using local:', error);
    }
    try {
      return await db.cmeTopics.orderBy('weekOf').reverse().toArray();
    } catch (error) {
      console.error('Error fetching CME topics:', error);
      return [];
    }
  }

  /**
   * Get a specific CME topic by ID
   */
  async getTopic(topicId: string): Promise<CMETopic | undefined> {
    try {
      await this.pullTopicsFromServer();
    } catch (error) {
      console.warn('Server pull failed for CME topic, using local:', error);
    }
    try {
      return await db.cmeTopics.get(topicId);
    } catch (error) {
      console.error('Error fetching CME topic:', error);
      return undefined;
    }
  }

  /**
   * Start a test session for a CME topic
   */
  async startTestSession(userId: string, topicId: string): Promise<TestSession> {
    const topic = await this.getTopic(topicId);
    if (!topic) {
      throw new Error('CME topic not found');
    }

    const session: TestSession = {
      id: this.generateId(),
      userId,
      topicId,
      questions: topic.questions,
      answers: {},
      startedAt: new Date(),
      timeSpent: 0,
      passed: false,
      certificateEligible: false
    };

    await db.testSessions.add(session);

    // Push to server for cross-device sync
    await this.pushToServer('cme_test_sessions', session.id, {
      ...session,
      user_id: session.userId,
      topic_id: session.topicId,
      started_at: session.startedAt,
      time_spent: session.timeSpent,
      certificate_eligible: session.certificateEligible,
    });

    return session;
  }

  /**
   * Submit answers for a test session
   */
  async submitTestSession(
    sessionId: string, 
    answers: Record<string, number>
  ): Promise<TestSession> {
    const session = await db.testSessions.get(sessionId);
    if (!session) {
      throw new Error('Test session not found');
    }

    // Calculate score
    const { score, passed } = this.calculateScore(session.questions, answers);
    
    const updatedSession: TestSession = {
      ...session,
      answers,
      score,
      completedAt: new Date(),
      timeSpent: Math.floor((new Date().getTime() - session.startedAt.getTime()) / 1000 / 60),
      passed,
      certificateEligible: passed && score >= 80 // 80% threshold for certificate
    };

    await db.testSessions.put(updatedSession);

    // Push updated session to server
    await this.pushToServer('cme_test_sessions', updatedSession.id, {
      ...updatedSession,
      user_id: updatedSession.userId,
      topic_id: updatedSession.topicId,
      started_at: updatedSession.startedAt,
      completed_at: updatedSession.completedAt,
      time_spent: updatedSession.timeSpent,
      certificate_eligible: updatedSession.certificateEligible,
    });

    // Update progress
    await this.updateProgress(session.userId, session.topicId, updatedSession);

    // Generate certificate if eligible
    if (updatedSession.certificateEligible) {
      await this.generateCertificate(updatedSession);
    }

    return updatedSession;
  }

  /**
   * Get user's CME progress
   */
  async getUserProgress(userId: string): Promise<CMEProgress[]> {
    try {
      // Pull progress from server
      const response = await apiClient.get('/sync/cme-progress');
      if (Array.isArray(response)) {
        for (const prog of response) {
          try {
            const parsed = {
              userId: prog.user_id || prog.userId,
              topicId: prog.topic_id || prog.topicId,
              completed: prog.completed,
              score: prog.score,
              timeSpent: prog.time_spent || prog.timeSpent || 0,
              attempts: prog.attempts || 0,
              lastAttempt: new Date(prog.last_attempt || prog.lastAttempt || prog.updated_at),
              certificateEarned: prog.certificate_earned || prog.certificateEarned || false,
            };
            const existing = await db.cmeProgress
              .where(['userId', 'topicId'])
              .equals([parsed.userId, parsed.topicId])
              .first();
            if (existing) {
              await db.cmeProgress.put({ ...existing, ...parsed });
            } else {
              await db.cmeProgress.add(parsed);
            }
          } catch (e) {
            console.warn('Error syncing CME progress to local:', e);
          }
        }
      }
    } catch (error) {
      console.warn('Server pull failed for CME progress, using local:', error);
    }
    try {
      return await db.cmeProgress.where('userId').equals(userId).toArray();
    } catch (error) {
      console.error('Error fetching user progress:', error);
      return [];
    }
  }

  /**
   * Get user's certificates
   */
  async getUserCertificates(userId: string): Promise<CMECertificate[]> {
    try {
      // Pull certificates from server
      const response = await apiClient.get('/sync/cme-certificates');
      if (Array.isArray(response)) {
        for (const cert of response) {
          try {
            const parsed = {
              id: cert.id,
              userId: cert.user_id || cert.userId,
              topicId: cert.topic_id || cert.topicId,
              issuedAt: new Date(cert.issued_at || cert.issuedAt),
              validUntil: new Date(cert.valid_until || cert.validUntil),
              score: cert.score,
              creditsEarned: cert.credits_earned || cert.creditsEarned || 1.0,
            };
            const existing = await db.cmeCertificates.get(cert.id);
            if (existing) {
              await db.cmeCertificates.update(cert.id, parsed);
            } else {
              await db.cmeCertificates.add(parsed);
            }
          } catch (e) {
            console.warn('Error syncing CME certificate to local:', e);
          }
        }
      }
    } catch (error) {
      console.warn('Server pull failed for CME certificates, using local:', error);
    }
    try {
      const certificates = await db.cmeCertificates
        .where('userId')
        .equals(userId)
        .toArray();
      return certificates.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
    } catch (error) {
      console.error('Error fetching user certificates:', error);
      return [];
    }
  }

  /**
   * Get study recommendations for a user
   */
  async getStudyRecommendations(userId: string): Promise<string[]> {
    const progress = await this.getUserProgress(userId);
    const recentScores = progress
      .filter(p => p.score !== undefined)
      .slice(-5)
      .map(p => p.score!);

    const weakAreas = await this.identifyWeakAreas(userId);
    
    return await aiService.generateStudyRecommendations(userId, recentScores, weakAreas);
  }

  /**
   * Check if new weekly topic should be generated
   */
  async shouldGenerateWeeklyTopic(): Promise<boolean> {
    const currentWeek = this.getCurrentWeek();
    const existingTopic = await db.cmeTopics
      .where('weekOf')
      .equals(currentWeek)
      .first();
    
    return !existingTopic;
  }

  /**
   * Initialize with demo data
   */
  async initializeDemoData(): Promise<void> {
    try {
      // Check if we already have demo data
      const existingTopics = await db.cmeTopics.count();
      if (existingTopics > 0) {
        return; // Demo data already exists
      }

      // Create demo clinical data
      const demoClinicalData: ClinicalData = {
        diagnoses: [
          'Facial laceration with nerve involvement',
          'Breast augmentation consultation', 
          'Carpal tunnel syndrome',
          'Burn injury second degree',
          'Rhinoplasty revision'
        ],
        procedures: [
          'Complex facial repair',
          'Breast augmentation with silicone implants',
          'Carpal tunnel release',
          'Skin graft application',
          'Revision rhinoplasty'
        ],
        labFindings: [
          'Elevated CRP indicating inflammation',
          'Normal coagulation studies pre-surgery',
          'Positive wound culture - Staph aureus',
          'Low albumin suggesting malnutrition',
          'Normal renal function pre-anesthesia'
        ],
        medications: [
          'Augmentin for post-operative infection',
          'Tramadol for pain management',
          'Bacitracin topical antibiotic',
          'Prednisone for inflammation',
          'Lorazepam pre-operative anxiety'
        ],
        complications: [
          'Post-operative hematoma',
          'Delayed wound healing',
          'Capsular contracture'
        ]
      };

      // Create demo topics without AI if not configured
      const demoTopics = await this.createDemoTopics(demoClinicalData);
      
      for (const topic of demoTopics) {
        await db.cmeTopics.add(topic);
      }

      console.log('Demo CME data initialized successfully');
    } catch (error) {
      console.error('Error initializing demo data:', error);
    }
  }

  private async gatherRecentClinicalData(): Promise<ClinicalData> {
    try {
      // Get data from the last 7 days
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      // Gather diagnoses from recent patients
      const recentPatients = await db.patients
        .where('created_at')
        .above(lastWeek)
        .toArray();

      // Gather procedures from recent treatment plans
      const recentPlans = await db.treatment_plans
        .where('created_at')
        .above(lastWeek)
        .toArray();

      // Extract clinical data
      const diagnoses = recentPatients
        .map(p => p.first_name + ' ' + p.last_name) // Using name as example since diagnosis not in Patient model
        .filter(d => d)
        .slice(0, 10);

      const procedures = recentPlans
        .map((p: any) => p.title) // Using plan title as procedure
        .filter(title => title)
        .slice(0, 10);

      // Mock lab findings and medications for demo
      const labFindings = [
        'Elevated white blood cell count',
        'Normal coagulation studies',
        'Low hemoglobin levels',
        'Positive bacterial culture',
        'Normal liver function tests'
      ];

      const medications = [
        'Antibiotics for infection prevention',
        'Pain management protocols',
        'Anti-inflammatory medications',
        'Wound care products',
        'Anesthetic agents'
      ];

      return {
        diagnoses: diagnoses.length > 0 ? diagnoses : ['Facial reconstruction', 'Breast surgery', 'Hand surgery'],
        procedures: procedures.length > 0 ? procedures : ['Skin graft', 'Tissue expansion', 'Microsurgery'],
        labFindings,
        medications,
        complications: ['Post-operative complications', 'Wound healing delays', 'Infection management']
      };
    } catch (error) {
      console.error('Error gathering clinical data:', error);
      // Return fallback data
      return {
        diagnoses: ['General plastic surgery consultation'],
        procedures: ['Standard plastic surgery procedures'],
        labFindings: ['Routine laboratory studies'],
        medications: ['Standard post-operative care'],
        complications: ['General complications management']
      };
    }
  }

  private async storeCMETopic(topic: CMETopic): Promise<void> {
    try {
      await db.cmeTopics.add(topic);
      // Push to server
      await this.pushToServer('cme_topics', topic.id, {
        ...topic,
        learning_objectives: topic.learningObjectives,
        key_points: topic.keyPoints,
        clinical_pearls: topic.clinicalPearls,
        generated_from: topic.generatedFrom,
        week_of: topic.weekOf,
        estimated_duration: topic.estimatedDuration,
      });
    } catch (error) {
      console.error('Error storing CME topic:', error);
      throw error;
    }
  }

  private calculateScore(questions: CMEQuestion[], answers: Record<string, number>): { score: number; passed: boolean } {
    let correctAnswers = 0;
    const totalQuestions = questions.length;

    questions.forEach(question => {
      const userAnswer = answers[question.id];
      if (userAnswer === question.correctAnswer) {
        correctAnswers++;
      }
    });

    const score = Math.round((correctAnswers / totalQuestions) * 100);
    const passed = score >= 70; // 70% passing threshold

    return { score, passed };
  }

  private async updateProgress(userId: string, topicId: string, session: TestSession): Promise<void> {
    try {
      const existingProgress = await db.cmeProgress
        .where(['userId', 'topicId'])
        .equals([userId, topicId])
        .first();

      const progress: CMEProgress = {
        userId,
        topicId,
        completed: !!session.completedAt,
        score: session.score,
        timeSpent: session.timeSpent,
        attempts: existingProgress ? existingProgress.attempts + 1 : 1,
        lastAttempt: new Date(),
        certificateEarned: session.certificateEligible
      };

      if (existingProgress) {
        await db.cmeProgress.put({ ...existingProgress, ...progress });
      } else {
        await db.cmeProgress.add(progress);
      }

      // Push progress to server
      await this.pushToServer('cme_progress', `${userId}_${topicId}`, {
        user_id: userId,
        topic_id: topicId,
        completed: progress.completed,
        score: progress.score,
        time_spent: progress.timeSpent,
        attempts: progress.attempts,
        last_attempt: progress.lastAttempt,
        certificate_earned: progress.certificateEarned,
      });
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  }

  private async generateCertificate(session: TestSession): Promise<void> {
    try {
      const certificate: CMECertificate = {
        id: this.generateId(),
        userId: session.userId,
        topicId: session.topicId,
        issuedAt: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Valid for 1 year
        score: session.score!,
        creditsEarned: 1.0 // 1 CME credit per topic
      };

      await db.cmeCertificates.add(certificate);

      // Push certificate to server
      await this.pushToServer('cme_certificates', certificate.id, {
        ...certificate,
        user_id: certificate.userId,
        topic_id: certificate.topicId,
        issued_at: certificate.issuedAt,
        valid_until: certificate.validUntil,
        credits_earned: certificate.creditsEarned,
      });
    } catch (error) {
      console.error('Error generating certificate:', error);
    }
  }

  private async identifyWeakAreas(userId: string): Promise<string[]> {
    try {
      const sessions = await db.testSessions
        .where('userId')
        .equals(userId)
        .toArray();

      const weakAreas: string[] = [];
      
      sessions.forEach(session => {
        session.questions.forEach(question => {
          const userAnswer = session.answers[question.id];
          if (userAnswer !== question.correctAnswer) {
            weakAreas.push(question.category);
          }
        });
      });

      // Return unique weak areas
      return [...new Set(weakAreas)];
    } catch (error) {
      console.error('Error identifying weak areas:', error);
      return [];
    }
  }

  private async createDemoTopics(clinicalData: ClinicalData): Promise<CMETopic[]> {
    const topics: CMETopic[] = [
      {
        id: this.generateId(),
        title: "Facial Trauma Management in Plastic Surgery",
        category: "Emergency Procedures",
        description: "Comprehensive approach to managing facial trauma including assessment, surgical planning, and reconstruction techniques.",
        learningObjectives: [
          "Understand the systematic approach to facial trauma assessment",
          "Learn prioritization of injuries in polytrauma patients",
          "Master surgical techniques for facial reconstruction",
          "Recognize complications and their management"
        ],
        content: `# Facial Trauma Management in Plastic Surgery

## Introduction
Facial trauma represents one of the most challenging aspects of plastic surgery, requiring immediate assessment, careful planning, and precise execution of reconstructive techniques.

## Assessment Protocol
### Primary Survey
- Airway assessment and management
- Cervical spine protection
- Hemorrhage control
- Neurological status

### Secondary Survey
- Systematic examination of facial structures
- Documentation of injuries
- Photographic documentation
- Radiological assessment

## Surgical Planning
### Timing Considerations
- Immediate vs. delayed repair
- Patient stability factors
- Soft tissue condition
- Available resources

### Reconstructive Principles
- Anatomical restoration
- Functional preservation
- Aesthetic considerations
- Long-term outcomes

## Common Procedures
### Facial Laceration Repair
- Wound irrigation and debridement
- Layer-by-layer closure
- Nerve repair considerations
- Scar minimization techniques

### Orbital Fracture Management
- Assessment of visual function
- Surgical indications
- Approach selection
- Implant considerations

## Complications
### Early Complications
- Bleeding and hematoma
- Infection
- Nerve injury
- Aesthetic concerns

### Late Complications
- Scarring and contracture
- Functional deficits
- Secondary deformities
- Patient satisfaction issues

## Key Clinical Pearls
- Always prioritize function over form
- Document everything thoroughly
- Consider psychological impact
- Plan for revision procedures
- Multidisciplinary approach is essential`,
        keyPoints: [
          "Systematic assessment prevents missed injuries",
          "Timing of repair affects outcomes significantly", 
          "Layer-by-layer closure ensures optimal healing",
          "Nerve repair should be considered in all cases",
          "Documentation is crucial for medicolegal reasons"
        ],
        clinicalPearls: [
          "Use loupe magnification for precise repair",
          "Consider botulinum toxin to reduce tension on repairs",
          "Always test facial nerve function before local anesthesia",
          "Photograph from multiple angles before and after repair",
          "Involve ophthalmology early for orbital injuries"
        ],
        questions: [
          {
            id: this.generateId(),
            question: "What is the most important initial step in managing a patient with facial trauma?",
            options: [
              "Immediate facial reconstruction",
              "Detailed photographic documentation", 
              "Airway assessment and management",
              "Pain control administration"
            ],
            correctAnswer: 2,
            explanation: "Airway assessment and management is the most critical initial step as facial trauma can compromise the airway through direct injury, swelling, or bleeding. This follows ATLS protocols where airway takes priority in trauma management.",
            category: "Emergency Management",
            difficulty: "beginner",
            points: 2,
            tags: ["trauma", "emergency", "airway"]
          },
          {
            id: this.generateId(),
            question: "A 25-year-old patient presents with a through-and-through cheek laceration involving the buccal branch of the facial nerve. What is the most appropriate management?",
            options: [
              "Primary closure without nerve repair",
              "Immediate microsurgical nerve repair with primary closure",
              "Delayed nerve repair after swelling subsides",
              "Observation with delayed reconstruction if needed"
            ],
            correctAnswer: 1,
            explanation: "Immediate microsurgical nerve repair with primary closure is preferred when facial nerve branches are completely transected. Early repair (within 72 hours) provides the best functional outcomes. The buccal branch controls mouth movement and should be repaired to prevent permanent facial asymmetry.",
            category: "Nerve Repair",
            difficulty: "intermediate",
            points: 3,
            tags: ["nerve-repair", "facial-nerve", "microsurgery"]
          }
        ],
        generatedFrom: clinicalData,
        weekOf: this.getCurrentWeek(),
        estimatedDuration: 45
      }
    ];

    return topics;
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private getCurrentWeek(): string {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + 1) / 7);
    return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
  }
}

export const cmeService = new CMEService();