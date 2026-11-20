<script lang="ts">
  import { app } from './lib/app.svelte';
  import { router, go } from './lib/router.svelte';
  import Home from './routes/Home.svelte';
  import Log from './routes/Log.svelte';
  import Progress from './routes/Progress.svelte';
  import Query from './routes/Query.svelte';
  import CourseTab from './routes/Course.svelte';
  import SyncBadge from './components/SyncBadge.svelte';
  import DateChip from './components/DateChip.svelte';
  import AppMenu from './components/AppMenu.svelte';
  import SignInGate from './components/SignInGate.svelte';
  import { gate } from './lib/gate.svelte';
  import { ClipboardCheck, Grid3x3, Search, BookOpen } from '@lucide/svelte';
  import UndoToast from './components/UndoToast.svelte';
  import PrintOverlay from './components/PrintOverlay.svelte';
  import LedgerLoader from './components/LedgerLoader.svelte';
  import CourseSkeleton from './components/CourseSkeleton.svelte';

  $effect(() => { if (app.ready) app.load(router.courseId); });
  // Briefly mark data as freshly arrived so it (and only it) fades in after the skeleton.
  let arriving = $state(false);
  $effect(() => { if (!app.loadedFor) return; arriving = true; const t = setTimeout(() => (arriving = false), 400); return () => clearTimeout(t); });

  const tabs = [['log', 'Log', ClipboardCheck], ['progress', 'Progress', Grid3x3], ['query', 'Query', Search], ['course', 'Course', BookOpen]] as const;
  function switchCourse(e: Event) {
    const v = (e.target as HTMLSelectElement).value;
    if (v === '__home') go(null); else go(v, router.tab);
  }
</script>

{#if !app.ready}
  <div class="h-full grid place-items-center skel-reveal"><LedgerLoader size="lg" label="Loading Lab Ledger" /></div>
{:else if gate.show}
  <div class="no-print h-full overflow-auto"><SignInGate /></div>
{:else if !router.courseId || !app.course}
  <div class="no-print h-full overflow-auto"><Home /></div>
{:else}
  <div class="no-print h-full flex flex-col">
    <header class="flex items-center gap-2 px-3 py-2 border-b border-hush-border bg-hush-surface">
      <select name="course" aria-label="Course" class="min-w-0 max-w-[50%] truncate font-semibold" value={app.course.id} onchange={switchCourse}>
        {#each app.courses as c}<option value={c.id}>{c.title}</option>{/each}
        <option value="__home">All courses…</option>
      </select>
      <nav class="hidden lg:flex gap-1 ml-4">
        {#each tabs as [t, label, Icon]}
          <button class="btn {router.tab === t ? 'btn-primary' : ''}" aria-current={router.tab === t ? 'page' : undefined} onclick={() => go(app.course!.id, t)}><Icon aria-hidden="true" />{label}</button>
        {/each}
      </nav>
      <div class="ml-auto flex items-center gap-2"><DateChip /><SyncBadge /><AppMenu /></div>
    </header>
    <main class="flex-1 min-h-0 overflow-auto" class:ll-arrive={arriving}>
      {#if app.loadedFor !== app.course.id && router.tab !== 'course'}<CourseSkeleton />
      {:else}
        {#if router.tab === 'log'}<Log />
        {:else if router.tab === 'progress'}<Progress />
        {:else if router.tab === 'query'}<Query />
        {:else}<CourseTab />{/if}
      {/if}
    </main>
    <nav class="lg:hidden grid grid-cols-4 border-t border-hush-border bg-hush-surface pb-[env(safe-area-inset-bottom)]">
      {#each tabs as [t, label, Icon]}
        <button class="relative flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-xs min-h-14 {router.tab === t ? 'text-accent font-semibold' : 'muted'}" aria-current={router.tab === t ? 'page' : undefined} onclick={() => go(app.course!.id, t)}>
          {#if router.tab === t}<span class="absolute top-0 inset-x-0 h-0.5 bg-accent"></span>{/if}
          <Icon aria-hidden="true" class="size-5" />{label}
        </button>
      {/each}
    </nav>
  </div>
  <UndoToast />
  {#if app.printOpen}<PrintOverlay />{/if}
{/if}
