<script lang="ts">
  import type { Course } from '../lib/model';
  import { activeAssignments } from '../lib/model';
  import type { Folded } from '../lib/fold';
  import { computeStats } from '../lib/stats';
  let { course, folded, onpick, stickyHead = true }: { course: Course; folded: Folded; onpick?: (roll: string) => void; stickyHead?: boolean } = $props();
  const asgs = $derived(activeAssignments(course));
  const rows = $derived(computeStats(course, folded));
  const th = $derived(stickyHead ? 'sticky top-0 z-10 bg-hush-surface' : '');
</script>
<table class="w-full border-separate border-spacing-0 mono text-sm tabular-nums">
  <thead>
    <tr class="text-left">
      <th class="py-1.5 pl-2 pr-2 border-b border-hush-border {th}">Roll</th>{#each asgs as a}<th class="px-1 text-center border-b border-hush-border {th}">A{a.id}</th>{/each}<th class="px-1 text-center border-b border-hush-border {th}">Total</th><th class="px-2 text-right border-b border-hush-border {th}">%</th>
    </tr>
  </thead>
  <tbody>
    {#each rows as r}
      <tr class="{onpick ? 'cursor-pointer hover:bg-hush-overlay' : ''}" onclick={() => onpick?.(r.roll)}>
        <td class="py-1 pl-2 pr-2 font-semibold border-b border-hush-border">
          {#if onpick}<button class="font-semibold min-h-8 min-w-8 text-left" onclick={(e) => { e.stopPropagation(); onpick(r.roll); }}>{r.roll}</button>{:else}{r.roll}{/if}
        </td>
        {#each r.perAssignment as p}
          <td class="px-1 text-center border-b border-hush-border {p.done === p.total ? 'text-hush-green font-semibold' : p.done === 0 ? 'text-hush-red' : ''}">{p.done}/{p.total}</td>
        {/each}
        <td class="px-1 text-center border-b border-hush-border">{r.done}/{r.total}</td>
        <td class="px-2 text-right border-b border-hush-border">{Math.round(r.pct * 100)}%</td>
      </tr>
    {/each}
  </tbody>
</table>
