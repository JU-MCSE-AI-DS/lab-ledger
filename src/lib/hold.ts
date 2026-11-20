/** Press-and-hold duration used across the app. */
export const HOLD_MS = 400;

// Svelte action: fire `onhold` after a press-and-hold (touch long-press or mouse hold).
// Vibrates, swallows the click that follows a hold, blocks the long-press context menu,
// and cancels on release, leave, or movement beyond a few pixels (so scrolling is safe).
export function hold(node: HTMLElement, onhold: () => void) {
  const SLOP = 10;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let fired = false, x = 0, y = 0;
  const cancel = () => clearTimeout(timer);
  // On release after a hold, swallow the click that follows; clear the flag shortly after in case none comes.
  const release = () => { cancel(); if (fired) setTimeout(() => { fired = false; }, 400); };
  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    fired = false; x = e.clientX; y = e.clientY; clearTimeout(timer);
    timer = setTimeout(() => {
      fired = true; navigator.vibrate?.(30); onhold();
    }, HOLD_MS);
  };
  const move = (e: PointerEvent) => { if (Math.hypot(e.clientX - x, e.clientY - y) > SLOP) cancel(); };
  const click = (e: Event) => { if (fired) { fired = false; e.preventDefault(); e.stopImmediatePropagation(); } };
  const menu = (e: Event) => e.preventDefault();
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  for (const t of ['pointerup', 'pointerleave', 'pointercancel']) node.addEventListener(t, release);
  node.addEventListener('click', click, true);
  node.addEventListener('contextmenu', menu);
  return {
    update(f: () => void) { onhold = f; },
    destroy() {
      cancel();
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      for (const t of ['pointerup', 'pointerleave', 'pointercancel']) node.removeEventListener(t, release);
      node.removeEventListener('click', click, true);
      node.removeEventListener('contextmenu', menu);
    },
  };
}
