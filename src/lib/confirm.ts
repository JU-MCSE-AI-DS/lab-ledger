import * as store from './store';

/** Confirm removing a course from this device (shared by Home and Manage). */
export async function confirmRemoveCourse(c: { id: string; title: string; kind: string }): Promise<boolean> {
  const unsynced = c.kind === 'google' ? (await store.outboxIds(c.id)).length : 0;
  const lost = unsynced ? ` ${unsynced} change${unsynced === 1 ? '' : 's'} not yet synced to the Sheet will be lost.` : '';
  return confirm(`Remove "${c.title}" from this device?${c.kind === 'google' ? ' The Google Sheet is not deleted.' : ' Local data will be lost.'}${lost}`);
}
