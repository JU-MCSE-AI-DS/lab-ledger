import { describe, it, expect } from 'vitest';
import { parseWorkDone, parseWork, parseLine, parseNotation, resolveNotation, compress, formatWorkDone, formatAssignment, formatRuns } from '../src/lib/notation';
import { makeCourse } from './helpers';

// Strings observed in the legacy Datewise sheets (notation fixtures).
const FIXTURES: Array<[string, Array<[number, number]>]> = [
  ['1.{1-3,5-6}', [[1, 1], [1, 2], [1, 3], [1, 5], [1, 6]]],
  ['1.15,2.{1-6}', [[1, 15], ...[1, 2, 3, 4, 5, 6].map((p) => [2, p] as [number, number])]],
  ['3.{2,10-12},4.{1-5}', [[3, 2], [3, 10], [3, 11], [3, 12], ...[1, 2, 3, 4, 5].map((p) => [4, p] as [number, number])]],
  ['4.{6-9},3.{6,12}', [[4, 6], [4, 7], [4, 8], [4, 9], [3, 6], [3, 12]]],
  ['2.{1-14}\n', Array.from({ length: 14 }, (_, i) => [2, i + 1] as [number, number])],
  ['3.{5-12},4.{1-5}', [...Array.from({ length: 8 }, (_, i) => [3, i + 5] as [number, number]), ...[1, 2, 3, 4, 5].map((p) => [4, p] as [number, number])]]
];

describe('legacy grammar', () => {
  for (const [s, expected] of FIXTURES) {
    it(`parses ${JSON.stringify(s)}`, () => {
      expect(parseWorkDone(s)).toEqual(expected);
    });
  }
  it('tolerates junk, empty and whitespace', () => {
    expect(parseWorkDone('')).toEqual([]);
    expect(parseWorkDone('  \n ')).toEqual([]);
    expect(parseWorkDone(' 1.{ 1 - 2 , 4 } ;; xx 2.3\t')).toEqual([[1, 1], [1, 2], [1, 4], [2, 3]]);
  });
  it('round-trips fixtures to equivalent compact notation', () => {
    for (const [s] of FIXTURES) {
      const map = new Map<number, number[]>();
      for (const [a, p] of parseWorkDone(s)) (map.get(a) ?? map.set(a, []).get(a)!).push(p);
      const out = formatWorkDone(map);
      expect(new Set(parseWorkDone(out).map((x) => x.join('.')))).toEqual(new Set(parseWorkDone(s).map((x) => x.join('.'))));
    }
    expect(formatWorkDone(new Map([[1, [15]], [2, [1, 2, 3, 4, 5, 6]]]))).toBe('1.15,2.{1-6}');
    expect(formatWorkDone(new Map([[1, [1, 2, 3, 5, 6]]]))).toBe('1.{1-3,5-6}');
  });
});

describe('compress/format', () => {
  it('compresses', () => {
    expect(compress([5, 1, 2, 3, 7, 8, 10])).toBe('1-3,5,7-8,10');
    expect(compress([])).toBe('');
    expect(formatAssignment(3, [5])).toBe('3.5');
    expect(formatAssignment(3, [2, 10, 11, 12])).toBe('3.{2,10-12}');
    expect(formatRuns(3, [5, 9, 10, 11])).toBe('3.5, 3.{9-11}');
  });
});

describe('extended notation', () => {
  it('wildcard', () => {
    expect(parseWork('3.*')).toEqual([{ a: 3, problems: null, undo: false }]);
  });
  it('undo prefix', () => {
    expect(parseWork('-3.5')).toEqual([{ a: 3, problems: [5], undo: true }]);
    expect(parseWork('-3.{1-2},4.1')).toEqual([{ a: 3, problems: [1, 2], undo: true }, { a: 4, problems: [1], undo: false }]);
  });
  it('multi-roll lines', () => {
    const l = parseLine('12,14-16 3.5');
    expect(l.rolls).toEqual(['12', '14', '15', '16']);
    expect(l.items).toEqual([{ a: 3, problems: [5], undo: false }]);
    expect(parseLine('1-3, 102 3.{1-2},4.*').rolls).toEqual(['1', '2', '3', '102']);
  });
  it('roll + undo', () => {
    const l = parseLine('12 -3.5');
    expect(l.rolls).toEqual(['12']);
    expect(l.items[0].undo).toBe(true);
  });
  it('no roll part', () => {
    const l = parseLine('3.{1-4}');
    expect(l.rolls).toBeNull();
    expect(l.items[0].problems).toEqual([1, 2, 3, 4]);
  });
  it('multi-line paste', () => {
    const lines = parseNotation('1-2 3.1\n\n  5 -3.2,4.*\r\n7 1.{1-3}');
    expect(lines).toHaveLength(3);
    expect(lines[1].rolls).toEqual(['5']);
    expect(lines[2].items[0].problems).toEqual([1, 2, 3]);
  });
  it('errors', () => {
    expect(parseLine('hello').error).toBeTruthy();
    expect(parseLine('1-x 3.4').error).toBeTruthy();
  });
});

describe('resolveNotation', () => {
  const course = makeCourse();
  it('expands * and multi-roll', () => {
    const r = resolveNotation(parseNotation('1-2 3.*'), course);
    expect(r.errors).toEqual([]);
    expect(r.ops).toHaveLength(2 * 6); // A3 has 6 problems
  });
  it('uses context roll', () => {
    const r = resolveNotation(parseNotation('1.{1-2}'), course, '5');
    expect(r.ops.map((o) => o.roll)).toEqual(['5', '5']);
    expect(resolveNotation(parseNotation('1.1'), course).errors[0]).toMatch(/no roll/);
  });
  it('rejects out-of-range, unknown roll/assignment', () => {
    expect(resolveNotation(parseNotation('1 3.7'), course).errors[0]).toMatch(/out of range/);
    expect(resolveNotation(parseNotation('999 1.1'), course).errors[0]).toMatch(/Unknown roll/);
    expect(resolveNotation(parseNotation('1 9.1'), course).errors[0]).toMatch(/Unknown assignment/);
  });
  it('marks undo ops', () => {
    expect(resolveNotation(parseNotation('1 -1.1'), course).ops[0].undo).toBe(true);
  });
});
