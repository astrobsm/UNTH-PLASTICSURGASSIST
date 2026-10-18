/**
 * CME article as a medical-grade slide deck — green, white and amber, with the
 * University of Nigeria Teaching Hospital, Enugu logo on every slide.
 *
 * Mobile first: on a phone a slide fills the screen height and, if its content
 * is longer than the screen, scrolls inside itself rather than being cut off.
 * Type scales with the screen width. Swipe, arrow buttons, keyboard arrows or
 * the progress strip move between slides; "Present" goes full screen.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Target, Lightbulb, GraduationCap, AlertTriangle, BookMarked, CheckCircle, Clock } from 'lucide-react';
import { Blocks } from './markdown';
import type { Slide } from './buildSlides';

const LOGO = '/unth-logo.png';
const INSTITUTION = 'University of Nigeria Teaching Hospital, Ituku-Ozalla, Enugu';
const DEPARTMENT = 'Department of Plastic, Reconstructive & Aesthetic Surgery';

const KIND_ICON: Partial<Record<Slide['kind'], React.ElementType>> = {
  objectives: Target, keypoints: CheckCircle, pearls: Lightbulb, tips: GraduationCap, mistakes: AlertTriangle, references: BookMarked,
};

export interface SectionStatus { read: boolean; secondsLeft: number }

interface Props {
  slides: Slide[];
  articleTitle: string;
  meta?: string;                       // e.g. "4 sections · 20 MCQs"
  index: number;
  onIndex: (i: number) => void;
  sectionStatus?: (sectionIndex: number) => SectionStatus | null;
  totalSections: number;
}

export default function CMESlideDeck({ slides, articleTitle, meta, index, onIndex, sectionStatus, totalSections }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const slide = slides[Math.min(index, slides.length - 1)];
  const go = useCallback((i: number) => onIndex(Math.max(0, Math.min(slides.length - 1, i))), [onIndex, slides.length]);

  // Each slide starts at its top.
  useEffect(() => { bodyRef.current?.scrollTo?.({ top: 0 }); }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(index + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(index - 1); }
    };
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFs); };
  }, [go, index]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await frameRef.current?.requestFullscreen?.();
    } catch { /* not supported (e.g. iOS Safari) — the deck still works inline */ }
  };

  const onPointerDown = (e: React.PointerEvent) => { swipe.current = { x: e.clientX, y: e.clientY, t: Date.now() }; };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current; swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4 && Date.now() - s.t < 800) go(index + (dx < 0 ? 1 : -1));
  };

  const status = slide.sectionIndex != null ? sectionStatus?.(slide.sectionIndex) : null;
  const Icon = KIND_ICON[slide.kind];
  const pct = slides.length > 1 ? (index / (slides.length - 1)) * 100 : 100;

  return (
    <div ref={frameRef} className={`flex flex-col bg-white ${fullscreen ? 'h-screen' : 'rounded-2xl shadow-lg border border-emerald-100 overflow-hidden'}`}
      style={{ fontSize: 'clamp(14px, 1.1vw + 11px, 21px)' }}>
      {/* Slide */}
      <div
        className={`relative flex flex-col select-text ${fullscreen ? 'flex-1' : 'h-[calc(100dvh-230px)] min-h-[420px] sm:h-auto sm:aspect-[16/10] lg:aspect-video'}`}
        onPointerDown={onPointerDown} onPointerUp={onPointerUp}
        role="region" aria-roledescription="slide" aria-label={`Slide ${index + 1} of ${slides.length}: ${slide.title}`}
      >
        {slide.kind === 'title' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-[6%] py-6 bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 text-white">
            <img src={LOGO} alt="University of Nigeria Teaching Hospital, Enugu" className="w-[22%] min-w-[72px] max-w-[130px] bg-white rounded-full p-2 shadow-lg" />
            <p className="mt-3 text-[0.7em] tracking-[0.18em] uppercase text-amber-300 font-semibold">Continuing Medical Education</p>
            <h2 className="mt-2 font-extrabold leading-tight text-[1.55em] sm:text-[1.9em] max-w-[22ch]">{articleTitle}</h2>
            <div className="mt-4 h-1 w-20 bg-amber-400 rounded-full" />
            <p className="mt-4 text-[0.78em] text-emerald-50">{DEPARTMENT}</p>
            <p className="text-[0.72em] text-emerald-100/90">{INSTITUTION}</p>
            {meta && <p className="mt-3 text-[0.7em] px-3 py-1 rounded-full bg-white/10 border border-white/20">{meta}</p>}
            <p className="mt-6 text-[0.68em] text-emerald-100/80 sm:hidden">Swipe left to begin →</p>
          </div>
        ) : (
          <>
            {/* Header band */}
            <div className="flex items-center gap-2 px-[4%] py-2.5 bg-emerald-800 text-white">
              <img src={LOGO} alt="" className="h-[2.1em] w-[2.1em] bg-white rounded-full p-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[0.62em] uppercase tracking-wider text-amber-300 font-semibold truncate">
                  {slide.sectionIndex != null ? `Section ${slide.sectionIndex + 1} of ${totalSections}` : articleTitle}
                </p>
                <h3 className="font-bold leading-tight text-[1.05em] sm:text-[1.15em] line-clamp-2 flex items-center gap-1.5">
                  {Icon && <Icon className="w-[1em] h-[1em] text-amber-300 shrink-0" />}{slide.title}
                  {slide.part && <span className="font-normal text-[0.7em] text-emerald-100 whitespace-nowrap"> · {slide.part.n}/{slide.part.of}</span>}
                </h3>
              </div>
              {status && (
                <span className={`shrink-0 text-[0.62em] px-2 py-0.5 rounded-full font-semibold ${status.read ? 'bg-white text-emerald-800' : 'bg-amber-400 text-emerald-950'}`}>
                  {status.read ? 'Read ✓' : <><Clock className="inline w-[1em] h-[1em] -mt-0.5" /> {status.secondsLeft}s</>}
                </span>
              )}
            </div>
            <div className="h-1 bg-amber-400" />
            {/* Body — scrolls inside the slide on small screens */}
            <div ref={bodyRef} className={`flex-1 overflow-y-auto px-[5%] py-[3%] ${slide.kind === 'mistakes' ? 'bg-red-50/40' : slide.kind === 'pearls' || slide.kind === 'tips' ? 'bg-amber-50/50' : 'bg-white'}`}>
              <Blocks blocks={slide.blocks} />
            </div>
            {/* Footer */}
            <div className="flex items-center justify-between gap-2 px-[4%] py-1.5 border-t border-emerald-100 bg-emerald-50 text-[0.6em] text-emerald-900">
              <span className="truncate">UNTH Enugu · Plastic Surgery CME</span>
              <span className="shrink-0 font-semibold">{index + 1} / {slides.length}</span>
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-t border-emerald-100">
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous slide"
          className="h-10 w-10 shrink-0 rounded-full border-2 border-emerald-600 text-emerald-700 flex items-center justify-center disabled:opacity-30">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex gap-[2px] h-2" role="tablist" aria-label="Slides">
            {slides.map((s, i) => {
              const st = s.sectionIndex != null ? sectionStatus?.(s.sectionIndex) : null;
              return (
                <button key={s.id} type="button" onClick={() => go(i)} aria-label={`Go to slide ${i + 1}: ${s.title}`} aria-selected={i === index}
                  className={`flex-1 rounded-full transition-colors ${i === index ? 'bg-amber-500' : i < index ? (st && !st.read ? 'bg-amber-200' : 'bg-emerald-600') : 'bg-emerald-100'}`} />
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 text-center truncate">{slide.title} · {Math.round(pct)}%</p>
        </div>
        <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Present full screen'}
          className="hidden sm:flex h-10 w-10 shrink-0 rounded-full border border-gray-300 text-gray-600 items-center justify-center">
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <button type="button" onClick={() => go(index + 1)} disabled={index >= slides.length - 1} aria-label="Next slide"
          className="h-10 w-10 shrink-0 rounded-full bg-emerald-700 text-white flex items-center justify-center disabled:opacity-30">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
