<script lang="ts">
  import { app } from '../lib/app.svelte';
</script>
{#if app.toast}
  {#key app.toast.id}
    <div role="status" class="no-print fixed left-1/2 -translate-x-1/2 bottom-36 lg:bottom-20 z-40 bg-hush-fg text-hush-bg rounded-xl shadow-lg px-4 py-2.5 flex items-center gap-3 overflow-hidden max-w-[calc(100vw-1.5rem)]">
      <span>{app.toast.msg}</span>
      {#if app.toast.batch.length}
        <button class="font-bold underline underline-offset-2" onclick={() => app.undoToast()}>Undo</button>
        <span class="toast-bar absolute left-0 bottom-0 h-0.5 bg-hush-green" style="width:100%"></span>
      {/if}
    </div>
  {/key}
{/if}
<style>
  @keyframes shrink { to { width: 0 } }
  .toast-bar { animation: shrink 5s linear forwards; }
  @media (prefers-reduced-motion: reduce) { .toast-bar { animation: none; width: 100% !important; } }
</style>
