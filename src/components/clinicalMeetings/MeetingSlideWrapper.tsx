import { ReactNode, useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Maximize2, Minimize2, Download } from 'lucide-react';

interface MeetingSlideWrapperProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onExit: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  currentSlide: number;
  totalSlides: number;
  meetingType: 'clinical-conference' | 'mortality-review' | 'vte-audit';
  institutionName?: string;
  departmentName?: string;
  presenterName?: string;
  meetingDate?: string;
}

const GRADIENT_MAP = {
  'clinical-conference': 'from-green-900 via-green-800 to-emerald-900',
  'mortality-review': 'from-gray-900 via-slate-800 to-gray-900',
  'vte-audit': 'from-blue-900 via-indigo-800 to-blue-900',
};

const ACCENT_MAP = {
  'clinical-conference': 'bg-green-600',
  'mortality-review': 'bg-red-600',
  'vte-audit': 'bg-blue-600',
};

const HEADER_LABEL = {
  'clinical-conference': 'Clinical Conference',
  'mortality-review': 'Mortality & Morbidity Review',
  'vte-audit': 'VTE Prophylaxis Audit',
};

export default function MeetingSlideWrapper({
  title,
  subtitle,
  children,
  onExit,
  onNext,
  onPrev,
  currentSlide,
  totalSlides,
  meetingType,
  institutionName = 'University of Nigeria Teaching Hospital',
  departmentName = 'Department of Plastic, Reconstructive & Burns Surgery',
  presenterName,
  meetingDate,
}: MeetingSlideWrapperProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          onNext?.();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onPrev?.();
          break;
        case 'Escape':
          onExit();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onNext, onPrev, onExit]);

  const gradient = GRADIENT_MAP[meetingType];
  const accent = ACCENT_MAP[meetingType];

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 bg-gradient-to-br ${gradient} text-white flex flex-col`}
      style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
    >
      {/* Watermark - upper right */}
      <div className="absolute top-4 right-6 opacity-10 text-6xl font-bold pointer-events-none select-none z-0"
           style={{ fontFamily: "'Georgia', serif" }}>
        UNTH
      </div>

      {/* Top Bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-2 bg-black/40 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center space-x-4">
          {/* Logo placeholder */}
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold border border-white/30">
            PS
          </div>
          <div>
            <p className="text-xs text-white/60 tracking-wider uppercase">{institutionName}</p>
            <p className="text-xs text-white/50">{departmentName}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className={`${accent} text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider`}>
            {HEADER_LABEL[meetingType]}
          </span>
          <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm font-bold">
            {currentSlide} / {totalSlides}
          </span>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={onExit}
            className="p-1.5 rounded-lg bg-red-600 hover:bg-red-700 transition-colors text-white"
            title="Exit presentation (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Slide Title */}
      <div className="relative z-10 px-8 pt-5 pb-2">
        <h1 className="text-3xl lg:text-4xl font-bold leading-tight" style={{ fontSize: '28px' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-lg text-white/60 mt-1" style={{ fontSize: '18px' }}>
            {subtitle}
          </p>
        )}
        {(presenterName || meetingDate) && (
          <div className="flex items-center space-x-4 mt-1 text-sm text-white/40">
            {presenterName && <span>Presented by: {presenterName}</span>}
            {meetingDate && <span>{meetingDate}</span>}
          </div>
        )}
        <div className={`h-1 w-24 ${accent} rounded mt-3`} />
      </div>

      {/* Slide Content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-8 py-4">
        <div className="text-lg leading-relaxed" style={{ fontSize: '20px', lineHeight: '1.8' }}>
          {children}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="relative z-10 flex items-center justify-between px-6 py-3 bg-black/40 backdrop-blur-sm border-t border-white/10">
        <button
          onClick={onPrev}
          disabled={!onPrev}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors text-sm ${
            onPrev
              ? 'bg-white/20 hover:bg-white/30 text-white'
              : 'bg-white/5 text-gray-600 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Previous</span>
        </button>

        {/* Slide dots */}
        <div className="flex space-x-1.5 max-w-[300px] overflow-x-auto">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all flex-shrink-0 ${
                i + 1 === currentSlide ? `w-5 ${accent}` : 'w-1.5 bg-white/30'
              }`}
            />
          ))}
        </div>

        <button
          onClick={onNext}
          disabled={!onNext}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors text-sm ${
            onNext
              ? `${accent} hover:opacity-90 text-white`
              : 'bg-white/5 text-gray-600 cursor-not-allowed'
          }`}
        >
          <span>Next</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Reusable Slide Content Components ─────────────────────────────────

interface SlideContentProps {
  children: ReactNode;
}

/** Full-width text slide */
export function SlideContent({ children }: SlideContentProps) {
  return <div className="max-w-5xl mx-auto">{children}</div>;
}

/** Split slide: text left, image right */
export function SplitSlide({ 
  children, 
  imageUrl, 
  imageCaption,
  imagePosition = 'right' 
}: { 
  children: ReactNode; 
  imageUrl?: string; 
  imageCaption?: string;
  imagePosition?: 'left' | 'right';
}) {
  const textContent = (
    <div className="flex-1 pr-4">{children}</div>
  );
  const imageContent = (
    <div className="flex-1 flex flex-col items-center justify-center">
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt={imageCaption || 'Clinical image'}
            className="max-h-[60vh] rounded-lg shadow-lg border border-white/20 object-contain"
          />
          {imageCaption && (
            <p className="text-sm text-white/50 mt-2 text-center italic">{imageCaption}</p>
          )}
        </>
      ) : (
        <div className="w-full h-64 bg-white/5 border-2 border-dashed border-white/20 rounded-lg flex items-center justify-center">
          <p className="text-white/30 text-sm">No clinical image available</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6 items-start">
      {imagePosition === 'left' ? (
        <>{imageContent}{textContent}</>
      ) : (
        <>{textContent}{imageContent}</>
      )}
    </div>
  );
}

/** Bullet list for outline/key points */
export function BulletList({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={`space-y-2 ${ordered ? 'list-decimal' : 'list-disc'} pl-6 text-white/90`}>
      {items.map((item, i) => (
        <li key={i} className="leading-relaxed">{item}</li>
      ))}
    </Tag>
  );
}

/** Key-value pair display for clinical data */
export function DataRow({ label, value, highlight = false }: { label: string; value: string | number | null | undefined; highlight?: boolean }) {
  return (
    <div className={`flex items-start py-2 border-b border-white/10 ${highlight ? 'bg-yellow-500/10 px-3 rounded' : ''}`}>
      <span className="text-white/60 w-48 flex-shrink-0 font-medium">{label}:</span>
      <span className="text-white/90 flex-1">{value || 'N/A'}</span>
    </div>
  );
}

/** Section header inside a slide */
export function SlideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xl font-bold text-white/90 border-b border-white/20 pb-2 mb-3 uppercase tracking-wider" style={{ fontSize: '22px' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

/** Reference list at bottom of slides */
export function ReferenceList({ references }: { references: string[] }) {
  return (
    <div className="mt-8 pt-4 border-t border-white/10">
      <h4 className="text-sm font-bold text-white/40 uppercase tracking-wider mb-2">References</h4>
      <ol className="list-decimal pl-5 text-sm text-white/40 space-y-1">
        {references.map((ref, i) => (
          <li key={i} className="leading-relaxed">{ref}</li>
        ))}
      </ol>
    </div>
  );
}
