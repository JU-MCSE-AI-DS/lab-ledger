<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { fly, fade } from 'svelte/transition';
  import { dur, ease } from '../lib/motion';
</script>
{#each app.toast ? [app.toast] : [] as t (t.id)}
    <div in:fly={{ y: 12, duration: dur(200), easing: ease }} out:fade={{ duration: dur(150) }} role="status" class="no-print fixed left-1/2 -translate-x-1/2 bottom-36 lg:bottom-20 z-40 bg-hush-fg text-hush-bg rounded-xl px-4 py-2.5 flex items-center gap-3 overflow-hidden max-w-[calc(100vw-1.5rem)]">
      <span>{t.msg}</span>
      {#if t.batch.length || t.undo}
        <button class="font-bold underline underline-offset-2" onclick={() => app.undoToast()}>Undo</button>
        <span class="toast-bar absolute left-0 bottom-0 h-0.5 bg-hush-green" style="width:100%"></span>
      {/if}
    </div>
{/each}
<style>
  @keyframes shrink { to { width: 0 } }
  .toast-bar { animation: shrink 5s linear forwards; }
  @media (prefers-reduced-motion: reduce) { .toast-bar { animation: none; width: 100% !important; } }
</style>
