import { db } from '../db/database';
import { aiService } from './aiService';
import { notificationService } from './notificationService';

// Interfaces
export interface EducationalTopic {
  id: string;
  title: string;
  category: string;
  description: string;
  targetLevels: ('house_officer' | 'junior_registrar' | 'senior_registrar' | 'consultant')[];
  keywords: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedStudyTime: number; // in minutes
  uploadedBy: string;
  uploadedAt: Date;
  status: 'active' | 'archived';
  weeklyContentGenerated: boolean;
  lastContentGeneratedAt?: Date;
}

export interface WeeklyContent {
  id: string;
  topicId: string;
  weekNumber: number;
  year: number;
  content: string; // AI-generated comprehensive content
  references: WHOReference[];
  learningObjectives: string[];
  keyTakeaways: string[];
  clinicalPearls: string[];
  caseStudies: CaseStudy[];
  generatedAt: Date;
  publishedAt?: Date;
  viewCount: number;
  targetLevels: ('house_officer' | 'junior_registrar' | 'senior_registrar' | 'consultant')[];
}

export interface WHOReference {
  title: string;
  url: string;
  publicationDate: string;
  summary: string;
  relevanceScore: number;
}

export interface CaseStudy {
  title: string;
  scenario: string;
  questions: string[];
  keyPoints: string[];
}

export interface TopicSchedule {
  id: string;
  topicId: string;
  scheduledWeek: Date;
  status: 'scheduled' | 'published' | 'completed';
  notificationsSent: boolean;
  targetLevels: ('house_officer' | 'junior_registrar' | 'senior_registrar' | 'consultant')[];
  createdAt: Date;
}

export interface UserProgress {
  id: string;
  userId: string;
  topicId: string;
  weeklyContentId: string;
  readAt: Date;
  completionPercentage: number;
  timeSpent: number; // in seconds
  mcqTestTaken: boolean;
  mcqScore?: number;
  notes: string;
}

class TopicManagementService {
  // Upload a new topic
  async uploadTopic(topicData: Omit<EducationalTopic, 'id' | 'uploadedAt' | 'status' | 'weeklyContentGenerated'>): Promise<string> {
    const topic: EducationalTopic = {
      ...topicData,
      id: crypto.randomUUID(),
      uploadedAt: new Date(),
      status: 'active',
      weeklyContentGenerated: false
    };

    await db.educational_topics.add(topic);

    // Schedule for next available week
    await this.scheduleTopicForWeek(topic.id, this.getNextAvailableWeek());

    return topic.id;
  }

  // Bulk upload topics
  async bulkUploadTopics(topics: Omit<EducationalTopic, 'id' | 'uploadedAt' | 'status' | 'weeklyContentGenerated'>[]): Promise<string[]> {
    const ids: string[] = [];

    for (const topicData of topics) {
      const id = await this.uploadTopic(topicData);
      ids.push(id);
    }

    return ids;
  }

  // Generate weekly content for a topic using AI and WHO guidelines
  async generateWeeklyContent(topicId: string): Promise<string> {
    const topic = await db.educational_topics.get(topicId);
    if (!topic) throw new Error('Topic not found');

    // Get current week details
    const now = new Date();
    const weekNumber = this.getWeekNumber(now);
    const year = now.getFullYear();

    // Check if content already exists for this week
    const existingContent = await db.weekly_contents
      .where(['topicId', 'weekNumber', 'year'])
      .equals([topicId, weekNumber, year])
      .first();

    if (existingContent) {
      return existingContent.id;
    }

    // Generate AI content with WHO guidelines integration
    const aiContent = await this.generateAIContent(topic);

    const weeklyContent: WeeklyContent = {
      id: crypto.randomUUID(),
      topicId: topic.id,
      weekNumber,
      year,
      content: aiContent.mainContent,
      references: aiContent.whoReferences,
      learningObjectives: aiContent.learningObjectives,
      keyTakeaways: aiContent.keyTakeaways,
      clinicalPearls: aiContent.clinicalPearls,
      caseStudies: aiContent.caseStudies,
      generatedAt: new Date(),
      publishedAt: new Date(),
      viewCount: 0,
      targetLevels: topic.targetLevels
    };

    await db.weekly_contents.add(weeklyContent);

    // Update topic
    await db.educational_topics.update(topicId, {
      weeklyContentGenerated: true,
      lastContentGeneratedAt: new Date()
    });

    // Send notifications to all users in target levels
    await this.sendWeeklyContentNotifications(weeklyContent, topic);

    // Schedule MCQ generation for this topic
    await this.scheduleMCQGeneration(topicId, weeklyContent.id);

    return weeklyContent.id;
  }

  // Generate AI content with WHO guidelines
  private async generateAIContent(topic: EducationalTopic): Promise<{
    mainContent: string;
    whoReferences: WHOReference[];
    learningObjectives: string[];
    keyTakeaways: string[];
    clinicalPearls: string[];
    caseStudies: CaseStudy[];
  }> {
    // Construct comprehensive prompt for AI
    const prompt = `Generate comprehensive educational content for plastic surgery topic: "${topic.title}"

Category: ${topic.category}
Difficulty Level: ${topic.difficulty}
Target Audience: ${topic.targetLevels.join(', ')}
Keywords: ${topic.keywords.join(', ')}
Description: ${topic.description}

Please create detailed educational content that includes:

1. COMPREHENSIVE OVERVIEW (500-800 words)
   - Current best practices based on WHO guidelines
   - Evidence-based recommendations
   - International standards and protocols
   - Recent advances and updates

2. LEARNING OBJECTIVES (5-7 specific, measurable objectives)
   - What learners should know after studying this content
   - Skills they should be able to demonstrate

3. KEY TAKEAWAYS (8-10 critical points)
   - Essential information for clinical practice
   - Safety considerations
   - Patient care priorities

4. CLINICAL PEARLS (6-8 practical tips)
   - Expert insights and techniques
   - Common pitfalls to avoid
   - Time-saving strategies

5. CASE STUDIES (2-3 realistic scenarios)
   - Patient presentations
   - Clinical decision-making questions
   - Key teaching points

6. WHO/INTERNATIONAL REFERENCES
   - Cite relevant WHO guidelines
   - International best practice publications
   - Recent evidence-based studies

Format the response as JSON with sections: mainContent, learningObjectives, keyTakeaways, clinicalPearls, caseStudies, whoReferences`;

    try {
      const aiResponse = await aiService.generateResponse(prompt);
      
      // Parse AI response
      let parsedContent;
      try {
        parsedContent = JSON.parse(aiResponse);
      } catch {
        // Fallback parsing if not JSON
        parsedContent = this.parseNonJSONResponse(aiResponse, topic);
      }

      // Fetch WHO references (simulated - in production, integrate with WHO API/database)
      const whoReferences = await this.fetchWHOReferences(topic);

      return {
        mainContent: parsedContent.mainContent || aiResponse,
        whoReferences: parsedContent.whoReferences || whoReferences,
        learningObjectives: parsedContent.learningObjectives || this.extractSection(aiResponse, 'objectives'),
        keyTakeaways: parsedContent.keyTakeaways || this.extractSection(aiResponse, 'takeaways'),
        clinicalPearls: parsedContent.clinicalPearls || this.extractSection(aiResponse, 'pearls'),
        caseStudies: parsedContent.caseStudies || this.extractCaseStudies(aiResponse)
      };
    } catch (error) {
      console.error('Error generating AI content:', error);
      
      // Fallback to template-based content
      return this.generateFallbackContent(topic);
    }
  }

  // Fetch WHO references (simulated - replace with actual WHO API integration)
  private async fetchWHOReferences(topic: EducationalTopic): Promise<WHOReference[]> {
    // Simulated WHO references based on topic category
    const referenceDatabase: Record<string, WHOReference[]> = {
      burn_care: [
        {
          title: 'WHO Burns Prevention and Care Guidelines',
          url: 'https://www.who.int/publications/i/item/9789241549882',
          publicationDate: '2018-03-15',
          summary: 'Comprehensive guidelines for burn prevention, acute care, and rehabilitation.',
          relevanceScore: 0.95
        }
      ],
      wound_care: [
        {
          title: 'WHO Guidelines on Hand Hygiene in Health Care',
          url: 'https://www.who.int/publications/i/item/9789241597906',
          publicationDate: '2009-10-01',
          summary: 'Essential infection prevention practices for wound care.',
          relevanceScore: 0.88
        }
      ],
      // Add more categories as needed
    };

    const references = referenceDatabase[topic.category] || [
      {
        title: `WHO Surgical Care Guidelines - ${topic.category}`,
        url: 'https://www.who.int/health-topics/surgery',
        publicationDate: new Date().toISOString().split('T')[0],
        summary: 'International best practices and evidence-based recommendations.',
        relevanceScore: 0.85
      }
    ];

    return references;
  }

  // Parse non-JSON AI response
  private parseNonJSONResponse(response: string, topic: EducationalTopic): any {
    return {
      mainContent: response,
      learningObjectives: this.extractSection(response, 'objectives'),
      keyTakeaways: this.extractSection(response, 'takeaways'),
      clinicalPearls: this.extractSection(response, 'pearls'),
      caseStudies: this.extractCaseStudies(response),
      whoReferences: []
    };
  }

  // Extract sections from text
  private extractSection(text: string, sectionType: string): string[] {
    const items: string[] = [];
    const lines = text.split('\n');
    
    let inSection = false;
    for (const line of lines) {
      const lower = line.toLowerCase();
      
      if (lower.includes(sectionType) || lower.includes('objective') || lower.includes('takeaway') || lower.includes('pearl')) {
        inSection = true;
        continue;
      }
      
      if (inSection && line.trim()) {
        if (line.match(/^\d+\.|^-|^•/)) {
          items.push(line.replace(/^\d+\.|^-|^•/, '').trim());
        } else if (line.match(/^[A-Z]/)) {
          inSection = false;
        }
      }
    }
    
    return items.length > 0 ? items : [
      'Understand core concepts and principles',
      'Apply evidence-based practices',
      'Demonstrate clinical competency'
    ];
  }

  // Extract case studies from text
  private extractCaseStudies(text: string): CaseStudy[] {
    // Simplified extraction - in production, use more sophisticated NLP
    return [
      {
        title: 'Clinical Scenario 1',
        scenario: 'Patient presentation and management challenge',
        questions: ['What is the diagnosis?', 'What is the treatment plan?'],
        keyPoints: ['Evidence-based approach', 'Patient safety priorities']
      }
    ];
  }

  // Generate fallback content if AI fails
  private generateFallbackContent(topic: EducationalTopic): any {
    return {
      mainContent: `# ${topic.title}\n\n${topic.description}\n\nThis topic covers essential aspects of ${topic.category} with focus on evidence-based practices and international standards.`,
      whoReferences: [],
      learningObjectives: [
        'Understand fundamental principles',
        'Apply evidence-based practices',
        'Demonstrate clinical competency',
        'Follow international guidelines'
      ],
      keyTakeaways: [
        'Patient safety is paramount',
        'Evidence-based decision making',
        'Follow WHO guidelines',
        'Continuous learning essential'
      ],
      clinicalPearls: [
        'Always prioritize patient safety',
        'Document thoroughly',
        'Consult when uncertain'
      ],
      caseStudies: []
    };
  }

  // Send notifications for new weekly content
  private async sendWeeklyContentNotifications(content: WeeklyContent, topic: EducationalTopic): Promise<void> {
    const users = await db.users.toArray();
    
    const targetUsers = users.filter(user => 
      content.targetLevels.includes(user.role as any)
    );

    for (const user of targetUsers) {
      // Store notification data in the notification payload data field
      await notificationService.scheduleLocalNotification({
        type: 'info',
        title: '📚 New Educational Content Available',
        message: `New study material: "${topic.title}" - ${topic.estimatedStudyTime}min read`,
        scheduledFor: new Date(),
        url: `/education?topicId=${topic.id}&contentId=${content.id}`
      });
    }
  }

  // Schedule MCQ generation for a topic
  private async scheduleMCQGeneration(topicId: string, weeklyContentId: string): Promise<void> {
    // This will trigger MCQ generation in mcqGenerationService
    // Integration point with existing MCQ system
    console.log(`MCQ generation scheduled for topic ${topicId}, content ${weeklyContentId}`);
  }

  // Schedule topic for a specific week
  async scheduleTopicForWeek(topicId: string, weekDate: Date): Promise<string> {
    const topic = await db.educational_topics.get(topicId);
    if (!topic) throw new Error('Topic not found');

    const schedule: TopicSchedule = {
      id: crypto.randomUUID(),
      topicId,
      scheduledWeek: weekDate,
      status: 'scheduled',
      notificationsSent: false,
      targetLevels: topic.targetLevels,
      createdAt: new Date()
    };

    await db.topic_schedules.add(schedule);
    return schedule.id;
  }

  // Get next available week for scheduling
  private getNextAvailableWeek(): Date {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    // Set to next Monday
    while (nextWeek.getDay() !== 1) {
      nextWeek.setDate(nextWeek.getDate() + 1);
    }
    return nextWeek;
  }

  // Get week number
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  // Track user progress
  async trackUserProgress(progressData: Omit<UserProgress, 'id' | 'readAt'>): Promise<string> {
    const progress: UserProgress = {
      ...progressData,
      id: crypto.randomUUID(),
      readAt: new Date()
    };

    await db.user_progress.add(progress);
    return progress.id;
  }

  // Get all topics
  async getAllTopics(): Promise<EducationalTopic[]> {
    return await db.educational_topics.where('status').equals('active').toArray();
  }

  // Get recent weekly content
  async getRecentWeeklyContent(limit: number = 10): Promise<WeeklyContent[]> {
    return await db.weekly_contents
      .orderBy('publishedAt')
      .reverse()
      .limit(limit)
      .toArray();
  }

  // Get upcoming schedules
  async getUpcomingSchedules(): Promise<TopicSchedule[]> {
    const today = new Date();
    return await db.topic_schedules
      .where('scheduledWeek')
      .aboveOrEqual(today)
      .toArray();
  }

  // Get user's progress for a topic
  async getUserProgress(userId: string, topicId: string): Promise<UserProgress[]> {
    return await db.user_progress
      .where(['userId', 'topicId'])
      .equals([userId, topicId])
      .toArray();
  }

  // Get performance analytics by cadre
  async getCadrePerformanceAnalytics(cadre: 'intern' | 'registrar' | 'consultant'): Promise<{
    totalUsers: number;
    averageScore: number;
    completionRate: number;
    topPerformers: any[];
    weakAreas: string[];
  }> {
    const users = await db.users.where('role').equals(cadre).toArray();
    const allProgress = await db.user_progress.toArray();
    
    const cadreProgress = allProgress.filter(p => 
      users.some(u => u.id === p.userId)
    );

    const totalUsers = users.length;
    const averageScore = cadreProgress
      .filter(p => p.mcqScore !== undefined)
      .reduce((sum, p) => sum + (p.mcqScore || 0), 0) / (cadreProgress.length || 1);
    
    const completionRate = (cadreProgress.filter(p => p.completionPercentage === 100).length / cadreProgress.length) * 100;

    return {
      totalUsers,
      averageScore,
      completionRate,
      topPerformers: [],
      weakAreas: []
    };
  }

  // Process weekly automation (run every Monday)
  async processWeeklyAutomation(): Promise<void> {
    const today = new Date();
    const currentWeek = this.getWeekNumber(today);
    const currentYear = today.getFullYear();

    // Get scheduled topics for this week
    const scheduledTopics = await db.topic_schedules
      .where('status')
      .equals('scheduled')
      .toArray();

    for (const schedule of scheduledTopics) {
      const scheduleWeek = this.getWeekNumber(schedule.scheduledWeek);
      
      if (scheduleWeek === currentWeek && schedule.scheduledWeek.getFullYear() === currentYear) {
        // Generate content for this topic
        await this.generateWeeklyContent(schedule.topicId);
        
        // Update schedule status
        await db.topic_schedules.update(schedule.id, {
          status: 'published',
          notificationsSent: true
        });
      }
    }
  }
}

export const topicManagementService = new TopicManagementService();
