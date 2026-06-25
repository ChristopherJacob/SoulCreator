import { describe, it, expect } from 'vitest';
import { moveLeaksToAgents } from './crossTab';
import { BASELINE_PACK } from './pack/baseline';
import type { Draft } from './model';

const soulSections = BASELINE_PACK.docTypes.soul.sections;

describe('moveLeaksToAgents', () => {
  it('moves a command line out of SOUL and into AGENTS commands', () => {
    const soul: Draft = { identity: 'I am Hermes.', style: ['Be direct.', 'Run npm test before finishing.'], avoid: [], defaults: [] };
    const agents: Draft = { overview: 'x', commands: [], boundaries: [] };
    const { soul: nextSoul, agents: nextAgents } = moveLeaksToAgents(soul, agents, soulSections);
    expect(nextSoul.style).toEqual(['Be direct.']);
    expect(nextAgents.commands).toContain('Run npm test before finishing.');
  });

  it('routes a path line into architecture and leaves clean drafts untouched', () => {
    const soul: Draft = { identity: 'I am Hermes.', style: ['Use ./src/index.ts as the entry.'], avoid: [], defaults: [] };
    const agents: Draft = { overview: 'x', commands: [], boundaries: [] };
    const { soul: nextSoul, agents: nextAgents } = moveLeaksToAgents(soul, agents, soulSections);
    expect(nextSoul.style).toEqual([]);
    expect((nextAgents.architecture as string[])).toContain('Use ./src/index.ts as the entry.');
  });

  it('moves a leak in the identity text field into AGENTS and clears it', () => {
    const soul: Draft = { identity: 'Use ./src/index.ts as the entry.', style: [], avoid: [], defaults: [] };
    const agents: Draft = { overview: 'x', commands: [], boundaries: [] };
    const { soul: nextSoul, agents: nextAgents } = moveLeaksToAgents(soul, agents, soulSections);
    expect(nextSoul.identity).toBe('');
    expect((nextAgents.architecture as string[])).toContain('Use ./src/index.ts as the entry.');
  });
});
