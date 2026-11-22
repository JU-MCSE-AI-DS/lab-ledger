// Sync engine: push outbox -> pull Log rows past cursor (+ config) -> fold (via app state) -> schedule view rebuild.
import { app } from './app.svelte';
import { mergeConfig, sameConfig, type Config } from './merge';
import * as store from './store';
import { googleEnabled } from './google/config';
import { auth, AuthError } from './google/auth.svelte';
import { appendLog, pull, readConfig, writeConfig, rebuildViews, HttpError } from './google/sheets';

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

const dirtyKey = (id: string) => `cfgdirty:${id}`;
const baseKey = (id: string) => `cfgbase:${id}`;

async function doSync(id: string, full: boolean) {
  const set = (patch: Partial<typeof app.syncState>) => (app.syncState = { ...app.syncState, ...patch });
  if (!navigator.onLine) { set({ status: 'offline' }); return; }
  set({ status: 'syncing', error: '' });
  try {
    await auth.getToken(false);
    // Plain copy: the merge reuses its roll/assignment objects, and IndexedDB can't clone Svelte's state proxies.
    const course = JSON.parse(JSON.stringify(app.courses.find((c) => c.id === id)!)) as typeof app.courses[number];

    // Config goes before the log so a roll/assignment added offline exists in the Sheet before its events do.
    if (await store.kvGet<boolean>(dirtyKey(id))) {
      // Clear before writing: a change made while the write is in flight re-sets it and is pushed next sync.
      await store.kvSet(dirtyKey(id), false);
      try {
        // Merge with the Sheet's current config so another TA's concurrent edit isn't overwritten.
        const merged = mergeConfig(await store.kvGet<Config>(baseKey(id)), course, await readConfig(id));
        await writeConfig(id, { ...course, ...merged });
        await store.kvSet(baseKey(id), merged);
        const cur = app.courses.find((c) => c.id === id)!;
        // If it changed again meanwhile, leave it: applying the older merge would revert that change.
        if (!(await store.kvGet<boolean>(dirtyKey(id))) && !sameConfig(cur, merged)) await app.applyRemote({ ...cur, ...merged });
      } catch (e) { await store.kvSet(dirtyKey(id), true); throw e; }
    }

    // Push before pull so our events are in the Sheet whatever the pull finds.
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
    // Store events before advancing the cursor: if storing fails the rows are re-read, not skipped (ids dedupe).
    if (r.events.length) await app.receive(id, r.events);
    await store.kvSet(`cursor:${id}`, cursor + r.rows);
    // Remote config is ignored while local edits are unsent (they'd be lost); an empty one means "not set up", not "deleted".
    const dirtyNow = await store.kvGet<boolean>(dirtyKey(id));
    if (!dirtyNow && (r.config.rolls.length || r.config.assignments.length)) {
      const cur = app.courses.find((c) => c.id === id)!;
      if (!sameConfig(cur, r.config)) await app.applyRemote({ ...cur, ...r.config });
      await store.kvSet(baseKey(id), r.config);
    }

    set({ status: 'idle', last: new Date().toISOString(), pending: (await store.outboxIds(id)).length });
    // Views are derived from the whole log; wait 60 s (debounced) so a burst of saves costs one rebuild.
    if (pushed || full) scheduleRebuild(id);
    // running[id] swallowed any sync requested meanwhile; pick up a config change made during this one.
    if (await store.kvGet<boolean>(dirtyKey(id))) afterLocalChange(id);
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
  // Pull first: rebuilding from a stale local log would overwrite the views with old data.
  await syncNow(id);
  if (app.syncState.status !== 'idle') return;
  try {
    app.syncState = { ...app.syncState, status: 'syncing', error: '' };
    await auth.getToken(false);
    const events = app.loadedFor === id ? app.events : await store.loadEvents(id);
    await rebuildViews(id, course, events);
    app.syncState = { ...app.syncState, status: 'idle', last: new Date().toISOString() };
    app.flash('Sheet views rebuilt');
  } catch (e) {
    app.syncState = { ...app.syncState, status: e instanceof AuthError ? 'reconnect' : 'error', error: String((e as Error).message ?? e) };
  }
}
