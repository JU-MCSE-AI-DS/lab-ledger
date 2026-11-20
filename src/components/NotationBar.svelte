<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { ListPlus, CalendarDays } from '@lucide/svelte';
  import type { Course } from '../lib/model';
  import { parseNotation, resolveNotation } from '../lib/notation';
  let { course, roll }: { course: Course; roll: string | null } = $props();
  let text = $state('');
  const dateLabel = $derived(new Date(app.date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));
  const parsed = $derived(parseNotation(text));
  const res = $derived(resolveNotation(parsed, course, roll));
  const summary = $derived.by(() => {
    let add = 0, rem = 0, skip = 0;
    for (const o of res.ops) {
      const eff = app.effective(o.roll, o.a, o.p);
      if (o.undo) eff ? rem++ : skip++; else eff ? skip++ : add++;
    }
    return { add, rem, skip };
  });
  function apply() {
    if (!res.ops.length || res.errors.length) return;
    app.stageOps(res.ops);
    text = '';
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !text.includes('\n')) { e.preventDefault(); apply(); }
  }
</script>
<div class="p-3 border-b border-hush-border space-y-1.5">
  <div class="flex gap-2 items-start">
    <textarea bind:value={text} onkeydown={key} rows={text.includes('\n') ? Math.min(6, text.split('\n').length) : 1} class="flex-1 mono text-sm resize-none" spellcheck="false" autocapitalize="off"
      placeholder={roll ? '3.{5-8}  -3.5  3.*' : 'e.g. 12 3.{1-4}'} aria-label="Notation"></textarea>
    <button class="btn {app.notToday ? 'max-sm:w-10 max-sm:px-0' : ''}" aria-label="Stage" title="Stage" disabled={!res.ops.length || !!res.errors.length} onclick={apply}><ListPlus aria-hidden="true" /><span class={app.notToday ? 'max-sm:hidden' : ''}>Stage</span></button>
    <label class="btn relative overflow-hidden cursor-pointer {app.notToday ? 'bg-hush-yellow/25 border-hush-yellow mono lg:w-10 lg:px-0' : 'btn-icon'}" title={app.notToday ? `Logging for ${dateLabel}, not today` : 'Log for another date'}>
      <CalendarDays aria-hidden="true" />{#if app.notToday}<span class="lg:hidden">{dateLabel}</span>{/if}
      <input type="date" class="absolute inset-0 w-full h-full opacity-0 appearance-none cursor-pointer !p-0 !border-0" value={app.date}
        onchange={(e) => app.setDate((e.target as HTMLInputElement).value || null)} aria-label={app.notToday ? `Logging for ${dateLabel}, not today. Change date` : 'Log for another date'} />
    </label>
  </div>
  {#if text.trim()}
    <div class="text-sm mono" data-testid="notation-preview">
      {#each res.errors as e}<div class="text-hush-red">{e}</div>{/each}
      {#if !res.errors.length}
        <div class="muted">
          {#each parsed as l}
            <div class="truncate">{l.rolls ? `Roll ${l.rolls.length > 4 ? l.rolls.slice(0, 3).join(',') + `… (${l.rolls.length})` : l.rolls.join(',')}` : roll ? `Roll ${roll}` : 'No roll'}: {l.items.map((i) => `${i.undo ? '−' : '+'}${i.a}.${i.problems ? (i.problems.length === 1 ? i.problems[0] : `{${i.problems.join(',')}}`) : '*'}`).join(' ')}</div>
          {/each}
          <div>= +{summary.add} −{summary.rem}{summary.skip ? ` (${summary.skip} already so)` : ''}</div>
        </div>
      {/if}
    </div>
  {/if}
</div>
