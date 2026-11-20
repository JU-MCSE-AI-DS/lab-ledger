<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { go } from '../lib/router.svelte';
  import { naturalCompare } from '../lib/model';
  import { googleEnabled } from '../lib/google/config';
  import { auth } from '../lib/google/auth.svelte';
  import { inviteTA } from '../lib/google/drive';
  import * as sync from '../lib/sync';
  import { Copy, ExternalLink, UserPlus, Plus, Eye, EyeOff, Trash2, RefreshCw, LogIn, Table2, ScanSearch, X } from '@lucide/svelte';

  const course = $derived(app.course!);
  const isGoogle = $derived(course.kind === 'google');
  let title = $state('');
  $effect(() => { title = course.title; });
  let rollExpr = $state('');
  let msg = $state('');
  let newTitle = $state('');
  let newCount = $state(10);
  let invite = $state('');
  let showInactive = $state(false);
  const link = $derived(`${location.origin}${import.meta.env.BASE_URL}#/c/${encodeURIComponent(course.id)}`);
  const rolls = $derived([...course.rolls].sort((a, b) => naturalCompare(a.roll, b.roll)));

  async function addRolls() { msg = (await app.addRolls(rollExpr)) ?? ''; if (!msg) rollExpr = ''; }
  async function addAssignment() { msg = (await app.addAssignment(newTitle, Number(newCount))) ?? ''; if (!msg) newTitle = ''; }
  async function setCount(id: number, e: Event) {
    const el = e.target as HTMLInputElement;
    const err = await app.updateAssignment(id, { problems: Number(el.value) });
    if (err) { msg = err; el.value = String(course.assignments.find((a) => a.id === id)!.problems); } else msg = '';
  }
  async function copyLink() { await navigator.clipboard.writeText(link); app.flash('Link copied'); }
  async function doInvite() {
    try { await inviteTA(course.id, invite.trim()); app.flash(`Invited ${invite.trim()}`); invite = ''; msg = ''; }
    catch (e) { msg = String((e as Error).message ?? e); }
  }
  async function remove() {
    if (!confirm(`Remove "${course.title}" from this device?${isGoogle ? ' The Google Sheet is not deleted.' : ' Local data will be lost.'}`)) return;
    const id = course.id;
    go(null);
    await app.removeCourse(id);
  }
</script>

<div class="p-3 space-y-4 max-w-3xl mx-auto pb-10">
  {#if msg}<p class="text-hush-red text-sm" role="alert">{msg}</p>{/if}

  <section class="card space-y-2">
    <h1 class="font-semibold text-base">Course</h1>
    <div class="flex gap-2 items-end"><label class="field flex-1"><span class="text-xs muted">Course title</span><input bind:value={title} /></label><button class="btn" onclick={() => app.renameCourse(title)} disabled={title === course.title}>Rename</button></div>
    <p class="muted text-sm">{isGoogle ? 'Stored in a Google Sheet.' : 'Stored on this device only (local course).'}</p>
    {#if isGoogle}
      <div class="flex gap-2 items-end"><label class="field flex-1"><span class="text-xs muted">Course link</span><input class="mono text-xs" readonly value={link} /></label><button class="btn" onclick={copyLink}><Copy aria-hidden="true" />Copy link</button></div>
      <div class="flex gap-2"><a class="btn" href={`https://docs.google.com/spreadsheets/d/${course.id}`} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />Open Sheet</a></div>
    {/if}
    {#if !googleEnabled}<p class="muted text-sm">Google sync is not configured in this build (demo / local mode).</p>{/if}
    <div class="pt-2 border-t border-hush-border"><button class="btn btn-danger" onclick={remove}><Trash2 aria-hidden="true" />Remove course from this device</button></div>
  </section>

  {#if isGoogle}
    <section class="card space-y-2">
      <h2 class="font-semibold">Sync</h2>
      <dl class="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt class="muted">Status</dt><dd><strong>{app.syncState.status}</strong></dd>
        {#if app.syncState.pending}<dt class="muted">Pending</dt><dd>{app.syncState.pending}</dd>{/if}
        {#if app.syncState.last}<dt class="muted">Last sync</dt><dd>{new Date(app.syncState.last).toLocaleTimeString()}</dd>{/if}
      </dl>
      {#if app.syncState.error}<p class="text-hush-red text-sm">{app.syncState.error}</p>{/if}
      <div class="flex flex-wrap gap-2">
        {#if !auth.signedIn}<button class="btn btn-primary" onclick={() => auth.signIn()}><LogIn aria-hidden="true" />Sign in / Reconnect</button>{/if}
        <button class="btn" onclick={() => sync.syncNow(course.id, true)}><RefreshCw aria-hidden="true" />Sync now</button>
        <button class="btn" onclick={() => sync.rebuildNow(course.id)}><Table2 aria-hidden="true" />Rebuild sheet views</button>
      </div>
    </section>
    <section class="card space-y-2">
      <h2 class="font-semibold">Invite a TA</h2>
      <p class="muted text-sm">Shares the Sheet as editor. They open it via the course link.</p>
      <div class="flex gap-2 items-end"><label class="field flex-1"><span class="text-xs muted">TA email</span><input type="email" bind:value={invite} placeholder="ta@example.com" /></label><button class="btn" disabled={!invite.includes('@')} onclick={doInvite}><UserPlus aria-hidden="true" />Invite</button></div>
    </section>
  {/if}

  <section class="card space-y-2" data-testid="conflicts">
    <h2 class="font-semibold">Conflicts inbox {#if app.conflicts.length}<span class="text-hush-yellow">({app.conflicts.length})</span>{/if}</h2>
    {#each app.conflicts as c (c.key)}
      <div class="flex items-start gap-2 text-sm border-t border-hush-border pt-2">
        <div class="flex-1">
          <div class="flex gap-2"><span class="muted">Roll</span><strong class="mono">{c.roll}</strong><span class="muted">Problem</span><span class="mono">{c.problem}</span></div>
          <div>Done by {c.doneBy} survived an undo by {c.undoBy} that did not see it. The cell is shown as done.</div>
        </div>
        <button class="btn btn-sm" onclick={() => go(course.id, 'log', { roll: c.roll })}><ScanSearch aria-hidden="true" />View</button>
        <button class="btn btn-sm" onclick={() => app.dismiss(c.key)}><X aria-hidden="true" />Dismiss</button>
      </div>
    {:else}<p class="muted text-sm">None.</p>{/each}
  </section>

  <section class="card space-y-2">
    <h2 class="font-semibold">Assignments</h2>
    {#if course.assignments.length}<div class="flex gap-2 text-xs muted" aria-hidden="true"><span class="w-8"></span><span class="flex-1">Title</span><span class="w-16">Problems</span><span class="btn btn-sm invisible !min-h-0 !h-0 !border-0"><EyeOff />Hide</span></div>{/if}
    {#each course.assignments as a (a.id)}
      <div class="flex items-center gap-2 {a.active ? '' : 'opacity-50'}">
        <span class="mono w-8">A{a.id}</span>
        <input class="flex-1" value={a.title} aria-label="Title A{a.id}" onchange={(e) => app.updateAssignment(a.id, { title: (e.target as HTMLInputElement).value })} />
        <input class="w-16 mono" type="number" min="1" value={a.problems} aria-label="Problems A{a.id}" onchange={(e) => setCount(a.id, e)} />
        <button class="btn btn-sm" onclick={() => app.updateAssignment(a.id, { active: !a.active })}>{#if a.active}<EyeOff aria-hidden="true" />Hide{:else}<Eye aria-hidden="true" />Show{/if}</button>
      </div>
    {/each}
    <div class="flex gap-2 pt-1 items-end">
      <span class="w-8 shrink-0"></span>
      <label class="field flex-1"><span class="text-xs muted">New assignment title</span><input bind:value={newTitle} /></label>
      <label class="field w-16"><span class="text-xs muted">Problems</span><input class="mono" type="number" min="1" bind:value={newCount} /></label>
      <button class="btn" onclick={addAssignment}><Plus aria-hidden="true" />Add</button>
    </div>
  </section>

  <section class="card space-y-2">
    <h2 class="font-semibold">Rolls <span class="muted text-sm font-normal">({course.rolls.filter((r) => r.active).length} active)</span></h2>
    <div class="flex gap-2 items-end"><label class="field flex-1"><span class="text-xs muted">Add rolls</span><input bind:value={rollExpr} placeholder="1-58, 102" /></label><button class="btn" onclick={addRolls}><Plus aria-hidden="true" />Add</button></div>
    <label class="text-sm muted flex gap-2 items-center"><input type="checkbox" bind:checked={showInactive} /> Show all (to deactivate / reactivate)</label>
    {#if showInactive}
      <div class="flex flex-wrap gap-1.5">
        {#each rolls as r (r.roll)}
          <button class="chip {r.active ? '' : 'opacity-40 line-through'}" onclick={() => app.setRollActive(r.roll, !r.active)}>{r.roll}</button>
        {/each}
      </div>
    {:else if rolls.some((r) => !r.active)}
      <p class="muted text-sm">Inactive: {rolls.filter((r) => !r.active).map((r) => r.roll).join(', ')}</p>
    {/if}
  </section>
</div>
