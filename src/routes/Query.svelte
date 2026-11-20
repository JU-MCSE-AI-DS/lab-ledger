<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { go } from '../lib/router.svelte';
  import { activeAssignments } from '../lib/model';
  import { runQuery } from '../lib/query';
  import { shareText } from '../lib/share';
  import { Share2, Copy } from '@lucide/svelte';

  const course = $derived(app.course!);
  const asgs = $derived(activeAssignments(course));
  type Preset = 'missing' | 'remaining' | 'lag' | 'rank' | 'done' | 'custom';
  let preset = $state<Preset>('remaining');
  let pa = $state('');       // assignment id
  let probs = $state('');    // problems range e.g. 5-8
  let proll = $state('');    // roll expr
  let lagN = $state(3);
  let pdate = $state('');
  let text = $state('summary');

  function build(): string {
    const parts: string[] = [];
    const work = pa ? (probs.trim() ? `${pa}.{${probs.trim()}}` : `${pa}.*`) : '';
    const r = proll.trim() ? `r:${proll.trim().replace(/\s+/g, '')}` : '';
    if (preset === 'missing') parts.push('missing', work, r);
    else if (preset === 'remaining') parts.push('remaining', r);
    else if (preset === 'lag') parts.push(`lag>${lagN}`, pa ? `a:${pa}` : '');
    else if (preset === 'rank') parts.push('sort:progress');
    else if (preset === 'done') parts.push('done', work, pdate ? `on:${pdate}` : '', r);
    return parts.filter(Boolean).join(' ');
  }
  $effect(() => { const q = build(); if (preset !== 'custom') text = q; });

  const result = $derived(runQuery(text, course, app.folded, app.today));
  const listText = $derived(result.rows.map((r) => `${r.roll}: ${r.text}`).join('\n'));
  async function copy() { await navigator.clipboard.writeText(listText); app.flash('Copied'); }
  async function share(roll: string) {
    const t = shareText(course, app.folded, roll);
    try { if (navigator.share) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); app.flash('Copied summary'); } } catch {}
  }
</script>

<div class="p-3 space-y-3 max-w-3xl mx-auto">
  <div class="card space-y-2">
    <div class="flex flex-wrap gap-2 items-center">
      <select bind:value={preset} aria-label="Preset">
        <option value="remaining">Remaining for roll</option>
        <option value="missing">Missing assignment…</option>
        <option value="lag">Lagging</option>
        <option value="rank">Rank</option>
        <option value="done">Done…</option>
        <option value="custom">Custom</option>
      </select>
      {#if preset === 'missing' || preset === 'done' || preset === 'lag'}
        <select bind:value={pa} aria-label="Assignment"><option value="">All A</option>{#each asgs as a}<option value={String(a.id)}>A{a.id}</option>{/each}</select>
      {/if}
      {#if (preset === 'missing' || preset === 'done') && pa}<input bind:value={probs} placeholder="problems 5-8" class="w-32" aria-label="Problems" />{/if}
      {#if preset === 'remaining' || preset === 'missing' || preset === 'done'}<input bind:value={proll} placeholder="rolls 1-30" class="w-28" inputmode="numeric" aria-label="Rolls" />{/if}
      {#if preset === 'lag'}<label class="text-sm muted">behind by &gt; <input type="number" min="0" bind:value={lagN} class="w-16" aria-label="Lag threshold" /></label>{/if}
      {#if preset === 'done'}<input type="date" bind:value={pdate} aria-label="On date" />{/if}
    </div>
    <input class="w-full mono text-sm" bind:value={text} oninput={() => { preset = 'custom'; }} spellcheck="false" autocapitalize="off" aria-label="Query" data-testid="query-input" />
    <details class="text-sm muted">
      <summary>Syntax</summary>
      <ul class="mono mt-1 space-y-0.5 leading-relaxed">
        <li>missing 3.{'{5-8}'} r:1-30</li>
        <li>remaining r:12</li>
        <li>done 4.* on:2026-03-13</li>
        <li>lag&gt;3 a:3</li>
        <li>by:ta@x since:-7d</li>
        <li>sort:progress (or sort:-progress, lag, count)</li>
      </ul>
    </details>
  </div>

  {#each result.errors as e}<p class="text-hush-red text-sm">{e}</p>{/each}
  <div class="flex items-center gap-2">
    <span class="muted text-sm" data-testid="result-count">{result.rows.length} roll{result.rows.length === 1 ? '' : 's'}</span>
    <button class="btn btn-sm ml-auto" disabled={!result.rows.length} onclick={copy}><Copy aria-hidden="true" />Copy list</button>
  </div>
  <ul class="space-y-1.5" data-testid="results">
    {#each result.rows as r (r.roll)}
      <li class="card flex items-start gap-3">
        <button class="mono font-semibold w-12 min-h-10 -my-2 text-left underline underline-offset-2" onclick={() => go(course.id, 'log', { roll: r.roll })}>{r.roll}</button>
        <span class="flex-1 mono text-sm break-words">{r.text}</span>
        <span class="muted text-xs mono">{r.count}</span>
        <button class="btn btn-icon btn-sm -my-1" aria-label="Share roll {r.roll}" title="Share roll {r.roll}" onclick={() => share(r.roll)}><Share2 aria-hidden="true" /></button>
      </li>
    {:else}
      <li class="muted p-4 text-center">No results.</li>
    {/each}
  </ul>
</div>
