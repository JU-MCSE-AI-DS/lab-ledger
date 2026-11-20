import { expoOut } from 'svelte/easing';

/** Transition duration that collapses to 0 under prefers-reduced-motion. */
export function dur(ms: number): number {
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
  return ms;
}
export const ease = expoOut;
