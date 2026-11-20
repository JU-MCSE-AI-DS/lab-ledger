import { type Course, type LogEvent, uuid } from './model';
import { parseRolls } from './notation';

export function localCourse(title: string, rollExpr: string, assignments: Array<{ id: number; title: string; problems: number }>, id?: string): Course {
  return {
    id: id ?? `local-${uuid().slice(0, 8)}`,
    kind: 'local',
    title,
    created: new Date().toISOString(),
    rolls: (parseRolls(rollExpr) ?? []).map((roll) => ({ roll, active: true })),
    assignments: assignments.map((a) => ({ ...a, active: true }))
  };
}

export function demoCourse(): Course {
  return localCourse('Demo course', '1-30, 102', [
    { id: 1, title: 'Basics', problems: 10 },
    { id: 2, title: 'Loops', problems: 12 },
    { id: 3, title: 'Arrays', problems: 8 },
    { id: 4, title: 'Strings', problems: 9 }
  ]);
}

/** Deterministic pseudo-random seed data so the heatmap has something to show. */
export function demoEvents(course: Course, today: string): LogEvent[] {
  let s = 42;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const out: LogEvent[] = [];
  const day = (n: number) => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  let i = 0;
  for (const r of course.rolls) {
    const diligence = 0.35 + rnd() * 0.65;
    for (const a of course.assignments) {
      const reach = Math.floor(a.problems * diligence * (a.id <= 2 ? 1 : 0.7) + rnd() * 3);
      for (let p = 1; p <= Math.min(reach, a.problems); p++) {
        const d = day(Math.floor(rnd() * 28));
        out.push({ id: `demo-${i++}`, ts: `${d}T09:00:00.000Z`, date: d, roll: r.roll, problem: `${a.id}.${p}`, action: 'done', ref: '', by: rnd() > 0.7 ? 'ta@demo.local' : 'demo@local', batch: `demo-${a.id}`, device: 'demo' });
      }
    }
  }
  return out;
}
