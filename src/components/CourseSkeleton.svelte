<script lang="ts">
  // Shown while a course's log loads. The course itself (rolls, assignments) is already known,
  // so real roll numbers and problem headers stay put and only the data cells wait.
  import { app } from '../lib/app.svelte';
  import { router } from '../lib/router.svelte';
  import { activeAssignments, activeRolls } from '../lib/model';

  const course = $derived(app.course!);
  const rolls = $derived(activeRolls(course));
  const asgs = $derived([...activeAssignments(course)].sort((x, y) => y.id - x.id));
  const roll = $derived(router.params.get('roll'));
  const n = (k: number) => Array.from({ length: k }, (_, i) => i);
</script>

<div class="skel-reveal h-full" aria-busy="true">
  <p class="sr-only" role="status">Loading {course.title}</p>

  {#if router.tab === 'log'}
    <div class="h-full flex flex-col lg:grid lg:grid-cols-[22rem_1fr]" aria-hidden="true">
      <aside class="hidden lg:flex flex-col border-r border-hush-border min-h-0 h-full">
        <div class="m-2 h-10 rounded-lg border border-[var(--ctl-border)]"></div>
        <ul class="flex-1 overflow-hidden">
          {#each rolls.slice(0, 30) as r, i}
            <li class="flex items-center gap-3 px-3 py-2 border-b border-hush-border">
              <span class="mono w-10 font-semibold muted">{r}</span>
              <span class="skel flex-1 h-2 rounded" style="--d:{Math.min(i, 20)}"></span>
              <span class="skel w-10 h-3 ml-4" style="--d:{Math.min(i + 1, 20)}"></span>
            </li>
          {/each}
        </ul>
      </aside>
      <div class="flex-1 min-h-0 overflow-hidden">
        <div class="p-3 border-b border-hush-border flex gap-2">
          <div class="flex-1 h-10 rounded-lg border border-[var(--ctl-border)]"></div>
          <div class="skel w-24 h-10 rounded-lg"></div>
          <div class="skel w-10 h-10 rounded-lg"></div>
        </div>
        {#if roll && rolls.includes(roll)}
          <div class="p-3 space-y-3">
            <div>
              <div class="text-xl font-semibold mono">Roll {roll}</div>
              <div class="skel mt-1.5 h-1.5 max-w-40 rounded"></div>
            </div>
            {#each asgs.slice(0, 2) as a, k}
              <section class="card">
                <div class="flex items-center gap-2 min-h-10">
                  <span class="font-semibold">A{a.id}</span><span class="muted text-sm truncate">{a.title}</span>
                  <span class="skel w-10 h-4 ml-auto"></span>
                </div>
                <div class="flex flex-wrap gap-1.5 mt-2.5">
                  {#each n(a.problems) as i}<span class="skel size-11 !rounded-[.6rem]" style="--d:{Math.min(i + k * 3, 20)}"></span>{/each}
                </div>
              </section>
            {/each}
          </div>
        {:else}
          <div class="lg:hidden p-3">
            <div class="flex gap-2 mb-2">
              <div class="skel flex-1 h-12 rounded-lg"></div>
              <div class="skel w-20 h-12 rounded-lg"></div>
            </div>
            <div class="min-h-9 mb-2"></div>
            <div class="grid grid-cols-3 gap-2">
              {#each n(12) as i}<div class="skel h-14 rounded-lg" style="--d:{(i % 3) + Math.floor(i / 3)}"></div>{/each}
            </div>
          </div>
        {/if}
      </div>
    </div>

  {:else if router.tab === 'progress'}
    {@const a = asgs[0]}
    <div class="h-full flex flex-col gap-3 p-3 max-w-5xl mx-auto [&>*]:shrink-0" aria-hidden="true">
      <div class="flex items-end gap-2 flex-wrap">
        <div class="skel w-56 h-10 rounded-lg"></div>
        {#if a}<div class="field"><span class="text-xs muted">Assignment</span><div class="skel w-40 h-10 rounded-lg" style="--d:1"></div></div>{/if}
        <div class="skel w-24 h-10 rounded-lg ml-auto" style="--d:2"></div>
      </div>
      {#if a}
        <p class="muted text-sm"><span class="skel inline-block align-middle w-14 h-3"></span> problems done across {rolls.length} rolls (<span class="skel inline-block align-middle w-7 h-3"></span>). Tap a cell for details.</p>
        <div class="!shrink min-h-0 overflow-hidden border border-hush-border rounded-lg bg-hush-bg">
          <table class="border-collapse mono" style="font-size:12px">
            <thead><tr><th class="min-w-3"></th>{#each n(a.problems) as p}<th class="font-normal muted text-center pb-1 pt-1">{p + 1}</th>{/each}</tr></thead>
            <tbody>
              {#each rolls.slice(0, 30) as r, ri}
                <tr>
                  <th class="pl-2 pr-1.5 text-right font-semibold">{r}</th>
                  {#each n(a.problems) as p}<td class="p-px"><div class="skel size-[26px] !rounded-sm" style="--d:{Math.min(ri + p, 20)}"></div></td>{/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="min-h-6 -mt-1"></div>
      {/if}
    </div>

  {:else}
    <div class="p-3 space-y-3 max-w-3xl mx-auto" aria-hidden="true">
      <div class="card space-y-3">
        <div class="flex gap-2">
          <div class="skel w-44 h-10 rounded-lg"></div>
          <div class="skel w-28 h-10 rounded-lg" style="--d:1"></div>
        </div>
        <div class="skel h-10 rounded-lg" style="--d:2"></div>
        <div class="skel h-4 w-16" style="--d:3"></div>
      </div>
      <div class="skel h-4 w-16"></div>
      <div class="space-y-1.5">
        {#each n(6) as i}
          <div class="card flex items-center gap-3">
            <span class="skel w-10 h-5" style="--d:{i}"></span>
            <span class="skel flex-1 h-4" style="--d:{i + 1}"></span>
            <span class="skel size-8 rounded-lg" style="--d:{i + 2}"></span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
