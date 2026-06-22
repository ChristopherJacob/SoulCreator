import { describe, it, expect } from 'vitest';
import { scoreSoul, exportGate, findLeaks } from './scoring';
import { SoulDraft, EMPTY_DRAFT } from './model';

const strong: SoulDraft = {
  identity: 'You are Hermes, a pragmatic engineer who values clarity.',
  style: ['Be direct.', 'Say when something is a bad idea.', 'Be concise unless depth is needed.'],
  avoid: ['Avoid hype language.', 'Avoid hedging when you are confident.'],
  defaults: ['When ambiguous, ask one clarifying question.', 'Prefer the simplest correct solution.'],
};

describe('scoreSoul', () => {
  it('gives a high score to a strong, portable draft', () => {
    const r = scoreSoul(strong);
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.categories.find((c) => c.key === 'identity')!.score).toBeGreaterThan(0);
  });

  it('gives a low score to an empty draft', () => {
    const r = scoreSoul(EMPTY_DRAFT);
    expect(r.score).toBeLessThan(20);
  });

  it('penalizes portability when task-specific content leaks in', () => {
    const leaky: SoulDraft = {
      ...strong,
      style: [...strong.style, 'Always run npm test in ./packages/api before pushing.'],
    };
    expect(scoreSoul(leaky).score).toBeLessThan(scoreSoul(strong).score);
  });

  it('penalizes hype language', () => {
    const hype: SoulDraft = { ...strong, style: [...strong.style, 'Write blazing fast, world-class code.'] };
    const noHype = scoreSoul(strong).categories.find((c) => c.key === 'noHype')!.score;
    const withHype = scoreSoul(hype).categories.find((c) => c.key === 'noHype')!.score;
    expect(withHype).toBeLessThan(noHype);
  });
});

describe('findLeaks', () => {
  it('detects file paths, ports, and commands', () => {
    expect(findLeaks('see ./src/app.ts').length).toBeGreaterThan(0);
    expect(findLeaks('listening on :8080').length).toBeGreaterThan(0);
    expect(findLeaks('run npm install').length).toBeGreaterThan(0);
  });
  it('passes clean identity prose', () => {
    expect(findLeaks('Be direct and concise.')).toEqual([]);
  });
});

describe('exportGate', () => {
  it('blocks empty drafts and reports reasons', () => {
    const g = exportGate(EMPTY_DRAFT);
    expect(g.ok).toBe(false);
    expect(g.reasons.length).toBeGreaterThan(0);
  });
  it('passes a strong, portable draft', () => {
    expect(exportGate(strong).ok).toBe(true);
  });
  it('blocks a draft with leaked task-specific content', () => {
    const leaky: SoulDraft = { ...strong, avoid: ['Avoid editing /etc/hosts'] };
    expect(exportGate(leaky).ok).toBe(false);
  });
});
