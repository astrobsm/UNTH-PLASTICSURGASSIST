/**
 * CME articles as slides: flattened Markdown is repaired and rendered (no raw
 * "##" or "**"), sections are paginated into slides tagged with their section,
 * and the deck shows the UNTH logo and moves by button and swipe.
 */
import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { normaliseMarkdown, parseBlocks, splitRunOnHeading, Blocks } from '../components/training/slides/markdown';
import { buildSlides, paginate } from '../components/training/slides/buildSlides';
import CMESlideDeck from '../components/training/slides/CMESlideDeck';

// Exactly as it reached the screen: one line, Markdown symbols intact.
const FLAT = "## Preoperative Anemia Management Preoperative anemia is a powerful independent predictor of adverse surgical outcomes. ### Anemia Detection and Workup All patients scheduled for procedures with expected blood loss should be screened. The WHO defines anemia as: - Hemoglobin <13 g/dL in men - Hemoglobin <12 g/dL in non-pregnant women **Anemia workup should include:** - Complete blood count with indices (MCV, MCH, MCHC, RDW) - Reticulocyte count ### Iron Deficiency Treatment Iron deficiency is the most common cause of anemia worldwide. **Oral Iron Therapy:** - Ferrous sulfate 325 mg (65 mg elemental iron) 2-3 times daily - Takes 4-6 weeks for significant hemoglobin rise";

describe('markdown repair', () => {
  it('splits a heading from the sentence it ran into', () => {
    expect(splitRunOnHeading('## Preoperative Anemia Management Preoperative anemia is a powerful independent predictor of outcomes'))
      .toBe('## Preoperative Anemia Management\nPreoperative anemia is a powerful independent predictor of outcomes');
    expect(splitRunOnHeading('### Anemia Detection and Workup All patients scheduled for procedures should be screened'))
      .toBe('### Anemia Detection and Workup\nAll patients scheduled for procedures should be screened');
    expect(splitRunOnHeading('## Short heading')).toBeNull();
  });

  it('recovers headings, paragraphs, bullets and bold labels from flattened text', () => {
    const blocks = parseBlocks(FLAT);
    const headings = blocks.filter(b => b.kind === 'heading').map(b => (b as any).text);
    expect(headings).toEqual(['Preoperative Anemia Management', 'Anemia Detection and Workup', 'Iron Deficiency Treatment']);
    const bullets = blocks.filter(b => b.kind === 'bullets').flatMap(b => (b as any).items);
    expect(bullets).toContain('Hemoglobin <13 g/dL in men');
    expect(bullets).toContain('Reticulocyte count');
    expect(normaliseMarkdown(FLAT)).toMatch(/\n\*\*Oral Iron Therapy:\*\*/);
  });

  it('renders without raw markup', () => {
    const { container } = render(<Blocks blocks={parseBlocks(FLAT)} />);
    expect(container.textContent).not.toMatch(/##|\*\*/);
    expect(screen.getByText('Oral Iron Therapy:').tagName).toBe('STRONG');
  });

  it('keeps proper Markdown as it is', () => {
    const md = '## Title\n\nA paragraph.\n\n- one\n- two\n\n1. first\n2. second\n\n| A | B |\n|---|---|\n| 1 | 2 |';
    expect(parseBlocks(md).map(b => b.kind)).toEqual(['heading', 'paragraph', 'bullets', 'numbered', 'table']);
  });
});

const article: any = {
  title: 'Blood Conservation Strategies', overview: 'Why blood conservation matters.',
  learningObjectives: ['Describe PBM', 'List autotransfusion methods'],
  sections: [
    { title: 'Preoperative Blood Conservation', content: FLAT + ' ' + FLAT },
    { title: 'Intraoperative Techniques', content: 'Cell salvage reduces allogeneic transfusion.' },
  ],
  keyPoints: ['Treat anaemia before surgery'], examTips: [], clinicalPearls: ['Tranexamic acid'], commonMistakes: [], references: ['Shander A. PBM. 2020'],
  selfAssessment: [],
};

describe('slides from an article', () => {
  const slides = buildSlides(article);
  it('title, overview, objectives, sections (continued as needed), then key points', () => {
    expect(slides[0].kind).toBe('title');
    expect(slides.map(s => s.kind)).toEqual(expect.arrayContaining(['overview', 'objectives', 'section', 'keypoints', 'pearls', 'references']));
    const s0 = slides.filter(s => s.sectionIndex === 0);
    expect(s0.length).toBeGreaterThan(1);                      // long section continues
    expect(s0.every(s => s.part && s.part.of === s0.length)).toBe(true);
    expect(slides.filter(s => s.sectionIndex === 1)).toHaveLength(1);
  });
  it('a long list is split across slides', () => {
    const pages = paginate([{ kind: 'bullets', items: Array.from({ length: 30 }, (_, i) => `Item ${i}`) }]);
    expect(pages.length).toBeGreaterThan(1);
  });
});

describe('the slide deck', () => {
  const Harness = () => {
    const slides = buildSlides(article);
    const [i, setI] = useState(0);
    return <CMESlideDeck slides={slides} articleTitle={article.title} index={i} onIndex={setI} totalSections={2}
      sectionStatus={() => ({ read: false, secondsLeft: 25 })} />;
  };
  it('opens on a branded title slide and moves by button and swipe', () => {
    render(<Harness />);
    expect(screen.getAllByAltText(/University of Nigeria Teaching Hospital, Enugu/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Ituku-Ozalla, Enugu/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Next slide'));
    expect(screen.getByText('Overview')).toBeTruthy();
    const region = screen.getByRole('region');
    fireEvent.pointerDown(region, { clientX: 300, clientY: 200 });
    fireEvent.pointerUp(region, { clientX: 100, clientY: 205 });
    expect(screen.getByText('Learning objectives')).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Go to slide 4:/));
    expect(screen.getByText('Section 1 of 2')).toBeTruthy();
    expect(screen.getByText(/25s/)).toBeTruthy();               // time still needed on this section
  });
});
