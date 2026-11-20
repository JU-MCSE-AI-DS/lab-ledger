import { describe, it, expect } from 'vitest';
import { fold } from '../src/lib/fold';
import { buildEvents, revertEvents, validateAssignmentChange } from '../src/lib/ops';
import { ev, makeCourse } from './helpers';

describe('fold', () => {
  it('single done', () => {
    const f = fold([ev({ action: 'done', id: 'd1', roll: '2', problem: '3.4', date: '2026-03-02' })]);
    const c = f.cells.get('2|3.4')!;
    expect(c.done).toBe(true);
    expect(c.date).toBe('2026-03-02');
    expect(f.conflicts).toEqual([]);
  });
  it('undo cancels referenced done', () => {
    const f = fold([ev({ action: 'done', id: 'd1' }), ev({ action: 'undo', id: 'u1', ref: 'd1' })]);
    expect(f.cells.size).toBe(0);
    expect(f.conflicts).toEqual([]);
  });
  it('done again after undo is done', () => {
    const f = fold([ev({ action: 'done', id: 'd1' }), ev({ action: 'undo', id: 'u1', ref: 'd1' }), ev({ action: 'done', id: 'd2', date: '2026-03-05' })]);
    expect(f.cells.get('1|1.1')!.date).toBe('2026-03-05');
    expect(f.conflicts).toEqual([]);
  });
  it('duplicate dones keep the earliest date', () => {
    const f = fold([
      ev({ action: 'done', id: 'd1', date: '2026-03-10', by: 'late@x' }),
      ev({ action: 'done', id: 'd2', date: '2026-03-03', by: 'early@x' })
    ]);
    const c = f.cells.get('1|1.1')!;
    expect(c.date).toBe('2026-03-03');
    expect(c.by).toBe('early@x');
    expect(c.ids.sort()).toEqual(['d1', 'd2']);
  });
  it('undo of referenced ids only: unreferenced duplicate survives', () => {
    const f = fold([
      ev({ action: 'done', id: 'd1', date: '2026-03-01' }),
      ev({ action: 'done', id: 'd2', date: '2026-03-02', device: 'd2' }),
      ev({ action: 'undo', id: 'u1', ref: 'd1', ts: '2026-03-03T00:00:00Z' })
    ]);
    const c = f.cells.get('1|1.1')!;
    expect(c.done).toBe(true);
    expect(c.ids).toEqual(['d2']);
    expect(c.date).toBe('2026-03-02');
  });
  it('concurrent done vs undo: done wins and is flagged', () => {
    const f = fold([
      ev({ action: 'done', id: 'd1', ts: '2026-03-01T10:00:00Z', by: 'a@x' }),
      // device B undid d1 without knowing about d2 (made concurrently on device A2)
      ev({ action: 'done', id: 'd2', ts: '2026-03-01T10:05:00Z', by: 'c@x', device: 'd3' }),
      ev({ action: 'undo', id: 'u1', ref: 'd1', ts: '2026-03-01T10:10:00Z', by: 'b@x', device: 'd2' })
    ]);
    expect(f.cells.get('1|1.1')!.done).toBe(true);
    expect(f.conflicts).toHaveLength(1);
    expect(f.conflicts[0]).toMatchObject({ doneId: 'd2', undoId: 'u1', doneBy: 'c@x', undoBy: 'b@x' });
  });
  it('redo after undo is not a conflict', () => {
    const f = fold([
      ev({ action: 'done', id: 'd1', ts: '2026-03-01T10:00:00Z' }),
      ev({ action: 'undo', id: 'u1', ref: 'd1', ts: '2026-03-01T10:01:00Z' }),
      ev({ action: 'done', id: 'd2', ts: '2026-03-01T10:02:00Z' })
    ]);
    expect(f.conflicts).toEqual([]);
  });
  it('is idempotent to duplicate event ids and order', () => {
    const evs = [ev({ action: 'done', id: 'd1' }), ev({ action: 'undo', id: 'u1', ref: 'd1' })];
    const a = fold([...evs, ...evs]);
    const b = fold([...evs].reverse());
    expect(a.cells.size).toBe(0);
    expect(b.cells.size).toBe(0);
  });
  it('ignores cfg and bad problems', () => {
    const f = fold([ev({ action: 'cfg', problem: '', roll: '' }), ev({ action: 'done', problem: 'zz' })]);
    expect(f.cells.size).toBe(0);
  });
});

describe('ops', () => {
  const ctx = { date: '2026-04-01', by: 'me@x', device: 'dev', batch: 'B', now: () => '2026-04-01T00:00:00Z' };
  let i = 0;
  const newId = () => `n${++i}`;
  it('skips no-ops and refs active ids on undo', () => {
    const f = fold([ev({ action: 'done', id: 'd1', roll: '1', problem: '1.1' })]);
    const out = buildEvents(
      [{ roll: '1', a: 1, p: 1, undo: false }, { roll: '1', a: 1, p: 2, undo: true }, { roll: '1', a: 1, p: 3, undo: false }, { roll: '1', a: 1, p: 1, undo: true }],
      f, { ...ctx, newId }
    );
    expect(out.map((e) => [e.action, e.problem, e.ref])).toEqual([['done', '1.3', ''], ['undo', '1.1', 'd1']]);
    expect(out[0]).toMatchObject({ date: '2026-04-01', by: 'me@x', batch: 'B', device: 'dev' });
  });
  it('revert restores previous state', () => {
    const base = [ev({ action: 'done', id: 'd1', roll: '1', problem: '1.1', date: '2026-02-02' })];
    const f0 = fold(base);
    const batch = buildEvents([{ roll: '1', a: 1, p: 1, undo: true }, { roll: '1', a: 1, p: 2, undo: false }], f0, { ...ctx, newId });
    const all = [...base, ...batch];
    expect(fold(all).cells.has('1|1.1')).toBe(false);
    const rev = revertEvents(batch, all, { ...ctx, newId });
    const f2 = fold([...all, ...rev]);
    expect(f2.cells.has('1|1.2')).toBe(false);
    expect(f2.cells.get('1|1.1')!.date).toBe('2026-02-02');
  });
  it('cannot shrink below highest logged', () => {
    const c = makeCourse();
    const evs = [ev({ action: 'done', problem: '1.5' })];
    expect(validateAssignmentChange(c, evs, 1, 4)).toMatch(/highest logged/);
    expect(validateAssignmentChange(c, evs, 1, 5)).toBeNull();
    expect(validateAssignmentChange(c, evs, 1, 0)).toBeTruthy();
  });
});
