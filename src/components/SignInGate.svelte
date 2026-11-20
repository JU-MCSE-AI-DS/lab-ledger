<script lang="ts">
  import { LogIn, TriangleAlert } from '@lucide/svelte';
  import { auth } from '../lib/google/auth.svelte';
  import { gate } from '../lib/gate.svelte';

  let busy = $state(false);
  let err = $state('');
  let dlg: HTMLDialogElement;
  let back: HTMLButtonElement;

  async function signIn() {
    err = ''; busy = true;
    try { await auth.signIn(); } catch (e) { err = String((e as Error).message ?? e); } finally { busy = false; }
  }
  function openWarn() { dlg.showModal(); back.focus(); }
</script>

<main class="min-h-full flex flex-col justify-start sm:justify-center items-center px-4 py-10">
  <div class="w-full max-w-[26rem] space-y-6">
    <header class="flex items-center gap-3">
      <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" class="w-10 h-10 rounded-lg" />
      <h1 class="text-2xl font-bold">Lab Ledger</h1>
    </header>
    <p class="text-pretty">
      Progress is saved to a Google Sheet in your Drive, so it survives a lost or reset device and TAs can log into the same course.
      Lab Ledger can only see the sheets it creates or you open.
    </p>
    <div class="space-y-3">
      <button class="btn btn-primary btn-lg w-full" disabled={busy} onclick={signIn}>
        <LogIn aria-hidden="true" /> {busy ? 'Waiting for Google' : 'Continue with Google'}
      </button>
      {#if err}<p class="text-hush-red text-sm" role="alert">{err}</p>{/if}
      <div class="text-center">
        <button class="btn btn-ghost btn-sm muted" onclick={openWarn}>Skip for now</button>
      </div>
    </div>
  </div>
</main>

<dialog bind:this={dlg} class="warn-dialog" aria-labelledby="skip-title">
  <div class="space-y-3">
    <div class="flex items-center gap-2">
      <TriangleAlert class="text-hush-yellow shrink-0" aria-hidden="true" />
      <h2 id="skip-title" class="font-semibold text-lg">Use without Google?</h2>
    </div>
    <p class="text-sm text-pretty">Courses will be saved in this browser only. Clearing browser data or switching devices deletes them, and TAs can't share them. You can sign in later from the menu.</p>
    <div class="flex flex-wrap justify-end gap-2 pt-1">
      <button class="btn" bind:this={back} onclick={() => dlg.close()}>Go back</button>
      <button class="btn btn-danger" onclick={() => { dlg.close(); gate.skip(); }}>Skip anyway</button>
    </div>
  </div>
</dialog>

<style>
  .warn-dialog {
    margin: auto;
    width: min(26rem, calc(100vw - 2rem));
    padding: 1.1rem;
    color: var(--hush-fg);
    background: var(--hush-surface);
    border: 1px solid var(--hush-border);
    border-radius: .75rem;
    box-shadow: 0 8px 24px color-mix(in srgb, var(--hush-bg) 40%, black 25%);
  }
  .warn-dialog::backdrop { background: color-mix(in srgb, var(--hush-bg) 70%, transparent); }
</style>
