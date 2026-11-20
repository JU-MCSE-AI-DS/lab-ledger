<script lang="ts">
  // The app mark's 3x3 grid with cells ticking done. Without a label it is decorative
  // (the surrounding button carries aria-busy and its own text).
  let { size = 'sm', label = '' }: { size?: 'sm' | 'lg'; label?: string } = $props();
</script>
<span class="ll-loader {size}" role={label ? 'status' : undefined} aria-hidden={label ? undefined : 'true'}>
  {#each { length: 9 } as _, i}<i style="--d:{(i % 3) + Math.floor(i / 3)}"></i>{/each}
  {#if label}<span class="sr-only">{label}</span>{/if}
</span>
