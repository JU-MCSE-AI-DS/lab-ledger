<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { go } from '../lib/router.svelte';
  import { activeAssignments, activeRolls } from '../lib/model';
  import { assignmentStats } from '../lib/stats';
  import { Grid3x3, Table2, Printer, ArrowRight } from '@lucide/svelte';
  import Heatmap from '../components/Heatmap.svelte';
  import SummaryTable from '../components/SummaryTable.svelte';

  const course = $derived(app.course!);
  const asgs = $derived(activeAssignments(course));
  const rolls = $derived(activeRolls(course));
  let view = $state<'heat' | 'summary'>('heat');
  let aId = $state<number | null>(null);
  const cur = $derived(asgs.find((a) => a.id === aId) ?? [...asgs].sort((x, y) => y.id - x.id)[0]);
  const astats = $derived(assignmentStats(course, app.folded));
  let picked = $state<{ roll: string; p: number } | null>(null);
  const info = $derived.by(() => {
    if (!picked || !cur) return null;
    const c = app.folded.cells.get(`${picked.roll}|${cur.id}.${picked.p}`);
    const date = c?.done && c.date ? new Date(c.date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
    return { roll: picked.roll, id: `${cur.id}.${picked.p}`, text: c?.done ? `done ${date} by ${c.by}` : 'not done' };
  });
</script>

<div class="h-full flex flex-col gap-3 p-3 max-w-5xl mx-auto [&>*]:shrink-0">
  <div class="flex items-center gap-2 flex-wrap">
    <div class="seg" role="group" aria-label="View">
      <button aria-pressed={view === 'heat'} onclick={() => (view = 'heat')}><Grid3x3 aria-hidden="true" class="icon" />Heatmap</button>
      <button aria-pressed={view === 'summary'} onclick={() => (view = 'summary')}><Table2 aria-hidden="true" class="icon" />Summary</button>
    </div>
    {#if view === 'heat' && cur}
      <select aria-label="Assignment" value={cur.id} onchange={(e) => { aId = Number((e.target as HTMLSelectElement).value); picked = null; }}>
        {#each asgs as a}<option value={a.id}>A{a.id} {a.title}</option>{/each}
      </select>
    {/if}
    <button class="btn ml-auto" onclick={() => (app.printOpen = true)}><Printer aria-hidden="true" />Print</button>
  </div>

  {#if !asgs.length}
    <p class="muted">No assignments yet. Add some in the Course tab.</p>
  {:else if view === 'heat' && cur}
    {@const st = astats.find((x) => x.a === cur.id)}
    <p class="muted text-sm">{st?.done}/{st?.total} problems done across {rolls.length} rolls ({Math.round((st?.pct ?? 0) * 100)}%). Tap a cell for details.</p>
    <div class="!shrink min-h-0 overflow-auto overscroll-contain border border-hush-border rounded-lg bg-hush-bg" data-testid="heatmap">
      <Heatmap a={cur} {rolls} folded={app.folded} onpick={(roll, p) => (picked = { roll, p })} />
    </div>
    <p class="min-h-6 text-sm flex flex-wrap items-baseline gap-x-2 -mt-1" data-testid="cell-info">{#if info}<strong>Roll {info.roll}</strong><span class="mono">{info.id}</span><span>{info.text}</span>{/if}</p>
    {#if picked}<button class="btn" onclick={() => go(course.id, 'log', { roll: picked!.roll })}>Open roll {picked.roll}<ArrowRight aria-hidden="true" /></button>{/if}
  {:else}
    <div class="!shrink min-h-0 overflow-auto overscroll-contain bg-hush-surface border border-hush-border rounded-xl"><SummaryTable {course} folded={app.folded} onpick={(roll) => go(course.id, 'log', { roll })} /></div>
  {/if}
</div>
