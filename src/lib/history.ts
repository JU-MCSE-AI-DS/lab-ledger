// Pure: events -> audit history entries (grouped per batch + action), filters, undo lookups.
import { type LogEvent, parseProblem, naturalCompare } from './model';
import { compress, formatWorkDone, parseRolls } from './notation';
import { resolveDate } from './query';

export interface UndoneRef { id: string; by: string | null; date: string | null }

export interface HistoryEntry {
  key: string;
  batch: string;
  ts: string; // latest event ts in the entry
  date: string;
  by: string;
  action: LogEvent['action'];
  rolls: string[]; // natural order, deduped
  problems: string[]; // "A.P", sorted
  /** cfg: the free text, as-is */
  text: string;
  /** undo: who logged / when, for each cancelled done (unknown ids have null by/date) */
  undone: UndoneRef[];
  events: LogEvent[];
}

export interface HistoryFilter {
  rolls?: string[] | null;
  problem?: string;
  by?: string;
  since?: string;
  until?: string;
}

const splitRef = (ref: string) => ref.split(',').map((s) => s.trim()).filter(Boolean);
const pcmp = (x: string, y: string) => {
  const a = parseProblem(x), b = parseProblem(y);
  return a && b ? a[0] - b[0] || a[1] - b[1] : x.localeCompare(y);
};

export function matchesFilter(e: LogEvent, f: HistoryFilter): boolean {
  if (f.rolls?.length && !f.rolls.includes(e.roll)) return false;
  if (f.problem && e.problem !== f.problem.trim()) return false;
  if (f.by && !e.by.toLowerCase().includes(f.by.trim().toLowerCase())) return false;
  if (f.since && e.date < f.since) return false;
  if (f.until && e.date > f.until) return false;
  return true;
}

/** Build entries, newest first. Events are filtered first; undo references resolve against all events. */
export function buildHistory(events: readonly LogEvent[], filter: HistoryFilter = {}): HistoryEntry[] {
  const byId = new Map<string, LogEvent>();
  for (const e of events) if (!byId.has(e.id)) byId.set(e.id, e);
  const groups = new Map<string, LogEvent[]>();
  for (const e of byId.values()) {
    if (!matchesFilter(e, filter)) continue;
    const k = `${e.batch || `~${e.id}`}\u0000${e.action}\u0000${e.by}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(e);
  }
  const out: HistoryEntry[] = [];
  for (const [key, evs] of groups) {
    const last = evs.reduce((m, e) => (e.ts > m.ts ? e : m));
    const undone: UndoneRef[] = [];
    if (last.action === 'undo') {
      const seen = new Set<string>();
      for (const e of evs) for (const id of splitRef(e.ref)) {
        if (seen.has(id)) continue;
        seen.add(id);
        const d = byId.get(id);
        undone.push({ id, by: d?.by ?? null, date: d?.date ?? null });
      }
    }
    out.push({
      key, batch: last.batch, ts: last.ts, date: last.date, by: last.by, action: last.action,
      rolls: [...new Set(evs.filter((e) => e.action !== 'cfg').map((e) => e.roll))].sort(naturalCompare),
      problems: [...new Set(evs.filter((e) => e.action !== 'cfg').map((e) => e.problem))].sort(pcmp),
      text: last.action === 'cfg' ? evs.map((e) => e.ref).filter(Boolean).join('; ') : '',
      undone, events: evs
    });
  }
  // newest first; ties keep later-inserted groups first
  const indexed = out.map((entry, i) => ({ entry, i }));
  indexed.sort((a, b) => (a.entry.ts < b.entry.ts ? 1 : a.entry.ts > b.entry.ts ? -1 : b.i - a.i));
  return indexed.map((x) => x.entry);
}

/** Latest undo of a cell, if any. */
export function latestUndo(events: readonly LogEvent[], roll: string, problem: string): { by: string; date: string; ts: string } | null {
  let best: LogEvent | null = null;
  for (const e of events) if (e.action === 'undo' && e.roll === roll && e.problem === problem && (!best || e.ts > best.ts)) best = e;
  return best ? { by: best.by, date: best.date, ts: best.ts } : null;
}

/** Compact roll list: numeric rolls as ranges, others as-is. */
export function formatRolls(rolls: string[]): string {
  const nums = rolls.filter((r) => /^\d+$/.test(r));
  const rest = rolls.filter((r) => !/^\d+$/.test(r));
  return [compress(nums.map(Number)), ...rest].filter(Boolean).join(',');
}

export function formatProblems(problems: string[]): string {
  const m = new Map<number, number[]>();
  const odd: string[] = [];
  for (const s of problems) {
    const p = parseProblem(s);
    if (p) (m.get(p[0]) ?? m.set(p[0], []).get(p[0])!).push(p[1]); else odd.push(s);
  }
  return [formatWorkDone(m), ...odd].filter(Boolean).join(',');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-11-18" -> "18 Nov" */
export function formatDay(date: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${Number(m[2])} ${MONTHS[Number(m[1]) - 1]}` : date;
}
/** "2026-11-18" -> locale short day, e.g. "18 Nov" */
export const shortDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
/** ISO ts -> local "20 Nov 14:02" */
export function formatStamp(ts: string): string {
  const d = new Date(ts);
  if (isNaN(+d)) return ts;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * "rolls → problems" segments. A batch is not always rolls × problems (a multi-line paste is one batch),
 * so rolls are grouped by their exact problem set: "12,14-16 → 3.{5-8}; 20 → 3.5".
 */
export function formatWork(events: readonly LogEvent[], maxSegments = Infinity): string {
  const perRoll = new Map<string, Set<string>>();
  for (const e of events) if (e.action !== 'cfg') (perRoll.get(e.roll) ?? perRoll.set(e.roll, new Set()).get(e.roll)!).add(e.problem);
  const segs = new Map<string, { rolls: string[]; problems: string[] }>();
  for (const [roll, ps] of perRoll) {
    const problems = [...ps].sort(pcmp);
    const k = problems.join(' ');
    (segs.get(k) ?? segs.set(k, { rolls: [], problems }).get(k)!).rolls.push(roll);
  }
  const list = [...segs.values()]
    .map((g) => ({ ...g, rolls: g.rolls.sort(naturalCompare) }))
    .sort((x, y) => naturalCompare(x.rolls[0], y.rolls[0]));
  const shown = list.slice(0, maxSegments).map((g) => `${formatRolls(g.rolls)} → ${formatProblems(g.problems)}`);
  const hidden = list.slice(maxSegments).reduce((n, g) => n + g.rolls.length, 0);
  return shown.join('; ') + (hidden ? `; +${hidden} more roll${hidden === 1 ? '' : 's'}` : '');
}

/** The part after "stamp · by · ". */
export function describeEntry(e: HistoryEntry, maxSegments = 3): string {
  if (e.action === 'cfg') return `config: ${e.text || '(no details)'}`;
  const what = formatWork(e.events, maxSegments);
  if (e.action === 'done') return `done ${what}`;
  const known = new Map<string, number>();
  let unknown = 0;
  for (const u of e.undone) {
    if (u.by === null) unknown++;
    else { const k = `${u.by} ${formatDay(u.date ?? '')}`.trim(); known.set(k, (known.get(k) ?? 0) + 1); }
  }
  const parts = [...known.keys()];
  if (unknown) parts.push('unknown entry');
  return `undo ${what}${parts.length ? ` (logged by ${parts.join(', ')})` : ''}`;
}


/** Build a filter from URL-ish string values (invalid bits are reported, not applied). */
export function filterFromStrings(v: { roll?: string; problem?: string; by?: string; since?: string; until?: string }, today: string): { filter: HistoryFilter; errors: string[] } {
  const errors: string[] = [];
  const filter: HistoryFilter = {};
  if (v.roll?.trim()) { const r = parseRolls(v.roll); if (r?.length) filter.rolls = r; else errors.push(`Bad roll "${v.roll}"`); }
  if (v.problem?.trim()) { if (parseProblem(v.problem)) filter.problem = v.problem.trim(); else errors.push(`Bad problem "${v.problem}" (use A.P, e.g. 3.5)`); }
  if (v.by?.trim()) filter.by = v.by.trim();
  if (v.since?.trim()) filter.since = resolveDate(v.since.trim(), today, errors);
  if (v.until?.trim()) filter.until = resolveDate(v.until.trim(), today, errors);
  return { filter, errors };
}
