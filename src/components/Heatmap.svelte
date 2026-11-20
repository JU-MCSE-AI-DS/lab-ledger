<script lang="ts">
  import type { Folded } from '../lib/fold';
  import type { Assignment } from '../lib/model';
  import { ddmmyyyy } from '../lib/views';
  let { a, rolls, folded, transpose = false, size = 26, onpick }: {
    a: Assignment; rolls: string[]; folded: Folded; transpose?: boolean; size?: number;
    onpick?: (roll: string, p: number) => void;
  } = $props();
  const probs = $derived(Array.from({ length: a.problems }, (_, i) => i + 1));
  const done = (r: string, p: number) => folded.cells.get(`${r}|${a.id}.${p}`)?.done;
</script>

{#snippet cell(r: string, p: number)}
  {@const c = folded.cells.get(`${r}|${a.id}.${p}`)}
  <td class="p-px">
    <button class="block rounded-sm {c?.done ? 'hm-done' : 'hm-miss'}" style="width:{size}px;height:{size}px" data-cell="{r}|{a.id}.{p}" data-done={c?.done ? 1 : 0}
      aria-label="Roll {r} problem {a.id}.{p} {c?.done ? 'done ' + ddmmyyyy(c.date ?? '') : 'missing'}" onclick={() => onpick?.(r, p)}></button>
  </td>
{/snippet}

<table class="border-collapse mono" style="font-size:{transpose ? Math.max(9, size * 0.6) : Math.max(12, size * 0.4)}px">
  {#if !transpose}
    <thead><tr><th class="sticky left-0 top-0 z-20 bg-hush-bg min-w-3"></th>{#each probs as p}<th class="sticky top-0 z-10 bg-hush-bg font-normal muted text-center pb-1 pt-1">{p}</th>{/each}</tr></thead>
    <tbody>
      {#each rolls as r}
        <tr><th class="sticky left-0 z-10 bg-hush-bg pl-2 pr-1.5 text-right font-semibold">{r}</th>{#each probs as p}{@render cell(r, p)}{/each}</tr>
      {/each}
    </tbody>
  {:else}
    <thead><tr><th></th>{#each rolls as r}<th class="font-normal text-center align-bottom pb-0.5" style="writing-mode:vertical-rl;transform:rotate(180deg)">{r}</th>{/each}</tr></thead>
    <tbody>
      {#each probs as p}
        <tr><th class="pr-1.5 text-right font-normal">{a.id}.{p}</th>{#each rolls as r}{@render cell(r, p)}{/each}</tr>
      {/each}
    </tbody>
  {/if}
</table>
