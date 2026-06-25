import { describe, it, expect } from 'vitest';
import { splitBlocks, parseForDoc } from './parser';
import type { SectionDef } from './pack/schema';

const soulSections: SectionDef[] = [
  { id: 'identity', heading: 'Personality', level: 1, kind: 'text', optional: false, placeholder: '' },
  { id: 'style', heading: 'Style', level: 2, kind: 'list', optional: false, placeholder: '' },
  { id: 'avoid', heading: 'What to avoid', level: 2, kind: 'list', optional: false, placeholder: '' },
];

describe('splitBlocks', () => {
  it('splits on # and ## headings and captures bodies', () => {
    const blocks = splitBlocks('# Personality\nI am Hermes.\n\n## Style\n- Be direct.');
    expect(blocks).toEqual([
      { heading: 'Personality', body: 'I am Hermes.' },
      { heading: 'Style', body: '- Be direct.' },
    ]);
  });

  it('captures preamble before the first heading as an empty-heading block', () => {
    const blocks = splitBlocks('loose text\n# Personality\nx');
    expect(blocks[0]).toEqual({ heading: '', body: 'loose text' });
  });
});

describe('parseForDoc', () => {
  it('maps matching headings; text sections take the body, list sections take bullets', () => {
    const md = '# Personality\nI am Hermes.\n\n## Style\n- Be direct.\n- Say when wrong.';
    const { draft, unmatched } = parseForDoc(splitBlocks(md), soulSections);
    expect(draft).toEqual({ identity: 'I am Hermes.', style: ['Be direct.', 'Say when wrong.'] });
    expect(unmatched).toEqual([]);
  });

  it('collects unrecognized headings as unmatched (lossless), nothing dropped', () => {
    const md = '# Personality\nI am Hermes.\n\n## Tone\nwarm and terse';
    const { draft, unmatched } = parseForDoc(splitBlocks(md), soulSections);
    expect(draft).toEqual({ identity: 'I am Hermes.' });
    expect(unmatched).toEqual([{ heading: 'Tone', body: 'warm and terse' }]);
  });

  it('surfaces non-bullet lines inside a list block as unmatched', () => {
    const md = '## Style\n- Be direct.\nstray prose';
    const { draft, unmatched } = parseForDoc(splitBlocks(md), soulSections);
    expect(draft.style).toEqual(['Be direct.']);
    expect(unmatched).toEqual([{ heading: 'Style (non-list lines)', body: 'stray prose' }]);
  });
});
