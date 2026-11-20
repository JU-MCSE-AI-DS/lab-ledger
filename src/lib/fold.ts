// Pure: events -> cell state + conflicts.
import { type LogEvent, parseProblem } from './model';

export interface Cell {
  roll: string;
  a: number;
  p: number;
  done: boolean;
  date?: string; // earliest date among active dones
  by?: string;
  ts?: string;
  ids: string[]; // active done ids (not cancelled by any undo)
}

export interface Conflict {
  roll: string;
  problem: string;
  doneId: string; // concurrent done that survived
  undoId: string; // undo that did not know about it
  doneBy: string;
  undoBy: string;
  key: string; // stable id for dismissal
}

export interface Folded {
  cells: Map<string, Cell>; // key "roll|A.P" (done cells only)
  conflicts: Conflict[];
}

export function cellKey(roll: string, a: number, p: number) {
  return `${roll}|${a}.${p}`;
}

export function fold(events: Iterable<LogEvent>): Folded {
  const byId = new Map<string, LogEvent>();
  for (const e of events) if (!byId.has(e.id)) byId.set(e.id, e);
  const all = [...byId.values()];

  const undone = new Set<string>();
  for (const e of all) if (e.action === 'undo') for (const id of e.ref.split(',')) if (id.trim()) undone.add(id.trim());

  const doneByCell = new Map<string, LogEvent[]>();
  const undoByCell = new Map<string, LogEvent[]>();
  for (const e of all) {
    if (e.action === 'cfg') continue;
    const pr = parseProblem(e.problem);
    if (!pr) continue;
    const k = cellKey(e.roll, pr[0], pr[1]);
    const m = e.action === 'done' ? doneByCell : undoByCell;
    (m.get(k) ?? m.set(k, []).get(k)!).push(e);
  }

  const cells = new Map<string, Cell>();
  const conflicts: Conflict[] = [];
  for (const [k, dones] of doneByCell) {
    const active = dones.filter((d) => !undone.has(d.id));
    if (!active.length) continue;
    active.sort((x, y) => (x.date + x.ts + x.id).localeCompare(y.date + y.ts + y.id));
    const best = active[0];
    const [a, p] = parseProblem(best.problem)!;
    cells.set(k, { roll: best.roll, a, p, done: true, date: best.date, by: best.by, ts: best.ts, ids: active.map((d) => d.id) });
    for (const u of undoByCell.get(k) ?? []) {
      const refs = new Set(u.ref.split(',').map((s) => s.trim()));
      for (const d of active) {
        if (!refs.has(d.id) && d.ts < u.ts) {
          conflicts.push({ roll: d.roll, problem: d.problem, doneId: d.id, undoId: u.id, doneBy: d.by, undoBy: u.by, key: `${d.id}:${u.id}` });
        }
      }
    }
  }
  return { cells, conflicts };
}
