import { fold } from './fold';
import { type Assignment, type Course, type LogEvent, uuid, cellKey, parseCellKey } from './model';
import type { Op } from './notation';
import { parseRolls } from './notation';
import { buildEvents, revertEvents, validateAssignmentChange, rollsWithHistory, isPositiveInt } from './ops';
import { shortDate } from './history';
import { applyTheme } from './theme';
import * as store from './store';
import { router } from './router.svelte';
import * as sync from './sync';

export type Theme = 'system' | 'light' | 'dark';
export interface Toast { msg: string; batch: LogEvent[]; id: number; undo?: () => Promise<void> }
export interface SyncState {
  status: 'idle' | 'syncing' | 'offline' | 'reconnect' | 'error';
  pending: number;
  last: string | null;
  error: string;
}

export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ls = (k: string, d = '') => (typeof localStorage !== 'undefined' ? localStorage.getItem(k) ?? d : d);

function deviceId() {
  const saved = ls('ll.device');
  if (saved) return saved;
  const fresh = uuid().slice(0, 8);
  localStorage.setItem('ll.device', fresh);
  return fresh;
}

class App {
  courses = $state<Course[]>([]);
  ready = $state(false);
  events = $state.raw<LogEvent[]>([]);
  loadedFor = $state<string | null>(null);
  theme = $state<Theme>(ls('ll.theme', 'system') as Theme);
  dateOverride = $state<string | null>(ls('ll.date') || null);
  email = $state(ls('ll.email', 'me@local'));
  device = deviceId();
  staged = $state<Record<string, 'add' | 'remove'>>({});
  toast = $state<Toast | null>(null);
  dismissed = $state<string[]>(JSON.parse(ls('ll.dismissed', '[]')));
  syncState = $state<SyncState>({ status: 'idle', pending: 0, last: null, error: '' });
  today = $state(localToday());
  printOpen = $state(false);
  toastSeq = 0;

  course = $derived(this.courses.find((c) => c.id === router.courseId) ?? null);
  folded = $derived(fold(this.events));
  date = $derived(this.dateOverride ?? this.today);
  dateLabel = $derived(shortDate(this.date));
  notToday = $derived(this.dateOverride !== null && this.dateOverride !== this.today);
  conflicts = $derived(this.folded.conflicts.filter((c) => !this.dismissed.includes(c.key)));
  stagedCounts = $derived.by(() => {
    let add = 0, remove = 0;
    for (const v of Object.values(this.staged)) v === 'add' ? add++ : remove++;
    return { add, remove };
  });

  async init() {
    this.courses = await store.listCourses();
    this.ready = true;
    setInterval(() => (this.today = localToday()), 60_000);
    sync.start();
  }

  async load(id: string | null) {
    if (!id || !this.courses.some((c) => c.id === id)) { this.events = []; this.loadedFor = null; return; }
    if (this.loadedFor === id) return;
    this.staged = {};
    this.events = await store.loadEvents(id);
    this.loadedFor = id;
    sync.onCourseOpened(id);
  }

  setTheme(t: Theme) { this.theme = t; localStorage.setItem('ll.theme', t); applyTheme(t); }
  setDate(d: string | null) {
    this.dateOverride = d && d !== this.today ? d : null;
    this.dateOverride ? localStorage.setItem('ll.date', this.dateOverride) : localStorage.removeItem('ll.date');
  }
  setEmail(e: string) { this.email = e; localStorage.setItem('ll.email', e); }
  dismiss(key: string) { this.dismissed = [...this.dismissed, key]; localStorage.setItem('ll.dismissed', JSON.stringify(this.dismissed)); }

  // ---- courses ----
  async addCourse(c: Course, events: LogEvent[] = []) {
    await store.putCourse(c);
    if (events.length) await store.addEvents(c.id, events, c.kind === 'google');
    this.courses = [...this.courses.filter((x) => x.id !== c.id), c];
  }

  async removeCourse(id: string) {
    await store.deleteCourse(id);
    this.courses = this.courses.filter((c) => c.id !== id);
    if (this.loadedFor === id) { this.loadedFor = null; this.events = []; }
  }

  async saveCourse(c: Course, cfgNote?: string) {
    // Dirty before the course is stored, so a concurrent sync can't see new config with a clean flag and overwrite it.
    if (c.kind === 'google') await store.kvSet(`cfgdirty:${c.id}`, true);
    await store.putCourse(c);
    this.courses = this.courses.map((x) => (x.id === c.id ? c : x));
    if (cfgNote) {
      await this.append([{ id: uuid(), ts: new Date().toISOString(), date: this.date, roll: '', problem: '', action: 'cfg', ref: cfgNote, by: this.email, batch: uuid(), device: this.device }]);
    }
    if (c.kind === 'google') await sync.markConfigDirty(c.id);
  }

  // ---- events ----
  async append(evs: LogEvent[]) {
    const c = this.course;
    if (!c || !evs.length) return [];
    const fresh = await store.addEvents(c.id, evs, c.kind === 'google');
    this.events = [...this.events, ...fresh];
    if (c.kind === 'google') sync.afterLocalChange(c.id);
    return fresh;
  }

  /** Receive events pulled from the remote (no outbox). */
  async receive(courseId: string, evs: LogEvent[]) {
    const fresh = await store.addEvents(courseId, evs, false);
    if (this.loadedFor === courseId && fresh.length) this.events = [...this.events, ...fresh];
  }

  ctx() { return { date: this.date, by: this.email, device: this.device }; }

  async commit(ops: Op[], label?: string): Promise<LogEvent[]> {
    const evs = buildEvents(ops, this.folded, this.ctx());
    if (!evs.length) { this.flash('Nothing to change'); return []; }
    const fresh = await this.append(evs);
    navigator.vibrate?.(25);
    const adds = fresh.filter((e) => e.action === 'done').length;
    const dels = fresh.length - adds;
    this.flash(label ?? `Saved ${adds ? `+${adds}` : ''}${adds && dels ? ' ' : ''}${dels ? `−${dels}` : ''}`, fresh);
    return fresh;
  }

  flash(msg: string, batch: LogEvent[] = [], undo?: () => Promise<void>) {
    this.toast = { msg, batch, undo, id: ++this.toastSeq };
    const id = this.toast.id;
    setTimeout(() => { if (this.toast?.id === id) this.toast = null; }, batch.length || undo ? 5000 : 2200);
  }

  async undoToast() {
    const t = this.toast;
    if (!t || !(t.batch.length || t.undo)) return;
    this.toast = null;
    if (t.undo) { await t.undo(); return; }
    const rev = revertEvents(t.batch, this.events, this.ctx());
    await this.append(rev);
    this.flash('Reverted');
  }

  // ---- staging ----
  stagedState(roll: string, a: number, p: number): 'add' | 'remove' | undefined { return this.staged[cellKey(roll, a, p)]; }
  isDone(roll: string, a: number, p: number) { return !!this.folded.cells.get(cellKey(roll, a, p))?.done; }
  /** Effective state after staging. */
  effective(roll: string, a: number, p: number) {
    const s = this.stagedState(roll, a, p);
    return s === 'add' ? true : s === 'remove' ? false : this.isDone(roll, a, p);
  }
  setEffective(roll: string, a: number, p: number, want: boolean) {
    const k = cellKey(roll, a, p);
    const actual = this.isDone(roll, a, p);
    const next = { ...this.staged };
    if (want === actual) delete next[k]; else next[k] = want ? 'add' : 'remove';
    this.staged = next;
  }
  toggle(roll: string, a: number, p: number) { this.setEffective(roll, a, p, !this.effective(roll, a, p)); }
  stageOps(ops: Op[]) {
    for (const o of ops) this.setEffective(o.roll, o.a, o.p, !o.undo);
  }
  discard() { this.staged = {}; }
  discardRoll(roll: string) {
    const pre = `${roll}|`;
    this.staged = Object.fromEntries(Object.entries(this.staged).filter(([k]) => !k.startsWith(pre)));
  }
  unstage(roll: string, a: number, p: number) { this.setEffective(roll, a, p, this.isDone(roll, a, p)); }
  /** Rolls that have unsaved staged changes. */
  stagedRolls = $derived(new Set(Object.keys(this.staged).map((k) => k.slice(0, k.lastIndexOf('|')))));
  async saveStaged() {
    const ops: Op[] = Object.entries(this.staged).map(([k, v]) => ({ ...parseCellKey(k)!, undo: v === 'remove' }));
    this.staged = {};
    await this.commit(ops);
  }

  // ---- course config ----
  async addRolls(expr: string): Promise<string | null> {
    const c = this.course; if (!c) return 'No course';
    const rs = parseRolls(expr);
    if (!rs || !rs.length) return 'Could not read roll list (e.g. 1-58, 102)';
    const next = structuredClone($state.snapshot(c)) as Course;
    for (const r of rs) {
      const ex = next.rolls.find((x) => x.roll === r);
      if (ex) ex.active = true; else next.rolls.push({ roll: r, active: true });
    }
    await this.saveCourse(next, `rolls +${rs.length}`);
    return null;
  }
  async setRollActive(roll: string, active: boolean) {
    const c = this.course; if (!c) return;
    const next = structuredClone($state.snapshot(c)) as Course;
    const r = next.rolls.find((x) => x.roll === roll); if (!r) return;
    r.active = active;
    await this.saveCourse(next, `roll ${roll} ${active ? 'activated' : 'deactivated'}`);
  }
  /** Delete rolls that have no logged progress. Returns what was removed/skipped. */
  async deleteRolls(rolls: string[]): Promise<{ removed: string[]; skipped: string[] }> {
    const c = this.course; if (!c) return { removed: [], skipped: [] };
    const hist = rollsWithHistory(this.events);
    const inRoster = new Set(c.rolls.map((r) => r.roll));
    const want = [...new Set(rolls)].filter((r) => inRoster.has(r));
    const skipped = want.filter((r) => hist.has(r));
    const del = new Set(want.filter((r) => !hist.has(r)));
    if (!del.size) return { removed: [], skipped };
    const next = structuredClone($state.snapshot(c)) as Course;
    const gone = next.rolls.filter((r) => del.has(r.roll));
    next.rolls = next.rolls.filter((r) => !del.has(r.roll));
    const list = gone.map((r) => r.roll).join(', ');
    await this.saveCourse(next, `rolls −${gone.length} (${list})`);
    this.flash(`Deleted ${gone.length} roll${gone.length === 1 ? '' : 's'}`, [], async () => {
      const cur = this.course; if (!cur || cur.id !== c.id) return;
      const back = structuredClone($state.snapshot(cur)) as Course;
      for (const g of gone) if (!back.rolls.some((r) => r.roll === g.roll)) back.rolls.push({ ...g });
      await this.saveCourse(back, `rolls restored (${list})`);
      this.flash('Rolls restored');
    });
    return { removed: gone.map((r) => r.roll), skipped };
  }
  async addAssignment(title: string, problems: number): Promise<string | null> {
    const c = this.course; if (!c) return 'No course';
    if (!isPositiveInt(problems)) return 'Problem count must be a positive whole number';
    const next = structuredClone($state.snapshot(c)) as Course;
    const id = Math.max(0, ...next.assignments.map((a) => a.id)) + 1;
    next.assignments.push({ id, title: title.trim() || `Assignment ${id}`, problems, active: true });
    await this.saveCourse(next, `assignment ${id} added (${problems})`);
    return null;
  }
  async updateAssignment(id: number, patch: Partial<Pick<Assignment, 'title' | 'problems' | 'active'>>): Promise<string | null> {
    const c = this.course; if (!c) return 'No course';
    if (patch.problems !== undefined) {
      const err = validateAssignmentChange(this.events, id, patch.problems);
      if (err) return err;
    }
    const next = structuredClone($state.snapshot(c)) as Course;
    const a = next.assignments.find((x) => x.id === id); if (!a) return 'Unknown assignment';
    Object.assign(a, patch);
    await this.saveCourse(next, `assignment ${id} updated`);
    return null;
  }
  /** Apply config pulled from the remote sheet (no outbox, no cfg event). */
  async applyRemote(c: Course) {
    await store.putCourse(c);
    this.courses = this.courses.map((x) => (x.id === c.id ? c : x));
  }
  async renameCourse(title: string) {
    const c = this.course; if (!c || !title.trim()) return;
    await this.saveCourse({ ...$state.snapshot(c), title: title.trim() } as Course, `title: ${title.trim()}`);
  }
}

export const app = new App();
