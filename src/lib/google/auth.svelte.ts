import { CLIENT_ID, SCOPES, googleEnabled } from './config';
import { app } from '../app.svelte';

export class AuthError extends Error {}

function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error(`Could not load ${src} (offline?)`));
    document.head.appendChild(s);
  });
}
export const loadGis = () => loadScript('https://accounts.google.com/gsi/client');
export const loadGapi = () => loadScript('https://apis.google.com/js/api.js');

class Auth {
  signedIn = $state(false);
  email = $state(localStorage.getItem('ll.gemail') ?? '');
  private token = '';
  private expires = 0;
  private client: google.accounts.oauth2.TokenClient | null = null;
  private pending: { res: (t: string) => void; rej: (e: Error) => void } | null = null;

  private async ensureClient() {
    if (!googleEnabled) throw new AuthError('Google is not configured in this build');
    await loadGis();
    this.client ??= google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (r) => {
        if (r.error || !r.access_token) return this.pending?.rej(new AuthError(r.error_description || r.error || 'Sign-in failed'));
        this.token = r.access_token;
        this.expires = Date.now() + (Number(r.expires_in) || 3600) * 1000;
        this.signedIn = true;
        this.pending?.res(this.token);
      },
      error_callback: (e) => this.pending?.rej(new AuthError(e.type === 'popup_closed' ? 'Sign-in cancelled' : `Sign-in blocked (${e.type}). Use "Sign in / Reconnect".`))
    });
    return this.client;
  }

  private request(prompt: '' | 'consent' | 'select_account'): Promise<string> {
    return new Promise(async (res, rej) => {
      try {
        const c = await this.ensureClient();
        this.pending = { res, rej };
        c.requestAccessToken({ prompt, login_hint: this.email || undefined } as any);
      } catch (e) { rej(e as Error); }
    });
  }

  /** Valid access token. Non-interactive attempts do a silent refresh and fail with AuthError ("Reconnect"). */
  async getToken(interactive = false): Promise<string> {
    if (this.token && Date.now() < this.expires - 60_000) return this.token;
    if (!interactive && !this.email) throw new AuthError('Not signed in');
    const t = await this.request(interactive && !this.email ? 'select_account' : '');
    if (!this.email) await this.fetchEmail(t);
    return t;
  }

  async signIn() {
    const t = await this.request(this.email ? '' : 'select_account');
    await this.fetchEmail(t);
  }

  private async fetchEmail(t: string) {
    try {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${t}` } });
      const j = await r.json();
      if (j.email) { this.email = j.email; localStorage.setItem('ll.gemail', j.email); app.setEmail(j.email); }
    } catch { /* offline: keep previous */ }
  }

  signOut() {
    if (this.token && typeof google !== 'undefined') google.accounts.oauth2.revoke(this.token, () => {});
    this.token = ''; this.expires = 0; this.signedIn = false; this.email = '';
    localStorage.removeItem('ll.gemail');
  }

  /** Current token without prompting (for Picker), or throws. */
  async interactiveToken() { return this.getToken(true); }
}

export const auth = new Auth();
