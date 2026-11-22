<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { ListPlus, CalendarDays } from '@lucide/svelte';
  import type { Course } from '../lib/model';
  import { parseNotation, resolveNotation } from '../lib/notation';
  import { hold } from '../lib/hold';
  let { course, roll }: { course: Course; roll: string | null } = $props();
  let text = $state('');
  let dlg: HTMLDialogElement;
  let trigger: HTMLButtonElement;
  let ta: HTMLTextAreaElement;
  function open() { if (!dlg.open) { dlg.showModal(); ta.focus(); } }
  function closed() { trigger?.focus(); }
  function global(e: KeyboardEvent) {
    if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || dlg?.open) return;
    if (e.key !== '/' && e.key.toLowerCase() !== 'n') return;
    const t = e.target as HTMLElement;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
    e.preventDefault(); open();
  }
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
  function backToToday() { if (app.notToday) { app.setDate(null); app.flash('Back to today'); } }
  function apply() {
    if (!res.ops.length || res.errors.length) return;
    app.stageOps(res.ops);
    text = '';
    dlg.close();
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !text.includes('\n')) { e.preventDefault(); apply(); }
  }
</script>
<svelte:window onkeydown={global} />
<div class="p-3 border-b border-hush-border">
  <div class="flex gap-2 items-start">
    <button bind:this={trigger} class="btn flex-1 justify-start" aria-keyshortcuts="/ n" onclick={open}>
      <ListPlus aria-hidden="true" />Notation<kbd class="hidden lg:inline ml-auto mono text-xs muted border border-hush-border rounded px-1.5" aria-hidden="true">/</kbd>
    </button>
    <label class="btn relative overflow-hidden cursor-pointer mono select-none {app.notToday ? 'bg-hush-yellow/25 border-hush-yellow' : ''}" title={app.notToday ? `Logging for ${app.dateLabel}, not today. Hold to go back to today` : 'Log for another date'}
      use:hold={backToToday}>
      <CalendarDays aria-hidden="true" /><span>{app.notToday ? app.dateLabel : 'Today'}</span>
      <input type="date" name="log-date" class="absolute inset-0 w-full h-full opacity-0 appearance-none cursor-pointer !p-0 !border-0" value={app.date}
        onclick={(e) => { try { e.currentTarget.showPicker(); } catch {} }}
        onchange={(e) => app.setDate((e.target as HTMLInputElement).value || null)} aria-label={app.notToday ? `Logging for ${app.dateLabel}, not today. Change date, or hold to go back to today` : 'Log for another date'} />
    </label>
  </div>
</div>

<dialog bind:this={dlg} class="notation-dialog" aria-labelledby="notation-title" onclose={closed}
  onclick={(e) => { if (e.target === dlg) dlg.close(); }}>
  <div class="h-full flex flex-col gap-3 p-4">
    <div class="flex items-center gap-2 shrink-0">
      <h2 id="notation-title" class="font-semibold text-lg flex-1">Notation</h2>
      <button class="btn" onclick={() => dlg.close()}>Cancel</button>
      <button class="btn btn-primary" disabled={!res.ops.length || !!res.errors.length} onclick={apply}><ListPlus aria-hidden="true" />Stage</button>
    </div>
    <textarea name="notation" autocomplete="off" bind:value={text} onkeydown={key} class="flex-1 min-h-32 w-full mono text-sm resize-none" spellcheck="false" autocapitalize="off" bind:this={ta}
      placeholder={roll ? '3.{5-8} -3.5' : '12 3.{1-4}'} aria-label="Notation"></textarea>
    {#if text.trim()}
      <div class="shrink-0 max-h-[30%] overflow-auto text-sm mono" data-testid="notation-preview">
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
</dialog>

<style>
  .notation-dialog {
    color: var(--hush-fg); background: var(--hush-surface); border: 1px solid var(--hush-border);
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); margin: 0; inset: 0; width: 100%; max-width: 100%; height: 100dvh; max-height: 100dvh; border: 0;
  }
  .notation-dialog::backdrop { background: color-mix(in srgb, var(--hush-bg) 70%, transparent); }
  .notation-dialog[open] { animation: sheet-in 180ms cubic-bezier(0.16, 1, 0.3, 1); }
  @keyframes sheet-in { from { transform: translateY(1.5rem); opacity: 0; } }
  @media (min-width: 1024px) {
    .notation-dialog { padding: 0; margin: auto; width: min(40rem, calc(100vw - 2rem)); height: min(40rem, 85vh); border: 1px solid var(--hush-border); border-radius: .75rem; }
  }
  @media (prefers-reduced-motion: reduce) { .notation-dialog[open] { animation: none; } }
</style>
