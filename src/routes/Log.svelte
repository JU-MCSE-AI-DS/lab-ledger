<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { router } from '../lib/router.svelte';
  import { computeStats } from '../lib/stats';
  import { activeRolls } from '../lib/model';
  import Keypad from '../components/Keypad.svelte';
  import RollList from '../components/RollList.svelte';
  import ChipPanel from '../components/ChipPanel.svelte';
  import { Undo2, Check } from '@lucide/svelte';
  import NotationBar from '../components/NotationBar.svelte';
  import { slide } from 'svelte/transition';
  import { dur, ease } from '../lib/motion';

  const course = $derived(app.course!);
  let selected = $state<string | null>(router.params.get('roll'));
  let keypadOpen = $state(!router.params.get('roll'));
  const stats = $derived(computeStats(course, app.folded));
  const rolls = $derived(activeRolls(course));
  const sel = $derived(selected ? stats.find((s) => s.roll === selected) : null);
  const staged = $derived(app.stagedCounts.add + app.stagedCounts.remove);
  const dateLabel = $derived(new Date(app.date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));
  function pick(r: string) { selected = r; keypadOpen = false; }
</script>

<div class="h-full flex flex-col lg:grid lg:grid-cols-[22rem_1fr]">
  <aside class="hidden lg:block border-r border-hush-border min-h-0 h-full">
    <RollList {stats} {selected} onpick={pick} />
  </aside>
  <div class="flex-1 min-h-0 flex flex-col">
    <div class="flex-1 min-h-0 overflow-auto">
      <NotationBar {course} roll={selected} />
      {#if keypadOpen}
        <div class="lg:hidden"><Keypad {rolls} onpick={pick} /></div>
      {/if}
      {#if selected && rolls.includes(selected)}
        {#key selected}<ChipPanel roll={selected} {course} stat={sel} showChange={!keypadOpen} onchange={() => (keypadOpen = true)} />{/key}
      {:else}
        <p class="p-6 muted hidden lg:block">Pick a roll from the list (or type digits).</p>
      {/if}
    </div>
    {#if staged > 0}
      <div transition:slide={{ duration: dur(180), easing: ease }} class="no-print shrink-0 bg-hush-surface border-t border-hush-border px-3 py-2 flex items-center gap-2" data-testid="savebar">
        <span class="mono font-semibold flex gap-2" data-testid="diff-badge">{#if app.stagedCounts.add}<span class="text-hush-green">+{app.stagedCounts.add}</span>{/if}{#if app.stagedCounts.remove}<span class="text-hush-red">−{app.stagedCounts.remove}</span>{/if}</span>
        {#if app.notToday}<span class="text-sm mono text-hush-yellow">for {dateLabel}</span>{/if}
        <button class="btn ml-auto" onclick={() => app.discard()}><Undo2 aria-hidden="true" />Discard</button>
        <button class="btn btn-primary" onclick={() => app.saveStaged()}><Check aria-hidden="true" />Save</button>
      </div>
    {/if}
  </div>
</div>
