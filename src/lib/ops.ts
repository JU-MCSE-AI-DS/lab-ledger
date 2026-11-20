// Pure: turn user intent (ops) into log events, and revert a batch.
import { type LogEvent, type Course, uuid, problemId, parseProblem } from './model';
import type { Folded } from './fold';
import { cellKey } from './fold';
import type { Op } from './notation';

export interface Ctx {
  date: string;
  by: string;
  device: string;
  now?: () => string;
  newId?: () => string;
  batch?: string;
}

/** Ops -> events, skipping no-ops (done on a done cell, undo on a not-done cell). */
export function buildEvents(ops: Op[], state: Folded, ctx: Ctx): LogEvent[] {
  const batch = ctx.batch ?? uuid();
  const now = ctx.now ?? (() => new Date().toISOString());
  const id = ctx.newId ?? uuid;
  const out: LogEvent[] = [];
  for (const op of ops) {
    const cell = state.cells.get(cellKey(op.roll, op.a, op.p));
    const base = { ts: now(), date: ctx.date, roll: op.roll, problem: problemId(op.a, op.p), by: ctx.by, batch, device: ctx.device };
    if (!op.undo) {
      if (cell?.done) continue;
      out.push({ ...base, id: id(), action: 'done', ref: '' });
    } else {
      if (!cell?.done) continue;
      out.push({ ...base, id: id(), action: 'undo', ref: cell.ids.join(',') });
    }
  }
  return out;
}

/** Events that revert a previously saved batch. */
export function revertEvents(batch: LogEvent[], all: LogEvent[], ctx: Ctx): LogEvent[] {
  const b = ctx.batch ?? uuid();
  const now = ctx.now ?? (() => new Date().toISOString());
  const id = ctx.newId ?? uuid;
  const byId = new Map(all.map((e) => [e.id, e]));
  const out: LogEvent[] = [];
  for (const e of batch) {
    const base = { ts: now(), roll: e.roll, problem: e.problem, by: ctx.by, batch: b, device: ctx.device };
    if (e.action === 'done') out.push({ ...base, id: id(), date: e.date, action: 'undo', ref: e.id });
    else if (e.action === 'undo') {
      for (const rid of e.ref.split(',').filter(Boolean)) {
        const orig = byId.get(rid);
        out.push({ ...base, id: id(), date: orig?.date ?? ctx.date, action: 'done', ref: '' });
      }
    }
  }
  return out;
}

/** Highest problem number ever logged (done) per assignment, for the "can't shrink" rule. */
export function highestLogged(events: LogEvent[], a: number): number {
  let m = 0;
  for (const e of events) {
    if (e.action !== 'done') continue;
    const pr = parseProblem(e.problem);
    if (pr && pr[0] === a) m = Math.max(m, pr[1]);
  }
  return m;
}

export function validateAssignmentChange(course: Course, events: LogEvent[], a: number, problems: number): string | null {
  if (!Number.isInteger(problems) || problems < 1) return 'Problem count must be a positive whole number';
  const hi = highestLogged(events, a);
  if (problems < hi) return `Cannot shrink below highest logged problem (${hi})`;
  return null;
}

/** Rolls referenced by any done/undo event (even if net-undone). These cannot be deleted. */
export function rollsWithHistory(events: LogEvent[]): Set<string> {
  const s = new Set<string>();
  for (const e of events) if (e.action === 'done' || e.action === 'undo') s.add(e.roll);
  return s;
}
