import { db } from '../db/database';
import { aiService } from './aiService';

// CME Article Interfaces
export interface CMEArticle {
  id: string;
  topic: string;
  category: WACSCategory;
  subcategory: string;
  title: string;
  content: string; // Full HTML article
  summary: string;
  learning_objectives: string[];
  key_points: string[];
  clinical_pearls: string[];
  case_studies?: CaseStudy[];
  references: string[];
  author: 'AI-CME System';
  published_date: Date;
  reading_time_minutes: number;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  related_topics: string[];
  mcq_quiz_id?: string;
  view_count: number;
  like_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface CaseStudy {
  id: string;
  title: string;
  presentation: string;
  clinical_findings: string;
  diagnosis: string;
  management: string;
  outcome: string;
  learning_points: string[];
}

export interface CMEReadingProgress {
  id: string;
  user_id: string;
  article_id: string;
  started_at: Date;
  completed_at?: Date;
  progress_percentage: number;
  time_spent_seconds: number;
  liked: boolean;
  bookmarked: boolean;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export type WACSCategory = 
  | 'part_i_principles'
  | 'part_i_specialty'
  | 'part_ii_general'
  | 'part_ii_plastic';

// WACS Curriculum Topics (from WACS_CME_TOPICS.md)
export const WACS_TOPICS = {
  part_i_principles: [
    { topic: 'Preoperative Patient Assessment', difficulty: 'beginner' as const, week: 1 },
    { topic: 'Fluid and Electrolyte Management', difficulty: 'intermediate' as const, week: 2 },
    { topic: 'Blood Transfusion and Component Therapy', difficulty: 'intermediate' as const, week: 3 },
    { topic: 'Nutritional Support in Surgical Patients', difficulty: 'intermediate' as const, week: 4 },
    { topic: 'Wound Healing Principles', difficulty: 'beginner' as const, week: 5 },
    { topic: 'Surgical Site Infections Prevention', difficulty: 'intermediate' as const, week: 6 },
    { topic: 'Perioperative Care and Monitoring', difficulty: 'intermediate' as const, week: 7 },
    { topic: 'Postoperative Pain Management', difficulty: 'intermediate' as const, week: 8 },
    { topic: 'Basic Trauma Life Support', difficulty: 'advanced' as const, week: 9 },
    { topic: 'Surgical Anatomy Review', difficulty: 'beginner' as const, week: 10 },
    { topic: 'Surgical Ethics and Professionalism', difficulty: 'beginner' as const, week: 11 },
    { topic: 'Communication Skills in Surgery', difficulty: 'beginner' as const, week: 12 }
  ],
  part_i_specialty: [
    { topic: 'Introduction to General Surgery', difficulty: 'beginner' as const, week: 13 },
    { topic: 'Emergency Room Management', difficulty: 'intermediate' as const, week: 14 },
    { topic: 'Basics of Urological Surgery', difficulty: 'beginner' as const, week: 15 },
    { topic: 'Orthopaedic Surgery Fundamentals', difficulty: 'beginner' as const, week: 16 },
    { topic: 'Anaesthesia Basics for Surgeons', difficulty: 'beginner' as const, week: 17 },
    { topic: 'Paediatric Surgical Emergencies', difficulty: 'intermediate' as const, week: 18 },
    { topic: 'Introduction to Plastic Surgery', difficulty: 'beginner' as const, week: 19 }
  ],
  part_ii_general: [
    { topic: 'Advanced Trauma Management', difficulty: 'advanced' as const, week: 20 },
    { topic: 'Surgical Site Infections Management', difficulty: 'advanced' as const, week: 21 },
    { topic: 'Inguinal and Femoral Hernias', difficulty: 'intermediate' as const, week: 22 },
    { topic: 'Upper GI Bleeding Management', difficulty: 'advanced' as const, week: 23 },
    { topic: 'Oesophageal Diseases', difficulty: 'advanced' as const, week: 24 },
    { topic: 'Peptic Ulcer Disease', difficulty: 'intermediate' as const, week: 25 },
    { topic: 'Acute Appendicitis', difficulty: 'intermediate' as const, week: 26 },
    { topic: 'Intestinal Obstruction', difficulty: 'advanced' as const, week: 27 },
    { topic: 'Colorectal Cancer', difficulty: 'advanced' as const, week: 28 },
    { topic: 'Anorectal Disorders', difficulty: 'intermediate' as const, week: 29 },
    { topic: 'Hepatobiliary Surgery', difficulty: 'advanced' as const, week: 30 },
    { topic: 'Thyroid and Parathyroid Surgery', difficulty: 'advanced' as const, week: 31 },
    { topic: 'Breast Cancer Management', difficulty: 'advanced' as const, week: 32 },
    { topic: 'Laparoscopic Surgery Principles', difficulty: 'advanced' as const, week: 33 },
    { topic: 'Surgical Critical Care', difficulty: 'advanced' as const, week: 34 },
    { topic: 'Research Methodology in Surgery', difficulty: 'intermediate' as const, week: 35 }
  ],
  part_ii_plastic: [
    { topic: 'Principles of Wound Healing and Repair', difficulty: 'intermediate' as const, week: 36 },
    { topic: 'Tissue Transfer and Grafts', difficulty: 'advanced' as const, week: 37 },
    { topic: 'Aesthetic Surgery Principles', difficulty: 'advanced' as const, week: 38 },
    { topic: 'Hand Injuries and Reconstruction', difficulty: 'advanced' as const, week: 39 },
    { topic: 'Facial Fractures Management', difficulty: 'advanced' as const, week: 40 },
    { topic: 'Burns Management', difficulty: 'advanced' as const, week: 41 },
    { topic: 'Paediatric Plastic Surgery', difficulty: 'advanced' as const, week: 42 },
    { topic: 'Skin Tumours', difficulty: 'intermediate' as const, week: 43 },
    { topic: 'Head and Neck Reconstruction', difficulty: 'advanced' as const, week: 44 },
    { topic: 'Microsurgery Principles', difficulty: 'advanced' as const, week: 45 },
    { topic: 'Cleft Lip and Palate', difficulty: 'advanced' as const, week: 46 },
    { topic: 'Breast Reconstruction', difficulty: 'advanced' as const, week: 47 },
    { topic: 'Lower Limb Reconstruction', difficulty: 'advanced' as const, week: 48 },
    { topic: 'Pressure Sores Management', difficulty: 'intermediate' as const, week: 49 },
    { topic: 'Genital Reconstruction', difficulty: 'advanced' as const, week: 50 },
    { topic: 'Rhinoplasty', difficulty: 'advanced' as const, week: 51 },
    { topic: 'Body Contouring Surgery', difficulty: 'advanced' as const, week: 52 }
  ]
};

class CMEWACSService {
  // Generate AI-powered CME article
  async generateArticle(topicData: { topic: string; category: WACSCategory; difficulty: 'beginner' | 'intermediate' | 'advanced' }): Promise<CMEArticle> {
    const prompt = this.buildArticlePrompt(topicData);
    
    try {
      const response = await aiService.generateContent(prompt);
      
      // Parse AI response
      const article = this.parseArticleResponse(response, topicData);
      
      // Save to database
      await db.cme_articles.add(article);
      
      return article;
    } catch (error) {
      console.error('Error generating CME article:', error);
      throw error;
    }
  }

  // Build comprehensive prompt for article generation
  private buildArticlePrompt(topicData: { topic: string; category: WACSCategory; difficulty: 'beginner' | 'intermediate' | 'advanced' }): string {
    return `Generate a comprehensive continuing medical education (CME) article for surgical residents preparing for WACS (West African College of Surgeons) examinations.

**Topic**: ${topicData.topic}
**Category**: ${topicData.category.replace(/_/g, ' ').toUpperCase()}
**Difficulty Level**: ${topicData.difficulty}

**Target Audience**: Surgical residents and fellows preparing for WACS Primary (Part I) or Fellowship (Part II) examinations

**Article Structure Required**:

1. **Introduction** (200-300 words)
   - Importance of the topic in surgical practice
   - Relevance to WACS curriculum
   - Learning objectives (3-5 specific objectives)

2. **Applied Anatomy and Physiology** (300-400 words)
   - Relevant anatomical structures
   - Physiological principles
   - Clinical correlation

3. **Clinical Presentation** (300-400 words)
   - Common presentations
   - Differential diagnosis considerations
   - Red flag symptoms

4. **Diagnostic Approach** (300-400 words)
   - History taking key points
   - Physical examination findings
   - Investigations (laboratory, imaging, special tests)
   - Diagnostic algorithms

5. **Management Principles** (400-500 words)
   - Non-operative management
   - Surgical indications
   - Surgical techniques overview
   - Complications and their management

6. **Recent Advances and Current Evidence** (200-300 words)
   - Recent research findings
   - Updated guidelines (WHO, international societies)
   - Evolving surgical techniques

7. **African Context Considerations** (150-200 words)
   - Resource-limited settings adaptations
   - Common challenges in West African practice
   - Local epidemiology

8. **WACS Examination Tips** (150-200 words)
   - Common exam questions format
   - Key points to remember
   - Common pitfalls to avoid

9. **Clinical Case Studies** (2 cases, 200 words each)
   - Realistic clinical scenarios
   - Step-by-step management
   - Learning points from each case

10. **Summary and Key Points** (150-200 words)
    - 5-7 key learning points
    - 5-7 clinical pearls for practice
    - Quick revision points

11. **References**
    - WHO guidelines
    - WACS curriculum references
    - Recent peer-reviewed articles (last 5 years)
    - Standard surgical textbooks

**Writing Style**:
- Professional but accessible
- Evidence-based
- Focus on exam-relevant information
- Include mnemonics where applicable
- Use bullet points for clarity
- Include tables/diagrams descriptions where helpful

**Total Length**: 2500-3000 words

Please generate the article in HTML format with proper headings, paragraphs, lists, and formatting. Include all sections mentioned above.`;
  }

  // Parse AI response into structured article
  private parseArticleResponse(response: string, topicData: any): CMEArticle {
    const id = `cme_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    // Extract learning objectives (look for numbered or bulleted list after "Learning Objectives" or "Objectives")
    const objectivesMatch = response.match(/(?:Learning Objectives?|Objectives?)[\s\S]*?(?:<ul>|<ol>)([\s\S]*?)(?:<\/ul>|<\/ol>)/i);
    const learning_objectives = objectivesMatch 
      ? this.extractListItems(objectivesMatch[1])
      : ['Understand the topic comprehensively', 'Apply knowledge to clinical practice', 'Prepare for WACS examination'];

    // Extract key points (look for "Key Points" or "Summary" section)
    const keyPointsMatch = response.match(/(?:Key Points?|Summary)[\s\S]*?(?:<ul>|<ol>)([\s\S]*?)(?:<\/ul>|<\/ol>)/i);
    const key_points = keyPointsMatch
      ? this.extractListItems(keyPointsMatch[1])
      : ['Comprehensive understanding of the topic', 'Evidence-based management approach', 'Exam-focused content'];

    // Extract clinical pearls
    const pearlsMatch = response.match(/(?:Clinical Pearls?)[\s\S]*?(?:<ul>|<ol>)([\s\S]*?)(?:<\/ul>|<\/ol>)/i);
    const clinical_pearls = pearlsMatch
      ? this.extractListItems(pearlsMatch[1])
      : ['Focus on clinical application', 'Remember common pitfalls', 'Practice makes perfect'];

    // Extract references
    const referencesMatch = response.match(/(?:References?)[\s\S]*?(?:<ul>|<ol>)([\s\S]*?)(?:<\/ul>|<\/ol>)/i);
    const references = referencesMatch
      ? this.extractListItems(referencesMatch[1])
      : ['WACS Curriculum Guidelines', 'WHO Surgical Safety Checklist', 'Standard Surgical Textbooks'];

    // Calculate reading time (approximately 200 words per minute)
    const wordCount = response.split(/\s+/).length;
    const reading_time_minutes = Math.ceil(wordCount / 200);

    // Generate summary (first 300 characters of content)
    const textContent = response.replace(/<[^>]*>/g, '').substring(0, 300);
    const summary = textContent + '...';

    const article: CMEArticle = {
      id,
      topic: topicData.topic,
      category: topicData.category,
      subcategory: this.getSubcategory(topicData.category),
      title: `${topicData.topic} - WACS CME Article`,
      content: response,
      summary,
      learning_objectives,
      key_points,
      clinical_pearls,
      references,
      author: 'AI-CME System',
      published_date: now,
      reading_time_minutes,
      difficulty_level: topicData.difficulty,
      related_topics: this.getRelatedTopics(topicData.topic, topicData.category),
      view_count: 0,
      like_count: 0,
      created_at: now,
      updated_at: now
    };

    return article;
  }

  // Extract list items from HTML
  private extractListItems(html: string): string[] {
    const items: string[] = [];
    const liRegex = /<li>(.*?)<\/li>/gi;
    let match;
    
    while ((match = liRegex.exec(html)) !== null) {
      const text = match[1].replace(/<[^>]*>/g, '').trim();
      if (text) {
        items.push(text);
      }
    }
    
    return items.length > 0 ? items : ['Key learning point'];
  }

  // Get subcategory based on category
  private getSubcategory(category: WACSCategory): string {
    const subcategories = {
      part_i_principles: 'Surgical Principles',
      part_i_specialty: 'Specialty Introduction',
      part_ii_general: 'General Surgery Fellowship',
      part_ii_plastic: 'Plastic Surgery Fellowship'
    };
    return subcategories[category] || 'General';
  }

  // Get related topics
  private getRelatedTopics(currentTopic: string, category: WACSCategory): string[] {
    const allTopics = WACS_TOPICS[category];
    const currentIndex = allTopics.findIndex(t => t.topic === currentTopic);
    
    const related: string[] = [];
    if (currentIndex > 0) {
      related.push(allTopics[currentIndex - 1].topic);
    }
    if (currentIndex < allTopics.length - 1) {
      related.push(allTopics[currentIndex + 1].topic);
    }
    
    return related;
  }

  // Get all articles
  async getAllArticles(): Promise<CMEArticle[]> {
    return await db.cme_articles.orderBy('published_date').reverse().toArray();
  }

  // Get articles by category
  async getArticlesByCategory(category: WACSCategory): Promise<CMEArticle[]> {
    return await db.cme_articles.where('category').equals(category).reverse().sortBy('published_date');
  }

  // Get article by ID
  async getArticleById(id: string): Promise<CMEArticle | undefined> {
    return await db.cme_articles.get(id);
  }

  // Increment view count
  async incrementViewCount(articleId: string): Promise<void> {
    const article = await db.cme_articles.get(articleId);
    if (article) {
      await db.cme_articles.update(articleId, {
        view_count: article.view_count + 1,
        updated_at: new Date()
      });
    }
  }

  // Increment like count
  async incrementLikeCount(articleId: string): Promise<void> {
    const article = await db.cme_articles.get(articleId);
    if (article) {
      await db.cme_articles.update(articleId, {
        like_count: article.like_count + 1,
        updated_at: new Date()
      });
    }
  }

  // Track reading progress
  async updateReadingProgress(progress: Omit<CMEReadingProgress, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const existing = await db.cme_reading_progress
      .where('[user_id+article_id]')
      .equals([progress.user_id, progress.article_id])
      .first();

    const now = new Date();

    if (existing) {
      await db.cme_reading_progress.update(existing.id, {
        ...progress,
        updated_at: now
      });
      return existing.id;
    } else {
      const id = `progress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newProgress: CMEReadingProgress = {
        ...progress,
        id,
        created_at: now,
        updated_at: now
      };
      await db.cme_reading_progress.add(newProgress);
      return id;
    }
  }

  // Get user's reading progress for an article
  async getReadingProgress(userId: string, articleId: string): Promise<CMEReadingProgress | undefined> {
    return await db.cme_reading_progress
      .where('[user_id+article_id]')
      .equals([userId, articleId])
      .first();
  }

  // Get user's completed articles
  async getCompletedArticles(userId: string): Promise<CMEArticle[]> {
    const completedProgress = await db.cme_reading_progress
      .where('user_id')
      .equals(userId)
      .and(p => p.completed_at !== undefined)
      .toArray();

    const articleIds = completedProgress.map(p => p.article_id);
    const articles = await db.cme_articles.where('id').anyOf(articleIds).toArray();
    
    return articles;
  }

  // Get user's bookmarked articles
  async getBookmarkedArticles(userId: string): Promise<CMEArticle[]> {
    const bookmarkedProgress = await db.cme_reading_progress
      .where('user_id')
      .equals(userId)
      .and(p => p.bookmarked === true)
      .toArray();

    const articleIds = bookmarkedProgress.map(p => p.article_id);
    const articles = await db.cme_articles.where('id').anyOf(articleIds).toArray();
    
    return articles;
  }

  // Search articles
  async searchArticles(query: string): Promise<CMEArticle[]> {
    const allArticles = await db.cme_articles.toArray();
    const lowerQuery = query.toLowerCase();
    
    return allArticles.filter(article => 
      (article.title || '').toLowerCase().includes(lowerQuery) ||
      (article.topic || '').toLowerCase().includes(lowerQuery) ||
      (article.summary || '').toLowerCase().includes(lowerQuery) ||
      (article.key_points || []).some((point: string) => (point || '').toLowerCase().includes(lowerQuery))
    );
  }

  // Get next topic in schedule
  async getNextScheduledTopic(): Promise<{ topic: string; category: WACSCategory; difficulty: 'beginner' | 'intermediate' | 'advanced' } | null> {
    const currentWeek = this.getCurrentWeekOfYear();
    const targetWeek = currentWeek % 52 || 52;

    // Check all categories for this week's topic
    for (const [category, topics] of Object.entries(WACS_TOPICS)) {
      const topicData = topics.find(t => t.week === targetWeek);
      if (topicData) {
        return {
          topic: topicData.topic,
          category: category as WACSCategory,
          difficulty: topicData.difficulty
        };
      }
    }

    // Fallback to first topic if nothing found
    return {
      topic: WACS_TOPICS.part_i_principles[0].topic,
      category: 'part_i_principles',
      difficulty: WACS_TOPICS.part_i_principles[0].difficulty
    };
  }

  // Get current week of year
  private getCurrentWeekOfYear(): number {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.ceil(diff / oneWeek);
  }

  // Get article statistics
  async getArticleStatistics(): Promise<{
    total_articles: number;
    articles_by_category: Record<WACSCategory, number>;
    total_views: number;
    total_likes: number;
    avg_reading_time: number;
  }> {
    const articles = await db.cme_articles.toArray();
    
    const stats = {
      total_articles: articles.length,
      articles_by_category: {
        part_i_principles: articles.filter(a => a.category === 'part_i_principles').length,
        part_i_specialty: articles.filter(a => a.category === 'part_i_specialty').length,
        part_ii_general: articles.filter(a => a.category === 'part_ii_general').length,
        part_ii_plastic: articles.filter(a => a.category === 'part_ii_plastic').length
      },
      total_views: articles.reduce((sum, a) => sum + a.view_count, 0),
      total_likes: articles.reduce((sum, a) => sum + a.like_count, 0),
      avg_reading_time: articles.length > 0 
        ? Math.round(articles.reduce((sum, a) => sum + a.reading_time_minutes, 0) / articles.length)
        : 0
    };

    return stats;
  }
}

export const cmeWACSService = new CMEWACSService();
