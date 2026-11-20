<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { go } from '../lib/router.svelte';
  import { HardDrive, CloudCheck, CloudUpload, CloudOff, CloudExclamationPoint, KeyRound, TriangleAlert } from '@lucide/svelte';
  import LedgerLoader from './LedgerLoader.svelte';
  const s = $derived(app.syncState);
  type K = 'conflict' | 'local' | 'reconnect' | 'offline' | 'error' | 'syncing' | 'pending' | 'synced';
  const kind = $derived.by((): K => {
    if (app.conflicts.length) return 'conflict';
    if (app.course?.kind === 'local') return 'local';
    if (s.status === 'reconnect') return 'reconnect';
    if (s.status === 'offline') return 'offline';
    if (s.status === 'error') return 'error';
    if (s.status === 'syncing') return 'syncing';
    if (s.pending) return 'pending';
    return 'synced';
  });
  const aria = $derived(({
    conflict: `${app.conflicts.length} conflicts`, local: 'Local course', reconnect: 'Reconnect to Google', offline: 'Offline',
    error: 'Sync error', syncing: 'Syncing', pending: `${s.pending} changes pending`, synced: 'Synced'
  } as Record<K, string>)[kind]);
</script>
{#if app.course}
  <button class="btn {kind === 'conflict' ? '!border-hush-yellow' : ''}" title={s.error || aria} aria-label={aria} onclick={() => go(app.course!.id, 'manage')}>
    {#key kind}<span class="inline-flex items-center gap-[.4rem] ll-pop-in">
    {#if kind === 'conflict'}<TriangleAlert aria-hidden="true" />{app.conflicts.length}
    {:else if kind === 'local'}<HardDrive aria-hidden="true" /><span>Local</span>
    {:else if kind === 'reconnect'}<KeyRound aria-hidden="true" /><span>Reconnect</span>
    {:else if kind === 'offline'}<CloudOff aria-hidden="true" /><span>Offline</span>
    {:else if kind === 'error'}<CloudExclamationPoint aria-hidden="true" /><span>Sync error</span>
    {:else if kind === 'syncing'}<LedgerLoader />
    {:else if kind === 'pending'}<CloudUpload aria-hidden="true" />{s.pending}
    {:else}<CloudCheck aria-hidden="true" />{/if}
    </span>{/key}
  </button>
{/if}
