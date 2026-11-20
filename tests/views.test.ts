import { describe, it, expect } from 'vitest';
import { fold } from '../src/lib/fold';
import { assignmentTab, datewiseTab, summaryTab, buildTabs, tabRequests, ddmmyyyy, isDerivedTitle } from '../src/lib/views';
import { ev, makeCourse } from './helpers';

const course = makeCourse();
const f = fold([
  ev({ action: 'done', roll: '1', problem: '2.1', date: '2026-03-13' }),
  ev({ action: 'done', roll: '1', problem: '2.2', date: '2026-03-13' }),
  ev({ action: 'done', roll: '1', problem: '2.4', date: '2026-03-13' }),
  ev({ action: 'done', roll: '1', problem: '1.5', date: '2026-02-20' }),
  ev({ action: 'done', roll: '102', problem: '2.1', date: '2026-02-20' })
]);

describe('views', () => {
  it('dates', () => {
    expect(ddmmyyyy('2026-03-13')).toBe('13/03/2026');
    expect(isDerivedTitle('Assignment 3')).toBe(true);
    expect(isDerivedTitle('Log')).toBe(false);
  });
  it('assignment grid mirrors legacy pivot', () => {
    const t = assignmentTab(course, f, 2)!;
    expect(t.title).toBe('Assignment 2');
    expect(t.values[0]).toEqual(['Roll No.', '2.1', '2.2', '2.3', '2.4']);
    expect(t.values[1]).toEqual(['1', '13/03/2026', '13/03/2026', '-', '13/03/2026']);
    expect(t.fills[1]).toEqual([null, 'green', 'green', 'red', 'green']);
    expect(t.values.at(-1)).toEqual(['102', '20/02/2026', '-', '-', '-']);
    expect(t.values).toHaveLength(1 + 6);
    expect(assignmentTab(course, f, 99)).toBeNull();
  });
  it('datewise compact, chronological', () => {
    const t = datewiseTab(course, f);
    expect(t.values).toEqual([
      ['Date', 'Roll No.', 'Work Done'],
      ['20/02/2026', '1', '1.5'],
      ['20/02/2026', '102', '2.1'],
      ['13/03/2026', '1', '2.{1-2,4}']
    ]);
  });
  it('summary', () => {
    const t = summaryTab(course, f);
    expect(t.values[0]).toEqual(['Roll No.', 'A1', 'A2', 'A3', 'Total', '%']);
    expect(t.values[1]).toEqual(['1', '1/5', '3/4', '0/6', '4/15', '27%']);
    expect(t.values[6]).toEqual(['102', '0/5', '1/4', '0/6', '1/15', '7%']);
  });
  it('buildTabs ordering and inactive skipped', () => {
    const c = makeCourse();
    c.assignments[1].active = false;
    expect(buildTabs(c, f).map((t) => t.title)).toEqual(['Assignment 1', 'Assignment 3', 'Datewise', 'Summary']);
  });
  it('requests use legacy colours/fonts', () => {
    const t = assignmentTab(course, f, 2)!;
    const reqs = tabRequests(7, t);
    // grid must be resized before writing, or updateCells fails past the old last row
    expect(reqs[0].updateSheetProperties.properties.gridProperties.rowCount).toBe(7);
    expect(reqs[1].updateCells.range.sheetId).toBe(7);
    expect(reqs[1].updateCells.rows).toBeUndefined();
    const rows = reqs[2].updateCells.rows;
    expect(rows).toHaveLength(7);
    const green = rows[1].values[1].userEnteredFormat;
    expect(green.backgroundColor.green).toBeCloseTo(0xea / 255);
    expect(green.textFormat).toMatchObject({ fontFamily: 'JetBrains Mono', fontSize: 10, bold: false });
    expect(green.horizontalAlignment).toBe('CENTER');
    const red = rows[1].values[3].userEnteredFormat;
    expect(red.backgroundColor.red).toBeCloseTo(0xfa / 255);
    expect(rows[0].values[0].userEnteredFormat.textFormat.bold).toBe(true);
    expect(rows[1].values[0].userEnteredValue).toEqual({ numberValue: 1 });
    expect(reqs.some((r: any) => r.updateSheetProperties?.properties.gridProperties.frozenRowCount === 1)).toBe(true);
  });
});
