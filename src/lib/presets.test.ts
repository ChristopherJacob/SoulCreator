import { describe, it, expect } from 'vitest';
import { presetsFor } from './presets';
import { BASELINE_PACK } from './pack/baseline';

describe('presetsFor', () => {
  it('returns the soul presets from a pack, including Blank Slate', () => {
    const ids = presetsFor(BASELINE_PACK, 'soul').map((p) => p.id);
    expect(ids).toContain('pragmatic-engineer');
    expect(ids).toContain('blank');
  });
});
