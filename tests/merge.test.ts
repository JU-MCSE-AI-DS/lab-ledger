import { describe, it, expect } from 'vitest';
import { mergeConfig, type Config } from '../src/lib/merge';

const roll = (r: string, active = true) => ({ roll: r, active });
const asg = (id: number, title = `A${id}`, problems = 5, active = true) => ({ id, title, problems, active });
const cfg = (rolls: Config['rolls'], assignments: Config['assignments'] = []): Config => ({ rolls, assignments });

describe('mergeConfig', () => {
  const base = cfg([roll('1'), roll('2')], [asg(1)]);

  it('keeps a local roll add and a remote roll hide', () => {
    const local = cfg([roll('1'), roll('2'), roll('3')], [asg(1)]);
    const remote = cfg([roll('1', false), roll('2')], [asg(1)]);
    const m = mergeConfig(base, local, remote);
    expect(m.rolls).toEqual([roll('1', false), roll('2'), roll('3')]);
  });

  it('local removal wins over an unchanged remote, remote-only change survives an unrelated local change', () => {
    const local = cfg([roll('1')], [asg(1)]); // removed roll 2
    const remote = cfg([roll('1'), roll('2')], [asg(1, 'Renamed')]);
    const m = mergeConfig(base, local, remote);
    expect(m.rolls).toEqual([roll('1')]);
    expect(m.assignments).toEqual([asg(1, 'Renamed')]);
  });

  it('renumbers a local assignment whose new id collides with a different remote one', () => {
    const local = cfg(base.rolls, [asg(1), asg(2, 'Mine', 3)]);
    const remote = cfg(base.rolls, [asg(1), asg(2, 'Theirs', 8)]);
    const m = mergeConfig(base, local, remote);
    expect(m.assignments).toEqual([asg(1), asg(2, 'Theirs', 8), asg(3, 'Mine', 3)]);
  });

  it('identical concurrent adds do not duplicate', () => {
    const m = mergeConfig(base, cfg(base.rolls, [asg(1), asg(2)]), cfg(base.rolls, [asg(1), asg(2)]));
    expect(m.assignments.map((a) => a.id)).toEqual([1, 2]);
  });

  it('without a base, local wins every difference', () => {
    const m = mergeConfig(undefined, cfg([roll('1', false)], [asg(1, 'Local')]), cfg([roll('1'), roll('9')], [asg(1, 'Remote')]));
    expect(m.rolls).toEqual([roll('1', false)]); // same as the old overwrite
    expect(m.assignments).toEqual([asg(1, 'Local')]);
  });

  it('an empty remote is not treated as everything deleted', () => {
    const local = cfg([roll('1')], [asg(1)]);
    expect(mergeConfig(base, local, cfg([]))).toEqual(local);
  });
});
