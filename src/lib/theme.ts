import type { Theme } from './app.svelte';

export function applyTheme(t: Theme) {
  const el = document.documentElement;
  if (t === 'system') el.removeAttribute('data-theme'); else el.setAttribute('data-theme', t);
  void syncFavicon(t);
}

/** icon.svg follows the OS scheme; an explicit app theme pins its light media query on or off. */
let faviconSrc: Promise<string> | null = null;
async function syncFavicon(t: Theme) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  const url = `${import.meta.env.BASE_URL}icon.svg`;
  if (t === 'system') { link.href = url; return; }
  faviconSrc ??= fetch(url).then((r) => r.text());
  const src = await faviconSrc.catch(() => { faviconSrc = null; return null; });
  if (!src || document.documentElement.getAttribute('data-theme') !== t) return; // failed, or theme changed meanwhile
  const svg = src.replace('(prefers-color-scheme: light)', t === 'light' ? 'all' : 'not all');
  link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
