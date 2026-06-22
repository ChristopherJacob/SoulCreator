import { describe, it, expect, beforeEach } from 'vitest';
import { loadDraft, saveDraft, STORAGE_KEY } from './storage';
import { SoulDraft } from './model';

const draft: SoulDraft = { identity: 'X', style: ['Be direct.'], avoid: [], defaults: [] };

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when nothing is stored', () => {
    expect(loadDraft()).toBeNull();
  });

  it('round-trips a draft', () => {
    saveDraft(draft);
    expect(loadDraft()).toEqual(draft);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('returns null on corrupt data', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadDraft()).toBeNull();
  });
});
