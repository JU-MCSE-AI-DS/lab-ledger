import { naturalCompare } from './model';

export interface StagedAssignment { a: number; problems: Array<{ p: number; kind: 'add' | 'remove' }> }
export interface StagedRoll { roll: string; add: number; remove: number; assignments: StagedAssignment[] }

/** Group staged entries (keyed "roll|a.p") as roll -> assignment -> problem, all sorted naturally. */
export function stagedBreakdown(staged: Record<string, 'add' | 'remove'>): StagedRoll[] {
  const byRoll = new Map<string, StagedRoll>();
  for (const [k, kind] of Object.entries(staged)) {
    const m = /^(.*)\|(\d+)\.(\d+)$/.exec(k);
    if (!m) continue;
    let r = byRoll.get(m[1]);
    if (!r) byRoll.set(m[1], (r = { roll: m[1], add: 0, remove: 0, assignments: [] }));
    kind === 'add' ? r.add++ : r.remove++;
    const a = Number(m[2]);
    let g = r.assignments.find((x) => x.a === a);
    if (!g) r.assignments.push((g = { a, problems: [] }));
    g.problems.push({ p: Number(m[3]), kind });
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
