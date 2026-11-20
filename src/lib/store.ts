// IndexedDB persistence (idb): courses, events, outbox, kv (cursors etc).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Course, LogEvent } from './model';

interface EventRec extends LogEvent { courseId: string; k: string }
interface OutRec { k: string; courseId: string; id: string }

interface Schema extends DBSchema {
  courses: { key: string; value: Course };
  events: { key: string; value: EventRec; indexes: { byCourse: string } };
  outbox: { key: string; value: OutRec; indexes: { byCourse: string } };
  kv: { key: string; value: unknown };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;
function db() {
  return (dbp ??= openDB<Schema>('lab-ledger', 1, {
    upgrade(d) {
      d.createObjectStore('courses', { keyPath: 'id' });
      d.createObjectStore('events', { keyPath: 'k' }).createIndex('byCourse', 'courseId');
      d.createObjectStore('outbox', { keyPath: 'k' }).createIndex('byCourse', 'courseId');
      d.createObjectStore('kv');
    }
  }));
}

export async function listCourses(): Promise<Course[]> {
  return (await (await db()).getAll('courses')).sort((a, b) => a.created.localeCompare(b.created));
}
export async function putCourse(c: Course) {
  await (await db()).put('courses', JSON.parse(JSON.stringify(c)));
}
export async function deleteCourse(id: string) {
  const d = await db();
  const tx = d.transaction(['courses', 'events', 'outbox', 'kv'], 'readwrite');
  await tx.objectStore('courses').delete(id);
  for (const name of ['events', 'outbox'] as const) {
    const idx = tx.objectStore(name).index('byCourse');
    for (const k of await idx.getAllKeys(id)) await tx.objectStore(name).delete(k);
  }
  await tx.objectStore('kv').delete(`cursor:${id}`);
  await tx.done;
}

export async function loadEvents(courseId: string): Promise<LogEvent[]> {
  const rows = await (await db()).getAllFromIndex('events', 'byCourse', courseId);
  return rows.map(({ courseId: _c, k: _k, ...e }) => e);
}

/** Store events; `queue` also adds them to the outbox (Google courses). Returns the ones actually new. */
export async function addEvents(courseId: string, evs: LogEvent[], queue: boolean): Promise<LogEvent[]> {
  const d = await db();
  const tx = d.transaction(['events', 'outbox'], 'readwrite');
  const fresh: LogEvent[] = [];
  for (const e of evs) {
    const k = `${courseId}:${e.id}`;
    if (await tx.objectStore('events').get(k)) continue;
    await tx.objectStore('events').put({ ...e, courseId, k });
    if (queue) await tx.objectStore('outbox').put({ k, courseId, id: e.id });
    fresh.push(e);
  }
  await tx.done;
  return fresh;
}

export async function outboxIds(courseId: string): Promise<string[]> {
  return (await (await db()).getAllFromIndex('outbox', 'byCourse', courseId)).map((r) => r.id);
}
export async function clearOutbox(courseId: string, ids: string[]) {
  const d = await db();
  const tx = d.transaction('outbox', 'readwrite');
  for (const id of ids) await tx.store.delete(`${courseId}:${id}`);
  await tx.done;
}

export async function kvGet<T>(k: string): Promise<T | undefined> {
  return (await (await db()).get('kv', k)) as T | undefined;
}
export async function kvSet(k: string, v: unknown) {
  await (await db()).put('kv', v, k);
}
