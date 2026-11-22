import { describe, it, expect } from 'vitest';
import { stagedBreakdown, stepStaged } from '../src/lib/breakdown';

describe('stagedBreakdown', () => {
  it('groups roll -> assignment -> problem in natural order with counts', () => {
    const out = stagedBreakdown({ '102|1.2': 'add', '12|3.5': 'remove', '12|3.1': 'add', '12|1.9': 'add', '2|1.1': 'add' });
    expect(out.map((r) => r.roll)).toEqual(['2', '12', '102']);
    const r12 = out[1];
    expect([r12.add, r12.remove]).toEqual([2, 1]);
    expect(r12.assignments.map((a) => a.a)).toEqual([1, 3]);
    expect(r12.assignments[1].problems).toEqual([{ p: 1, kind: 'add' }, { p: 5, kind: 'remove' }]);
  });
  it('is empty when nothing is staged', () => expect(stagedBreakdown({})).toEqual([]));
});

describe('stepStaged', () => {
  const rolls = ['2', '12', '102'];
  it('steps and wraps', () => {
    expect(stepStaged(rolls, '2', 1)).toBe('12');
    expect(stepStaged(rolls, '102', 1)).toBe('2');
    expect(stepStaged(rolls, '2', -1)).toBe('102');
  });
  it('handles an unstaged current roll', () => {
    expect(stepStaged(rolls, '5', 1)).toBe('12');
    expect(stepStaged(rolls, '5', -1)).toBe('2');
    expect(stepStaged(rolls, '200', 1)).toBe('2');
    expect(stepStaged(rolls, null, 1)).toBe('2');
    expect(stepStaged(rolls, null, -1)).toBe('102');
  });
  it('returns null when empty', () => expect(stepStaged([], '1', 1)).toBeNull());
});
