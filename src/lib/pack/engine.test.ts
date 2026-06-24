import { describe, it, expect } from 'vitest';
import { scoreDraft, evaluateGate } from './engine';
import type { Rule, GateRule, SectionDef } from './schema';

const sections: SectionDef[] = [
  { id: 'identity', heading: 'Personality', level: 1, kind: 'text', optional: false, placeholder: '' },
  { id: 'style', heading: 'Style', level: 2, kind: 'list', optional: false, placeholder: '' },
];

describe('scoreDraft primitives', () => {
  it('textLength bands', () => {
    const rule: Rule = {
      id: 'identity', label: 'Identity', max: 18, target: 'identity', check: 'textLength',
      direction: 'reward',
      params: { bands: [{ min: 20, points: 18 }, { min: 1, points: 9 }, { min: 0, points: 0 }] },
      tips: { pass: 'ok', fail: 'write more' },
    };
    expect(scoreDraft([rule], { identity: 'x'.repeat(25), style: [] }, sections).score).toBe(18);
    expect(scoreDraft([rule], { identity: 'short', style: [] }, sections).score).toBe(9);
    expect(scoreDraft([rule], { identity: '', style: [] }, sections).score).toBe(0);
  });

  it('patternRatio with low-count cap', () => {
    const rule: Rule = {
      id: 'style', label: 'Style', max: 18, target: 'style', check: 'patternRatio',
      direction: 'reward',
      params: { patterns: [{ source: '^(be|say)\\b', flags: 'i' }], lowCountCap: { whenBelow: 2, cap: 9 } },
      tips: { pass: 'ok', fail: 'use verbs' },
    };
    expect(scoreDraft([rule], { identity: '', style: ['Be x', 'Say y'] }, sections).score).toBe(18);
    expect(scoreDraft([rule], { identity: '', style: ['Be x'] }, sections).score).toBe(9);
  });

  it('patternPenalty counts distinct patterns and respects requiresContent', () => {
    const rule: Rule = {
      id: 'portability', label: 'Portability', max: 16, target: '*', check: 'patternPenalty',
      direction: 'penalty',
      params: {
        patterns: [{ name: 'command', source: '\\b(npm|git)\\b', flags: 'i' }],
        perHit: 8, countMode: 'patterns', requiresContent: true,
      },
      tips: { pass: 'clean', fail: 'found {hits}' },
    };
    expect(scoreDraft([rule], { identity: '', style: [] }, sections).score).toBe(0);
    expect(scoreDraft([rule], { identity: 'plain text', style: [] }, sections).score).toBe(16);
    const leaked = scoreDraft([rule], { identity: 'run npm install', style: [] }, sections);
    expect(leaked.score).toBe(8);
    expect(leaked.categories[0].tip).toContain('command: npm');
  });

  it('structure: full marks when no required sections, partial when some present', () => {
    const base = { id: 's', label: 'Structure', max: 4, target: '*', check: 'structure', direction: 'reward', tips: { pass: 'ok', fail: 'add' } } as const;
    const noReq: Rule = { ...base, params: { requiredSections: [] } };
    expect(scoreDraft([noReq], { identity: '', style: [] }, sections).score).toBe(4);
    const req: Rule = { ...base, params: { requiredSections: ['identity', 'style'] } };
    expect(scoreDraft([req], { identity: '', style: ['Be x'] }, sections).score).toBe(0);
    expect(scoreDraft([req], { identity: 'I am', style: [] }, sections).score).toBe(2);
    expect(scoreDraft([req], { identity: 'I am', style: ['Be x'] }, sections).score).toBe(4);
  });

  it('patternPenalty matches-mode counts every match, not just patterns', () => {
    const rule: Rule = {
      id: 'hype', label: 'No hype', max: 8, target: '*', check: 'patternPenalty', direction: 'penalty',
      params: { patterns: [{ source: '\\b(fast|great)\\b', flags: 'gi' }], perHit: 4, countMode: 'matches', requiresContent: true },
      tips: { pass: 'clean', fail: 'hype' },
    };
    expect(scoreDraft([rule], { identity: 'fast and great', style: [] }, sections).score).toBe(0);
    expect(scoreDraft([rule], { identity: 'just fast', style: [] }, sections).score).toBe(4);
  });

  it('lineCount over #total sums only list sections', () => {
    const rule: Rule = {
      id: 'len', label: 'Length', max: 10, target: '#total', check: 'lineCount', direction: 'reward',
      params: { bands: [{ min: 2, points: 10 }, { min: 1, points: 5 }, { min: 0, points: 0 }] },
      tips: { pass: 'ok', fail: 'more' },
    };
    expect(scoreDraft([rule], { identity: 'long text here', style: ['a', 'b'] }, sections).score).toBe(10);
    expect(scoreDraft([rule], { identity: 'x', style: [] }, sections).score).toBe(0);
  });
});

describe('evaluateGate', () => {
  const gate: GateRule[] = [
    { id: 'identity', check: 'nonEmptyText', target: 'identity', message: 'Add Identity.' },
    { id: 'style', check: 'nonEmptyList', target: 'style', message: 'Add a Style line.' },
    { id: 'leak', check: 'noPatterns', target: '*', patterns: [{ name: 'command', source: '\\bnpm\\b', flags: 'i' }], countMode: 'patterns', message: 'Remove: {hits}.' },
  ];
  it('blocks until identity+style present and no leaks', () => {
    expect(evaluateGate(gate, { identity: '', style: [] }, sections).ok).toBe(false);
    expect(evaluateGate(gate, { identity: 'I am', style: ['Be x'] }, sections).ok).toBe(true);
    const leak = evaluateGate(gate, { identity: 'use npm', style: ['Be x'] }, sections);
    expect(leak.ok).toBe(false);
    expect(leak.reasons[0]).toContain('command: npm');
  });
});
