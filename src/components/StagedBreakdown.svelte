<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { stagedBreakdown, stepStaged } from '../lib/breakdown';
  import { ChevronLeft, ChevronRight, X } from '@lucide/svelte';
  import { slide } from 'svelte/transition';
  import { dur, ease } from '../lib/motion';
  let { open = $bindable(false), selected, onpick }: { open: boolean; selected: string | null; onpick: (r: string) => void } = $props();
  const groups = $derived(stagedBreakdown(app.staged));
  const order = $derived(groups.map((g) => g.roll));
  function step(dir: 1 | -1) { const r = stepStaged(order, selected, dir); if (r) onpick(r); }
  function global(e: KeyboardEvent) {
    if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    if (e.key === 'Escape' && open) { e.preventDefault(); open = false; return; }
    const t = e.target as HTMLElement;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
    if (e.key === '[' || e.key === ']') { e.preventDefault(); step(e.key === ']' ? 1 : -1); }
  }
</script>
<svelte:window onkeydown={global} />
{#if open}
  <div id="staged-breakdown" transition:slide={{ duration: dur(180), easing: ease }} class="no-print shrink-0 bg-hush-surface border-t border-hush-border" data-testid="staged-breakdown">
    <div class="max-h-[40vh] overflow-auto">
      <div class="sticky top-0 z-10 bg-hush-surface flex items-center gap-1 px-3 py-1.5 border-b border-hush-border">
        <h2 class="text-sm font-semibold flex-1">Staged changes <span class="muted mono">· {groups.length} roll{groups.length === 1 ? '' : 's'}</span></h2>
        <button class="btn btn-sm" aria-label="Previous staged roll" aria-keyshortcuts="[" title="Previous staged roll ([)" onclick={() => step(-1)}><ChevronLeft aria-hidden="true" /></button>
        <button class="btn btn-sm" aria-label="Next staged roll" aria-keyshortcuts="]" title="Next staged roll (])" onclick={() => step(1)}><ChevronRight aria-hidden="true" /></button>
      </div>
      <ul>
        {#each groups as g (g.roll)}
          {@const cur = g.roll === selected}
          <li class="border-b border-hush-border last:border-b-0" data-testid="staged-roll">
            <div class="flex items-center {cur ? 'bg-accent/15 text-accent' : ''}">
              <button class="flex-1 flex items-center gap-2 px-3 py-1.5 text-left {cur ? '' : 'hover:bg-hush-overlay'}" aria-current={cur ? 'true' : undefined} onclick={() => onpick(g.roll)}>
                <span class="font-semibold">Roll <span class="mono">{g.roll}</span></span>
                <span class="mono text-sm flex gap-2">{#if g.add}<span class="text-hush-green">+{g.add}</span>{/if}{#if g.remove}<span class="text-hush-red">−{g.remove}</span>{/if}</span>
              </button>
              <button class="btn btn-sm mr-2 border-transparent bg-transparent" aria-label="Discard staged changes for roll {g.roll}" title="Discard roll {g.roll}" onclick={() => app.discardRoll(g.roll)}><X aria-hidden="true" /></button>
            </div>
            <div class="px-3 pb-2 pt-1 flex flex-col gap-1">
              {#each g.assignments as a (a.a)}
                <div class="flex items-center gap-2">
                  <span class="mono muted text-sm w-8 shrink-0">A{a.a}</span>
                  <div class="flex flex-wrap gap-1">
                    {#each a.problems as q (q.p)}
                      <button class="chip {q.kind} !min-w-8 !min-h-7 px-2 text-sm" aria-label="Unstage {q.kind === 'add' ? 'add' : 'remove'} A{a.a} problem {q.p}, roll {g.roll}" onclick={() => app.unstage(g.roll, a.a, q.p)}>{q.p}</button>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}
