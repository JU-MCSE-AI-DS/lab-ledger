import type { Course, LogEvent } from '../src/lib/model';

export function makeCourse(): Course {
  return {
    id: 'local-t', kind: 'local', title: 'T', created: '2026-01-01T00:00:00Z',
    rolls: ['1', '2', '3', '4', '5', '102'].map((roll) => ({ roll, active: true })),
    assignments: [
      { id: 1, title: 'One', problems: 5, active: true },
      { id: 2, title: 'Two', problems: 4, active: true },
      { id: 3, title: 'Three', problems: 6, active: true }
    ]
  };
}

let n = 0;
export function ev(p: Partial<LogEvent> & Pick<LogEvent, 'action'>): LogEvent {
  n++;
  return {
    id: p.id ?? `e${n}`, ts: p.ts ?? `2026-03-01T10:00:${String(n % 60).padStart(2, '0')}Z`, date: p.date ?? '2026-03-01',
    roll: p.roll ?? '1', problem: p.problem ?? '1.1', action: p.action, ref: p.ref ?? '', by: p.by ?? 'a@x', batch: p.batch ?? 'b', device: p.device ?? 'd1'
  };
}
