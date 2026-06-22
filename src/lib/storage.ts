import { SoulDraft } from './model';

export const STORAGE_KEY = 'soul-creator:draft';

export function saveDraft(draft: SoulDraft): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* storage full or unavailable — non-fatal */
  }
}

export function loadDraft(): SoulDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SoulDraft;
  } catch {
    return null;
  }
}
