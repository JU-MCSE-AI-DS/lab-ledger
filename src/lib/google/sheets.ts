// Thin Sheets v4 REST wrappers.
import { auth, AuthError } from './auth.svelte';
import { LOG_HEADERS, type Assignment, type Course, type LogEvent, eventToRow, rowToEvent } from '../model';
import { fold } from '../fold';
import { buildTabs, headerFormatRequests, isDerivedTitle, tabRequests } from '../views';

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export class HttpError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

export async function gfetch(url: string, init: RequestInit = {}, interactive = false, retried = false): Promise<any> {
  const token = await auth.getToken(interactive);
  const r = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) } });
  if (r.status === 401 && !retried) { auth.invalidate(); return gfetch(url, init, interactive, true); }
  if (r.status === 401) throw new AuthError('Session expired');
  if (!r.ok) {
    let m = r.statusText;
    try { m = (await r.json()).error?.message ?? m; } catch {}
    throw new HttpError(r.status, m);
  }
  return r.status === 204 ? null : r.json();
}
const enc = encodeURIComponent;

export const REMOTE_TABS = ['Log', 'Rolls', 'Assignments', 'Meta'];

export async function getSheetMeta(id: string, interactive = false): Promise<{ title: string; sheets: Array<{ sheetId: number; title: string }> }> {
  const j = await gfetch(`${BASE}/${id}?fields=properties.title,sheets.properties(sheetId,title)`, {}, interactive);
  return { title: j.properties.title, sheets: j.sheets.map((s: any) => s.properties) };
}

const rollRows = (c: Course) => [['roll', 'active'], ...c.rolls.map((r) => [r.roll, r.active ? 'TRUE' : 'FALSE'])];
const asgRow = (a: Assignment) => [String(a.id), a.title, String(a.problems), a.problemTitles ? JSON.stringify(a.problemTitles) : '', a.active ? 'TRUE' : 'FALSE'];
const asgRows = (c: Course) => [['id', 'title', 'problems', 'problem_titles', 'active'], ...c.assignments.map(asgRow)];

export async function createSpreadsheet(c: Course): Promise<string> {
  const j = await gfetch(BASE, {
    method: 'POST',
    body: JSON.stringify({ properties: { title: c.title }, sheets: REMOTE_TABS.map((title) => ({ properties: { title } })) })
  }, true);
  const id: string = j.spreadsheetId;
  const ids: Record<string, number> = Object.fromEntries(j.sheets.map((s: any) => [s.properties.title, s.properties.sheetId]));
  await gfetch(`${BASE}/${id}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: [
        { range: 'Log!A1', values: [[...LOG_HEADERS]] },
        { range: 'Rolls!A1', values: rollRows(c) },
        { range: 'Assignments!A1', values: asgRows(c) },
        { range: 'Meta!A1', values: [['key', 'value'], ['schema_version', '1'], ['title', c.title], ['created', c.created]] }
      ]
    })
  });
  await gfetch(`${BASE}/${id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: REMOTE_TABS.flatMap((t) => headerFormatRequests(ids[t])) }) });
  return id;
}

export function parseConfig(rolls: string[][] | undefined, asg: string[][] | undefined) {
  const r = (rolls ?? []).slice(1).filter((x) => x[0] !== undefined && x[0] !== '').map((x) => ({ roll: String(x[0]), active: String(x[1] ?? 'TRUE').toUpperCase() !== 'FALSE' }));
  const a: Assignment[] = (asg ?? []).slice(1).filter((x) => x[0]).map((x) => {
    let pt: string[] | undefined;
    try { pt = x[3] ? JSON.parse(x[3]) : undefined; } catch { /* ignore */ }
    return { id: Number(x[0]), title: x[1] ?? '', problems: Number(x[2]) || 0, problemTitles: pt, active: String(x[4] ?? 'TRUE').toUpperCase() !== 'FALSE' };
  }).filter((x) => x.id > 0);
  return { rolls: r, assignments: a };
}

export async function readCourse(id: string, interactive = false): Promise<Course> {
  const meta = await getSheetMeta(id, interactive);
  const missing = REMOTE_TABS.filter((t) => !meta.sheets.some((s) => s.title === t));
  if (missing.length) throw new Error(`This spreadsheet is not a Lab Ledger course (missing tabs: ${missing.join(', ')})`);
  const j = await gfetch(`${BASE}/${id}/values:batchGet?ranges=Rolls&ranges=Assignments&ranges=Meta`, {}, interactive);
  const [rolls, asg, m] = j.valueRanges.map((v: any) => v.values as string[][] | undefined);
  const cfg = parseConfig(rolls, asg);
  const created = (m ?? []).find((x: string[]) => x[0] === 'created')?.[1] ?? new Date().toISOString();
  return { id, kind: 'google', title: meta.title, created, ...cfg };
}

export async function appendLog(id: string, evs: LogEvent[]) {
  for (let i = 0; i < evs.length; i += 400) {
    const chunk = evs.slice(i, i + 400);
    await gfetch(`${BASE}/${id}/values/Log!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: chunk.map(eventToRow) }) });
  }
}

/** Current Rolls + Assignments from the Sheet. */
export async function readConfig(id: string) {
  const j = await gfetch(`${BASE}/${id}/values:batchGet?ranges=Rolls&ranges=Assignments`);
  const [rolls, asg] = j.valueRanges.map((v: any) => v.values as string[][] | undefined);
  return parseConfig(rolls, asg);
}

/** One request: new Log rows past `cursor` (last row number already read) + current config. */
export async function pull(id: string, cursor: number) {
  const j = await gfetch(`${BASE}/${id}/values:batchGet?ranges=${enc('Log!A' + (cursor + 1) + ':J')}&ranges=Rolls&ranges=Assignments`, {});
  const [log, rolls, asg] = j.valueRanges.map((v: any) => (v.values ?? []) as string[][]);
  const events: LogEvent[] = [];
  for (const row of log) { const e = rowToEvent(row.map(String)); if (e) events.push(e); }
  return { events, rows: log.length, config: parseConfig(rolls, asg) };
}

export async function writeConfig(id: string, c: Course) {
  await gfetch(`${BASE}/${id}/values:batchClear`, { method: 'POST', body: JSON.stringify({ ranges: ['Rolls', 'Assignments'] }) });
  await gfetch(`${BASE}/${id}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'RAW', data: [{ range: 'Rolls!A1', values: rollRows(c) }, { range: 'Assignments!A1', values: asgRows(c) }, { range: 'Meta!A3', values: [['title', c.title]] }] })
  });
}

/** Rebuild Assignment N / Datewise / Summary tabs from the folded log in one batchUpdate. */
export async function rebuildViews(id: string, course: Course, events: LogEvent[]) {
  const tabs = buildTabs(course, fold(events));
  const meta = await getSheetMeta(id);
  const have = new Map(meta.sheets.map((s) => [s.title, s.sheetId]));
  const pre: any[] = [];
  for (const t of tabs) if (!have.has(t.title)) pre.push({ addSheet: { properties: { title: t.title } } });
  for (const s of meta.sheets) if (isDerivedTitle(s.title) && !tabs.some((t) => t.title === s.title)) pre.push({ deleteSheet: { sheetId: s.sheetId } });
  if (pre.length) {
    const r = await gfetch(`${BASE}/${id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: pre }) });
    for (const rep of r.replies ?? []) if (rep.addSheet) have.set(rep.addSheet.properties.title, rep.addSheet.properties.sheetId);
  }
  const requests = tabs.flatMap((t) => tabRequests(have.get(t.title)!, t));
  await gfetch(`${BASE}/${id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests }) });
}
