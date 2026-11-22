<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { CalendarDays, X } from '@lucide/svelte';
  const label = $derived(app.dateLabel);
</script>
{#if app.notToday}
  <!-- Desktop only: on phones the Log view's date button carries the date (it only matters when logging). -->
  <span class="hidden lg:inline-flex items-center gap-1">
    <!-- The native date input sits invisibly on top of the chip: tapping opens the OS picker everywhere
         (no showPicker dependency), and overflow-hidden stops iOS's wide date input from widening the page. -->
    <label class="btn relative overflow-hidden mono whitespace-nowrap !bg-hush-yellow/25 !border-hush-yellow" title="Logging for {label}, not today">
      <CalendarDays aria-hidden="true" />{label}
      <input type="date" name="log-date" class="absolute inset-0 w-full h-full opacity-0 appearance-none cursor-pointer !p-0 !border-0" value={app.date}
        onchange={(e) => app.setDate((e.target as HTMLInputElement).value || null)} aria-label="Logging for {label}, not today. Change date" />
    </label>
    <button class="btn btn-icon" aria-label="Back to today" title="Back to today" onclick={() => app.setDate(null)}><X aria-hidden="true" /></button>
  </span>
{/if}
