// Notation grammar (ported from the old Python scripts, extended).
//   work  :=  item (sep item)*       item := [-] A.P | [-] A.{x-y,z} | [-] A.*
//   line  :=  [rolls] work           rolls := 12,14-16,102
// A leading "-" on a work item means "undo". Multiple lines are supported.
import { activeAssignments, type Course, naturalCompare } from './model';

export interface WorkItem {
  a: number;
  /** explicit problems; null means "whole assignment" (A.*) */
  problems: number[] | null;
  undo: boolean;
}

export interface ParsedLine {
  raw: string;
  rolls: string[] | null; // null = no roll part on the line
  items: WorkItem[];
  error?: string;
}

const ITEM = /(?<!\d)(-)?(\d+)\.(?:\{([^}]*)\}|(\d+)|(\*))/g;

function expandInner(inner: string): number[] {
  const out: number[] = [];
  for (let sub of inner.split(',')) {
    sub = sub.trim();
    const r = /^(\d+)\s*-\s*(\d+)$/.exec(sub);
    if (r) {
      const s = Number(r[1]);
      const e = Number(r[2]);
      for (let p = s; p <= e; p++) out.push(p);
    } else if (/^\d+$/.test(sub)) out.push(Number(sub));
  }
  return out;
}

/** Parse only the work part (legacy-compatible: junk between items is ignored). */
export function parseWork(str: string): WorkItem[] {
  const items: WorkItem[] = [];
  for (const m of (str ?? '').matchAll(ITEM)) {
    const undo = !!m[1];
    const a = Number(m[2]);
    if (m[3] !== undefined) items.push({ a, problems: expandInner(m[3]), undo });
    else if (m[4] !== undefined) items.push({ a, problems: [Number(m[4])], undo });
    else items.push({ a, problems: null, undo });
  }
  return items;
}

/** Legacy-equivalent flat expansion to [assignment, problem] pairs (no "*", no undo). */
export function parseWorkDone(str: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const it of parseWork(str)) if (it.problems) for (const p of it.problems) out.push([it.a, p]);
  return out;
}

export function parseRolls(expr: string): string[] | null {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (r: string) => { if (!seen.has(r)) { seen.add(r); out.push(r); } };
  for (const tok of expr.split(/[,\s]+/).filter(Boolean)) {
    const r = /^(\d+)-(\d+)$/.exec(tok);
    if (r) {
      const s = Number(r[1]);
      const e = Number(r[2]);
      if (e < s || e - s > 5000) return null;
      for (let n = s; n <= e; n++) push(String(n));
    } else if (/^[A-Za-z0-9_]+$/.test(tok)) push(tok);
    else return null;
  }
  return out;
}

export function parseLine(raw: string): ParsedLine {
  const line = raw.trim();
  const first = line.search(/(?<!\d)-?\d+\.(?:\{|\d|\*)/);
  if (first < 0) return { raw, rolls: null, items: [], error: line ? 'No work found (expected e.g. 3.5, 3.{1-4}, 3.*)' : undefined };
  const rollPart = line.slice(0, first).trim();
  const items = parseWork(line.slice(first));
  if (!rollPart) return { raw, rolls: null, items };
  const rolls = parseRolls(rollPart);
  if (!rolls || !rolls.length) return { raw, rolls: null, items, error: `Bad roll list "${rollPart}"` };
  return { raw, rolls, items };
}

export function parseNotation(text: string): ParsedLine[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map(parseLine);
}

export interface Op {
  roll: string;
  a: number;
  p: number;
  undo: boolean;
}

export interface Resolved {
  ops: Op[];
  errors: string[];
}

/** Expand parsed lines against a course: validate rolls/assignments/problem ranges, expand "*". */
export function resolveNotation(lines: ParsedLine[], course: Course, ctxRoll?: string | null): Resolved {
  const ops: Op[] = [];
  const errors: string[] = [];
  const rolls = new Set(course.rolls.filter((r) => r.active).map((r) => r.roll));
  const asg = new Map(activeAssignments(course).map((a) => [a.id, a]));
  const seen = new Set<string>();
  for (const line of lines) {
    if (line.error) { errors.push(`${line.raw.trim()}: ${line.error}`); continue; }
    const targets = line.rolls ?? (ctxRoll ? [ctxRoll] : null);
    if (!targets) { errors.push(`${line.raw.trim()}: no roll selected`); continue; }
    const bad = targets.filter((r) => !rolls.has(r));
    if (bad.length) { errors.push(`Unknown roll${bad.length > 1 ? 's' : ''}: ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? '…' : ''}`); continue; }
    let lineOk = true;
    const lineOps: Array<[number, number, boolean]> = [];
    for (const it of line.items) {
      const a = asg.get(it.a);
      if (!a) { errors.push(`Unknown assignment ${it.a}`); lineOk = false; continue; }
      const ps = it.problems ?? Array.from({ length: a.problems }, (_, i) => i + 1);
      const oob = ps.filter((p) => p < 1 || p > a.problems);
      if (oob.length) { errors.push(`${it.a}.${oob[0]} is out of range (assignment ${it.a} has ${a.problems} problems)`); lineOk = false; continue; }
      for (const p of ps) lineOps.push([it.a, p, it.undo]);
    }
    if (!lineOk) continue;
    for (const r of targets) for (const [a, p, undo] of lineOps) {
      const k = `${r}|${a}.${p}|${undo}`;
      if (!seen.has(k)) { seen.add(k); ops.push({ roll: r, a, p, undo }); }
    }
  }
  return { ops, errors };
}

/** Compress sorted numbers to "1-3,5,7-8". Runs of 2+ become ranges. */
export function compress(nums: Iterable<number>): string {
  const a = [...new Set(nums)].sort((x, y) => x - y);
  const parts: string[] = [];
  for (let i = 0; i < a.length; ) {
    let j = i;
    while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
    parts.push(j > i ? `${a[i]}-${a[j]}` : `${a[i]}`);
    i = j + 1;
  }
  return parts.join(',');
}

/** Format a problem set as `A.{x-y,z}` (single problem → `A.P`). */
export function formatAssignment(a: number, problems: Iterable<number>): string {
  const c = compress(problems);
  if (!c) return '';
  return /^\d+$/.test(c) ? `${a}.${c}` : `${a}.{${c}}`;
}

/** Format map assignment → problems as `1.15,2.{1-6}` ordered by assignment id. */
export function formatWorkDone(map: Map<number, Iterable<number>> | Record<number, number[]>): string {
  const entries = map instanceof Map ? [...map.entries()] : Object.entries(map).map(([k, v]) => [Number(k), v] as [number, Iterable<number>]);
  return entries.sort((x, y) => x[0] - y[0]).map(([a, ps]) => formatAssignment(a, ps)).filter(Boolean).join(',');
}

/** Spaced display variant: `3.5, 3.{9-11}` – every run is its own item (used in share text). */
export function formatRuns(a: number, problems: Iterable<number>): string {
  const c = compress(problems);
  if (!c) return '';
  return c.split(',').map((r) => (/^\d+$/.test(r) ? `${a}.${r}` : `${a}.{${r}}`)).join(', ');
}
