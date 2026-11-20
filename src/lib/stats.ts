import { type Course, activeAssignments, activeRolls } from './model';
import { cellKey, type Folded } from './fold';

export interface AssignmentProgress { a: number; done: number; total: number; missing: number[] }
export interface RollStat {
  roll: string;
  done: number;
  total: number;
  pct: number;
  lag: number; // median(done of class) - done (positive = behind)
  perAssignment: AssignmentProgress[];
}

export function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function rollProgress(course: Course, f: Folded, roll: string): AssignmentProgress[] {
  return activeAssignments(course).map((as) => {
    const missing: number[] = [];
    for (let p = 1; p <= as.problems; p++) if (!f.cells.get(cellKey(roll, as.id, p))?.done) missing.push(p);
    return { a: as.id, done: as.problems - missing.length, total: as.problems, missing };
  });
}

/** Stats for every active roll. `onlyAssignments` restricts the lag/progress to a subset. */
export function computeStats(course: Course, f: Folded, onlyAssignments?: number[]): RollStat[] {
  const rows = activeRolls(course).map((roll) => {
    let per = rollProgress(course, f, roll);
    if (onlyAssignments) per = per.filter((x) => onlyAssignments.includes(x.a));
    const done = per.reduce((s, x) => s + x.done, 0);
    const total = per.reduce((s, x) => s + x.total, 0);
    return { roll, done, total, pct: total ? done / total : 0, lag: 0, perAssignment: per };
  });
  const med = median(rows.map((r) => r.done));
  for (const r of rows) r.lag = med - r.done;
  return rows;
}

export function assignmentStats(course: Course, f: Folded) {
  const rolls = activeRolls(course);
  return activeAssignments(course).map((as) => {
    let done = 0;
    for (const r of rolls) for (let p = 1; p <= as.problems; p++) if (f.cells.get(cellKey(r, as.id, p))?.done) done++;
    const total = rolls.length * as.problems;
    return { a: as.id, title: as.title, done, total, pct: total ? done / total : 0 };
  });
}
