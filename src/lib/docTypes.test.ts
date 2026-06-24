import { describe, it, expect } from 'vitest';
import { DOC_TYPES, docTypeById } from './docTypes';

describe('docTypes', () => {
  it('exposes soul and agents in order', () => {
    expect(DOC_TYPES.map((d) => d.id)).toEqual(['soul', 'agents']);
  });
  it('looks up by id', () => {
    expect(docTypeById('agents').filename).toBe('AGENTS.md');
  });
});
