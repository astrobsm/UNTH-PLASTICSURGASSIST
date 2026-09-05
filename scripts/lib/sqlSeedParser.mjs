/**
 * Parsing for the CHAMBER seed SQL.
 *
 * Shared by scripts/import-chamber-content.mjs (which replays the files) and
 * scripts/audit-question-bank.mjs (which reads the questions out of them
 * without a database). Keep it the only copy.
 */

/**
 * Splits a SQL script into statements on semicolons outside string literals.
 *
 * Single-quoted strings use '' to escape a quote. Dollar-quoting is tracked,
 * but only outside a string literal: several CME articles contain LaTeX such
 * as $$BMI = ...$$ *inside* a quoted string, which is not PostgreSQL
 * dollar-quoting and must not open a dollar-quoted block.
 */
export function splitStatements(sql) {
  const out = [];
  let buf = '';
  let i = 0;
  let inSingle = false;
  let dollarTag = null;

  while (i < sql.length) {
    const ch = sql[i];
    const rest = sql.slice(i);

    if (dollarTag) {
      if (rest.startsWith(dollarTag)) {
        buf += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      buf += ch;
      i += 1;
      continue;
    }

    if (inSingle) {
      if (ch === "'" && sql[i + 1] === "'") {
        buf += "''";
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
      buf += ch;
      i += 1;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      buf += ch;
      i += 1;
      continue;
    }
    if (ch === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i);
      const end = nl === -1 ? sql.length : nl;
      buf += sql.slice(i, end);
      i = end;
      continue;
    }
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i);
      const stop = end === -1 ? sql.length : end + 2;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }
    const dq = rest.match(/^\$[A-Za-z_]*\$/);
    if (dq) {
      dollarTag = dq[0];
      buf += dollarTag;
      i += dollarTag.length;
      continue;
    }
    if (ch === ';') {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      i += 1;
      continue;
    }
    buf += ch;
    i += 1;
  }

  if (buf.trim()) out.push(buf.trim());
  return out;
}

/** Strips a SQL literal down to its JS value. */
function literal(raw) {
  const t = raw.trim().replace(/::[A-Za-z_][A-Za-z0-9_]*(\[\])?$/, '').trim();
  if (/^null$/i.test(t)) return null;
  if (/^true$/i.test(t)) return true;
  if (/^false$/i.test(t)) return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) {
    return t.slice(1, -1).replace(/''/g, "'");
  }
  return t; // ARRAY[...], function calls, anything else -- kept verbatim.
}

/** Splits one `(a, b, c)` tuple body into its top-level values. */
function splitTupleValues(body) {
  const values = [];
  let buf = '';
  let depth = 0;
  let inSingle = false;

  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (inSingle) {
      if (ch === "'" && body[i + 1] === "'") {
        buf += "''";
        i += 1;
        continue;
      }
      if (ch === "'") inSingle = false;
      buf += ch;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      buf += ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth += 1;
    if (ch === ')' || ch === ']') depth -= 1;
    if (ch === ',' && depth === 0) {
      values.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) values.push(buf);
  return values.map(literal);
}

/**
 * Pulls every row out of the INSERT statements targeting `table`.
 *
 * Returns `[{ ...columns, _file, _statement, _tupleIndex }]`. Column lists vary
 * between seed files (some supply `id`, some omit `option_e`), so values are
 * mapped by the statement's own column list rather than a fixed order.
 */
export function extractInserts(sql, table, file = '') {
  const rows = [];
  const statements = splitStatements(sql);
  // Counts across the whole file, not per statement: several seeds spread one
  // topic over a dozen INSERTs, and (file, index) has to name one row.
  let tupleIndex = 0;

  for (const stmt of statements) {
    const head = stmt.match(
      new RegExp(`INSERT\\s+INTO\\s+${table}\\s*\\(([^)]*)\\)\\s*VALUES`, 'i'),
    );
    if (!head) continue;

    const columns = head[1].split(',').map((c) => c.trim().replace(/"/g, ''));
    let body = stmt.slice(head.index + head[0].length);
    body = body.replace(/\bON\s+CONFLICT[\s\S]*$/i, '');

    // Walk the tuples. Comments are skipped rather than scanned: the seeds
    // label their batches with lines like `-- CATHETER SIZING (French/Charriere)`,
    // and those parentheses are not tuples.
    let i = 0;
    let inSingle = false;
    while (i < body.length) {
      const ch = body[i];
      if (inSingle) {
        if (ch === "'" && body[i + 1] === "'") { i += 2; continue; }
        if (ch === "'") inSingle = false;
        i += 1;
        continue;
      }
      if (ch === "'") { inSingle = true; i += 1; continue; }
      if (ch === '-' && body[i + 1] === '-') {
        const nl = body.indexOf('\n', i);
        i = nl === -1 ? body.length : nl + 1;
        continue;
      }
      if (ch === '/' && body[i + 1] === '*') {
        const end = body.indexOf('*/', i);
        i = end === -1 ? body.length : end + 2;
        continue;
      }
      if (ch !== '(') { i += 1; continue; }

      // Found a tuple start -- scan to its matching close paren.
      let depth = 0;
      let j = i;
      let inner = false;
      for (; j < body.length; j += 1) {
        const c = body[j];
        if (inner) {
          if (c === "'" && body[j + 1] === "'") { j += 1; continue; }
          if (c === "'") inner = false;
          continue;
        }
        if (c === "'") { inner = true; continue; }
        if (c === '(') depth += 1;
        else if (c === ')') {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      if (depth !== 0) break; // Unbalanced -- stop rather than guess.

      const values = splitTupleValues(body.slice(i + 1, j));
      const row = { _file: file, _tupleIndex: tupleIndex };
      columns.forEach((col, k) => { row[col] = values[k]; });
      rows.push(row);
      tupleIndex += 1;
      i = j + 1;
    }
  }

  return rows;
}
