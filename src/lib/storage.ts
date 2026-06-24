import type { Draft } from './model';
import type { Pack, DocId } from './pack/schema';
import { validatePack } from './pack/schema';

const PREFIX = 'soul-creator';
export const LEGACY_KEY = 'soul-creator:draft';

const draftKey = (docId: DocId) => `${PREFIX}:draft:${docId}`;
const ACTIVE_PACK_KEY = `${PREFIX}:pack:active`;
const AVAILABLE_PACK_KEY = `${PREFIX}:pack:available`;
const ACTIVE_TAB_KEY = `${PREFIX}:tab`;

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — non-fatal */
  }
}

export function saveDraft(docId: DocId, draft: Draft): void {
  writeJSON(draftKey(docId), draft);
}

export function loadDraft(docId: DocId): Draft | null {
  return readJSON<Draft>(draftKey(docId));
}

export function saveActivePack(pack: Pack): void {
  writeJSON(ACTIVE_PACK_KEY, pack);
}

export function loadActivePack(): Pack | null {
  return validatePack(readJSON<unknown>(ACTIVE_PACK_KEY));
}

export function saveAvailablePack(pack: Pack): void {
  writeJSON(AVAILABLE_PACK_KEY, pack);
}

export function loadAvailablePack(): Pack | null {
  return validatePack(readJSON<unknown>(AVAILABLE_PACK_KEY));
}

export function clearAvailablePack(): void {
  try {
    localStorage.removeItem(AVAILABLE_PACK_KEY);
  } catch {
    /* non-fatal */
  }
}

export function saveActiveTab(docId: DocId): void {
  writeJSON(ACTIVE_TAB_KEY, docId);
}

export function loadActiveTab(): DocId | null {
  const v = readJSON<DocId>(ACTIVE_TAB_KEY);
  return v === 'soul' || v === 'agents' ? v : null;
}

/** One-time, non-destructive migration of the v1 single-draft key. */
export function migrateLegacyDraft(): void {
  if (loadDraft('soul')) return;
  const legacy = readJSON<Draft>(LEGACY_KEY);
  if (legacy) saveDraft('soul', legacy);
}
