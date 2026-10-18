/**
 * Turns a CME article into slides.
 *
 *   title · overview · learning objectives
 *   each section: split at its headings, long parts continued on further slides
 *   key points · clinical pearls · exam tips · common mistakes · references
 *
 * Every content slide records the article section it belongs to, so reading
 * time is credited to that section while its slide is on screen.
 */
import type { CMEArticle } from '../../../services/medicalTrainingService';
import { parseBlocks, blockWeight, type Block } from './markdown';

export type SlideKind = 'title' | 'overview' | 'objectives' | 'section' | 'keypoints' | 'pearls' | 'tips' | 'mistakes' | 'references';

export interface Slide {
  id: string;
  kind: SlideKind;
  title: string;
  /** Article section this slide belongs to (content slides only). */
  sectionIndex?: number;
  /** "Part 2 of 3" when a section's text spans several slides. */
  part?: { n: number; of: number };
  blocks: Block[];
}

/** Content per slide before it continues on the next one (in "lines"). */
export const SLIDE_CAPACITY = 9;

/** Split blocks into slide-sized pages, never splitting inside a heading's first block. */
export function paginate(blocks: Block[], capacity = SLIDE_CAPACITY): Block[][] {
  const pages: Block[][] = [];
  let page: Block[] = [];
  let used = 0;
  const push = () => { if (page.length) pages.push(page); page = []; used = 0; };
  for (const b of blocks) {
    // A long list is split across slides rather than overflowing one.
    if ((b.kind === 'bullets' || b.kind === 'numbered') && blockWeight(b) > capacity) {
      let chunk: string[] = [];
      let w = 0;
      for (const item of b.items) {
        const iw = Math.max(1, item.split(/\s+/).length / 16);
        if (chunk.length && used + w + iw > capacity) { page.push({ kind: b.kind, items: chunk }); push(); chunk = []; w = 0; }
        chunk.push(item); w += iw;
      }
      if (chunk.length) { page.push({ kind: b.kind, items: chunk }); used += w; }
      continue;
    }
    const w = blockWeight(b);
    if (page.length && used + w > capacity) {
      // keep a heading with the block after it
      const last = page[page.length - 1];
      if (last?.kind === 'heading') { page.pop(); push(); page.push(last); used = blockWeight(last); }
      else push();
    }
    page.push(b);
    used += w;
  }
  push();
  return pages;
}

const listSlide = (id: string, kind: SlideKind, title: string, items: string[] | undefined): Slide[] => {
  const clean = (items || []).map(s => String(s || '').trim()).filter(Boolean);
  if (!clean.length) return [];
  const pages = paginate([{ kind: kind === 'references' ? 'numbered' : 'bullets', items: clean }]);
  return pages.map((blocks, i) => ({ id: `${id}-${i}`, kind, title, blocks, part: pages.length > 1 ? { n: i + 1, of: pages.length } : undefined }));
};

export function buildSlides(article: CMEArticle): Slide[] {
  const slides: Slide[] = [{ id: 'title', kind: 'title', title: article.title, blocks: [] }];

  if (article.overview?.trim()) {
    const pages = paginate(parseBlocks(article.overview));
    pages.forEach((blocks, i) => slides.push({ id: `overview-${i}`, kind: 'overview', title: 'Overview', blocks, part: pages.length > 1 ? { n: i + 1, of: pages.length } : undefined }));
  }
  slides.push(...listSlide('objectives', 'objectives', 'Learning objectives', article.learningObjectives));

  (article.sections || []).forEach((section, sectionIndex) => {
    const blocks: Block[] = [...parseBlocks(section.content || '')];
    for (const sub of section.subsections || []) {
      blocks.push({ kind: 'heading', level: 3, text: sub.title });
      blocks.push(...parseBlocks(sub.content || ''));
    }
    // A leading heading that repeats the section title is dropped — the slide header shows it.
    if (blocks[0]?.kind === 'heading' && blocks[0].text.trim().toLowerCase() === section.title.trim().toLowerCase()) blocks.shift();
    const pages = paginate(blocks);
    if (!pages.length) pages.push([{ kind: 'paragraph', text: '—' }]);
    pages.forEach((p, i) => slides.push({
      id: `s${sectionIndex}-${i}`, kind: 'section', title: section.title, sectionIndex, blocks: p,
      part: pages.length > 1 ? { n: i + 1, of: pages.length } : undefined,
    }));
  });

  slides.push(...listSlide('keypoints', 'keypoints', 'Key points', article.keyPoints));
  slides.push(...listSlide('pearls', 'pearls', 'Clinical pearls', article.clinicalPearls));
  slides.push(...listSlide('tips', 'tips', 'Exam tips', article.examTips));
  slides.push(...listSlide('mistakes', 'mistakes', 'Common mistakes to avoid', article.commonMistakes));
  slides.push(...listSlide('references', 'references', 'References', article.references));
  return slides;
}
