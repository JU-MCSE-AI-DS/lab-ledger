// Sync engine: push outbox -> pull Log rows past cursor (+ config) -> fold (via app state) -> schedule view rebuild.
import { app } from './app.svelte';
import type { Course } from './model';
import * as store from './store';
import { googleEnabled } from './google/config';
import { auth, AuthError } from './google/auth.svelte';
import { appendLog, pull, writeConfig, rebuildViews, HttpError } from './google/sheets';

const running = new Map<string, Promise<void>>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const rebuildTimers = new Map<string, ReturnType<typeof setTimeout>>();

const isGoogle = (id: string | null | undefined) => !!id && googleEnabled && app.courses.find((c) => c.id === id)?.kind === 'google';
const activeId = () => (app.loadedFor && isGoogle(app.loadedFor) ? app.loadedFor : null);

export function start() {
  if (!googleEnabled) return;
  const tick = () => { const id = activeId(); if (id && document.visibilityState === 'visible') syncNow(id); };
  window.addEventListener('online', tick);
  window.addEventListener('offline', () => { if (activeId()) app.syncState = { ...app.syncState, status: 'offline' }; });
  window.addEventListener('focus', tick);
  document.addEventListener('visibilitychange', tick);
  setInterval(tick, 60_000);
}

export function onCourseOpened(id: string) {
  if (!isGoogle(id)) return;
  refreshPending(id);
  syncNow(id);
}

export async function markConfigDirty(id: string) {
  await store.kvSet(`cfgdirty:${id}`, true);
  afterLocalChange(id);
}

export function afterLocalChange(id: string) {
  refreshPending(id);
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => syncNow(id), 1500));
}

async function refreshPending(id: string) {
  app.syncState = { ...app.syncState, pending: (await store.outboxIds(id)).length };
}

export function syncNow(id: string, full = false): Promise<void> {
  if (!isGoogle(id)) return Promise.resolve();
  const cur = running.get(id);
  if (cur) return cur;
  const p = doSync(id, full).finally(() => running.delete(id));
  running.set(id, p);
  return p;
}

function configChanged(a: Course, cfg: { rolls: Course['rolls']; assignments: Course['assignments'] }) {
  return JSON.stringify([a.rolls, a.assignments.map((x) => ({ ...x, problemTitles: x.problemTitles ?? undefined }))]) !== JSON.stringify([cfg.rolls, cfg.assignments.map((x) => ({ ...x, problemTitles: x.problemTitles ?? undefined }))]);
}

async function doSync(id: string, full: boolean) {
  const set = (patch: Partial<typeof app.syncState>) => (app.syncState = { ...app.syncState, ...patch });
  if (!navigator.onLine) { set({ status: 'offline' }); return; }
  set({ status: 'syncing', error: '' });
  try {
    await auth.getToken(false);
    const course = app.courses.find((c) => c.id === id)!;

    if (await store.kvGet<boolean>(`cfgdirty:${id}`)) {
      await writeConfig(id, course);
      await store.kvSet(`cfgdirty:${id}`, false);
    }

    const ids = await store.outboxIds(id);
    let pushed = 0;
    if (ids.length) {
      const wanted = new Set(ids);
      const evs = (await store.loadEvents(id)).filter((e) => wanted.has(e.id));
      await appendLog(id, evs);
      await store.clearOutbox(id, ids);
      pushed = evs.length;
    }

    let cursor = full ? 1 : (await store.kvGet<number>(`cursor:${id}`)) ?? 1;
    const r = await pull(id, cursor);
    await store.kvSet(`cursor:${id}`, cursor + r.rows);
    if (r.events.length) await app.receive(id, r.events);
    const dirtyNow = await store.kvGet<boolean>(`cfgdirty:${id}`);
    if (!dirtyNow && (r.config.rolls.length || r.config.assignments.length)) {
      const cur = app.courses.find((c) => c.id === id)!;
      if (configChanged(cur, r.config)) await app.applyRemote({ ...cur, ...r.config });
    }

    set({ status: 'idle', last: new Date().toISOString(), pending: (await store.outboxIds(id)).length });
    if (pushed || full) scheduleRebuild(id);
  } catch (e) {
    if (e instanceof AuthError) set({ status: 'reconnect', error: e.message });
    else if (e instanceof TypeError || !navigator.onLine) set({ status: 'offline' });
    else set({ status: 'error', error: e instanceof HttpError ? `${e.status}: ${e.message}` : String((e as Error).message ?? e) });
    refreshPending(id);
  }
}

export function scheduleRebuild(id: string, delay = 60_000) {
  clearTimeout(rebuildTimers.get(id));
  rebuildTimers.set(id, setTimeout(() => rebuildNow(id).catch(() => {}), delay));
}

export async function rebuildNow(id: string) {
  const course = app.courses.find((c) => c.id === id);
  if (!course) return;
  try {
    app.syncState = { ...app.syncState, status: 'syncing', error: '' };
    await auth.getToken(false);
    const events = app.loadedFor === id ? app.events : await store.loadEvents(id);
    await rebuildViews(id, course, events as any);
    app.syncState = { ...app.syncState, status: 'idle', last: new Date().toISOString() };
    app.flash('Sheet views rebuilt');
  } catch (e) {
    app.syncState = { ...app.syncState, status: e instanceof AuthError ? 'reconnect' : 'error', error: String((e as Error).message ?? e) };
  }
}
