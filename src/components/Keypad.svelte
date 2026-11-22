<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { Delete } from '@lucide/svelte';
  let { rolls, onpick }: { rolls: string[]; onpick: (roll: string) => void } = $props();
  let value = $state('');
  const matches = $derived(value ? rolls.filter((r) => r.startsWith(value)).slice(0, 8) : []);
  const exact = $derived(rolls.includes(value) ? value : matches.length === 1 ? matches[0] : null);
  function press(k: string) {
    if (k === 'back') value = value.slice(0, -1);
    else if (k === 'C') value = '';
    else value += k;
  }
  function go() { if (exact) { onpick(exact); value = ''; } }
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'back'];
</script>
<div class="p-3">
  <div class="flex items-center gap-2 mb-2">
    <div class="flex-1 mono text-3xl h-12 flex items-center px-3 rounded-lg bg-hush-surface border border-hush-border" role="status" aria-live="polite" aria-label="Roll number" data-testid="keypad-display">
      {#if value}{value}{:else}<span class="muted text-base">Roll no.</span>{/if}
    </div>
    <button class="btn btn-primary btn-lg" disabled={!exact} onclick={go} data-testid="keypad-go">Open</button>
  </div>
  <div class="flex gap-1.5 mb-2 min-h-9 flex-wrap">
    {#each matches as m}
      <button class="btn btn-sm mono {m === exact ? 'border-accent text-accent' : ''}" onclick={() => { onpick(m); value = ''; }}>{m}{#if app.stagedRolls.has(m)}<span class="size-2 rounded-full bg-hush-yellow" title="Unsaved changes"><span class="sr-only">unsaved changes</span></span>{/if}</button>
    {/each}
    {#if value && !matches.length}<span class="muted text-sm py-1.5">No such roll</span>{/if}
  </div>
  <div class="grid grid-cols-3 gap-2">
    {#each keys as k}
      <button class="btn h-14 text-xl mono" onclick={() => press(k)} aria-label={k === 'back' ? 'Backspace' : k === 'C' ? 'Clear' : k}>{#if k === 'back'}<Delete aria-hidden="true" />{:else}{k}{/if}</button>
    {/each}
  </div>
</div>
