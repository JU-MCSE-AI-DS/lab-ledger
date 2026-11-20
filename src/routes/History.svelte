<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { router, go } from '../lib/router.svelte';
  import { buildHistory, filterFromStrings } from '../lib/history';
  import HistoryLine from '../components/HistoryLine.svelte';
  import { ArrowLeft, Eraser } from '@lucide/svelte';

  const course = $derived(app.course!);
  const PAGE = 50;
  let roll = $state(router.params.get('roll') ?? '');
  let problem = $state(router.params.get('problem') ?? '');
  let by = $state(router.params.get('by') ?? '');
  let since = $state(router.params.get('since') ?? '');
  let until = $state(router.params.get('until') ?? '');
  let limit = $state(PAGE);
  const parsed = $derived(filterFromStrings({ roll, problem, by, since, until }, app.today));
  const entries = $derived(buildHistory(app.events, parsed.filter));
  const shown = $derived(entries.slice(0, limit));
  $effect(() => { roll; problem; by; since; until; limit = PAGE; });
  function clear() { roll = problem = by = since = until = ''; }
</script>

<div class="p-3 space-y-3 max-w-3xl mx-auto pb-10">
  <div class="flex items-center gap-2">
    <button class="btn" onclick={() => go(course.id, 'manage')}><ArrowLeft aria-hidden="true" />Manage</button>
    <h1 class="font-semibold text-base">History</h1>
  </div>

  <section class="card space-y-2">
    <div class="grid grid-cols-2 gap-2">
      <label class="field"><span class="text-xs muted">Roll</span><input name="h-roll" autocomplete="off" bind:value={roll} placeholder="12 or 1-30" /></label>
      <label class="field"><span class="text-xs muted">Problem</span><input name="h-problem" autocomplete="off" class="mono" bind:value={problem} placeholder="3.5" /></label>
      <label class="field col-span-2"><span class="text-xs muted">By</span><input name="h-by" autocomplete="off" bind:value={by} placeholder="ta@example.com" /></label>
      <label class="field"><span class="text-xs muted">Since</span><input name="h-since" autocomplete="off" bind:value={since} placeholder="2026-03-01 or -7d" /></label>
      <label class="field"><span class="text-xs muted">Until</span><input name="h-until" autocomplete="off" bind:value={until} placeholder="2026-03-31" /></label>
    </div>
    {#each parsed.errors as er}<p class="text-hush-red text-sm" role="alert">{er}</p>{/each}
    <button class="btn btn-sm" onclick={clear} disabled={!(roll || problem || by || since || until)}><Eraser aria-hidden="true" />Clear filters</button>
  </section>

  <section class="card space-y-2" data-testid="history-list">
    <p class="muted text-xs">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</p>
    {#each shown as e (e.key)}<HistoryLine entry={e} />{:else}<p class="muted text-sm">No activity{roll || problem || by || since || until ? ' matches these filters' : ' yet'}.</p>{/each}
    {#if entries.length > shown.length}<button class="btn btn-sm" onclick={() => (limit += PAGE)}>Show more ({entries.length - shown.length} left)</button>{/if}
  </section>
</div>
