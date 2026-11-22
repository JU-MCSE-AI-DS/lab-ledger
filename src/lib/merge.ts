// Pure 3-way merge of course config (rolls + assignments) between this device and the Sheet.
import type { Assignment, RollEntry } from './model';

export interface Config { rolls: RollEntry[]; assignments: Assignment[] }

const sameRoll = (a: RollEntry, b: RollEntry) => a.active === b.active;
const sameAsg = (a: Assignment, b: Assignment) =>
  a.title === b.title && a.problems === b.problems && a.active === b.active && JSON.stringify(a.problemTitles ?? null) === JSON.stringify(b.problemTitles ?? null);

/** Per key: if local differs from base (added, changed or removed) local wins, else remote wins. */
function mergeBy<T, K>(base: T[], local: T[], remote: T[], key: (x: T) => K, same: (a: T, b: T) => boolean): T[] {
  const [b, l, r] = [base, local, remote].map((xs) => new Map(xs.map((x) => [key(x), x] as const)));
  const out: T[] = [];
  for (const k of new Set([...r.keys(), ...l.keys()])) {
    const bv = b.get(k), lv = l.get(k);
    const localChanged = lv === undefined || bv === undefined ? lv !== bv : !same(lv, bv);
    const pick = localChanged ? lv : r.get(k);
    if (pick !== undefined) out.push(pick);
  }
  return out;
}

export function sameConfig(a: Config, b: Config): boolean {
  const eq = <T,>(x: T[], y: T[], same: (p: T, q: T) => boolean) => x.length === y.length && x.every((v, i) => same(v, y[i]));
  return eq(a.rolls, b.rolls, (p, q) => p.roll === q.roll && sameRoll(p, q)) && eq(a.assignments, b.assignments, (p, q) => p.id === q.id && sameAsg(p, q));
}

/**
 * `base` is the last config known to match the Sheet; without one (old installs) the remote is the base,
 * so local wins every difference. An empty remote is treated as "nothing there yet", not "everything deleted".
 */
export function mergeConfig(base: Config | undefined, local: Config, remote: Config): Config {
  if (!remote.rolls.length && !remote.assignments.length) return local;
  const b = base ?? remote;
  const bAsg = new Map(b.assignments.map((a) => [a.id, a]));
  const rAsg = new Map(remote.assignments.map((a) => [a.id, a]));
  // Both sides added a different assignment with the same id: keep both, renumber the local one.
  let next = Math.max(0, ...local.assignments.map((a) => a.id), ...remote.assignments.map((a) => a.id)) + 1;
  const localAsg = local.assignments.map((a) => {
    const r = rAsg.get(a.id);
    return !bAsg.has(a.id) && r && !sameAsg(a, r) ? { ...a, id: next++ } : a;
  });
  return {
    rolls: mergeBy(b.rolls, local.rolls, remote.rolls, (x) => x.roll, sameRoll),
    assignments: mergeBy(b.assignments, localAsg, remote.assignments, (x) => x.id, sameAsg)
  };
}
