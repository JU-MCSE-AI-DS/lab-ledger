import { describe, it, expect } from 'vitest';
import { fold } from '../src/lib/fold';
import { computeStats, median, rollProgress, assignmentStats } from '../src/lib/stats';
import { runQuery, parseQuery, tokenize, addDays } from '../src/lib/query';
import { shareText } from '../src/lib/share';
import { ev, makeCourse } from './helpers';
import type { LogEvent } from '../src/lib/model';

const course = makeCourse(); // rolls 1-5,102; A1=5, A2=4, A3=6
const done = (roll: string, a: number, ps: number[], date = '2026-03-01', by = 'a@x') =>
  ps.map((p) => ev({ action: 'done', roll, problem: `${a}.${p}`, date, by }));

const events: LogEvent[] = [
  ...done('1', 1, [1, 2, 3, 4, 5], '2026-03-01'),
  ...done('1', 3, [1, 2, 3, 4, 5, 6], '2026-03-13', 'ta@x'),
  ...done('2', 1, [1, 2, 3, 4, 5], '2026-03-02'),
  ...done('2', 3, [1, 2, 3, 4], '2026-03-13'),
  ...done('3', 1, [1, 2, 3], '2026-03-05'),
  ...done('4', 1, [1], '2026-03-05'),
  ...done('5', 1, [1, 2, 3, 4, 5], '2026-03-01'),
  ...done('5', 2, [1, 2, 3, 4], '2026-03-02')
];
const f = fold(events);
const TODAY = '2026-03-14';

describe('stats', () => {
  it('median', () => {
    expect(median([])).toBe(0);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it('per roll progress + missing', () => {
    const p = rollProgress(course, f, '3');
    expect(p[0]).toMatchObject({ a: 1, done: 3, total: 5, missing: [4, 5] });
    expect(p[2].missing).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('lag vs median', () => {
    const s = computeStats(course, f);
    // done counts: r1=11, r2=9, r3=3, r4=1, r5=9, r102=0 -> median of [0,1,3,9,9,11] = 6
    const by = Object.fromEntries(s.map((x) => [x.roll, x]));
    expect(by['1'].done).toBe(11);
    expect(by['1'].total).toBe(15);
    expect(by['3'].lag).toBe(3);
    expect(by['102'].lag).toBe(6);
    expect(by['1'].lag).toBe(-5);
    expect(by['1'].pct).toBeCloseTo(11 / 15);
  });
  it('restricts to assignments', () => {
    const s = computeStats(course, f, [1]);
    expect(s.find((x) => x.roll === '3')!.total).toBe(5);
  });
  it('assignment totals', () => {
    const a = assignmentStats(course, f);
    expect(a[0].done).toBe(5 + 5 + 3 + 1 + 5);
    expect(a[0].total).toBe(30);
  });
});

describe('query', () => {
  const q = (s: string) => runQuery(s, course, f, TODAY);
  it('tokenizes braces', () => {
    expect(tokenize('missing 3.{5, 8} r:1-30')).toEqual(['missing', '3.{5, 8}', 'r:1-30']);
  });
  it('missing 3.{5-6} r:1-3', () => {
    const r = q('missing 3.{5-6} r:1-3');
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => [x.roll, x.text])).toEqual([['2', '3.{5-6}'], ['3', '3.{5-6}']]);
  });
  it('remaining r:3', () => {
    const r = q('remaining r:3');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].text).toBe('1.{4-5},2.{1-4},3.{1-6}');
    expect(r.rows[0].count).toBe(12);
  });
  it('done 3.* on:2026-03-13', () => {
    const r = q('done 3.* on:2026-03-13');
    expect(r.rows.map((x) => [x.roll, x.text])).toEqual([['1', '3.{1-6}'], ['2', '3.{1-4}']]);
  });
  it('lag>3 a:3', () => {
    // A3 dones: r1=6, r2=4 others 0 -> median 0 of [6,4,0,0,0,0]=0 -> nobody lags >3
    expect(q('lag>3 a:3').rows).toEqual([]);
    const r = q('lag>3');
    expect(r.rows.map((x) => x.roll)).toEqual(['102', '4']);
    expect(q('lag>=3 a:1').rows.map((x) => x.roll)).toEqual(['102', '4']);
    expect(r.rows.every((x) => x.lag! > 3)).toBe(true);
  });
  it('by:ta since:-7d', () => {
    const r = q('by:ta@x since:-7d');
    expect(r.query.mode).toBe('done');
    expect(r.query.since).toBe('2026-03-07');
    expect(r.rows.map((x) => x.roll)).toEqual(['1']);
    expect(r.rows[0].text).toBe('3.{1-6}');
  });
  it('sort:progress ascending, -progress descending', () => {
    const asc = q('sort:progress').rows.map((x) => x.roll);
    expect(asc[0]).toBe('102');
    expect(asc[asc.length - 1]).toBe('1');
    expect(q('sort:-progress').rows[0].roll).toBe('1');
  });
  it('reports errors', () => {
    expect(q('missing 9.1').errors[0]).toMatch(/Unknown assignment 9/);
    expect(q('wat').errors[0]).toMatch(/Unknown term/);
    expect(q('since:foo').errors[0]).toMatch(/Bad date/);
    expect(q('r:999').errors[0]).toMatch(/Unknown roll/);
  });
  it('parseQuery relative dates', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(parseQuery('until:-1d', TODAY).until).toBe('2026-03-13');
  });
});

describe('share', () => {
  it('formats roll summary', () => {
    const f2 = fold([...done('7', 3, [1, 2, 3, 4, 6, 7, 8, 12], '2026-03-01')]);
    const c = makeCourse();
    c.assignments = [{ id: 1, title: '', problems: 3, active: true }, { id: 3, title: '', problems: 12, active: true }];
    c.rolls.push({ roll: '7', active: true });
    const f3 = fold([...done('7', 1, [1, 2, 3]), ...done('7', 3, [1, 2, 3, 4, 6, 7, 8, 12])]);
    void f2;
    expect(shareText(c, f3, '7')).toBe('Roll 7 — A1 ✓ · A3 8/12 (left 3.5, 3.{9-11})');
  });
});
