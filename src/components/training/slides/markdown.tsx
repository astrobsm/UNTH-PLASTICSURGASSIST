/**
 * A small, safe Markdown reader for CME article text.
 *
 * Article content arrives as Markdown — sometimes with its line breaks lost on
 * the way ("## Heading Text … - item - item **Bold:** …" on one line), which
 * is why it showed as raw symbols. normaliseMarkdown() restores the breaks;
 * parseBlocks() turns the text into headings, paragraphs, bullet and numbered
 * lists and tables; <Inline> renders **bold**, *italic* and `code`.
 * Everything is rendered as React elements — never as HTML — so article text
 * cannot inject markup.
 */
import React from 'react';

export type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'numbered'; items: string[] }
  | { kind: 'table'; header: string[]; rows: string[][] };

const CONNECTORS = new Set(['and', 'or', 'of', 'the', 'in', 'for', 'to', 'with', 'vs', 'vs.', 'a', 'an', 'on', 'at', 'by', 'from', '&', '-', '–', '/']);

/** "## Title Words Sentence starts here…" → "## Title Words\nSentence starts here…", or null. */
export function splitRunOnHeading(line: string): string | null {
  const m = /^(#{1,6})\s+(.+)$/.exec(line);
  if (!m || m[2].length <= 60) return null;
  const words = m[2].split(/\s+/);
  const isCap = (w: string) => /^[A-Z0-9(]/.test(w);
  const firstLower = words.findIndex((w, i) => i > 0 && !isCap(w) && !CONNECTORS.has(w.toLowerCase()));
  if (firstLower < 2) return null;
  let cut = firstLower - 1;                       // the capitalised word that starts the sentence
  while (cut > 0 && !isCap(words[cut])) cut--;
  if (cut < 1) return null;
  return `${m[1]} ${words.slice(0, cut).join(' ')}\n${words.slice(cut).join(' ')}`;
}

/** Put line breaks back where flattened Markdown lost them. */
export function normaliseMarkdown(raw: string): string {
  let s = String(raw || '').replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
  // Headings run into the previous text: "… text ## Heading"
  s = s.replace(/([^\n#])\s+(#{1,6}\s+)/g, '$1\n$2');
  // Bullets run inline: "… text - Item" (a dash between spaces, followed by a capital, digit or bold)
  s = s.replace(/([^\n])\s+[-•*]\s+(?=(\*\*|[A-Z0-9(]))/g, (m, prev) => (prev === '*' ? m : `${prev}\n- `));
  // Bold labels opening a new thought: "… sentence. **Oral Iron Therapy:**"
  s = s.replace(/([.:)!?])\s+(\*\*[^*\n]{2,80}:\*\*)/g, '$1\n$2');
  // Numbered items run inline: "… text 2. Item"
  s = s.replace(/([^\n\d])\s+(\d{1,2}\.)\s+(?=[A-Z*])/g, '$1\n$2 ');
  // A flattened heading runs into its first sentence: "## Iron Deficiency
  // Treatment Iron deficiency is the most…". Headings are Title Case, the
  // sentence is not, so the heading ends before the last capitalised word that
  // precedes the first ordinary lower-case word.
  s = s.split('\n').map(line => splitRunOnHeading(line.trim()) ?? line).join('\n');
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

const isTableRow = (l: string) => /^\|.*\|$/.test(l.trim());
const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

export function parseBlocks(raw: string): Block[] {
  const lines = normaliseMarkdown(raw).split('\n');
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { out.push({ kind: 'paragraph', text: para.join(' ').trim() }); para = []; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { flush(); continue; }
    const h = /^(#{1,6})\s+(.+)$/.exec(line);
    if (h) { flush(); out.push({ kind: 'heading', level: h[1].length, text: h[2].replace(/\s*#+$/, '') }); continue; }
    if (isTableRow(line)) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        const r = cells(lines[i]);
        if (!r.every(c => /^:?-{2,}:?$/.test(c))) rows.push(r);
        i++;
      }
      i--;
      if (rows.length) out.push({ kind: 'table', header: rows[0], rows: rows.slice(1) });
      continue;
    }
    const b = /^[-•*]\s+(.+)$/.exec(line);
    if (b) {
      flush();
      const last = out[out.length - 1];
      if (last?.kind === 'bullets') last.items.push(b[1]); else out.push({ kind: 'bullets', items: [b[1]] });
      continue;
    }
    const n = /^\d{1,2}[.)]\s+(.+)$/.exec(line);
    if (n) {
      flush();
      const last = out[out.length - 1];
      if (last?.kind === 'numbered') last.items.push(n[1]); else out.push({ kind: 'numbered', items: [n[1]] });
      continue;
    }
    para.push(line);
  }
  flush();
  return out;
}

/** Roughly how much room a block takes on a slide, for pagination. */
export function blockWeight(b: Block): number {
  const words = (t: string) => t.split(/\s+/).length;
  switch (b.kind) {
    case 'heading': return 1.2;
    case 'paragraph': return Math.max(1, words(b.text) / 22);
    case 'bullets': case 'numbered': return b.items.reduce((n, t) => n + Math.max(1, words(t) / 16), 0);
    case 'table': return 1 + b.rows.length * 0.9;
  }
}

/** **bold**, *italic*, `code` — rendered as elements, never as HTML. */
export const Inline: React.FC<{ text: string }> = ({ text }) => {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) parts.push(<strong key={k++} className="font-semibold text-emerald-900">{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) parts.push(<code key={k++} className="px-1 rounded bg-emerald-50 text-emerald-900 text-[0.92em]">{t.slice(1, -1)}</code>);
    else parts.push(<em key={k++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
};

export const Blocks: React.FC<{ blocks: Block[] }> = ({ blocks }) => (
  <div className="space-y-[0.7em]">
    {blocks.map((b, i) => {
      if (b.kind === 'heading') {
        return b.level <= 2
          ? <h3 key={i} className="font-bold text-emerald-800 text-[1.12em] border-l-4 border-amber-400 pl-2"><Inline text={b.text} /></h3>
          : <h4 key={i} className="font-semibold text-emerald-700 text-[1.02em]"><Inline text={b.text} /></h4>;
      }
      if (b.kind === 'paragraph') return <p key={i} className="leading-relaxed text-gray-800"><Inline text={b.text} /></p>;
      if (b.kind === 'bullets') {
        return (
          <ul key={i} className="space-y-[0.35em]">
            {b.items.map((t, j) => (
              <li key={j} className="flex gap-2 leading-snug text-gray-800">
                <span className="mt-[0.45em] h-[0.45em] w-[0.45em] shrink-0 rounded-sm bg-amber-500" aria-hidden />
                <span><Inline text={t} /></span>
              </li>
            ))}
          </ul>
        );
      }
      if (b.kind === 'numbered') {
        return (
          <ol key={i} className="space-y-[0.35em]">
            {b.items.map((t, j) => (
              <li key={j} className="flex gap-2 leading-snug text-gray-800">
                <span className="shrink-0 min-w-[1.5em] h-[1.5em] rounded-full bg-emerald-700 text-white text-[0.75em] font-bold flex items-center justify-center mt-[0.1em]">{j + 1}</span>
                <span><Inline text={t} /></span>
              </li>
            ))}
          </ol>
        );
      }
      return (
        <div key={i} className="overflow-x-auto -mx-1">
          <table className="w-full text-[0.85em] border-collapse">
            <thead><tr>{b.header.map((c, j) => <th key={j} className="bg-emerald-700 text-white text-left px-2 py-1 font-semibold"><Inline text={c} /></th>)}</tr></thead>
            <tbody>{b.rows.map((r, j) => <tr key={j} className={j % 2 ? 'bg-emerald-50/60' : 'bg-white'}>{r.map((c, k) => <td key={k} className="px-2 py-1 border-b border-emerald-100 align-top"><Inline text={c} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    })}
  </div>
);
