<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { activeAssignments, type Course } from '../lib/model';
  import { shareText } from '../lib/share';
  import type { RollStat } from '../lib/stats';
  import { Share2, Hash, ChevronDown, ChevronRight, Check, CheckCheck } from '@lucide/svelte';
  let { roll, course, stat = null, showChange = false, onchange }: { roll: string; course: Course; stat?: RollStat | null; showChange?: boolean; onchange?: () => void } = $props();

  // incomplete first (newest first), then complete (collapsed)
  const sections = $derived.by(() => {
    const rows = activeAssignments(course).map((a) => {
      let done = 0;
      for (let p = 1; p <= a.problems; p++) if (app.isDone(roll, a.id, p)) done++;
      return { a, done, complete: done === a.problems };
    });
    return [...rows.filter((r) => !r.complete).sort((x, y) => y.a.id - x.a.id), ...rows.filter((r) => r.complete).sort((x, y) => y.a.id - x.a.id)];
  });
  let open = $state<Record<number, boolean>>({});
  let anchor = $state<{ a: number; p: number } | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let longFired = false;
  let drag = $state<{ a: number; p: number; end: number } | null>(null);
  let dragged = $state(false);

  $effect(() => { roll; anchor = null; open = {}; });

  function down(a: number, p: number) {
    longFired = false; dragged = false; drag = { a, p, end: p };
    timer = setTimeout(() => { longFired = true; anchor = { a, p }; navigator.vibrate?.(15); }, 450);
  }
  function up() { if (timer) clearTimeout(timer); timer = null; }
  function move(e: PointerEvent) {
    if (!drag) return;
    const c = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-chip]');
    const [a, p] = c?.dataset.chip?.split('.').map(Number) ?? [];
    if (a !== drag.a || p === drag.end) return;
    drag.end = p;
    if (p !== drag.p) { dragged = true; up(); anchor = null; }
  }
  function release() {
    if (drag && dragged && drag.end !== drag.p) {
      const want = !app.effective(roll, drag.a, drag.p);
      for (let q = Math.min(drag.p, drag.end); q <= Math.max(drag.p, drag.end); q++) app.setEffective(roll, drag.a, q, want);
    }
    drag = null; up();
  }
  function cancel() { drag = null; dragged = false; up(); }
  function tap(a: number, p: number) {
    if (longFired) { longFired = false; return; }
    if (dragged) { dragged = false; return; }
    if (anchor && anchor.a === a) {
      const want = !app.effective(roll, a, anchor.p);
      for (let q = Math.min(anchor.p, p); q <= Math.max(anchor.p, p); q++) app.setEffective(roll, a, q, want);
      anchor = null;
    } else {
      anchor = null;
      app.toggle(roll, a, p);
    }
  }
  function fill(a: number, total: number) { for (let p = 1; p <= total; p++) app.setEffective(roll, a, p, true); }
  async function share() {
    const text = shareText(course, app.folded, roll);
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); app.flash('Copied summary'); } }
    catch { /* cancelled */ }
  }
</script>
<svelte:window onpointermove={move} onpointerup={release} onpointercancel={cancel} />
<div class="p-3 space-y-3">
  <div class="flex items-center gap-2">
    <div class="min-w-0 flex-1">
      <div class="flex items-baseline gap-3">
        <h1 class="text-xl font-semibold mono">Roll {roll}</h1>
        {#if stat}<span data-arrive class="muted mono text-sm">{stat.done}/{stat.total}</span>{/if}
      </div>
      {#if stat}<div class="mt-1.5 h-1.5 max-w-40 rounded bg-hush-overlay overflow-hidden"><div data-arrive class="h-full bg-hush-green" style="width:{Math.round(stat.pct * 100)}%"></div></div>{/if}
    </div>
    {#if showChange}<span class="lg:hidden"><button class="btn btn-sm" onclick={onchange} data-testid="change-roll"><Hash aria-hidden="true" />Change roll</button></span>{/if}
    <button class="btn btn-sm" onclick={share}><Share2 aria-hidden="true" />Share</button>
  </div>
  {#each sections as { a, done, complete } (a.id)}
    <section class="card">
      <div class="flex items-center gap-2">
        <button class="flex-1 min-w-0 min-h-10 flex items-center gap-2 text-left" onclick={() => (open[a.id] = !(open[a.id] ?? !complete))} aria-expanded={open[a.id] ?? !complete}>
          {#if open[a.id] ?? !complete}<ChevronDown class="icon muted" aria-hidden="true" />{:else}<ChevronRight class="icon muted" aria-hidden="true" />{/if}
          <span class="font-semibold">A{a.id}</span> <span class="muted text-sm truncate">{a.title}</span>
          <span data-arrive class="mono text-sm ml-auto inline-flex items-center gap-1 {complete ? 'text-hush-green' : ''}">{#if complete}<Check class="icon" aria-hidden="true" />{/if}{done}/{a.problems}</span>
        </button>
        {#if !complete && (open[a.id] ?? true)}<button class="btn btn-sm" onclick={() => fill(a.id, a.problems)} aria-label="Mark all A{a.id} problems done"><CheckCheck aria-hidden="true" />All</button>{/if}
      </div>
      {#if open[a.id] ?? !complete}
        <div class="flex flex-wrap gap-1.5 mt-2.5" role="group" aria-label="Assignment {a.id} problems">
          {#each Array.from({ length: a.problems }, (_, i) => i + 1) as p}
            {@const st = app.stagedState(roll, a.id, p)}
            <button
              class="chip {app.isDone(roll, a.id, p) && st !== 'remove' ? 'done' : ''} {st ?? ''} {anchor && anchor.a === a.id && anchor.p === p ? 'anchor' : ''} {drag && dragged && drag.a === a.id && p >= Math.min(drag.p, drag.end) && p <= Math.max(drag.p, drag.end) ? 'sel' : ''}"
              data-chip="{a.id}.{p}"
              title={a.problemTitles?.[p - 1] ?? `${a.id}.${p}`}
              onpointerdown={() => down(a.id, p)}
              oncontextmenu={(e) => e.preventDefault()}
              onclick={() => tap(a.id, p)}>{p}</button>
          {/each}
        </div>
      {/if}
    </section>
  {/each}
  {#if anchor}<p class="text-sm muted">Range starts at {anchor.a}.{anchor.p}. Tap another chip to toggle the whole range.</p>{:else}<p class="text-sm muted">Tip: slide across chips, or long-press one then tap another, to toggle a range.</p>{/if}
</div>
