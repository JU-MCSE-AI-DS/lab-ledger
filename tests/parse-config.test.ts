import { describe, it, expect, vi } from 'vitest';

// sheets.ts imports the auth rune module, which needs a browser; parseConfig itself is pure.
vi.mock('../src/lib/google/auth.svelte', () => ({ auth: {}, AuthError: class extends Error {} }));
import { parseConfig } from '../src/lib/google/sheets';

const roll = (r: string, active = true) => ({ roll: r, active });

describe('parseConfig', () => {
  it('tolerates rows with missing cells', () => {
    const c = parseConfig(
      [['roll', 'active'], ['1'], ['2', 'FALSE'], [], ['', 'TRUE']],
      [['id', 'title', 'problems', 'problem_titles', 'active'], ['1'], ['2', 'Two', '4', 'not json'], ['0', 'bad', '3'], ['3', 'T', '', '["a"]', 'false']]
    );
    expect(c.rolls).toEqual([roll('1'), roll('2', false)]);
    expect(c.assignments).toEqual([
      { id: 1, title: '', problems: 0, problemTitles: undefined, active: true },
      { id: 2, title: 'Two', problems: 4, problemTitles: undefined, active: true },
      { id: 3, title: 'T', problems: 0, problemTitles: ['a'], active: false }
    ]);
  });
  it('handles missing ranges', () => {
    expect(parseConfig(undefined, undefined)).toEqual({ rolls: [], assignments: [] });
  });
});
