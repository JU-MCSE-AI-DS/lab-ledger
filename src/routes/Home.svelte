<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { go, router } from '../lib/router.svelte';
  import { demoCourse, demoEvents, localCourse } from '../lib/demo';
  import { googleEnabled } from '../lib/google/config';
  import { auth } from '../lib/google/auth.svelte';
  import { createRemoteCourse, openViaPicker, openById } from '../lib/google/course';
  import AppMenu from '../components/AppMenu.svelte';
  import { Plus, FlaskConical, FolderOpen, Link, X, CloudOff, Sheet, HardDrive } from '@lucide/svelte';

  let creating = $state(false);
  let title = $state('');
  let rolls = $state('1-60');
  let rows = $state([{ title: 'Assignment 1', problems: 10 }]);
  let where = $state<'local' | 'google'>(googleEnabled && auth.email ? 'google' : 'local');
  $effect(() => { where = googleEnabled && auth.email ? 'google' : 'local'; });
  let signing = $state(false);
  async function signIn() {
    msg = ''; signing = true;
    try { await auth.signIn(); } catch (e) { msg = String((e as Error).message ?? e); } finally { signing = false; }
  }
  let linkText = $state('');
  let msg = $state('');
  let busy = $state(false);

  // arrived via a course link that is not on this device
  const missingId = $derived(router.courseId && !app.courses.some((c) => c.id === router.courseId) ? router.courseId : null);

  async function startDemo() {
    const c = demoCourse();
    await app.addCourse(c, demoEvents(c, app.today));
    go(c.id);
  }
  async function create() {
    msg = ''; busy = true;
    try {
      const asg = rows.map((r, i) => ({ id: i + 1, title: r.title.trim() || `Assignment ${i + 1}`, problems: Number(r.problems) }));
      if (!title.trim()) throw new Error('Give the course a title');
      if (asg.some((a) => !Number.isInteger(a.problems) || a.problems < 1)) throw new Error('Each assignment needs a positive problem count');
      const base = localCourse(title.trim(), rolls, asg);
      if (!base.rolls.length) throw new Error('Could not read roll list (e.g. 1-58, 102)');
      const c = where === 'google' ? await createRemoteCourse(base) : base;
      await app.addCourse(c);
      go(c.id);
    } catch (e) { msg = String((e as Error).message ?? e); } finally { busy = false; }
  }
  async function pick(id?: string) {
    msg = ''; busy = true;
    try { const c = id ? await openById(id) : await openViaPicker(); if (c) { await app.addCourse(c); go(c.id); } }
    catch (e) { msg = String((e as Error).message ?? e); } finally { busy = false; }
  }
  function openLink() {
    const m = /\/c\/([^/?#]+)/.exec(linkText) ?? /^([\w-]{20,})$/.exec(linkText.trim());
    if (!m) { msg = 'Paste a course link'; return; }
    const id = decodeURIComponent(m[1]);
    if (app.courses.some((c) => c.id === id)) go(id); else pick(id);
  }
</script>

<div class="max-w-xl mx-auto p-4 space-y-4">
  <header class="flex items-center gap-3">
    <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" class="w-9 h-9 rounded-lg" />
    <h1 class="text-2xl font-bold">Lab Ledger</h1>
    <div class="ml-auto"><AppMenu /></div>
  </header>

  {#if googleEnabled && !auth.email}
    <div class="card flex items-center gap-3">
      <CloudOff class="shrink-0 muted" aria-hidden="true" />
      <p class="flex-1 text-sm muted">Not signed in. Courses are stored on this device only.</p>
      <button class="btn btn-sm" disabled={signing} onclick={signIn}>Sign in</button>
    </div>
  {/if}

  {#if missingId}
    <div class="card space-y-2">
      <p>This course is not on this device yet.</p>
      {#if googleEnabled}<button class="btn btn-primary" disabled={busy} onclick={() => pick(missingId)}>Open via Google Picker</button>{:else}<p class="muted text-sm">Google is not configured in this build.</p>{/if}
    </div>
  {/if}

  <section class="space-y-2">
    <h2 class="font-semibold">Your courses</h2>
    {#each app.courses as c (c.id)}
      <button class="card w-full text-left flex items-center gap-2 hover:bg-hush-overlay" onclick={() => go(c.id)}>
        <span class="font-semibold flex-1">{c.title}</span>
        <span class="muted text-xs flex items-center gap-1">{#if c.kind === 'google'}<Sheet class="w-3.5 h-3.5" aria-hidden="true" /> Google Sheet{:else}<HardDrive class="w-3.5 h-3.5" aria-hidden="true" /> Local{/if}</span>
        <span class="muted text-xs ml-3">{c.rolls.filter((r) => r.active).length} rolls</span>
      </button>
    {:else}
      <p class="muted text-sm">No courses yet. Create one below, or try the demo course to look around.</p>
    {/each}
  </section>

  <section class="space-y-2">
    <div class="flex flex-wrap gap-2">
      <button class="btn btn-primary" onclick={() => (creating = !creating)}><Plus aria-hidden="true" /> New course</button>
      <button class="btn" onclick={startDemo} data-testid="demo-btn"><FlaskConical aria-hidden="true" /> Try demo course</button>
      {#if googleEnabled}<button class="btn" disabled={busy} onclick={() => pick()}><FolderOpen aria-hidden="true" /> Open from Google</button>{/if}
    </div>
    {#if googleEnabled}
      <div class="flex gap-2 items-center">
        <input class="flex-1" bind:value={linkText} placeholder="Paste a course link" aria-label="Course link" />
        <button class="btn" onclick={openLink}><Link aria-hidden="true" /> Open</button>
      </div>
      {#if !auth.signedIn}<p class="muted text-sm">You will be asked to sign in with Google.</p>{/if}
    {/if}
    {#if msg}<p class="text-hush-red text-sm" role="alert">{msg}</p>{/if}
  </section>

  {#if creating}
    <section class="card space-y-3">
      <h2 class="font-semibold">New course</h2>
      <input class="w-full" bind:value={title} placeholder="Title, e.g. MCA Programming Lab (C) 2025-27" aria-label="Title" />
      <input class="w-full" bind:value={rolls} placeholder="Rolls: 1-58, 102" aria-label="Rolls" />
      <div class="space-y-1.5">
        <p class="text-sm muted">Assignments</p>
        {#each rows as r, i}
          <div class="flex gap-2">
            <span class="mono w-8 h-10 flex items-center">A{i + 1}</span>
            <input class="flex-1" bind:value={r.title} aria-label="Assignment {i + 1} title" />
            <input class="w-20 mono" type="number" min="1" bind:value={r.problems} aria-label="Assignment {i + 1} problems" />
            {#if rows.length > 1}<button class="btn btn-icon" aria-label="Remove assignment {i + 1}" title="Remove assignment {i + 1}" onclick={() => (rows = rows.filter((_, j) => j !== i))}><X aria-hidden="true" /></button>{/if}
          </div>
        {/each}
        <button class="btn" onclick={() => (rows = [...rows, { title: `Assignment ${rows.length + 1}`, problems: 10 }])}><Plus aria-hidden="true" /> Assignment</button>
      </div>
      {#if googleEnabled}
        <div class="flex flex-wrap gap-x-4 text-sm">
          <label class="flex gap-1.5 items-center min-h-10"><input type="radio" bind:group={where} value="google" /> Google Sheet</label>
          <label class="flex gap-1.5 items-center min-h-10"><input type="radio" bind:group={where} value="local" /> This device only</label>
        </div>
      {:else}
        <p class="muted text-sm">Stored on this device only (Google is not configured).</p>
      {/if}
      <button class="btn btn-primary" disabled={busy} onclick={create}>Create</button>
    </section>
  {/if}
</div>
