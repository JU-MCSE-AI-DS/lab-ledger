export type Action = 'done' | 'undo' | 'cfg';

export interface LogEvent {
  id: string;
  ts: string; // ISO UTC
  date: string; // YYYY-MM-DD
  roll: string;
  problem: string; // "A.P"
  action: Action;
  ref: string; // comma list of undone ids (undo) or free text (cfg)
  by: string;
  batch: string;
  device: string;
}

export interface Assignment {
  id: number;
  title: string;
  problems: number;
  problemTitles?: string[];
  active: boolean;
}

export interface RollEntry {
  roll: string;
  active: boolean;
}

export interface Course {
  id: string; // spreadsheet id, or "local-..." for local courses
  kind: 'local' | 'google';
  title: string;
  created: string;
  rolls: RollEntry[];
  assignments: Assignment[];
}

export const LOG_HEADERS = ['id', 'ts', 'date', 'roll', 'problem', 'action', 'ref', 'by', 'batch', 'device'] as const;

/** Key of one (roll, problem) cell in Folded.cells and the staged map. */
export const cellKey = (roll: string, a: number, p: number) => `${roll}|${a}.${p}`;
export function parseCellKey(k: string): { roll: string; a: number; p: number } | null {
  const m = /^(.*)\|(\d+)\.(\d+)$/.exec(k);
  return m ? { roll: m[1], a: Number(m[2]), p: Number(m[3]) } : null;
}
export const problemId = (a: number, p: number) => `${a}.${p}`;
export function parseProblem(s: string): [number, number] | null {
  const m = /^(\d+)\.(\d+)$/.exec(s.trim());
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Natural sort for roll strings ("2" < "10" < "102" < "A1"). */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function eventToRow(e: LogEvent): string[] {
  return [e.id, e.ts, e.date, e.roll, e.problem, e.action, e.ref, e.by, e.batch, e.device];
}

export function rowToEvent(r: string[]): LogEvent | null {
  if (!r[0] || (r[5] !== 'done' && r[5] !== 'undo' && r[5] !== 'cfg')) return null;
  return {
    id: r[0], ts: r[1] ?? '', date: r[2] ?? '', roll: r[3] ?? '', problem: r[4] ?? '',
    action: r[5] as Action, ref: r[6] ?? '', by: r[7] ?? '', batch: r[8] ?? '', device: r[9] ?? ''
  };
}

export function activeAssignments(c: Course): Assignment[] {
  return c.assignments.filter((a) => a.active).sort((x, y) => x.id - y.id);
}
export function activeRolls(c: Course): string[] {
  return c.rolls.filter((r) => r.active).map((r) => r.roll).sort(naturalCompare);
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
}
