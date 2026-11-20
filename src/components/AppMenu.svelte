<script lang="ts">
  import { app, type Theme } from '../lib/app.svelte';
  import { router, go } from '../lib/router.svelte';
  import { googleEnabled } from '../lib/google/config';
  import { auth } from '../lib/google/auth.svelte';
  import { Settings, Monitor, Sun, Moon, Check, LogOut, LogIn, LayoutList } from '@lucide/svelte';

  const themes: Array<[Theme, string, typeof Monitor]> = [['system', 'System', Monitor], ['light', 'Light', Sun], ['dark', 'Dark', Moon]];
  let panel = $state<HTMLElement>();
  let btn = $state<HTMLButtonElement>();
  let open = $state(false);
  let err = $state('');
  let pos = $state({ top: 0, right: 0 });

  function place() {
    const r = btn!.getBoundingClientRect();
    pos = { top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) };
  }
  function toggle() { if (open) panel?.hidePopover(); else { place(); err = ''; panel?.showPopover(); } }
  function ontoggle(e: Event) {
    open = (e as ToggleEvent).newState === 'open';
    if (open) (panel?.querySelector('[aria-pressed="true"]') as HTMLElement | null)?.focus();
  }
  function close() { panel?.hidePopover(); }
  function onkeydown(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [...panel!.querySelectorAll<HTMLElement>('button, input')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const n = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[n]?.focus(); e.preventDefault();
  }
  async function signIn() { err = ''; try { await auth.signIn(); } catch (e) { err = String((e as Error).message ?? e); } }
</script>

<svelte:window onresize={() => open && place()} />
<button bind:this={btn} class="btn btn-icon" aria-label="Menu" title="Menu" aria-controls="app-menu" aria-expanded={open} onclick={toggle}><Settings aria-hidden="true" /></button>
<div bind:this={panel} id="app-menu" popover="auto" role="dialog" aria-label="Menu" tabindex="-1" {ontoggle} {onkeydown}
  class="menu-panel" style="top:{pos.top}px; right:{pos.right}px">
  <div class="px-2 pt-1 pb-1 text-xs font-semibold muted" id="menu-theme">Theme</div>
  <div role="group" aria-labelledby="menu-theme">
    {#each themes as [t, label, Icon]}
      <button aria-pressed={app.theme === t} class="menu-row" onclick={() => app.setTheme(t)}>
        <Icon aria-hidden="true" /><span class="flex-1 text-left">{label}</span>
        {#if app.theme === t}<Check aria-hidden="true" class="text-accent" />{/if}
      </button>
    {/each}
  </div>

  {#if googleEnabled}
    <hr class="my-1 border-hush-border" />
    <div class="px-2 pt-1 pb-1 text-xs font-semibold muted">Account</div>
    {#if auth.email}
      <div class="px-2 py-1 text-sm truncate" title={auth.email}>{auth.email}</div>
      <button class="menu-row" onclick={() => { auth.signOut(); close(); }}><LogOut aria-hidden="true" /><span>Sign out</span></button>
    {:else}
      <button class="menu-row" onclick={signIn}><LogIn aria-hidden="true" /><span>Sign in with Google</span></button>
    {/if}
    {#if err}<p class="px-2 text-sm text-hush-red" role="alert">{err}</p>{/if}
  {/if}
  {#if !auth.email}
    {#if !googleEnabled}<hr class="my-1 border-hush-border" />{/if}
    <div class="px-2 pb-1 pt-1 space-y-1">
      <label class="text-sm muted block" for="menu-email">Name or email on your log entries</label>
      <input id="menu-email" class="w-full" value={app.email} onchange={(e) => app.setEmail((e.target as HTMLInputElement).value.trim() || 'me@local')} />
    </div>
  {/if}

  {#if router.courseId}
    <hr class="my-1 border-hush-border" />
    <button class="menu-row" onclick={() => { close(); go(null); }}><LayoutList aria-hidden="true" /><span>All courses</span></button>
  {/if}
</div>

<style>
  .menu-panel {
    position: fixed; inset: auto; margin: 0; padding: .375rem;
    width: min(18rem, calc(100vw - 1rem)); max-height: calc(100dvh - 4.5rem); overflow: auto;
    background: var(--hush-surface); color: var(--hush-fg);
    border: 1px solid var(--hush-border); border-radius: .75rem;
    box-shadow: 0 8px 24px -4px color-mix(in srgb, var(--hush-fg) 22%, transparent);
  }
  .menu-row {
    display: flex; align-items: center; gap: .6rem; width: 100%; min-height: 2.5rem;
    padding: 0 .5rem; border-radius: .5rem; font-size: .9375rem; background: transparent;
  }
  .menu-row:hover { background: var(--hush-overlay); }
  .menu-row :global(svg) { width: 1.125rem; height: 1.125rem; flex: none; }
</style>
