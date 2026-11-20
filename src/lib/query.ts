// Query language: tokenizer + evaluator. Pure.
//   missing 3.{5-8} r:1-30     remaining r:12      done 4.* on:2026-03-13
//   lag>3 a:3                  by:ta@x since:-7d   sort:progress
import { type Course, activeAssignments, activeRolls } from './model';
import { cellKey, type Folded } from './fold';
import { parseRolls, parseWork, formatAssignment } from './notation';
import { computeStats } from './stats';

export type Mode = 'missing' | 'done' | 'lag' | 'summary';

export interface Query {
  mode: Mode;
  work: ReturnType<typeof parseWork>;
  rolls: string[] | null;
  assignments: number[] | null;
  lag?: { op: '>' | '>=' | '<' | '<=' | '='; n: number };
  by?: string;
  on?: string;
  since?: string;
  until?: string;
  sort?: string; // progress | -progress | roll | lag | count
  errors: string[];
}

export interface Row {
  roll: string;
  text: string; // compact notation of the matched problems
  count: number;
  done?: number;
  total?: number;
  lag?: number;
  items: Array<{ a: number; problems: number[] }>;
}

export interface Result {
  query: Query;
  rows: Row[];
  errors: string[];
}

export function tokenize(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  for (const ch of s) {
    if (ch === '{') depth++;
    if (ch === '}') depth = Math.max(0, depth - 1);
    if (/\s/.test(ch) && depth === 0) { if (cur) out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function resolveDate(v: string, today: string, errors: string[]): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const r = /^-(\d+)d$/.exec(v);
  if (r) return addDays(today, -Number(r[1]));
  if (v === 'today') return today;
  errors.push(`Bad date "${v}" (use YYYY-MM-DD or -7d)`);
  return undefined;
}

export function parseQuery(text: string, today: string): Query {
  const q: Query = { mode: 'summary', work: [], rolls: null, assignments: null, errors: [] };
  let explicitMode = false;
  let hasFilter = false;
  for (const tok of tokenize(text)) {
    const lower = tok.toLowerCase();
    let m: RegExpExecArray | null;
    if (lower === 'missing' || lower === 'remaining') { q.mode = 'missing'; explicitMode = true; }
    else if (lower === 'done') { q.mode = 'done'; explicitMode = true; }
    else if ((m = /^lag(>=|<=|>|<|=)(\d+(?:\.\d+)?)$/.exec(lower))) { q.mode = 'lag'; explicitMode = true; q.lag = { op: m[1] as any, n: Number(m[2]) }; }
    else if (lower === 'lagging' || lower === 'lag') { q.mode = 'lag'; explicitMode = true; q.lag = { op: '>', n: 0 }; }
    else if (/^r:/.test(lower)) { const r = parseRolls(tok.slice(2)); if (r) q.rolls = r; else q.errors.push(`Bad roll filter "${tok}"`); }
    else if (/^a:/.test(lower)) {
      const ids = tok.slice(2).split(',').map((x) => Number(x.trim()));
      if (ids.every((n) => Number.isInteger(n) && n > 0)) q.assignments = ids; else q.errors.push(`Bad assignment filter "${tok}"`);
    }
    else if (/^by:/.test(lower)) { q.by = tok.slice(3).toLowerCase(); hasFilter = true; }
    else if (/^on:/.test(lower)) { q.on = resolveDate(tok.slice(3), today, q.errors); hasFilter = true; }
    else if (/^since:/.test(lower)) { q.since = resolveDate(tok.slice(6), today, q.errors); hasFilter = true; }
    else if (/^until:/.test(lower)) { q.until = resolveDate(tok.slice(6), today, q.errors); hasFilter = true; }
    else if (/^sort:/.test(lower)) q.sort = lower.slice(5);
    else if (/^\d+\./.test(tok)) { const w = parseWork(tok); if (w.length) q.work.push(...w); else q.errors.push(`Bad work "${tok}"`); }
    else q.errors.push(`Unknown term "${tok}"`);
  }
  if (!explicitMode && hasFilter) q.mode = 'done';
  return q;
}

const cmp = (op: string, a: number, b: number) =>
  op === '>' ? a > b : op === '>=' ? a >= b : op === '<' ? a < b : op === '<=' ? a <= b : a === b;

export function runQuery(text: string, course: Course, f: Folded, today: string): Result {
  const q = parseQuery(text, today);
  const errors = [...q.errors];
  const asgs = activeAssignments(course);
  const asgMap = new Map(asgs.map((a) => [a.id, a]));
  for (const id of q.assignments ?? []) if (!asgMap.has(id)) errors.push(`Unknown assignment ${id}`);
  for (const w of q.work) if (!asgMap.has(w.a)) errors.push(`Unknown assignment ${w.a}`);

  // Which problems does the query target? map assignment -> problem list
  const target = new Map<number, number[]>();
  const wantAsg = q.assignments ?? (q.work.length ? [...new Set(q.work.map((w) => w.a))] : asgs.map((a) => a.id));
  for (const id of wantAsg) {
    const a = asgMap.get(id);
    if (!a) continue;
    let ps: number[] = Array.from({ length: a.problems }, (_, i) => i + 1);
    const ws = q.work.filter((w) => w.a === id);
    if (ws.length && !ws.some((w) => w.problems === null)) ps = [...new Set(ws.flatMap((w) => w.problems!))].filter((p) => p >= 1 && p <= a.problems);
    target.set(id, ps);
  }

  const allRolls = activeRolls(course);
  const rolls = q.rolls ? allRolls.filter((r) => q.rolls!.includes(r)) : allRolls;
  if (q.rolls) for (const r of q.rolls) if (!allRolls.includes(r)) errors.push(`Unknown roll ${r}`);

  const build = (roll: string, mode: 'missing' | 'done') => {
    const items: Row['items'] = [];
    for (const [a, ps] of target) {
      const hit = ps.filter((p) => {
        const c = f.cells.get(cellKey(roll, a, p));
        if (mode === 'missing') return !c?.done;
        if (!c?.done) return false;
        if (q.on && c.date !== q.on) return false;
        if (q.since && (c.date ?? '') < q.since) return false;
        if (q.until && (c.date ?? '') > q.until) return false;
        if (q.by && !(c.by ?? '').toLowerCase().includes(q.by)) return false;
        return true;
      });
      if (hit.length) items.push({ a, problems: hit });
    }
    const count = items.reduce((s, i) => s + i.problems.length, 0);
    return { roll, items, count, text: items.map((i) => formatAssignment(i.a, i.problems)).join(',') };
  };

  let rows: Row[] = [];
  if (q.mode === 'missing' || q.mode === 'done') {
    rows = rolls.map((r) => build(r, q.mode as 'missing' | 'done')).filter((r) => r.count > 0);
  } else {
    const stats = computeStats(course, f, q.assignments ?? undefined).filter((s) => rolls.includes(s.roll));
    rows = stats
      .filter((s) => q.mode !== 'lag' || cmp(q.lag!.op, s.lag, q.lag!.n))
      .map((s) => ({
        roll: s.roll, done: s.done, total: s.total, lag: s.lag, count: s.done,
        text: q.mode === 'lag' ? `${s.lag > 0 ? '-' : '+'}${Math.abs(s.lag)} vs median` : `${s.done}/${s.total}`,
        items: s.perAssignment.filter((x) => x.missing.length).map((x) => ({ a: x.a, problems: x.missing }))
      }));
  }

  const sort = q.sort ?? (q.mode === 'lag' ? 'lag' : undefined);
  const prog = (r: Row) => (r.total ? (r.done ?? 0) / r.total : r.count);
  if (sort === 'progress') rows.sort((x, y) => prog(x) - prog(y));
  else if (sort === '-progress') rows.sort((x, y) => prog(y) - prog(x));
  else if (sort === 'lag') rows.sort((x, y) => (y.lag ?? 0) - (x.lag ?? 0));
  else if (sort === 'count') rows.sort((x, y) => y.count - x.count);
  else if (sort === '-count') rows.sort((x, y) => x.count - y.count);
  else if (sort && sort !== 'roll') errors.push(`Unknown sort "${sort}"`);
  return { query: q, rows, errors };
}
