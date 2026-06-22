import { describe, it, expect } from 'vitest';
import { PRESETS } from './presets';
import { exportGate } from './scoring';

describe('PRESETS', () => {
  it('includes the documented personas plus a blank slate', () => {
    const ids = PRESETS.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining(['pragmatic-engineer', 'research-partner', 'teacher', 'tough-reviewer', 'blank']),
    );
  });

  it('non-blank presets pass the export gate out of the box', () => {
    for (const p of PRESETS.filter((p) => p.id !== 'blank')) {
      expect(exportGate(p.draft).ok, `${p.id} should be export-ready`).toBe(true);
    }
  });
});
