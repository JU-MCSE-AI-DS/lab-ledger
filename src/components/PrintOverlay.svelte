<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { activeAssignments, activeRolls } from '../lib/model';
  import { Printer, X } from '@lucide/svelte';
  import Heatmap from './Heatmap.svelte';
  import SummaryTable from './SummaryTable.svelte';
  const course = $derived(app.course!);
  const rolls = $derived(activeRolls(course));
  const printed = $derived(new Date(app.today + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }));
  const asgs = $derived(activeAssignments(course));
</script>
<div class="print-overlay fixed inset-0 z-50 overflow-auto bg-hush-bg text-hush-fg" data-theme="light" data-testid="print-overlay">
  <div class="no-print sticky top-0 z-10 flex items-center gap-2 p-2 bg-gray-100 border-b border-gray-300">
    <strong class="flex-1">Print preview</strong>
    <button class="btn !bg-white !text-black" onclick={() => window.print()}><Printer aria-hidden="true" />Print</button>
    <button class="btn !bg-white !text-black" onclick={() => (app.printOpen = false)}><X aria-hidden="true" />Close</button>
  </div>
  <div class="p-4 space-y-8">
    {#each asgs as a (a.id)}
      <section class="print-page">
        <h2 class="text-lg font-bold mb-0.5">{course.title}</h2>
        <p class="text-sm font-semibold mb-0.5">Assignment {a.id}{a.title ? ` ${a.title}` : ''}</p>
        <p class="text-xs mb-2">Printed {printed}. Green is done, red is missing.</p>
        <div class="overflow-x-auto"><Heatmap {a} {rolls} folded={app.folded} transpose size={15} /></div>
      </section>
    {/each}
    <section class="print-page">
      <h2 class="text-lg font-bold mb-0.5">{course.title}</h2>
      <p class="text-sm font-semibold mb-2">Summary</p>
      <SummaryTable {course} folded={app.folded} stickyHead={false} />
    </section>
  </div>
</div>
