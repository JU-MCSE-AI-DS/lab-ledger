import { googleEnabled } from './google/config';
import { auth } from './google/auth.svelte';

const KEY = 'll.authSkipped';

class Gate {
  skipped = $state(typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1');
  get show() { return googleEnabled && !auth.email && !this.skipped; }
  skip() { this.skipped = true; localStorage.setItem(KEY, '1'); }
  unskip() { this.skipped = false; localStorage.removeItem(KEY); }
}

export const gate = new Gate();
