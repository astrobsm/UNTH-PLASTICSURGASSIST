import { cmeWACSService } from './cmeWACSService';
import { notificationService } from './notificationService';

interface ArticleSchedule {
  id: string;
  scheduled_date: Date;
  topic_id: string;
  article_id?: string;
  status: 'pending' | 'generated' | 'published' | 'failed';
  notification_sent: boolean;
  created_at: Date;
  updated_at: Date;
}

class CMEArticleSchedulerService {
  private scheduleInterval: NodeJS.Timeout | null = null;
  private readonly SCHEDULE_DAYS = [2, 5]; // Tuesday (2) and Friday (5) - 0 = Sunday
  private readonly PUBLISH_HOUR = 6; // 6 AM
  private readonly PUBLISH_MINUTE = 0;

  // Initialize scheduler
  start(): void {
    console.log('Starting CME Article Scheduler...');
    
    // Check every hour for scheduled articles
    this.scheduleInterval = setInterval(() => {
      this.checkAndPublishScheduledArticles();
    }, 60 * 60 * 1000); // Every hour

    // Run immediately on start
    this.checkAndPublishScheduledArticles();
  }

  // Stop scheduler
  stop(): void {
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
      this.scheduleInterval = null;
      console.log('CME Article Scheduler stopped');
    }
  }

  // Check if it's time to publish and publish scheduled articles
  private async checkAndPublishScheduledArticles(): Promise<void> {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();

    // Check if today is a scheduled day (Tuesday or Friday) and it's the publish hour
    if (this.SCHEDULE_DAYS.includes(dayOfWeek) && hour === this.PUBLISH_HOUR) {
      console.log('Time to publish CME article!');
      await this.publishNextArticle();
    }
  }

  // Publish the next article in the sequence
  async publishNextArticle(): Promise<void> {
    try {
      console.log('Publishing next CME article...');

      // Get next topic from WACS curriculum
      const nextTopic = await cmeWACSService.getNextScheduledTopic();
      if (!nextTopic) {
        console.log('No topics available');
        return;
      }
      console.log('Next topic:', nextTopic.topic);

      // Generate article
      const article = await cmeWACSService.generateArticle(nextTopic);
      console.log('Article generated:', article.id);

      // Send push notification to all users
      await this.sendArticleNotification(article);
      console.log('Notification sent for article:', article.title);

    } catch (error) {
      console.error('Error publishing CME article:', error);
    }
  }

  // Send push notification for new article
  private async sendArticleNotification(article: any): Promise<void> {
    const notification = {
      title: '📚 New CME Article Available!',
      body: `${article.title} - ${article.reading_time_minutes} min read`,
      icon: '/logo.png',
      badge: '/badge-72x72.png',
      data: {
        type: 'cme_article',
        article_id: article.id,
        url: `/education/articles/${article.id}`,
        category: article.category
      },
      actions: [
        {
          action: 'read',
          title: 'Read Now'
        },
        {
          action: 'later',
          title: 'Read Later'
        }
      ],
      requireInteraction: true,
      vibrate: [200, 100, 200],
      tag: 'cme-article',
    };

    // Send to all users via service worker
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(notification.title, notification);
        console.log('Push notification sent successfully');
      } catch (error) {
        console.error('Error sending push notification:', error);
      }
    }
  }

  // Manual trigger for testing or admin use
  async generateAndPublishNow(): Promise<void> {
    console.log('Manually triggering article generation...');
    await this.publishNextArticle();
  }

  // Get publication schedule for the next N weeks
  getUpcomingSchedule(weeks: number = 4): { date: Date; dayName: string }[] {
    const schedule: { date: Date; dayName: string }[] = [];
    const now = new Date();
    const daysToCheck = weeks * 7;

    for (let i = 0; i < daysToCheck; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(now.getDate() + i);
      checkDate.setHours(this.PUBLISH_HOUR, this.PUBLISH_MINUTE, 0, 0);

      const dayOfWeek = checkDate.getDay();
      if (this.SCHEDULE_DAYS.includes(dayOfWeek)) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        schedule.push({
          date: checkDate,
          dayName: dayNames[dayOfWeek]
        });
      }
    }

    return schedule;
  }

  // Get articles published in the last N days
  async getRecentArticles(days: number = 7): Promise<any[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const articles = await cmeWACSService.getAllArticles();
    return articles.filter((a: any) => a.published_date >= cutoffDate);
  }

  // Get next publication date
  getNextPublicationDate(): Date {
    const now = new Date();
    const schedule = this.getUpcomingSchedule(1);
    return schedule.length > 0 ? schedule[0].date : now;
  }

  // Reschedule for different days/times (admin function)
  updateSchedule(days: number[], hour: number): void {
    // This would typically update configuration
    console.log(`Schedule updated to days: ${days.join(', ')} at ${hour}:00`);
    // Restart scheduler with new configuration
    this.stop();
    this.start();
  }
}

export const cmeArticleScheduler = new CMEArticleSchedulerService();
