import { naturalCompare, parseCellKey } from './model';

export interface StagedAssignment { a: number; problems: Array<{ p: number; kind: 'add' | 'remove' }> }
export interface StagedRoll { roll: string; add: number; remove: number; assignments: StagedAssignment[] }

/** Group staged entries (keyed "roll|a.p") as roll -> assignment -> problem, all sorted naturally. */
export function stagedBreakdown(staged: Record<string, 'add' | 'remove'>): StagedRoll[] {
  const byRoll = new Map<string, StagedRoll>();
  for (const [k, kind] of Object.entries(staged)) {
    const c = parseCellKey(k);
    if (!c) continue;
    let r = byRoll.get(c.roll);
    if (!r) byRoll.set(c.roll, (r = { roll: c.roll, add: 0, remove: 0, assignments: [] }));
    kind === 'add' ? r.add++ : r.remove++;
    let g = r.assignments.find((x) => x.a === c.a);
    if (!g) r.assignments.push((g = { a: c.a, problems: [] }));
    g.problems.push({ p: c.p, kind });
  }
  const out = [...byRoll.values()].sort((x, y) => naturalCompare(x.roll, y.roll));
  for (const r of out) {
    r.assignments.sort((x, y) => x.a - y.a);
    for (const g of r.assignments) g.problems.sort((x, y) => x.p - y.p);
  }
  return out;
}

/** Next/previous staged roll relative to `current` (which need not be staged), wrapping around. */
export function stepStaged(rolls: string[], current: string | null, dir: 1 | -1): string | null {
  if (!rolls.length) return null;
  if (current === null) return dir === 1 ? rolls[0] : rolls[rolls.length - 1];
  if (dir === 1) return rolls.find((r) => naturalCompare(r, current) > 0) ?? rolls[0];
  return [...rolls].reverse().find((r) => naturalCompare(r, current) < 0) ?? rolls[rolls.length - 1];
}
