import { ReactNode, useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Download,
  Image as ImageIcon,
  X
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────
export interface SlideData {
  id: string;
  title: string;
  subtitle?: string;
  content: ReactNode;
  /** Optional clinical image (base64 or URL) shown on right half */
  image?: string;
  imageCaption?: string;
  /** Slide type for styling */
  type?: 'title' | 'content' | 'summary' | 'divider';
}

interface PresentationSlideProps {
  slides: SlideData[];
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

// ─── Component ────────────────────────────────────────
export default function PresentationSlide({
  slides,
  institutionName = 'Department of Plastic Surgery',
  logoUrl,
  watermarkText = 'UNTH Plastic Surgery',
  presenterName,
  presentationDate,
  onSetLogo,
}: PresentationSlideProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const slide = slides[currentIndex];

  // ─── Navigation ────────────────────────────────────
  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, slides.length - 1));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goNext();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, isFullscreen]);

  // ─── Fullscreen ─────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else if (document.fullscreenElement) {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }, []);

  useEffect(() => {
    const onFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  if (!slide) return null;

  const isTitleSlide = slide.type === 'title';
  const isDividerSlide = slide.type === 'divider';
  const hasImage = !!slide.image;

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col ${isFullscreen ? 'bg-black' : ''}`}
      style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      {/* ─── Slide Canvas ──────────────────────────── */}
      <div
        className={`relative mx-auto w-full ${
          isFullscreen ? 'h-screen' : 'aspect-[16/9] max-h-[75vh]'
        } bg-white rounded-lg shadow-2xl overflow-hidden border border-gray-200`}
      >
        {/* Watermark */}
        <div className="absolute top-3 right-4 text-gray-200 text-xs tracking-widest uppercase select-none z-10"
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

        {/* ─── Title Slide ─────────────────────────── */}
        {isTitleSlide && (
          <div className="flex flex-col items-center justify-center h-full px-12 text-center">
            <div className="mb-6">
              <p className="text-green-700 text-sm uppercase tracking-widest mb-2"
                style={{ fontSize: '14px' }}>
                {institutionName}
              </p>
              <h1 className="text-green-900 font-bold leading-tight mb-4"
                style={{ fontSize: '36px' }}>
                {slide.title}
              </h1>
              {slide.subtitle && (
                <p className="text-gray-600" style={{ fontSize: '20px' }}>
                  {slide.subtitle}
                </p>
              )}
            </div>
            <div className="mt-4 text-gray-500" style={{ fontSize: '16px' }}>
              {presenterName && <p>{presenterName}</p>}
              {presentationDate && <p>{presentationDate}</p>}
            </div>
            <div className="mt-6">{slide.content}</div>
          </div>
        )}

        {/* ─── Divider Slide ───────────────────────── */}
        {isDividerSlide && (
          <div className="flex items-center justify-center h-full px-12 bg-gradient-to-br from-green-700 to-green-900">
            <div className="text-center">
              <h2 className="text-white font-bold" style={{ fontSize: '36px' }}>
                {slide.title}
              </h2>
              {slide.subtitle && (
                <p className="text-green-200 mt-3" style={{ fontSize: '20px' }}>
                  {slide.subtitle}
                </p>
              )}
              <div className="mt-4 text-green-100">{slide.content}</div>
            </div>
          </div>
        )}

        {/* ─── Content Slide ───────────────────────── */}
        {!isTitleSlide && !isDividerSlide && (
          <div className="flex flex-col h-full">
            {/* Slide header bar */}
            <div className="bg-gradient-to-r from-green-700 to-green-600 px-8 py-3 flex-shrink-0">
              <h2 className="text-white font-bold" style={{ fontSize: '28px' }}>
                {slide.title}
              </h2>
              {slide.subtitle && (
                <p className="text-green-100 mt-0.5" style={{ fontSize: '16px' }}>
                  {slide.subtitle}
                </p>
              )}
            </div>

            {/* Slide body */}
            <div className={`flex flex-1 min-h-0 ${hasImage ? '' : ''}`}>
              {/* Text content */}
              <div
                className={`${hasImage ? 'w-1/2' : 'w-full'} p-6 overflow-y-auto text-gray-800 leading-relaxed`}
                style={{ fontSize: '20px' }}
              >
                {slide.content}
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

      {/* ─── Controls ──────────────────────────────── */}
      <div className={`flex items-center justify-between mt-4 px-2 ${isFullscreen ? 'absolute bottom-4 left-4 right-4' : ''}`}>
        {/* Left: slide counter */}
        <div className="text-sm text-gray-500">
          Slide {currentIndex + 1} of {slides.length}
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

        {/* Right: fullscreen */}
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
  );
}
