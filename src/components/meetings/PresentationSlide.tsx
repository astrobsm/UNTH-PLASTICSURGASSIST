import { ReactNode, useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Image as ImageIcon,
  X,
  Edit3,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  Type,
  List,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────
export interface SlideData {
  id: string;
  title: string;
  subtitle?: string;
  content: ReactNode;
  /** Optional editable text; when set, overrides `content` rendering */
  editableContent?: string;
  /** Optional clinical image (base64 or URL) shown on right half */
  image?: string;
  imageCaption?: string;
  /** Slide type for styling */
  type?: 'title' | 'content' | 'summary' | 'divider';
}

interface PresentationSlideProps {
  slides: SlideData[];
  /** Called when slides are modified – passing this enables editing */
  onSlidesChange?: (slides: SlideData[]) => void;
  /** Institution / department name for title slide */
  institutionName?: string;
  /** Logo image (base64 or URL) */
  logoUrl?: string;
  /** Watermark text shown at upper-right corner */
  watermarkText?: string;
  /** Presenter name */
  presenterName?: string;
  /** Presentation date */
  presentationDate?: string;
  /** Called when user wants to set a logo */
  onSetLogo?: () => void;
}

// ─── Helper: render editable plain-text with basic formatting ──
function renderFormattedText(text: string) {
  if (!text) return null;
  const blocks = text.split('\n\n');
  return (
    <div className="space-y-3" style={{ fontSize: '20px' }}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n').filter((l) => l.trim());
        const isBullets =
          lines.length > 0 && lines.every((l) => /^\s*[-•*]\s/.test(l));
        const isNumbered =
          lines.length > 0 && lines.every((l) => /^\s*\d+[.)]\s/.test(l));

        if (isBullets) {
          return (
            <ul key={bi} className="list-disc list-inside space-y-1.5">
              {lines.map((l, li) => (
                <li key={li} className="leading-relaxed">
                  {l.replace(/^\s*[-•*]\s*/, '')}
                </li>
              ))}
            </ul>
          );
        }
        if (isNumbered) {
          return (
            <ol key={bi} className="list-decimal list-inside space-y-1.5">
              {lines.map((l, li) => (
                <li key={li} className="leading-relaxed">
                  {l.replace(/^\s*\d+[.)]\s*/, '')}
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p key={bi} className="leading-relaxed">
            {block}
          </p>
        );
      })}
    </div>
  );
}

// ─── Component ────────────────────────────────────────
export default function PresentationSlide({
  slides,
  onSlidesChange,
  institutionName = 'Burns, Plastic & Reconstructive Surgery UNIT, Department of Surgery',
  logoUrl,
  watermarkText = 'UNTH Plastic Surgery',
  presenterName,
  presentationDate,
  onSetLogo,
}: PresentationSlideProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingField, setEditingField] = useState<'title' | 'subtitle' | 'content' | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [showSlidePanel, setShowSlidePanel] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const slide = slides[currentIndex];
  const canEdit = !!onSlidesChange;

  // Clamp index when slides change
  useEffect(() => {
    if (currentIndex >= slides.length) {
      setCurrentIndex(Math.max(0, slides.length - 1));
    }
  }, [slides.length, currentIndex]);

  // ─── Navigation ────────────────────────────────────
  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, slides.length - 1));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingField) return; // don't capture when editing
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      if (e.key === 'Escape' && isFullscreen) toggleFullscreen();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, isFullscreen, editingField]);

  // ─── Fullscreen ─────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else if (document.fullscreenElement) {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }, []);

  useEffect(() => {
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  // ─── Editing helpers ────────────────────────────────
  const updateSlide = useCallback(
    (index: number, updates: Partial<SlideData>) => {
      if (!onSlidesChange) return;
      const updated = slides.map((s, i) => (i === index ? { ...s, ...updates } : s));
      onSlidesChange(updated);
    },
    [onSlidesChange, slides],
  );

  const startEditing = (field: 'title' | 'subtitle' | 'content') => {
    if (!canEdit) return;
    setEditingField(field);
    if (field === 'title') setTempValue(slide.title);
    else if (field === 'subtitle') setTempValue(slide.subtitle || '');
    else setTempValue(slide.editableContent || '');
    setTimeout(() => {
      if (field === 'content') editTextareaRef.current?.focus();
      else { editInputRef.current?.focus(); editInputRef.current?.select(); }
    }, 50);
  };

  const saveEdit = () => {
    if (!editingField) return;
    if (editingField === 'title') updateSlide(currentIndex, { title: tempValue });
    else if (editingField === 'subtitle') updateSlide(currentIndex, { subtitle: tempValue });
    else updateSlide(currentIndex, { editableContent: tempValue || undefined });
    setEditingField(null);
    setTempValue('');
  };

  const cancelEdit = () => { setEditingField(null); setTempValue(''); };

  const addSlide = (position: 'before' | 'after') => {
    if (!onSlidesChange) return;
    const newSlide: SlideData = {
      id: `custom-${Date.now()}`,
      title: 'New Slide',
      subtitle: '',
      type: 'content',
      editableContent: '',
      content: <></>,
    };
    const idx = position === 'before' ? currentIndex : currentIndex + 1;
    const updated = [...slides.slice(0, idx), newSlide, ...slides.slice(idx)];
    onSlidesChange(updated);
    setCurrentIndex(idx);
  };

  const insertSlideAt = (position: number) => {
    if (!onSlidesChange) return;
    const newSlide: SlideData = {
      id: `custom-${Date.now()}`,
      title: 'New Slide',
      subtitle: '',
      type: 'content',
      editableContent: '',
      content: <></>,
    };
    const updated = [...slides.slice(0, position), newSlide, ...slides.slice(position)];
    onSlidesChange(updated);
    setCurrentIndex(position);
  };

  const deleteSlide = () => {
    if (!onSlidesChange || slides.length <= 1) return;
    const updated = slides.filter((_, i) => i !== currentIndex);
    onSlidesChange(updated);
    setCurrentIndex(Math.min(currentIndex, updated.length - 1));
  };

  const moveSlide = (direction: 'up' | 'down') => {
    if (!onSlidesChange) return;
    const target = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (target < 0 || target >= slides.length) return;
    const updated = [...slides];
    [updated[currentIndex], updated[target]] = [updated[target], updated[currentIndex]];
    onSlidesChange(updated);
    setCurrentIndex(target);
  };

  const duplicateSlide = () => {
    if (!onSlidesChange) return;
    const dup: SlideData = { ...slides[currentIndex], id: `dup-${Date.now()}` };
    const updated = [...slides.slice(0, currentIndex + 1), dup, ...slides.slice(currentIndex + 1)];
    onSlidesChange(updated);
    setCurrentIndex(currentIndex + 1);
  };

  if (!slide) return null;

  const isTitleSlide = slide.type === 'title';
  const isDividerSlide = slide.type === 'divider';
  const hasImage = !!slide.image;
  const hasEditableContent = slide.editableContent !== undefined && slide.editableContent !== '';
  const contentToRender = hasEditableContent
    ? renderFormattedText(slide.editableContent!)
    : slide.content;

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col ${isFullscreen ? 'bg-black' : ''}`}
      style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      {/* ─── Content Editor Modal ──────────────────── */}
      {editingField === 'content' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">Edit Slide Content</h3>
              <div className="flex items-center gap-2">
                <button onClick={saveEdit} className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">
                  <Check className="w-4 h-4" /> Save
                </button>
                <button onClick={cancelEdit} className="flex items-center gap-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition">
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
            </div>
            <div className="p-4 text-xs text-gray-400 bg-gray-50 border-b">
              <span className="font-medium">Formatting tips:</span>{' '}
              Use blank lines for paragraphs. Start lines with <code className="bg-gray-200 px-1 rounded">-</code> or{' '}
              <code className="bg-gray-200 px-1 rounded">•</code> for bullets. Start with{' '}
              <code className="bg-gray-200 px-1 rounded">1.</code> for numbered lists.
            </div>
            <textarea
              ref={editTextareaRef}
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              className="flex-1 p-6 text-base leading-relaxed resize-none focus:outline-none font-mono"
              placeholder={'Enter slide content here...\n\nUse blank lines to create paragraphs.\n- Use dashes for bullet points\n1. Use numbers for ordered lists'}
              style={{ minHeight: '300px' }}
            />
            {tempValue && (
              <div className="border-t px-6 py-4 max-h-48 overflow-y-auto bg-gray-50">
                <p className="text-xs font-bold text-gray-400 mb-2 uppercase">Preview</p>
                <div className="text-gray-800">{renderFormattedText(tempValue)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Title / Subtitle Edit Modal ─────────────── */}
      {(editingField === 'title' || editingField === 'subtitle') && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={cancelEdit}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">Edit {editingField}</h3>
            <input
              ref={editInputRef}
              type="text"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
              className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder={`Enter ${editingField}...`}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={cancelEdit} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancel</button>
              <button onClick={saveEdit} className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Slide Manager Panel ──────────────────── */}
      {showSlidePanel && canEdit && (
        <div className="absolute left-0 top-0 bottom-0 w-64 bg-white/95 backdrop-blur border-r border-gray-200 z-30 overflow-y-auto shadow-xl rounded-l-lg">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-700">Slides ({slides.length})</h3>
            <button onClick={() => setShowSlidePanel(false)} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="p-2 space-y-0.5">
            {slides.map((s, i) => (
              <div key={s.id}>
                {/* Insert-here button */}
                <button
                  onClick={() => insertSlideAt(i)}
                  className="w-full flex items-center justify-center gap-1 py-0.5 text-xs text-transparent hover:text-green-600 transition group"
                  title="Insert slide here"
                >
                  <Plus className="w-3 h-3" />
                  <span className="text-xs">Insert here</span>
                </button>
                {/* Slide entry */}
                <button
                  onClick={() => { setCurrentIndex(i); setShowSlidePanel(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center gap-2 ${
                    i === currentIndex
                      ? 'bg-green-50 border border-green-300 text-green-800'
                      : 'hover:bg-gray-50 text-gray-700 border border-transparent'
                  }`}
                >
                  <span className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium truncate text-xs">{s.title}</p>
                    {s.type && <p className="text-[10px] text-gray-400">{s.type}</p>}
                  </div>
                </button>
              </div>
            ))}
            {/* Insert at end */}
            <button
              onClick={() => insertSlideAt(slides.length)}
              className="w-full flex items-center justify-center gap-1 py-2 text-xs text-gray-400 hover:text-green-600 transition mt-1 border border-dashed border-gray-200 rounded-lg hover:border-green-400"
            >
              <Plus className="w-3 h-3" /> Add slide at end
            </button>
          </div>
        </div>
      )}

      {/* ─── Slide Canvas ──────────────────────────── */}
      <div
        className={`relative mx-auto w-full ${
          isFullscreen ? 'h-screen' : 'aspect-[16/9] max-h-[75vh]'
        } bg-white rounded-lg shadow-2xl overflow-hidden border border-gray-200`}
      >
        {/* Watermark */}
        <div
          className="absolute top-3 right-4 text-gray-200 text-xs tracking-widest uppercase select-none z-10"
          style={{ fontFamily: 'Georgia, serif', fontSize: '11px', opacity: 0.45 }}
        >
          {watermarkText}
        </div>

        {/* Logo (top-left) */}
        <div className="absolute top-3 left-4 z-10 flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
          ) : (
            onSetLogo && (
              <button
                onClick={onSetLogo}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-500 transition"
              >
                <ImageIcon className="w-3 h-3" /> Add Logo
              </button>
            )
          )}
        </div>

        {/* Edit mode indicator */}
        {isEditing && canEdit && (
          <div className="absolute top-3 right-4 z-20 flex items-center gap-1 bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium shadow">
            <Edit3 className="w-3 h-3" /> Edit Mode
          </div>
        )}

        {/* ─── Title Slide ─────────────────────────── */}
        {isTitleSlide && (
          <div className="flex flex-col items-center justify-center h-full px-12 text-center">
            <div className="mb-6">
              <p
                className="text-green-700 text-sm uppercase tracking-widest mb-2"
                style={{ fontSize: '14px' }}
              >
                {institutionName}
              </p>
              <h1
                className={`text-green-900 font-bold leading-tight mb-4 ${isEditing ? 'cursor-pointer hover:bg-green-50 hover:outline hover:outline-2 hover:outline-green-300 rounded px-2 transition' : ''}`}
                style={{ fontSize: '36px' }}
                onClick={() => isEditing && startEditing('title')}
                title={isEditing ? 'Click to edit title' : undefined}
              >
                {slide.title}
              </h1>
              {(slide.subtitle || isEditing) && (
                <p
                  className={`text-gray-600 ${isEditing ? 'cursor-pointer hover:bg-gray-50 hover:outline hover:outline-2 hover:outline-gray-300 rounded px-2 transition min-h-[28px]' : ''}`}
                  style={{ fontSize: '20px' }}
                  onClick={() => isEditing && startEditing('subtitle')}
                  title={isEditing ? 'Click to edit subtitle' : undefined}
                >
                  {slide.subtitle || (isEditing ? '(click to add subtitle)' : '')}
                </p>
              )}
            </div>
            <div className="mt-4 text-gray-500" style={{ fontSize: '16px' }}>
              {presenterName && <p>{presenterName}</p>}
              {presentationDate && <p>{presentationDate}</p>}
            </div>
            <div className="mt-6">{contentToRender}</div>
            {isEditing && (
              <button
                onClick={() => startEditing('content')}
                className="mt-4 flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition"
              >
                <Type className="w-3 h-3" /> Edit Content
              </button>
            )}
          </div>
        )}

        {/* ─── Divider Slide ───────────────────────── */}
        {isDividerSlide && (
          <div className="flex items-center justify-center h-full px-12 bg-gradient-to-br from-green-700 to-green-900">
            <div className="text-center">
              <h2
                className={`text-white font-bold ${isEditing ? 'cursor-pointer hover:bg-white/10 rounded px-2 transition' : ''}`}
                style={{ fontSize: '36px' }}
                onClick={() => isEditing && startEditing('title')}
                title={isEditing ? 'Click to edit title' : undefined}
              >
                {slide.title}
              </h2>
              {(slide.subtitle || isEditing) && (
                <p
                  className={`text-green-200 mt-3 ${isEditing ? 'cursor-pointer hover:bg-white/10 rounded px-2 transition min-h-[28px]' : ''}`}
                  style={{ fontSize: '20px' }}
                  onClick={() => isEditing && startEditing('subtitle')}
                  title={isEditing ? 'Click to edit subtitle' : undefined}
                >
                  {slide.subtitle || (isEditing ? '(click to add subtitle)' : '')}
                </p>
              )}
              <div className="mt-4 text-green-100">{contentToRender}</div>
              {isEditing && (
                <button
                  onClick={() => startEditing('content')}
                  className="mt-4 flex items-center gap-1 px-3 py-1.5 text-xs bg-white/20 hover:bg-white/30 rounded-lg text-white transition mx-auto"
                >
                  <Type className="w-3 h-3" /> Edit Content
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── Content Slide ───────────────────────── */}
        {!isTitleSlide && !isDividerSlide && (
          <div className="flex flex-col h-full">
            {/* Slide header bar */}
            <div className="bg-gradient-to-r from-green-700 to-green-600 px-8 py-3 flex-shrink-0">
              <h2
                className={`text-white font-bold ${isEditing ? 'cursor-pointer hover:bg-white/10 rounded px-1 transition' : ''}`}
                style={{ fontSize: '28px' }}
                onClick={() => isEditing && startEditing('title')}
                title={isEditing ? 'Click to edit title' : undefined}
              >
                {slide.title}
              </h2>
              {(slide.subtitle || isEditing) && (
                <p
                  className={`text-green-100 mt-0.5 ${isEditing ? 'cursor-pointer hover:bg-white/10 rounded px-1 transition min-h-[22px]' : ''}`}
                  style={{ fontSize: '16px' }}
                  onClick={() => isEditing && startEditing('subtitle')}
                  title={isEditing ? 'Click to edit subtitle' : undefined}
                >
                  {slide.subtitle || (isEditing ? '(click to add subtitle)' : '')}
                </p>
              )}
            </div>

            {/* Slide body */}
            <div className={`flex flex-1 min-h-0`}>
              {/* Text content */}
              <div
                className={`${hasImage ? 'w-1/2' : 'w-full'} p-6 overflow-y-auto text-gray-800 leading-relaxed relative`}
                style={{ fontSize: '20px' }}
              >
                {contentToRender}
                {isEditing && (
                  <button
                    onClick={() => startEditing('content')}
                    className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 text-xs bg-green-50 hover:bg-green-100 rounded text-green-700 transition border border-green-200 shadow-sm"
                  >
                    <Edit3 className="w-3 h-3" /> Edit Text
                  </button>
                )}
              </div>

              {/* Clinical image (right half) */}
              {hasImage && (
                <div className="w-1/2 flex flex-col items-center justify-center p-4 bg-gray-50 border-l border-gray-200">
                  <img
                    src={slide.image}
                    alt={slide.imageCaption || 'Clinical image'}
                    className="max-h-full max-w-full object-contain rounded-lg shadow"
                  />
                  {slide.imageCaption && (
                    <p className="mt-2 text-sm text-gray-500 italic text-center">
                      {slide.imageCaption}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Bottom bar */}
            <div className="bg-green-50 border-t border-green-100 px-8 py-1.5 flex items-center justify-between flex-shrink-0">
              <span className="text-green-700 text-xs">{institutionName}</span>
              <span className="text-green-600 text-xs font-medium">
                {currentIndex + 1} / {slides.length}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Edit Toolbar ──────────────────────────── */}
      {isEditing && canEdit && (
        <div className="flex items-center justify-center gap-1 mt-2 flex-wrap">
          <button
            onClick={() => addSlide('before')}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-700 transition border border-blue-200"
            title="Insert slide before current"
          >
            <Plus className="w-3 h-3" /> Before
          </button>
          <button
            onClick={() => addSlide('after')}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-50 hover:bg-green-100 rounded-lg text-green-700 transition border border-green-200"
            title="Insert slide after current"
          >
            <Plus className="w-3 h-3" /> After
          </button>
          <button
            onClick={duplicateSlide}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-purple-50 hover:bg-purple-100 rounded-lg text-purple-700 transition border border-purple-200"
            title="Duplicate current slide"
          >
            <Copy className="w-3 h-3" /> Duplicate
          </button>
          <button
            onClick={() => moveSlide('up')}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-700 transition border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move slide left"
          >
            <ArrowUp className="w-3 h-3 -rotate-90" /> Move ←
          </button>
          <button
            onClick={() => moveSlide('down')}
            disabled={currentIndex === slides.length - 1}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-700 transition border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move slide right"
          >
            Move → <ArrowDown className="w-3 h-3 -rotate-90" />
          </button>
          <button
            onClick={deleteSlide}
            disabled={slides.length <= 1}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-red-50 hover:bg-red-100 rounded-lg text-red-700 transition border border-red-200 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Delete current slide"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      )}

      {/* ─── Controls ──────────────────────────────── */}
      <div className={`flex items-center justify-between mt-4 px-2 ${isFullscreen ? 'absolute bottom-4 left-4 right-4' : ''}`}>
        {/* Left: slide panel toggle + counter */}
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={() => setShowSlidePanel(!showSlidePanel)}
              className={`p-2 rounded-lg border transition shadow-sm ${
                showSlidePanel ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
              title="Slide manager panel"
            >
              <List className="w-4 h-4" />
            </button>
          )}
          <div className="text-sm text-gray-500">
            Slide {currentIndex + 1} of {slides.length}
          </div>
        </div>

        {/* Center: navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>

          {/* Slide dots (max 20 visible) */}
          <div className="flex items-center gap-1 mx-2">
            {slides.length <= 20 &&
              slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentIndex
                      ? 'bg-green-600 w-4'
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              ))}
            {slides.length > 20 && (
              <select
                value={currentIndex}
                onChange={(e) => setCurrentIndex(Number(e.target.value))}
                className="text-sm border rounded px-2 py-1"
              >
                {slides.map((s, i) => (
                  <option key={i} value={i}>
                    {i + 1}. {s.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={goNext}
            disabled={currentIndex === slides.length - 1}
            className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Right: edit toggle + fullscreen */}
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={() => { setIsEditing(!isEditing); if (isEditing) cancelEdit(); }}
              className={`p-2 rounded-lg border transition shadow-sm ${
                isEditing
                  ? 'bg-green-600 border-green-600 text-white hover:bg-green-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
              title={isEditing ? 'Exit edit mode' : 'Edit slides'}
            >
              <Edit3 className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition shadow-sm"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen presentation'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5 text-gray-700" />
            ) : (
              <Maximize2 className="w-5 h-5 text-gray-700" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
