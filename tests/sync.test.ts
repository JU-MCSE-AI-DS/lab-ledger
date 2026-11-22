import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory stand-ins: the real store is IndexedDB, app.svelte is a rune class, sheets/auth hit Google.
const kv = new Map<string, unknown>();
const remote = { rolls: [] as any[], assignments: [] as any[] }; // the "Sheet"
const written: any[] = [];
let gate: Promise<void> = Promise.resolve();

vi.mock('../src/lib/store', () => ({
  kvGet: async (k: string) => kv.get(k),
  kvSet: async (k: string, v: unknown) => { kv.set(k, structuredClone(v)); }, // IndexedDB clones (and rejects proxies)
  outboxIds: async () => [],
  loadEvents: async () => [],
  clearOutbox: async () => {}
}));
vi.mock('../src/lib/google/config', () => ({ googleEnabled: true }));
vi.mock('../src/lib/google/auth.svelte', () => ({ auth: { getToken: async () => 't' }, AuthError: class extends Error {} }));
vi.mock('../src/lib/google/sheets', () => ({
  HttpError: class extends Error {},
  appendLog: async () => {},
  rebuildViews: async () => {},
  readConfig: async () => structuredClone(remote),
  pull: async () => ({ events: [], rows: 0, config: structuredClone(remote) }),
  writeConfig: async (_id: string, c: any) => { await gate; Object.assign(remote, structuredClone({ rolls: c.rolls, assignments: c.assignments })); written.push(structuredClone(remote)); }
}));
const app = vi.hoisted(() => ({
  courses: [] as any[], syncState: { status: 'idle', pending: 0, last: null, error: '' } as any, loadedFor: null, events: [],
  receive: async () => {}, flash: () => {},
  applyRemote: async (c: any) => { app.courses = app.courses.map((x) => (x.id === c.id ? c : x)); }
}));
vi.mock('../src/lib/app.svelte', () => ({ app }));

import { syncNow } from '../src/lib/sync';

beforeEach(() => {
  vi.stubGlobal('navigator', { onLine: true });
  kv.clear(); written.length = 0; remote.rolls = [{ roll: '1', active: true }]; gate = Promise.resolve();
  // Proxies stand in for Svelte $state, which structuredClone/IndexedDB refuse.
  const deep = <T extends object>(o: T): T => new Proxy(o, { get: (t, k) => { const v = Reflect.get(t, k); return v && typeof v === 'object' ? deep(v) : v; } });
  app.courses = [deep({ id: 'g1', kind: 'google', title: 'T', created: '', rolls: [{ roll: '1', active: true }, { roll: '2', active: true }], assignments: [{ id: 1, title: 'A1', problems: 3, active: true }] })];
  kv.set('cfgdirty:g1', true);
});

describe('doSync config handling', () => {
  it('a config change made while the config write is in flight is kept and pushed next sync', async () => {
    let release!: () => void;
    gate = new Promise((r) => (release = r));
    const first = syncNow('g1');
    await vi.waitFor(() => expect(kv.get('cfgdirty:g1')).toBe(false)); // cleared before the write started
    // user edits while writeConfig is awaiting (saveCourse: dirty first, then the course)
    kv.set('cfgdirty:g1', true);
    app.courses = [{ ...app.courses[0], rolls: [...app.courses[0].rolls, { roll: '3', active: true }] }];
    release();
    await first;

    expect(kv.get('cfgdirty:g1')).toBe(true);
    expect(app.courses[0].rolls.map((r: any) => r.roll)).toEqual(['1', '2', '3']); // not reverted by the pull

    await syncNow('g1');
    expect(written.at(-1).rolls.map((r: any) => r.roll)).toEqual(['1', '2', '3']);
    expect(kv.get('cfgdirty:g1')).toBe(false);
  });

  it('stores the merged config base without tripping on state proxies', async () => {
    await syncNow('g1');
    expect(app.syncState.status).toBe('idle');
    expect((kv.get('cfgbase:g1') as any).assignments.map((a: any) => a.id)).toEqual([1]);
  });

  it('a failed config write leaves the course dirty', async () => {
    gate = Promise.reject(new Error('boom'));
    gate.catch(() => {});
    await syncNow('g1');
    expect(kv.get('cfgdirty:g1')).toBe(true);
    expect(app.syncState.status).toBe('error');
  });
});
