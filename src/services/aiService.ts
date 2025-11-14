import OpenAI from 'openai';

// Types for medical education content
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

export interface CMEQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  points: number;
  tags: string[];
  references?: string[];
}

export interface CMETopic {
  id: string;
  title: string;
  category: string;
  description: string;
  learningObjectives: string[];
  content: string;
  keyPoints: string[];
  clinicalPearls: string[];
  questions: CMEQuestion[];
  generatedFrom: {
    diagnoses: string[];
    procedures: string[];
    labFindings: string[];
  };
  weekOf: string;
  estimatedDuration: number; // minutes
}

export interface TestSession {
  id: string;
  userId: string;
  topicId: string;
  questions: CMEQuestion[];
  answers: Record<string, number>;
  score?: number;
  startedAt: Date;
  completedAt?: Date;
  timeSpent: number; // minutes
  passed: boolean;
  certificateEligible: boolean;
}

export interface ClinicalData {
  diagnoses: string[];
  procedures: string[];
  labFindings: string[];
  medications: string[];
  complications: string[];
}

class AIService {
  private openai: OpenAI;
  private isConfigured: boolean = false;

  constructor() {
    const apiKey = this.getApiKey();
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true // Note: In production, use a backend proxy
      });
      this.isConfigured = true;
    } else {
      // Silently disable AI features - no warning needed
      this.isConfigured = false;
    }
  }

  private getApiKey(): string | null {
    // Try multiple sources for API key
    return (
      localStorage.getItem('openai_api_key') ||
      null
    );
  }

  public setApiKey(apiKey: string): void {
    localStorage.setItem('openai_api_key', apiKey);
    this.openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });
    this.isConfigured = true;
  }

  public isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Generate weekly CME topics based on clinical data from the application
   */
  async generateWeeklyCMETopic(clinicalData: ClinicalData): Promise<CMETopic> {
    if (!this.isConfigured) {
      throw new Error('AI service not configured. Please set OpenAI API key.');
    }

    const prompt = this.buildCMETopicPrompt(clinicalData);
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an expert medical educator specializing in plastic surgery. 
            Generate comprehensive continuing medical education content based on real clinical data. 
            Focus on practical, evidence-based learning that enhances clinical practice.
            
            Respond with a valid JSON object only, following this exact structure:
            {
              "title": "string",
              "category": "string",
              "description": "string", 
              "learningObjectives": ["string"],
              "content": "detailed educational content in markdown",
              "keyPoints": ["string"],
              "clinicalPearls": ["string"]
            }`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response
      const topicData = JSON.parse(response);
      
      // Generate questions for this topic
      const questions = await this.generateCMEQuestions(topicData.title, topicData.content, 5);

      const topic: CMETopic = {
        id: this.generateId(),
        ...topicData,
        questions,
        generatedFrom: {
          diagnoses: clinicalData.diagnoses,
          procedures: clinicalData.procedures,
          labFindings: clinicalData.labFindings
        },
        weekOf: this.getCurrentWeek(),
        estimatedDuration: this.estimateDuration(topicData.content, questions.length)
      };

      return topic;
    } catch (error) {
      console.error('Error generating CME topic:', error);
      throw new Error('Failed to generate CME topic. Please try again.');
    }
  }

  /**
   * Generate multiple choice questions for a CME topic
   */
  async generateCMEQuestions(topic: string, content: string, count: number = 5): Promise<CMEQuestion[]> {
    if (!this.isConfigured) {
      throw new Error('AI service not configured');
    }

    const prompt = `
    Based on the following medical education topic and content, generate ${count} multiple choice questions
    that test clinical understanding and practical application.
    
    Topic: ${topic}
    Content: ${content.substring(0, 1500)}...
    
    Requirements:
    - Questions should test clinical reasoning, not just memorization
    - Include case-based scenarios where appropriate
    - Provide clear explanations for correct answers
    - Mix difficulty levels appropriately for plastic surgery residents
    - Include relevant clinical pearls in explanations
    
    Respond with a valid JSON array of question objects, each with this exact structure:
    {
      "question": "string",
      "options": ["option1", "option2", "option3", "option4"],
      "correctAnswer": 0-3,
      "explanation": "detailed explanation with clinical reasoning",
      "category": "string",
      "difficulty": "beginner|intermediate|advanced",
      "points": 1-5,
      "tags": ["tag1", "tag2"]
    }
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a medical education expert creating assessment questions for plastic surgery residents. Generate high-quality, clinically relevant multiple choice questions."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.6,
        max_tokens: 2500
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const questionsData = JSON.parse(response);
      
      return questionsData.map((q: any, index: number) => ({
        id: this.generateId(),
        ...q,
        tags: q.tags || [topic.toLowerCase().replace(/\s+/g, '-')]
      }));
    } catch (error) {
      console.error('Error generating CME questions:', error);
      throw new Error('Failed to generate questions. Please try again.');
    }
  }

  /**
   * Generate personalized study recommendations based on performance
   */
  async generateStudyRecommendations(
    userId: string, 
    recentScores: number[], 
    weakAreas: string[]
  ): Promise<string[]> {
    if (!this.isConfigured) {
      return this.getFallbackRecommendations(weakAreas);
    }

    const prompt = `
    Based on a plastic surgery resident's recent test performance, provide personalized study recommendations.
    
    Recent Scores: ${recentScores.join(', ')}% (average: ${recentScores.reduce((a, b) => a + b, 0) / recentScores.length}%)
    Weak Areas: ${weakAreas.join(', ')}
    
    Provide 5-7 specific, actionable study recommendations that address these weak areas.
    Focus on evidence-based learning resources and practical clinical applications.
    
    Respond with a JSON array of recommendation strings.
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a medical education mentor for plastic surgery residents. Provide specific, helpful study guidance."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 800
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        return this.getFallbackRecommendations(weakAreas);
      }

      return JSON.parse(response);
    } catch (error) {
      console.error('Error generating study recommendations:', error);
      return this.getFallbackRecommendations(weakAreas);
    }
  }

  private buildCMETopicPrompt(clinicalData: ClinicalData): string {
    return `
    Generate a comprehensive continuing medical education topic for plastic surgery residents based on the following clinical data from our application:
    
    Recent Diagnoses: ${clinicalData.diagnoses.join(', ')}
    Recent Procedures: ${clinicalData.procedures.join(', ')}
    Recent Lab Findings: ${clinicalData.labFindings.join(', ')}
    Recent Medications: ${clinicalData.medications.join(', ')}
    
    Create educational content that:
    1. Addresses common patterns in the clinical data
    2. Provides evidence-based learning points
    3. Includes practical clinical applications
    4. Covers safety considerations and best practices
    5. Incorporates recent research and guidelines
    
    The topic should be suitable for plastic surgery residents and take approximately 30-45 minutes to complete.
    Focus on actionable knowledge that improves patient care.
    `;
  }

  private getFallbackRecommendations(weakAreas: string[]): string[] {
    const fallbacks = [
      "Review fundamental plastic surgery principles and anatomy",
      "Practice case-based scenarios related to your weak areas",
      "Study recent literature on " + (weakAreas[0] || "plastic surgery"),
      "Attend virtual conferences or webinars on challenging topics",
      "Discuss difficult cases with senior residents or attendings",
      "Use medical education apps for quick knowledge reinforcement",
      "Create flashcards for key concepts and procedures"
    ];
    return fallbacks.slice(0, 5);
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

  private estimateDuration(content: string, questionCount: number): number {
    // Estimate reading time: ~200 words per minute
    const wordCount = content.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);
    
    // Estimate question time: ~2 minutes per question
    const questionTime = questionCount * 2;
    
    return readingTime + questionTime;
  }

  /**
   * General purpose content generation method for various AI tasks
   */
  async generateContent(prompt: string): Promise<string> {
    if (!this.isConfigured) {
      throw new Error('AI service not configured. Please set OpenAI API key.');
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert medical AI assistant specializing in plastic surgery and laboratory medicine. Provide accurate, evidence-based responses."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      });

      return completion.choices[0]?.message?.content || 'Unable to generate content';
    } catch (error) {
      console.error('Error generating AI content:', error);
      throw new Error('Failed to generate AI content');
    }
  }

  /**
   * Generate response for topic management system with WHO guidelines integration
   */
  async generateResponse(prompt: string): Promise<string> {
    if (!this.isConfigured) {
      throw new Error('AI service not configured. Please set OpenAI API key.');
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an expert medical educator and plastic surgery specialist with comprehensive knowledge of WHO guidelines and international best practices. 
            
            When generating educational content:
            - Base recommendations on WHO guidelines and evidence-based medicine
            - Include specific references to international publications
            - Provide practical, actionable clinical guidance
            - Include safety considerations and patient-centered care principles
            - Format responses as detailed JSON when requested
            - Focus on real-world clinical applications`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 3000,
        temperature: 0.7
      });

      return completion.choices[0]?.message?.content || 'Unable to generate content';
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw new Error('Failed to generate AI response');
    }
  }
}

export const aiService = new AIService();