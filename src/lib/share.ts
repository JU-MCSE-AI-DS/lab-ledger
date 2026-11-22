import { type Course } from './model';
import type { Folded } from './fold';
import { rollProgress } from './stats';
import { formatRuns } from './notation';

/** `Roll 12 — A1 ✓ · A3 8/12 (left 3.5, 3.{9-11}) · A4 2/9 (left 4.{3-9})` */
export function shareText(course: Course, f: Folded, roll: string): string {
  const parts = rollProgress(course, f, roll).map((p) =>
    p.missing.length === 0 ? `A${p.a} ✓` : `A${p.a} ${p.done}/${p.total} (left ${formatRuns(p.a, p.missing)})`
  );
  return `Roll ${roll} — ${parts.join(' · ') || 'no assignments'}`;
}

/** Share via the OS sheet, else copy. Resolves true when copied to the clipboard (caller may flash). */
export async function shareRoll(course: Course, f: Folded, roll: string): Promise<boolean> {
  const text = shareText(course, f, roll);
  try {
    if (navigator.share) { await navigator.share({ text }); return false; }
    await navigator.clipboard.writeText(text);
    return true;
  } catch { return false; /* cancelled */ }
}
