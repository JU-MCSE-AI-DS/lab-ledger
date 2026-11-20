export type Tab = 'log' | 'progress' | 'query' | 'course';
export interface Route { courseId: string | null; tab: Tab; params: URLSearchParams }

export function parseHash(h: string): Route {
  const [path, qs] = h.replace(/^#/, '').split('?');
  const m = /^\/c\/([^/]+)(?:\/(log|progress|query|course))?$/.exec(path || '/');
  return { courseId: m ? decodeURIComponent(m[1]) : null, tab: (m?.[2] as Tab) ?? 'log', params: new URLSearchParams(qs ?? '') };
}

export const router = $state<Route>(parseHash(location.hash));
if (typeof window !== 'undefined') window.addEventListener('hashchange', () => Object.assign(router, parseHash(location.hash)));

export function go(courseId: string | null, tab: Tab = 'log', params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  location.hash = courseId ? `#/c/${encodeURIComponent(courseId)}/${tab}${qs}` : '#/';
}
