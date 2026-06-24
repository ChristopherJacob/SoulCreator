import { describe, it, expect } from 'vitest';
import { validatePack, SUPPORTED_SCHEMA_VERSION } from './schema';

const minimalPack = {
  packVersion: '1',
  schemaVersion: SUPPORTED_SCHEMA_VERSION,
  publishedAt: '2026-06-24',
  summary: 'seed',
  docTypes: {
    soul: { sections: [], rubric: [], gate: [], presets: [] },
    agents: { sections: [], rubric: [], gate: [], presets: [] },
  },
};

describe('validatePack', () => {
  it('accepts a structurally valid pack', () => {
    expect(validatePack(minimalPack)?.packVersion).toBe('1');
  });

  it('rejects a pack missing docTypes', () => {
    const { docTypes, ...bad } = minimalPack;
    expect(validatePack(bad)).toBeNull();
  });

  it('rejects a non-object', () => {
    expect(validatePack('nope')).toBeNull();
    expect(validatePack(null)).toBeNull();
  });
});
