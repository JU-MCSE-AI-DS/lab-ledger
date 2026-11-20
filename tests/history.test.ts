import { describe, it, expect } from 'vitest';
import { buildHistory, latestUndo, describeEntry, formatRolls, formatProblems, filterFromStrings } from '../src/lib/history';
import { ev } from './helpers';

const t = (n: number) => `2026-03-01T10:00:${String(n).padStart(2, '0')}Z`;

describe('history', () => {
  const events = [
    ev({ action: 'done', id: 'd1', roll: '12', problem: '3.5', batch: 'b1', by: 'ta@x', ts: t(1), date: '2026-03-01' }),
    ev({ action: 'done', id: 'd2', roll: '12', problem: '3.6', batch: 'b1', by: 'ta@x', ts: t(1), date: '2026-03-01' }),
    ev({ action: 'done', id: 'd3', roll: '14', problem: '3.5', batch: 'b1', by: 'ta@x', ts: t(2), date: '2026-03-01' }),
    ev({ action: 'done', id: 'd4', roll: '15', problem: '3.5', batch: 'b1', by: 'ta@x', ts: t(2), date: '2026-03-01' }),
    ev({ action: 'undo', id: 'u1', roll: '12', problem: '3.5', ref: 'd1', batch: 'b2', by: 'ta@y', ts: t(5), date: '2026-03-04' }),
    ev({ action: 'cfg', id: 'c1', roll: '', problem: '', ref: 'added assignment 4', batch: 'b3', by: 'boss@x', ts: t(9), date: '2026-03-09' })
  ];

  it('groups by batch, newest first', () => {
    const h = buildHistory(events);
    expect(h.map((e) => e.batch)).toEqual(['b3', 'b2', 'b1']);
    const b1 = h[2];
    expect(b1.rolls).toEqual(['12', '14', '15']);
    expect(b1.problems).toEqual(['3.5', '3.6']);
    // not a rolls × problems product: 14 and 15 only did 3.5
    expect(describeEntry(b1)).toBe('done 12 → 3.{5-6}; 14-15 → 3.5');
  });
  it('merges rolls with the same problems and caps segments', () => {
    const mk = (id: string, roll: string, problem: string) => ev({ action: 'done', id, roll, problem, batch: 'p', by: 'ta@x', ts: t(1), date: '2026-03-01' });
    const one = buildHistory([mk('a', '1', '2.1'), mk('b', '2', '2.1'), mk('c', '3', '2.1'), mk('d', '1', '2.2'), mk('e', '2', '2.2'), mk('f', '3', '2.2')]);
    expect(describeEntry(one[0])).toBe('done 1-3 → 2.{1-2}');
    const many = buildHistory(['1', '2', '3', '4', '5'].map((r, i) => mk(`x${i}`, r, `2.${i + 1}`)));
    expect(describeEntry(many[0], 2)).toBe('done 1 → 2.1; 2 → 2.2; +3 more rolls');
  });
  it('splits a batch by who logged it', () => {
    const h = buildHistory([
      ev({ action: 'done', id: 'm1', roll: '1', problem: '1.1', batch: 'mix', by: 'a@x', ts: t(1), date: '2026-03-01' }),
      ev({ action: 'done', id: 'm2', roll: '2', problem: '1.1', batch: 'mix', by: 'b@x', ts: t(1), date: '2026-03-01' })
    ]);
    expect(h.map((e) => e.by).sort()).toEqual(['a@x', 'b@x']);
  });
  it('resolves undo refs', () => {
    const u = buildHistory(events)[1];
    expect(u.undone).toEqual([{ id: 'd1', by: 'ta@x', date: '2026-03-01' }]);
    expect(describeEntry(u)).toBe('undo 12 → 3.5 (logged by ta@x 1 Mar)');
  });
  it('tolerates unknown ids', () => {
    const h = buildHistory([ev({ action: 'undo', id: 'u9', ref: 'nope', batch: 'z' })]);
    expect(h[0].undone).toEqual([{ id: 'nope', by: null, date: null }]);
    expect(describeEntry(h[0])).toContain('unknown entry');
  });
  it('cfg shows ref as-is', () => {
    const c = buildHistory(events)[0];
    expect(c.action).toBe('cfg');
    expect(describeEntry(c)).toBe('config: added assignment 4');
  });
  it('splits mixed actions in a batch', () => {
    const h = buildHistory([ev({ action: 'done', id: 'a', batch: 'm', ts: t(1) }), ev({ action: 'undo', id: 'b', ref: 'a', batch: 'm', ts: t(2) })]);
    expect(h.map((e) => e.action)).toEqual(['undo', 'done']);
  });
  it('does not merge events with empty batch', () => {
    expect(buildHistory([ev({ action: 'done', id: 'a', batch: '' }), ev({ action: 'done', id: 'b', batch: '' })])).toHaveLength(2);
  });
  it('filters', () => {
    expect(buildHistory(events, { rolls: ['12'] }).map((e) => e.batch).sort()).toEqual(['b1', 'b2']);
    expect(buildHistory(events, { rolls: ['12'] }).find((e) => e.batch === 'b1')!.problems).toEqual(['3.5', '3.6']);
    expect(buildHistory(events, { rolls: ['14'], problem: '3.5' })).toHaveLength(1);
    expect(buildHistory(events, { problem: '3.6' })).toHaveLength(1);
    expect(buildHistory(events, { by: 'TA@Y' }).map((e) => e.batch)).toEqual(['b2']);
    expect(buildHistory(events, { since: '2026-03-02' }).map((e) => e.batch)).toEqual(['b3', 'b2']);
    expect(buildHistory(events, { until: '2026-03-02' }).map((e) => e.batch)).toEqual(['b1']);
  });
  it('filter parsing', () => {
    const { filter, errors } = filterFromStrings({ roll: '1-3', problem: '3.5', since: '-7d' }, '2026-03-10');
    expect(errors).toEqual([]);
    expect(filter).toEqual({ rolls: ['1', '2', '3'], problem: '3.5', since: '2026-03-03' });
    expect(filterFromStrings({ roll: '!!', problem: 'x', until: 'zzz' }, '2026-03-10').errors).toHaveLength(3);
  });
  it('latestUndo', () => {
    expect(latestUndo(events, '12', '3.5')).toMatchObject({ by: 'ta@y', date: '2026-03-04' });
    expect(latestUndo(events, '14', '3.5')).toBeNull();
  });
  it('formatters', () => {
    expect(formatRolls(['1', '2', '3', '5', 'A1'])).toBe('1-3,5,A1');
    expect(formatProblems(['2.1', '1.2', '1.1'])).toBe('1.{1-2},2.1');
  });
});
