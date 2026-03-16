import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  BookOpen,
  Clock,
  Award,
  Heart,
  Bookmark,
  Share2,
  CheckCircle,
  ArrowLeft,
  Lightbulb,
  Target,
  FileText
} from 'lucide-react';
import { CMEArticle, CMEReadingProgress, cmeWACSService } from '../services/cmeWACSService';

interface CMEArticleViewerProps {
  articleId: string;
  userId: string;
  onClose: () => void;
}

export default function CMEArticleViewer({ articleId, userId, onClose }: CMEArticleViewerProps) {
  const [article, setArticle] = useState<CMEArticle | null>(null);
  const [progress, setProgress] = useState<CMEReadingProgress | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [readingStartTime, setReadingStartTime] = useState<number>(Date.now());
  const [progressId, setProgressId] = useState<string>('');

  useEffect(() => {
    loadArticle();
  }, [articleId]);

  const loadArticle = async () => {
    try {
      const articleData = await cmeWACSService.getArticleById(articleId);
      if (articleData) {
        setArticle(articleData);

        // Increment view count
        await cmeWACSService.incrementViewCount(articleId);

        // Track reading start
        const existingProgress = await cmeWACSService.getReadingProgress(userId, articleId);
        if (existingProgress) {
          setProgress(existingProgress);
          setProgressId(existingProgress.id);
          setIsLiked(existingProgress.liked);
          setIsBookmarked(existingProgress.bookmarked);
        } else {
          // Create new progress
          const newProgressId = await cmeWACSService.updateReadingProgress({
            user_id: userId,
            article_id: articleId,
            started_at: new Date(),
            completed_at: undefined,
            progress_percentage: 0,
            time_spent_seconds: 0,
            liked: false,
            bookmarked: false,
            notes: ''
          });
          setProgressId(newProgressId);
        }
      }
    } catch (error) {
      console.error('Error loading article:', error);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const scrollPercent = (scrollTop / (scrollHeight - clientHeight)) * 100;

    // Update progress
    if (progressId && userId) {
      cmeWACSService.updateReadingProgress({
        user_id: userId,
        article_id: articleId,
        started_at: progress?.started_at || new Date(),
        completed_at: progress?.completed_at,
        progress_percentage: Math.round(scrollPercent),
        time_spent_seconds: Math.floor((Date.now() - readingStartTime) / 1000),
        liked: isLiked,
        bookmarked: isBookmarked,
        notes: progress?.notes || ''
      });
    }

    // Auto-complete when scrolled to bottom
    if (scrollPercent > 95 && progressId && userId && !progress?.completed_at) {
      cmeWACSService.updateReadingProgress({
        user_id: userId,
        article_id: articleId,
        started_at: progress?.started_at || new Date(),
        completed_at: new Date(),
        progress_percentage: 100,
        time_spent_seconds: Math.floor((Date.now() - readingStartTime) / 1000),
        liked: isLiked,
        bookmarked: isBookmarked,
        notes: progress?.notes || ''
      });
    }
  };

  const handleLike = async () => {
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    
    if (newLiked) {
      await cmeWACSService.incrementLikeCount(articleId);
    }
    
    if (userId) {
      await cmeWACSService.updateReadingProgress({
        user_id: userId,
        article_id: articleId,
        started_at: progress?.started_at || new Date(),
        completed_at: progress?.completed_at,
        progress_percentage: progress?.progress_percentage || 0,
        time_spent_seconds: progress?.time_spent_seconds || 0,
        liked: newLiked,
        bookmarked: isBookmarked,
        notes: progress?.notes || ''
      });
    }
  };

  const handleBookmark = async () => {
    const newBookmarked = !isBookmarked;
    setIsBookmarked(newBookmarked);
    
    if (userId) {
      await cmeWACSService.updateReadingProgress({
        user_id: userId,
        article_id: articleId,
        started_at: progress?.started_at || new Date(),
        completed_at: progress?.completed_at,
        progress_percentage: progress?.progress_percentage || 0,
        time_spent_seconds: progress?.time_spent_seconds || 0,
        liked: isLiked,
        bookmarked: newBookmarked,
        notes: progress?.notes || ''
      });
    }
  };

  const handleComplete = async () => {
    if (userId) {
      await cmeWACSService.updateReadingProgress({
        user_id: userId,
        article_id: articleId,
        started_at: progress?.started_at || new Date(),
        completed_at: new Date(),
        progress_percentage: 100,
        time_spent_seconds: Math.floor((Date.now() - readingStartTime) / 1000),
        liked: isLiked,
        bookmarked: isBookmarked,
        notes: progress?.notes || ''
      });
      alert('Article marked as complete! 🎉');
    }
  };

  if (!article) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-3 animate-pulse" />
          <p className="text-gray-600">Loading article...</p>
        </div>
      </div>
    );
  }

  const categoryLabels = {
    part_i_principles: 'Part I - Principles',
    part_i_specialty: 'Part I - Specialty Intro',
    part_ii_general: 'Part II - General Surgery',
    part_ii_plastic: 'Part II - Plastic Surgery'
  };

  const difficultyColors = {
    beginner: 'bg-green-100 text-green-800',
    intermediate: 'bg-yellow-100 text-yellow-800',
    advanced: 'bg-red-100 text-red-800'
  };

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onClose}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Articles</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleLike}
                className={`p-2 rounded-lg transition-colors ${
                  isLiked ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={handleBookmark}
                className={`p-2 rounded-lg transition-colors ${
                  isBookmarked ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Bookmark className={`h-5 w-5 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
              <button className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-3 mb-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${difficultyColors[article.difficulty_level]}`}>
              {article.difficulty_level.charAt(0).toUpperCase() + article.difficulty_level.slice(1)}
            </span>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
              {categoryLabels[article.category]}
            </span>
            <div className="flex items-center space-x-1 text-gray-600">
              <Clock className="h-4 w-4" />
              <span className="text-sm">{article.reading_time_minutes} min read</span>
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2">{article.title}</h1>
          <p className="text-gray-600 mb-3">{article.subcategory}</p>
          <div className="text-sm text-gray-500">
            Published {article.published_date ? format(new Date(article.published_date), 'MMMM d, yyyy') : 'Date unavailable'} • By {article.author}
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        className="max-w-4xl mx-auto px-6 py-8 overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 200px)' }}
        onScroll={handleScroll}
      >
        {/* Learning Objectives */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-lg mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Target className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-blue-900">Learning Objectives</h2>
          </div>
          <ul className="space-y-2">
            {article.learning_objectives.map((obj, idx) => (
              <li key={idx} className="flex items-start space-x-2">
                <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span className="text-blue-900">{obj}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Article Content */}
        <div
          className="prose max-w-none mb-8"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }}
        />

        {/* Clinical Pearls */}
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-r-lg mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Lightbulb className="h-6 w-6 text-yellow-600" />
            <h2 className="text-xl font-semibold text-yellow-900">Clinical Pearls 💎</h2>
          </div>
          <ul className="space-y-3">
            {article.clinical_pearls.map((pearl, idx) => (
              <li key={idx} className="flex items-start space-x-2">
                <span className="text-yellow-600 font-bold flex-shrink-0 mt-1">•</span>
                <span className="text-yellow-900">{pearl}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Key Points Summary */}
        <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-r-lg mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <FileText className="h-6 w-6 text-green-600" />
            <h2 className="text-xl font-semibold text-green-900">Key Points Summary</h2>
          </div>
          <ul className="space-y-2">
            {article.key_points.map((point, idx) => (
              <li key={idx} className="flex items-start space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-green-900">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* References */}
        <div className="bg-gray-50 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">References</h2>
          <ol className="space-y-2 text-sm text-gray-700">
            {article.references.map((ref, idx) => (
              <li key={idx} className="pl-4">
                {idx + 1}. {ref}
              </li>
            ))}
          </ol>
        </div>

        {/* Complete Button */}
        <div className="text-center py-8">
          <button
            onClick={handleComplete}
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 mx-auto"
          >
            <Award className="h-5 w-5" />
            <span>Mark as Complete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
