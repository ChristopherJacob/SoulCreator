import { describe, it, expect } from 'vitest';
import { BASELINE_PACK } from './baseline';
import { scoreDraft, evaluateGate } from './engine';
import type { Draft } from '../model';

const agents = BASELINE_PACK.docTypes.agents;
const cat = (d: Draft, key: string) =>
  scoreDraft(agents.rubric, d, agents.sections).categories.find((c) => c.key === key)!;

describe('baseline AGENTS rubric', () => {
  it('weights sum to 100', () => {
    expect(agents.rubric.reduce((s, r) => s + r.max, 0)).toBe(100);
  });

  it('rewards concrete commands (the inverse of SOUL portability)', () => {
    const withCmds: Draft = { overview: 'A web app.', commands: ['Run `npm test` before pushing.', 'Build with `npm run build`.'] };
    const noCmds: Draft = { overview: 'A web app.', commands: ['Do the usual stuff.'] };
    expect(cat(withCmds, 'commands').score).toBeGreaterThan(cat(noCmds, 'commands').score);
  });

  it('rewards an explicit boundaries triad', () => {
    const triad: Draft = { overview: 'x', commands: ['npm test'], boundaries: ['Always run tests.', 'Ask before deleting data.', 'Never commit secrets.'] };
    expect(cat(triad, 'boundaries').score).toBe(16);
  });

  it('gate needs an overview and at least one command', () => {
    expect(evaluateGate(agents.gate, { overview: '', commands: [] }, agents.sections).ok).toBe(false);
    expect(evaluateGate(agents.gate, { overview: 'A web app.', commands: ['npm test'] }, agents.sections).ok).toBe(true);
  });

  it('ships a non-empty preset library including a blank slate', () => {
    expect(agents.presets.map((p) => p.id)).toContain('blank');
  });
});
