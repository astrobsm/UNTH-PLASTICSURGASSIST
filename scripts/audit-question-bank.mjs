#!/usr/bin/env node
/**
 * Audit every question in the CHAMBER seed files before it reaches this app.
 *
 *   node scripts/audit-question-bank.mjs [--seeds <dir>] [--out <dir>] [--json]
 *
 * Reads the SQL directly -- no database needed -- and checks the CBT bank
 * (`questions`) and the CME article self-assessments
 * (`article_self_assessments`) for:
 *
 *   empty      a blank or stub stem, option, or explanation; a correct_option
 *              that names an option the row does not have
 *   duplicate  the same stem twice in the bank, the same stem twice within one
 *              topic, or two options of one question saying the same thing
 *   ambiguous  two plausible keys, an unmarked negative stem, "all of the
 *              above" sitting above another option, a stem that asks two
 *              things at once, a stem that never asks anything
 *   unrelated  a clinical vignette whose options share no clinical vocabulary
 *              with it, or an explanation that argues for a different letter
 *
 * Writes audit/question-bank-report.md (readable) and
 * audit/question-bank.json (every parsed question, for follow-up review).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractInserts } from './lib/sqlSeedParser.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const SEEDS_DIR = opt(
  'seeds',
  [
    process.env.CHAMBER_SEEDS_DIR,
    path.resolve(ROOT, '../CHAMBER/packages/backend/database/seeds'),
    'C:/Users/HomePC/Documents/GitHub/CHAMBER/packages/backend/database/seeds',
  ].filter(Boolean).find((d) => fs.existsSync(d)),
);
const OUT_DIR = path.resolve(ROOT, opt('out', 'audit'));

const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e'];
// A bare "None" is a real answer to "Complications include:", so it is not
// listed here -- only text that carries no clinical meaning at all.
const PLACEHOLDER = /^(n\/?a|tbd|todo|-+|option [a-e]|\.+|xxx+)$/i;

const SUPERSCRIPT = { '\u2070': '0', '\u00b9': '1', '\u00b2': '2', '\u00b3': '3', '\u2074': '4', '\u2075': '5', '\u2076': '6', '\u2077': '7', '\u2078': '8', '\u2079': '9' };
const SUBSCRIPT = { '\u2080': '0', '\u2081': '1', '\u2082': '2', '\u2083': '3', '\u2084': '4', '\u2085': '5', '\u2086': '6', '\u2087': '7', '\u2088': '8', '\u2089': '9' };

/**
 * Lowercase and collapse whitespace, for comparison only.
 *
 * Parentheses and super/subscript digits survive: `Na minus Cl plus HCO3` and
 * `Na minus (Cl plus HCO3)` are different formulae, and `10\u00b3` and `10\u2076`
 * are different concentrations. Flattening either would report real distractor
 * sets as duplicates.
 */
const norm = (s) =>
  String(s ?? '')
    .replace(/[\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079]/g, (c) => SUPERSCRIPT[c])
    .replace(/[\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089]/g, (c) => SUBSCRIPT[c])
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9%+/<>=() ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STOPWORDS = new Set(
  ('a an the of in on at to for with and or is are was were be been being by from as that this '
    + 'these those which what who whom whose it its his her their there then than have has had '
    + 'do does did not no all none above following best most least likely he she they patient '
    + 'presents presenting history year old man woman boy girl male female admitted brought').split(' '),
);
// Parentheses matter to norm() for equality, but must not glue themselves to
// words here -- "(cl" and "cl" are the same term for relatedness purposes.
const contentWords = (s) =>
  new Set(
    norm(s)
      .replace(/[()]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
  );

/**
 * A stem is a clinical vignette when it describes a particular patient.
 *
 * "A 45-year-old woman has recurrent RUQ pain" is one. "Renal cell carcinoma
 * classically presents with:" is not -- it is a textbook fact stated about a
 * disease, and reading it as a vignette flags well-formed questions.
 */
const isVignette = (stem) =>
  /\b\d{1,3}[- ]?(year|month|week|day)[- ]?old\b/i.test(stem)
  || /\b(a|an|the)\s+(patient|man|woman|boy|girl|child|infant|neonate|adult)\b/i.test(stem)
  || /\b(is brought|is admitted|was admitted|presents to|presenting to|arrives at)\b/i.test(stem);

// ---------------------------------------------------------------------------

/** 01 < 02 < 10 < 100 < 200 < 200b < 201 -- the order the importer applies. */
function seedOrder(a, b) {
  const num = (f) => {
    const m = f.match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
  };
  return num(a) - num(b) || a.localeCompare(b);
}

function loadQuestions() {
  // Sorted the way import-chamber-content.mjs applies them, so that
  // "which declaration wins" here matches what the database will hold.
  const files = fs.readdirSync(SEEDS_DIR).filter((f) => f.endsWith('.sql')).sort(seedOrder);
  const cbt = [];
  const selfAssessment = [];
  const topicNames = new Map();
  const topicDecls = new Map();
  const articleDecls = new Map();
  const topicRefs = new Map();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf8');

    for (const t of extractInserts(sql, 'topics', file)) {
      if (!t.id) continue;
      // First declaration wins: the seeds insert ON CONFLICT DO NOTHING, so
      // the earliest file to claim an id is the one the database keeps.
      if (!topicNames.has(t.id)) topicNames.set(t.id, t.name);
      if (!topicDecls.has(t.id)) topicDecls.set(t.id, []);
      topicDecls.get(t.id).push({ file, name: t.name, category_id: t.category_id });
    }
    for (const a of extractInserts(sql, 'cme_articles', file)) {
      if (!a.id) continue;
      if (!articleDecls.has(a.id)) articleDecls.set(a.id, []);
      articleDecls.get(a.id).push({ file, title: a.title, topic_id: a.topic_id });
    }
    for (const q of extractInserts(sql, 'questions', file)) {
      cbt.push({ ...q, _kind: 'cbt', _group: q.topic_id ?? null });
      if (q.topic_id) {
        if (!topicRefs.has(q.topic_id)) topicRefs.set(q.topic_id, []);
        topicRefs.get(q.topic_id).push({ file, category_id: q.category_id });
      }
    }
    for (const q of extractInserts(sql, 'article_self_assessments', file)) {
      selfAssessment.push({ ...q, _kind: 'self_assessment', _group: q.article_id ?? null });
    }
  }
  return { cbt, selfAssessment, topicNames, topicDecls, articleDecls, topicRefs };
}

/**
 * Integrity of the content graph itself, as opposed to any single question.
 *
 * The seeds hard-code UUIDs and insert ON CONFLICT DO NOTHING, so two files
 * claiming one id is silent: the later one is simply discarded. That is fine
 * while nothing references the discarded row and fatal the moment something
 * does, so it is reported either way.
 */
function checkContentIntegrity({ topicDecls, articleDecls, topicRefs, topicNames }) {
  const findings = { collisions: [], dangling: [], categoryMismatch: [] };

  for (const [id, decls] of topicDecls) {
    const names = new Set(decls.map((d) => d.name));
    const cats = new Set(decls.map((d) => d.category_id));
    if (names.size > 1 || cats.size > 1) {
      const winner = decls[0];
      const losers = decls.slice(1);
      const referenced = (topicRefs.get(id) || []).length;
      findings.collisions.push({ id, winner, losers, referenced });
    }
  }

  for (const [id, refs] of topicRefs) {
    if (!topicNames.has(id)) {
      findings.dangling.push({ id, count: refs.length, example: refs[0].file });
      continue;
    }
    const declaredCat = topicDecls.get(id)[0].category_id;
    for (const r of refs) {
      if (r.category_id && declaredCat && r.category_id !== declaredCat) {
        findings.categoryMismatch.push({
          id, file: r.file, questionCategory: r.category_id,
          topicCategory: declaredCat, topicName: topicNames.get(id),
        });
      }
    }
  }

  const dupArticles = [...articleDecls.entries()]
    .filter(([, d]) => d.length > 1)
    .map(([id, d]) => ({ id, files: d.map((x) => x.file) }));

  return { ...findings, dupArticles };
}

// ---------------------------------------------------------------------------
// Checks. Each pushes { severity, code, message } onto the question.
// ---------------------------------------------------------------------------

function checkStructure(q, issues) {
  const stem = String(q.question_text ?? '').trim();

  if (!stem) issues.push(['error', 'empty-stem', 'question_text is blank']);
  else if (stem.length < 12) issues.push(['error', 'stub-stem', `stem is only ${stem.length} characters: "${stem}"`]);

  const present = OPTION_KEYS.filter((k) => `option_${k}` in q);
  for (const k of present) {
    const v = q[`option_${k}`];
    if (v === null || v === undefined) {
      // option_e is legitimately absent in the four-option article sets.
      if (k !== 'e') issues.push(['error', 'empty-option', `option_${k} is NULL`]);
      continue;
    }
    const text = String(v).trim();
    if (!text) issues.push(['error', 'empty-option', `option_${k} is blank`]);
    else if (PLACEHOLDER.test(text)) issues.push(['error', 'placeholder-option', `option_${k} is a placeholder: "${text}"`]);
  }

  const explanation = String(q.explanation ?? '').trim();
  if (!explanation) issues.push(['error', 'empty-explanation', 'explanation is blank']);
  else if (explanation.length < 20) issues.push(['warn', 'thin-explanation', `explanation is only ${explanation.length} characters`]);

  const key = String(q.correct_option ?? '').trim().toUpperCase();
  if (!key) issues.push(['error', 'no-key', 'correct_option is blank']);
  else if (!'ABCDE'.includes(key) || key.length !== 1) issues.push(['error', 'bad-key', `correct_option is "${key}"`]);
  else {
    const target = q[`option_${key.toLowerCase()}`];
    if (target === null || target === undefined || !String(target).trim()) {
      issues.push(['error', 'key-without-option', `correct_option is ${key} but option_${key.toLowerCase()} is empty`]);
    }
  }
}

function checkOptionQuality(q, issues) {
  const opts = OPTION_KEYS
    .filter((k) => q[`option_${k}`] != null && String(q[`option_${k}`]).trim())
    .map((k) => ({ k, raw: String(q[`option_${k}`]).trim(), n: norm(q[`option_${k}`]) }));

  // Two options saying the same thing make the key indefensible.
  const seen = new Map();
  for (const o of opts) {
    if (seen.has(o.n)) {
      issues.push(['error', 'duplicate-option', `option_${seen.get(o.n)} and option_${o.k} are the same: "${o.raw}"`]);
    } else {
      seen.set(o.n, o.k);
    }
  }

  const all = opts.filter((o) => /^all of the above/.test(o.n));
  const none = opts.filter((o) => /^none of the above/.test(o.n));
  if (all.length && none.length) {
    issues.push(['warn', 'all-and-none', '"all of the above" and "none of the above" both offered']);
  }
  for (const o of [...all, ...none]) {
    if (o.k !== opts[opts.length - 1].k) {
      issues.push(['warn', 'catchall-misplaced', `"${o.raw}" is option_${o.k}, not the last option`]);
    }
  }

  // A key markedly longer than every distractor is a giveaway.
  const key = String(q.correct_option ?? '').trim().toLowerCase();
  const keyOpt = opts.find((o) => o.k === key);
  const others = opts.filter((o) => o.k !== key);
  if (keyOpt && others.length >= 2) {
    const mean = others.reduce((s, o) => s + o.raw.length, 0) / others.length;
    if (mean > 0 && keyOpt.raw.length > mean * 2 && keyOpt.raw.length - mean > 40) {
      issues.push(['warn', 'key-length-cue', `the key is ${Math.round(keyOpt.raw.length / mean)}x longer than the average distractor`]);
    }
  }
}

function checkStem(q, issues) {
  const stem = String(q.question_text ?? '').trim();
  if (!stem) return;

  const questionMarks = (stem.match(/\?/g) || []).length;
  if (questionMarks > 1) {
    issues.push(['warn', 'two-questions', `the stem asks ${questionMarks} separate questions`]);
  }

  // A vignette that never gets round to asking anything.
  const vignette = isVignette(stem);
  const asks = questionMarks > 0
    || /:\s*$/.test(stem)
    || /\b(which|what|how|why|when|where|who|identify|select|choose|calculate|the (most|best|next|least))\b/i.test(stem);
  if (vignette && !asks) {
    issues.push(['error', 'vignette-without-question', 'clinical scenario with no question asked']);
  }
  if (!vignette && !asks && !/\bis\b|\bare\b|_{3,}/.test(stem)) {
    issues.push(['warn', 'no-interrogative', 'the stem neither asks a question nor forms a completion sentence']);
  }

  // Truncation.
  if (/[,;]\s*$/.test(stem)) issues.push(['error', 'truncated-stem', 'stem ends on a comma or semicolon']);
  if (/\b(and|or|the|of|with|for|to|in|a|an)\s*$/i.test(stem)) {
    issues.push(['error', 'truncated-stem', 'stem ends mid-phrase']);
  }

  // Negative stems must be shouted, or half the cohort misreads them.
  const negative = stem.match(/\b(not|except|least|false|incorrect|inappropriate)\b/i);
  if (negative) {
    const word = negative[0];
    const shouted = new RegExp(`\\b${word.toUpperCase()}\\b`).test(stem)
      || new RegExp(`\\*\\*${word}`, 'i').test(stem);
    if (!shouted && /\b(which|what)\b/i.test(stem)) {
      issues.push(['warn', 'unmarked-negative', `negative stem: "${word}" is not capitalised`]);
    }
  }
}

/**
 * Does the vignette actually bear on the options, and does the explanation
 * argue for the letter the row claims?
 */
function checkRelatedness(q, issues) {
  const stem = String(q.question_text ?? '').trim();
  if (!stem) return;

  if (isVignette(stem)) {
    const stemWords = contentWords(stem);
    const optionWords = new Set();
    for (const k of OPTION_KEYS) {
      const v = q[`option_${k}`];
      if (v != null) contentWords(v).forEach((w) => optionWords.add(w));
    }
    if (stemWords.size >= 4 && optionWords.size >= 4) {
      const shared = [...stemWords].filter((w) => optionWords.has(w));
      const explanationWords = contentWords(q.explanation);
      const sharedWithExplanation = [...stemWords].filter((w) => explanationWords.has(w));
      // No vocabulary in common with either the options or the explanation is
      // the signature of a stem paired with the wrong answer set.
      // Advisory only. Manual review of every question this flagged found no
      // genuine mismatch: a good vignette often shares no vocabulary with its
      // options, because the options name the diagnosis the vignette
      // deliberately withholds. Kept as a signal for newly added content, not
      // as a claim that the question is wrong.
      if (shared.length === 0 && sharedWithExplanation.length <= 1) {
        issues.push(['warn', 'low-vocabulary-overlap',
          'the scenario shares no wording with any option or the explanation -- worth an eye, usually fine']);
      }
    }
  }

  // The explanation is the third opinion on which letter is right.
  const key = String(q.correct_option ?? '').trim().toUpperCase();
  const explanation = String(q.explanation ?? '');
  if (key && 'ABCDE'.includes(key) && explanation) {
    const claimed = explanation.match(/\b(?:option|answer|choice)\s+\(?([A-E])\)?\b/i);
    if (claimed && claimed[1].toUpperCase() !== key) {
      const alsoNamesKey = new RegExp(`\\b(?:option|answer|choice)\\s+\\(?${key}\\)?\\b`, 'i').test(explanation);
      // A distractor is often named in order to rule it out -- "Dry heat
      // sterilization (option D pattern) requires 160°C" is not a claim that D
      // is right. Only contradict when the explanation also fails to state
      // what the key actually says.
      const keyText = q[`option_${key.toLowerCase()}`];
      const keyWords = keyText ? contentWords(keyText) : new Set();
      const explanationWords = contentWords(explanation);
      const restatesKey = keyWords.size > 0
        && [...keyWords].filter((w) => explanationWords.has(w)).length >= Math.min(2, keyWords.size);
      if (!alsoNamesKey && !restatesKey) {
        issues.push(['error', 'explanation-contradicts-key',
          `correct_option is ${key} but the explanation argues for ${claimed[1].toUpperCase()}`]);
      }
    }

    // The explanation should restate the key, not a distractor.
    const keyText = q[`option_${key.toLowerCase()}`];
    if (keyText && String(keyText).length > 12) {
      const keyWords = contentWords(keyText);
      const explanationWords = contentWords(explanation);
      if (keyWords.size >= 3) {
        const overlap = [...keyWords].filter((w) => explanationWords.has(w)).length;
        if (overlap === 0) {
          issues.push(['warn', 'explanation-ignores-key',
            'the explanation never mentions anything from the correct option']);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------

function auditSet(questions, label) {
  const byStem = new Map();
  const byTopicStem = new Map();
  const byWhole = new Map();

  for (const q of questions) {
    q._issues = [];
    checkStructure(q, q._issues);
    checkOptionQuality(q, q._issues);
    checkStem(q, q._issues);
    checkRelatedness(q, q._issues);

    const stemKey = norm(q.question_text);
    if (!stemKey) continue;

    if (!byStem.has(stemKey)) byStem.set(stemKey, []);
    byStem.get(stemKey).push(q);

    const topicKey = `${q._group}::${stemKey}`;
    if (!byTopicStem.has(topicKey)) byTopicStem.set(topicKey, []);
    byTopicStem.get(topicKey).push(q);

    const wholeKey = [stemKey, ...OPTION_KEYS.map((k) => norm(q[`option_${k}`]))].join('|');
    if (!byWhole.has(wholeKey)) byWhole.set(wholeKey, []);
    byWhole.get(wholeKey).push(q);
  }

  for (const [, group] of byWhole) {
    if (group.length < 2) continue;
    const where = group.map((g) => g._file).join(', ');
    group.forEach((g) => g._issues.push(['error', 'duplicate-question',
      `identical question (stem and all options) appears ${group.length} times: ${where}`]));
  }
  for (const [, group] of byTopicStem) {
    if (group.length < 2) continue;
    if (group.every((g) => g._issues.some(([, code]) => code === 'duplicate-question'))) continue;
    group.forEach((g) => g._issues.push(['error', 'duplicate-stem-in-topic',
      `the same stem appears ${group.length} times within one ${g._kind === 'cbt' ? 'topic' : 'article'}`]));
  }
  for (const [, group] of byStem) {
    if (group.length < 2) continue;
    const groups = new Set(group.map((g) => g._group));
    if (groups.size < 2) continue; // Already reported as a within-topic repeat.
    if (group.every((g) => g._issues.some(([, code]) => code === 'duplicate-question'))) continue;
    group.forEach((g) => g._issues.push(['warn', 'duplicate-stem-across-topics',
      `the same stem appears under ${groups.size} different ${g._kind === 'cbt' ? 'topics' : 'articles'}`]));
  }

  const counts = new Map();
  for (const q of questions) {
    for (const [severity, code] of q._issues) {
      const k = `${severity}:${code}`;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }

  const keyBalance = {};
  for (const q of questions) {
    const k = String(q.correct_option ?? '?').toUpperCase();
    keyBalance[k] = (keyBalance[k] || 0) + 1;
  }

  return { label, questions, counts, keyBalance };
}

function renderIntegrity(integrity) {
  const lines = ['## Content graph integrity', ''];

  lines.push(`- topic id collisions: **${integrity.collisions.length}**`);
  lines.push(`- questions pointing at an undeclared topic: **${integrity.dangling.length}**`);
  lines.push(`- questions whose category disagrees with their topic: **${integrity.categoryMismatch.length}**`);
  lines.push(`- CME articles declared more than once: **${integrity.dupArticles.length}**`);
  lines.push('');

  if (integrity.collisions.length) {
    const live = integrity.collisions.filter((c) => c.referenced > 0);
    lines.push('### Topic ids claimed by more than one file', '');
    lines.push('The seeds insert `ON CONFLICT DO NOTHING`, so the first file to claim an id keeps it');
    lines.push('and the rest are dropped without a word. Collisions where nothing references the id are');
    lines.push('dead weight; collisions where something does would mis-file questions.', '');
    lines.push(`**${live.length} of ${integrity.collisions.length} collisions have a question referencing the id.**`, '');
    lines.push('| id | kept (first file wins) | discarded | questions referencing |');
    lines.push('| --- | --- | --- | ---: |');
    for (const c of integrity.collisions.slice(0, 80)) {
      const kept = `${c.winner.name} — \`${c.winner.file}\``;
      const lost = c.losers.map((l) => `${l.name} — \`${l.file}\``).join('<br>');
      lines.push(`| \`${c.id.slice(0, 13)}…\` | ${kept} | ${lost} | ${c.referenced} |`);
    }
    if (integrity.collisions.length > 80) lines.push(`\n…and ${integrity.collisions.length - 80} more.`);
    lines.push('');
  }

  for (const [title, rows, fmt] of [
    ['Questions pointing at an undeclared topic', integrity.dangling,
      (d) => `- \`${d.id}\` — ${d.count} questions, e.g. \`${d.example}\``],
    ['Questions whose category disagrees with their topic', integrity.categoryMismatch,
      (d) => `- \`${d.file}\` — question says ${d.questionCategory}, topic "${d.topicName}" is ${d.topicCategory}`],
    ['CME articles declared more than once', integrity.dupArticles,
      (d) => `- \`${d.id}\` — ${d.files.join(', ')}`],
  ]) {
    if (!rows.length) continue;
    lines.push(`### ${title} (${rows.length})`, '');
    rows.slice(0, 40).forEach((r) => lines.push(fmt(r)));
    if (rows.length > 40) lines.push(`- …and ${rows.length - 40} more`);
    lines.push('');
  }

  return lines.join('\n');
}

function renderReport(results, topicNames, integrity) {
  const lines = [];
  lines.push('# Question bank audit');
  lines.push('');
  lines.push(`Source: \`${SEEDS_DIR}\``);
  lines.push(`Run: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(renderIntegrity(integrity));

  for (const r of results) {
    const flagged = r.questions.filter((q) => q._issues.length);
    const errors = r.questions.filter((q) => q._issues.some(([s]) => s === 'error'));
    lines.push(`## ${r.label}`);
    lines.push('');
    lines.push(`- parsed: **${r.questions.length}**`);
    lines.push(`- clean: **${r.questions.length - flagged.length}**`);
    lines.push(`- with errors: **${errors.length}**`);
    lines.push(`- with warnings only: **${flagged.length - errors.length}**`);
    lines.push('');
    lines.push('| severity | check | count |');
    lines.push('| --- | --- | ---: |');
    [...r.counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, n]) => {
        const [severity, code] = k.split(':');
        lines.push(`| ${severity} | ${code} | ${n} |`);
      });
    if (!r.counts.size) lines.push('| | nothing flagged | 0 |');
    lines.push('');
    lines.push(`Answer key balance: ${JSON.stringify(r.keyBalance)}`);
    lines.push('');

    const byCode = new Map();
    for (const q of r.questions) {
      for (const [severity, code, message] of q._issues) {
        if (!byCode.has(code)) byCode.set(code, { severity, items: [] });
        byCode.get(code).items.push({ q, message });
      }
    }
    for (const [code, { severity, items }] of [...byCode.entries()].sort(
      (a, b) => (a[1].severity === b[1].severity ? b[1].items.length - a[1].items.length : a[1].severity === 'error' ? -1 : 1),
    )) {
      lines.push(`### ${severity}: ${code} (${items.length})`);
      lines.push('');
      for (const { q, message } of items.slice(0, 40)) {
        const topic = topicNames.get(q._group) || q._group || '';
        const stem = String(q.question_text ?? '').replace(/\s+/g, ' ').slice(0, 150);
        lines.push(`- \`${q._file}\` #${q._tupleIndex}${topic ? ` — ${topic}` : ''}`);
        lines.push(`  - ${message}`);
        lines.push(`  - stem: ${stem}${stem.length >= 150 ? '…' : ''}`);
      }
      if (items.length > 40) lines.push(`- …and ${items.length - 40} more (see question-bank.json)`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------

function main() {
  if (!SEEDS_DIR || !fs.existsSync(SEEDS_DIR)) {
    console.error('Could not find the CHAMBER seeds directory. Pass --seeds <dir>.');
    process.exit(1);
  }

  const loaded = loadQuestions();
  const { cbt, selfAssessment, topicNames } = loaded;
  const integrity = checkContentIntegrity(loaded);
  const results = [
    auditSet(cbt, 'CBT question bank (`questions`)'),
    auditSet(selfAssessment, 'CME self-assessments (`article_self_assessments`)'),
  ];

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, 'question-bank-report.md'),
    renderReport(results, topicNames, integrity),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'question-bank.json'),
    JSON.stringify(
      results.map((r) => ({
        label: r.label,
        keyBalance: r.keyBalance,
        questions: r.questions.map((q) => ({
          file: q._file,
          index: q._tupleIndex,
          kind: q._kind,
          group: q._group,
          groupName: topicNames.get(q._group) || null,
          question_text: q.question_text,
          options: Object.fromEntries(
            OPTION_KEYS.filter((k) => `option_${k}` in q).map((k) => [k.toUpperCase(), q[`option_${k}`]]),
          ),
          correct_option: q.correct_option,
          explanation: q.explanation,
          issues: q._issues.map(([severity, code, message]) => ({ severity, code, message })),
        })),
      })),
      null,
      2,
    ),
  );

  for (const r of results) {
    const errors = r.questions.filter((q) => q._issues.some(([s]) => s === 'error')).length;
    const warns = r.questions.filter((q) => q._issues.length && !q._issues.some(([s]) => s === 'error')).length;
    console.log(`${r.label}`);
    console.log(`  parsed ${r.questions.length}, ${errors} with errors, ${warns} with warnings only`);
    [...r.counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`    ${k.padEnd(42)} ${n}`));
    console.log('');
  }
  console.log('Content graph integrity');
  console.log(`  topic id collisions              ${integrity.collisions.length}`
    + ` (${integrity.collisions.filter((c) => c.referenced > 0).length} referenced by a question)`);
  console.log(`  questions on undeclared topics   ${integrity.dangling.length}`);
  console.log(`  question/topic category clashes  ${integrity.categoryMismatch.length}`);
  console.log(`  articles declared twice          ${integrity.dupArticles.length}`);
  console.log('');
  console.log(`Report: ${path.join(OUT_DIR, 'question-bank-report.md')}`);
  console.log(`Data:   ${path.join(OUT_DIR, 'question-bank.json')}`);
}

main();
