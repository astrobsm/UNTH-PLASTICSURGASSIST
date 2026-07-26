import { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Plus, 
  Pin, 
  Trash2, 
  Edit3, 
  Filter,
  Clock,
  User,
  X,
  Save,
  AlertCircle,
  BellRing
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { noticeBoardService, NoticePost, NOTICE_CATEGORIES } from '../services/noticeBoardService';
import StaffDutyReminder from '../components/StaffDutyReminder';

export default function NoticeBoardPage() {
  const { user } = useAuthStore();
  const [notices, setNotices] = useState<NoticePost[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingNotice, setEditingNotice] = useState<NoticePost | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReminder, setShowReminder] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<string>('general');
  const [formContent, setFormContent] = useState('');
  const [formPinned, setFormPinned] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'consultant';

  useEffect(() => {
    loadNotices();
  }, [selectedCategory]);

  const loadNotices = async () => {
    setLoading(true);
    try {
      const data = await noticeBoardService.getNoticesByCategory(selectedCategory);
      setNotices(data);
    } catch (error) {
      console.error('Error loading notices:', error);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormTitle('');
    setFormCategory('general');
    setFormContent('');
    setFormPinned(false);
    setShowCreateForm(false);
    setEditingNotice(null);
  };

  const handleCreate = async () => {
    if (!formTitle.trim() || !formContent.trim()) return;

    try {
      await noticeBoardService.createNotice({
        title: formTitle.trim(),
        category: formCategory as NoticePost['category'],
        content: formContent.trim(),
        posted_by: user?.id || '',
        posted_by_name: user?.name || 'Unknown',
        posted_by_role: user?.role || 'unknown',
        is_pinned: formPinned,
        is_active: true,
      });
      resetForm();
      loadNotices();
    } catch (error) {
      console.error('Error creating notice:', error);
    }
  };

  const handleUpdate = async () => {
    if (!editingNotice?.id || !formTitle.trim() || !formContent.trim()) return;

    try {
      await noticeBoardService.updateNotice(editingNotice.id, {
        title: formTitle.trim(),
        category: formCategory as NoticePost['category'],
        content: formContent.trim(),
        is_pinned: formPinned,
      });
      resetForm();
      loadNotices();
    } catch (error) {
      console.error('Error updating notice:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notice?')) return;
    try {
      await noticeBoardService.deleteNotice(id);
      loadNotices();
    } catch (error) {
      console.error('Error deleting notice:', error);
    }
  };

  const handleTogglePin = async (id: string) => {
    try {
      await noticeBoardService.togglePin(id);
      loadNotices();
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  const startEdit = (notice: NoticePost) => {
    setEditingNotice(notice);
    setFormTitle(notice.title);
    setFormCategory(notice.category);
    setFormContent(notice.content);
    setFormPinned(notice.is_pinned);
    setShowCreateForm(true);
  };

  /** Put a generated reminder on the board as a notice, so it is on the record
   *  as well as in the person's WhatsApp. */
  const postReminderToBoard = async (title: string, content: string) => {
    try {
      await noticeBoardService.createNotice({
        title,
        category: 'general' as NoticePost['category'],
        content,
        posted_by: user?.id || '',
        posted_by_name: user?.name || 'Unknown',
        posted_by_role: user?.role || 'unknown',
        is_pinned: false,
        is_active: true,
      });
      await loadNotices();
    } catch (error) {
      console.error('Error posting reminder to the board:', error);
    }
  };

  const getCategoryInfo = (category: string) => {
    return NOTICE_CATEGORIES.find(c => c.value === category) || NOTICE_CATEGORIES[5];
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary-600" />
            Notice Board
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Weekly activities, announcements, and important updates
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Build a per-staff duty reminder to send on WhatsApp. */}
          <button
            onClick={() => setShowReminder(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              showReminder ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <BellRing className="h-4 w-4" />
            Duty Reminder
          </button>
          {isAdmin && (
            <button
              onClick={() => { resetForm(); setShowCreateForm(true); }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Post Notice
            </button>
          )}
        </div>
      </div>

      {showReminder && (
        <StaffDutyReminder
          onPostToBoard={isAdmin ? postReminderToBoard : undefined}
        />
      )}

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selectedCategory === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Filter className="h-3.5 w-3.5 inline mr-1" />
          All
        </button>
        {NOTICE_CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === cat.value
                ? 'bg-primary-600 text-white'
                : `${cat.color} hover:opacity-80`
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Create/Edit Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingNotice ? 'Edit Notice' : 'Post New Notice'}
                </h2>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Enter notice title..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {NOTICE_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
                  <textarea
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="Enter notice details, schedules, instructions..."
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                  />
                </div>

                {/* Pin toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formPinned}
                    onChange={(e) => setFormPinned(e.target.checked)}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <Pin className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-gray-700">Pin this notice to top</span>
                </label>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={editingNotice ? handleUpdate : handleCreate}
                    disabled={!formTitle.trim() || !formContent.trim()}
                    className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="h-4 w-4" />
                    {editingNotice ? 'Update Notice' : 'Post Notice'}
                  </button>
                  <button
                    onClick={resetForm}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notices List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : notices.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg">No notices found</p>
          <p className="text-gray-400 text-sm mt-1">
            {isAdmin ? 'Click "Post Notice" to create one.' : 'Check back later for updates.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {notices.map((notice) => {
            const catInfo = getCategoryInfo(notice.category);
            return (
              <div
                key={notice.id}
                className={`card p-4 sm:p-5 border-l-4 ${
                  notice.is_pinned ? 'border-l-yellow-500 bg-yellow-50/30' : 'border-l-primary-500'
                }`}
              >
                {/* Notice header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {notice.is_pinned && (
                        <Pin className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                      )}
                      <h3 className="font-semibold text-gray-900 text-base sm:text-lg">
                        {notice.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${catInfo.color}`}>
                        {catInfo.label}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {notice.posted_by_name}
                        {notice.posted_by_role && (
                          <span className="text-gray-400">({notice.posted_by_role})</span>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(notice.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Admin actions */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleTogglePin(notice.id!)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          notice.is_pinned 
                            ? 'text-yellow-600 bg-yellow-100 hover:bg-yellow-200' 
                            : 'text-gray-400 hover:text-yellow-600 hover:bg-yellow-50'
                        }`}
                        title={notice.is_pinned ? 'Unpin' : 'Pin to top'}
                      >
                        <Pin className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => startEdit(notice)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(notice.id!)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Notice content */}
                <div className="mt-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {notice.content}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
