// Derived Sheet tabs: pure grids + Sheets batchUpdate requests.
import { type Course, activeAssignments, activeRolls, naturalCompare } from './model';
import { cellKey, type Folded } from './fold';
import { formatWorkDone } from './notation';

export type Fill = 'green' | 'red' | null;
export interface Tab {
  title: string;
  values: string[][];
  fills: Fill[][]; // same shape as values
}

export const GREEN = 'D9EAD3';
export const RED = 'FADAD8';
export const DERIVED_PREFIXES = ['Assignment ', 'Datewise', 'Summary'];
export const isDerivedTitle = (t: string) => /^Assignment \d+$/.test(t) || t === 'Datewise' || t === 'Summary';

export function ddmmyyyy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

const noFill = (n: number): Fill[] => Array(n).fill(null);

export function assignmentTab(course: Course, f: Folded, aId: number): Tab | null {
  const a = course.assignments.find((x) => x.id === aId);
  if (!a) return null;
  const rolls = activeRolls(course);
  const header = ['Roll No.', ...Array.from({ length: a.problems }, (_, i) => `${a.id}.${i + 1}`)];
  const values = [header];
  const fills = [noFill(header.length)];
  for (const r of rolls) {
    const row = [r];
    const fr: Fill[] = [null];
    for (let p = 1; p <= a.problems; p++) {
      const c = f.cells.get(cellKey(r, a.id, p));
      row.push(c?.done ? ddmmyyyy(c.date ?? '') : '-');
      fr.push(c?.done ? 'green' : 'red');
    }
    values.push(row);
    fills.push(fr);
  }
  return { title: `Assignment ${a.id}`, values, fills };
}

export function datewiseTab(course: Course, f: Folded): Tab {
  const byDate = new Map<string, Map<string, Map<number, number[]>>>();
  for (const c of f.cells.values()) {
    const d = c.date ?? '';
    const rolls = byDate.get(d) ?? byDate.set(d, new Map()).get(d)!;
    const asg = rolls.get(c.roll) ?? rolls.set(c.roll, new Map()).get(c.roll)!;
    (asg.get(c.a) ?? asg.set(c.a, []).get(c.a)!).push(c.p);
  }
  const values = [['Date', 'Roll No.', 'Work Done']];
  for (const d of [...byDate.keys()].sort()) {
    const rolls = byDate.get(d)!;
    for (const r of [...rolls.keys()].sort(naturalCompare)) values.push([ddmmyyyy(d), r, formatWorkDone(rolls.get(r)!)]);
  }
  return { title: 'Datewise', values, fills: values.map((r) => noFill(r.length)) };
}

export function summaryTab(course: Course, f: Folded): Tab {
  const asgs = activeAssignments(course);
  const header = ['Roll No.', ...asgs.map((a) => `A${a.id}`), 'Total', '%'];
  const values = [header];
  const fills = [noFill(header.length)];
  const grand = asgs.reduce((s, a) => s + a.problems, 0);
  for (const r of activeRolls(course)) {
    let tot = 0;
    const fr: Fill[] = [null];
    const row = [r];
    for (const a of asgs) {
      let d = 0;
      for (let p = 1; p <= a.problems; p++) if (f.cells.get(cellKey(r, a.id, p))?.done) d++;
      tot += d;
      row.push(`${d}/${a.problems}`);
      fr.push(d === a.problems ? 'green' : d === 0 ? 'red' : null);
    }
    row.push(`${tot}/${grand}`, grand ? `${Math.round((tot / grand) * 100)}%` : '0%');
    fr.push(null, null);
    values.push(row);
    fills.push(fr);
  }
  return { title: 'Summary', values, fills };
}

export function buildTabs(course: Course, f: Folded): Tab[] {
  const tabs: Tab[] = [];
  for (const a of activeAssignments(course)) tabs.push(assignmentTab(course, f, a.id)!);
  tabs.push(datewiseTab(course, f), summaryTab(course, f));
  return tabs;
}

const rgb = (hex: string) => ({
  red: parseInt(hex.slice(0, 2), 16) / 255,
  green: parseInt(hex.slice(2, 4), 16) / 255,
  blue: parseInt(hex.slice(4, 6), 16) / 255
});

const baseFormat = { horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', textFormat: { fontFamily: 'JetBrains Mono', fontSize: 10 } };

/** Requests that overwrite one derived tab wholesale (mirrors legacy/main.py + fetch.py:apply_formatting). */
export function tabRequests(sheetId: number, tab: Tab): any[] {
  const rows = tab.values.map((row, ri) => ({
    values: row.map((v, ci) => {
      const fill = tab.fills[ri]?.[ci];
      const fmt: any = { ...baseFormat, textFormat: { ...baseFormat.textFormat, bold: ri === 0 } };
      if (fill) fmt.backgroundColor = rgb(fill === 'green' ? GREEN : RED);
      return { userEnteredValue: /^\d+$/.test(v) && ci === 0 && ri > 0 ? { numberValue: Number(v) } : { stringValue: v }, userEnteredFormat: fmt };
    })
  }));
  const cols = Math.max(...tab.values.map((r) => r.length), 1);
  const reqs: any[] = [
    { updateCells: { range: { sheetId }, fields: 'userEnteredValue,userEnteredFormat' } },
    { updateCells: { start: { sheetId, rowIndex: 0, columnIndex: 0 }, rows, fields: 'userEnteredValue,userEnteredFormat' } },
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1, rowCount: Math.max(tab.values.length, 2), columnCount: Math.max(cols, 2) } }, fields: 'gridProperties(frozenRowCount,rowCount,columnCount)' } }
  ];
  for (let c = 0; c < cols; c++) {
    const max = Math.max(...tab.values.map((r) => (r[c] ?? '').length));
    reqs.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: c, endIndex: c + 1 },
        properties: { pixelSize: Math.max(64, (max + 4) * 8) }, fields: 'pixelSize'
      }
    });
  }
  return reqs;
}

/** Plain header-style request for config/log tabs (bold frozen header, JetBrains Mono 10). */
export function headerFormatRequests(sheetId: number): any[] {
  return [
    { repeatCell: { range: { sheetId }, cell: { userEnteredFormat: { textFormat: { fontFamily: 'JetBrains Mono', fontSize: 10 } } }, fields: 'userEnteredFormat.textFormat(fontFamily,fontSize)' } },
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } },
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } }
  ];
}
