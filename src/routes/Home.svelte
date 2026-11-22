<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { confirmRemoveCourse } from '../lib/confirm';
  import { hold } from '../lib/hold';
  import { isPositiveInt } from '../lib/ops';
  import type { Course } from '../lib/model';
  import { go, router, COURSE_ID } from '../lib/router.svelte';
  import { demoCourse, demoEvents, localCourse } from '../lib/demo';
  import { googleEnabled } from '../lib/google/config';
  import { auth } from '../lib/google/auth.svelte';
  import { createRemoteCourse, openViaPicker, openById } from '../lib/google/course';
  import { slide, fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { dur, ease } from '../lib/motion';
  import AppMenu from '../components/AppMenu.svelte';
  import LedgerLoader from '../components/LedgerLoader.svelte';
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
  let busy = $state<'' | 'create' | 'pick' | 'link'>('');

  // arrived via a course link that is not on this device
  const missingId = $derived(router.courseId && !app.courses.some((c) => c.id === router.courseId) ? router.courseId : null);

  async function removeOne(c: Course) { if (await confirmRemoveCourse(c)) await app.removeCourse(c.id); }
  async function startDemo() {
    const c = demoCourse();
    await app.addCourse(c, demoEvents(c, app.today));
    go(c.id);
  }
  async function create() {
    msg = ''; busy = 'create';
    try {
      const asg = rows.map((r, i) => ({ id: i + 1, title: r.title.trim() || `Assignment ${i + 1}`, problems: Number(r.problems) }));
      if (!title.trim()) throw new Error('Give the course a title');
      if (asg.some((a) => !isPositiveInt(a.problems))) throw new Error('Each assignment needs a positive problem count');
      const base = localCourse(title.trim(), rolls, asg);
      if (!base.rolls.length) throw new Error('Could not read roll list (e.g. 1-58, 102)');
      const c = where === 'google' ? await createRemoteCourse(base) : base;
      await app.addCourse(c);
      go(c.id);
    } catch (e) { msg = String((e as Error).message ?? e); } finally { busy = ''; }
  }
  async function pick(id?: string) {
    msg = ''; busy = id ? 'link' : 'pick';
    try { const c = id ? await openById(id) : await openViaPicker(); if (c) { await app.addCourse(c); go(c.id); } }
    catch (e) { msg = String((e as Error).message ?? e); } finally { busy = ''; }
  }
  function openLink() {
    const m = /\/c\/([^/?#]+)/.exec(linkText) ?? /^([\w-]{20,})$/.exec(linkText.trim());
    if (!m) { msg = 'Paste a course link'; return; }
    const id = decodeURIComponent(m[1]);
    if (!COURSE_ID.test(id)) { msg = 'Bad course link'; return; }
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
      <button class="btn btn-sm" disabled={signing} aria-busy={signing} onclick={signIn}>{#if signing}<LedgerLoader />{/if}Sign in</button>
    </div>
  {/if}

  {#if missingId}
    <div class="card space-y-2">
      <p>This course is not on this device yet.</p>
      {#if googleEnabled}<button class="btn btn-primary" disabled={!!busy} aria-busy={busy === 'link'} onclick={() => pick(missingId)}>{#if busy === 'link'}<LedgerLoader />Opening course…{:else}Open via Google Picker{/if}</button>{:else}<p class="muted text-sm">Google is not configured in this build.</p>{/if}
    </div>
  {/if}

  <section class="space-y-2">
    <h2 class="font-semibold">Your courses</h2>
    {#if app.courses.length}<p class="text-xs muted">Hold a course, or hover and click ×, to remove it from this device.</p>{/if}
    {#each app.courses as c, i (c.id)}
      <div class="hold-wrap block ll-rise" style="animation-delay: {Math.min(i, 8) * 35}ms" out:fade={{ duration: dur(150) }} animate:flip={{ duration: dur(220), easing: ease }}>
        <button class="card w-full text-left flex items-center gap-2 hover:bg-hush-overlay transition-colors duration-[120ms] select-none" use:hold={() => removeOne(c)} onclick={() => go(c.id)}>
          <span class="font-semibold flex-1">{c.title}</span>
          <span class="muted text-xs flex items-center gap-1">{#if c.kind === 'google'}<Sheet class="w-3.5 h-3.5" aria-hidden="true" /> Google Sheet{:else}<HardDrive class="w-3.5 h-3.5" aria-hidden="true" /> Local{/if}</span>
          <span class="muted text-xs ml-3">{c.rolls.filter((r) => r.active).length} rolls</span>
        </button>
        <button class="hold-x" tabindex="-1" aria-label="Remove {c.title} from this device" title="Remove from this device" onclick={() => removeOne(c)}><X aria-hidden="true" /></button>
      </div>
    {:else}
      <p class="muted text-sm">No courses yet. Create one below{#if !googleEnabled}, or try the demo course to look around{/if}.</p>
    {/each}
  </section>

  <section class="space-y-2">
    <div class="flex flex-wrap gap-2">
      <button class="btn btn-primary" onclick={() => (creating = !creating)}><Plus aria-hidden="true" /> New course</button>
      {#if !googleEnabled}<button class="btn" onclick={startDemo} data-testid="demo-btn"><FlaskConical aria-hidden="true" /> Try demo course</button>{/if}
      {#if googleEnabled}<button class="btn" disabled={!!busy} aria-busy={busy === 'pick'} onclick={() => pick()}>{#if busy === 'pick'}<LedgerLoader />Opening…{:else}<FolderOpen aria-hidden="true" />Open from Google{/if}</button>{/if}
    </div>
    {#if googleEnabled}
      <div class="flex gap-2 items-end">
        <label class="field flex-1"><span class="text-xs muted">Course link</span><input name="course-link" autocomplete="off" bind:value={linkText} placeholder="Paste a course link" /></label>
        <button class="btn" disabled={!!busy} aria-busy={busy === 'link'} onclick={openLink}>{#if busy === 'link'}<LedgerLoader />{:else}<Link aria-hidden="true" />{/if}Open</button>
      </div>
      {#if !auth.signedIn}<p class="muted text-sm">You will be asked to sign in with Google.</p>{/if}
    {/if}
    {#if msg}<p class="text-hush-red text-sm" role="alert">{msg}</p>{/if}
  </section>

  {#if creating}
    <section class="card space-y-3" transition:slide={{ duration: dur(220), easing: ease }}>
      <h2 class="font-semibold">New course</h2>
      <label class="field"><span class="text-xs muted">Title</span><input name="course-title" autocomplete="off" bind:value={title} placeholder="e.g. MCA Programming Lab (C) 2025-27" /></label>
      <label class="field"><span class="text-xs muted">Rolls</span><input name="rolls" autocomplete="off" bind:value={rolls} placeholder="1-58, 102" /></label>
      <div class="space-y-1.5">
        <p class="text-sm muted">Assignments</p>
        <div class="flex gap-2 text-xs muted" aria-hidden="true"><span class="w-8"></span><span class="flex-1">Title</span><span class="w-20">Problems</span>{#if rows.length > 1}<span class="w-10"></span>{/if}</div>
        {#each rows as r, i}
          <div class="flex gap-2 ll-rise">
            <span class="mono w-8 h-10 flex items-center">A{i + 1}</span>
            <input name="assignment-title" class="flex-1" bind:value={r.title} aria-label="Assignment {i + 1} title" />
            <input name="assignment-problems" class="w-20 mono" type="number" min="1" bind:value={r.problems} aria-label="Assignment {i + 1} problems" />
            {#if rows.length > 1}<button class="btn btn-icon" aria-label="Remove assignment {i + 1}" title="Remove assignment {i + 1}" onclick={() => (rows = rows.filter((_, j) => j !== i))}><X aria-hidden="true" /></button>{/if}
          </div>
        {/each}
        <button class="btn" onclick={() => (rows = [...rows, { title: `Assignment ${rows.length + 1}`, problems: 10 }])}><Plus aria-hidden="true" /> Assignment</button>
      </div>
      {#if googleEnabled}
        <div class="flex flex-wrap gap-x-4 text-sm">
          <label class="flex gap-1.5 items-center min-h-10"><input type="radio" name="where" bind:group={where} value="google" /> Google Sheet</label>
          <label class="flex gap-1.5 items-center min-h-10"><input type="radio" name="where" bind:group={where} value="local" /> This device only</label>
        </div>
      {:else}
        <p class="muted text-sm">Stored on this device only (Google is not configured).</p>
      {/if}
      <button class="btn btn-primary" disabled={!!busy} aria-busy={busy === 'create'} onclick={create}>{#if busy === 'create'}<LedgerLoader />{where === 'google' ? 'Creating sheet…' : 'Creating…'}{:else}Create{/if}</button>
    </section>
  {/if}
</div>
