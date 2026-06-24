import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadDraft, saveDraft, loadActivePack, saveActivePack,
  loadAvailablePack, saveAvailablePack, clearAvailablePack,
  loadActiveTab, saveActiveTab, migrateLegacyDraft, LEGACY_KEY,
} from './storage';
import { BASELINE_PACK } from './pack/baseline';
import type { Draft } from './model';

beforeEach(() => localStorage.clear());

describe('storage', () => {
  it('round-trips a namespaced draft', () => {
    const d: Draft = { identity: 'x', style: ['a'] };
    saveDraft('soul', d);
    expect(loadDraft('soul')).toEqual(d);
    expect(loadDraft('agents')).toBeNull();
  });

  it('round-trips active/available pack and active tab', () => {
    saveActivePack(BASELINE_PACK);
    expect(loadActivePack()?.packVersion).toBe('1');
    saveAvailablePack(BASELINE_PACK);
    expect(loadAvailablePack()?.packVersion).toBe('1');
    clearAvailablePack();
    expect(loadAvailablePack()).toBeNull();
    saveActiveTab('agents');
    expect(loadActiveTab()).toBe('agents');
  });

  it('migrates a legacy v1 draft into draft:soul once', () => {
    const legacy = { identity: 'old', style: ['s'], avoid: [], defaults: [], examples: ['e'] };
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
    migrateLegacyDraft();
    expect(loadDraft('soul')).toEqual({ identity: 'old', style: ['s'], avoid: [], defaults: [], examples: ['e'] });
    saveDraft('soul', { identity: 'new', style: [] });
    migrateLegacyDraft();
    expect(loadDraft('soul')).toEqual({ identity: 'new', style: [] });
  });
});
