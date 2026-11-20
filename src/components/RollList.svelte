<script lang="ts">
  import type { RollStat } from '../lib/stats';
  let { stats, selected, onpick }: { stats: RollStat[]; selected: string | null; onpick: (r: string) => void } = $props();
  let q = $state('');
  let input: HTMLInputElement;
  const list = $derived(q ? stats.filter((s) => s.roll.startsWith(q)) : stats);
  function key(e: KeyboardEvent) {
    const i = list.findIndex((s) => s.roll === selected);
    if (e.key === 'ArrowDown') { e.preventDefault(); const n = list[Math.min(list.length - 1, i + 1)]; if (n) onpick(n.roll); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const n = list[Math.max(0, i - 1)]; if (n) onpick(n.roll); }
    else if (e.key === 'Enter' && list.length) { const hit = list.find((s) => s.roll === q) ?? list[0]; onpick(hit.roll); q = ''; }
  }
  function global(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key)) input?.focus();
  }
  $effect(() => { if (selected) document.querySelector(`[data-roll="${CSS.escape(selected)}"]`)?.scrollIntoView({ block: 'nearest' }); });
</script>
<svelte:window onkeydown={global} />
<div class="flex flex-col h-full min-h-0">
  <input name="roll-search" autocomplete="off" bind:this={input} bind:value={q} onkeydown={key} placeholder="Type a roll number" inputmode="numeric" class="m-2" aria-label="Search roll" />
  <ul class="flex-1 overflow-auto">
    {#each list as s (s.roll)}
      <li>
        <button data-roll={s.roll} class="w-full flex items-center gap-3 px-3 py-2 text-left border-b border-hush-border {selected === s.roll ? 'bg-accent/15 text-accent' : 'hover:bg-hush-surface'}" aria-current={selected === s.roll ? 'true' : undefined} onclick={() => onpick(s.roll)}>
          <span class="mono w-10 font-semibold">{s.roll}</span>
          <span class="flex-1 h-2 rounded bg-hush-overlay overflow-hidden"><span data-arrive class="block h-full bg-hush-green" style="width:{Math.round(s.pct * 100)}%"></span></span>
          <span data-arrive class="mono text-xs {selected === s.roll ? '' : 'muted'} w-14 text-right">{s.done}/{s.total}</span>
        </button>
      </li>
    {/each}
  </ul>
</div>
