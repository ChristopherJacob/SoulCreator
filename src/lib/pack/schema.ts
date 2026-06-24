import type { Draft } from '../model';

/** Bumped only when a NEW check primitive is added to the engine. */
export const SUPPORTED_SCHEMA_VERSION = 2;

export type CheckKind =
  | 'textLength'
  | 'lineCount'
  | 'listSize'
  | 'patternRatio'
  | 'patternPenalty'
  | 'structure';

export interface PatternSpec {
  /** Optional label prefixed to hits in tips, e.g. "file path: ./x". */
  name?: string;
  source: string;
  flags?: string;
}

export interface Band {
  min: number;
  max?: number;
  points: number;
}

export interface RuleParams {
  bands?: Band[];
  patterns?: PatternSpec[];
  /** patternPenalty: points subtracted per hit. */
  perHit?: number;
  /** patternPenalty hit counting: distinct patterns matched, or every match. */
  countMode?: 'patterns' | 'matches';
  /** patternPenalty: empty draft scores 0 instead of full marks. */
  requiresContent?: boolean;
  /** patternRatio: cap score when the list is shorter than `whenBelow`. */
  lowCountCap?: { whenBelow: number; cap: number };
  /** structure: ordered section ids; first one is mandatory for any points. */
  requiredSections?: string[];
}

export interface Rule {
  id: string;
  label: string;
  max: number;
  /** Section id, '*' (all text), or '#total' (sum of list-section lines). */
  target: string;
  check: CheckKind;
  params: RuleParams;
  direction: 'reward' | 'penalty';
  tips: { pass: string; fail: string };
}

export type GateCheck = 'nonEmptyText' | 'nonEmptyList' | 'noPatterns';

export interface GateRule {
  id: string;
  check: GateCheck;
  target: string;
  patterns?: PatternSpec[];
  countMode?: 'patterns' | 'matches';
  /** Shown when the gate fails; supports the `{hits}` placeholder. */
  message: string;
}

export interface SectionDef {
  id: string;
  heading: string;
  level: 1 | 2;
  kind: 'text' | 'list';
  optional: boolean;
  placeholder: string;
  help?: string;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  draft: Draft;
}

export interface DocTypePack {
  sections: SectionDef[];
  rubric: Rule[];
  gate: GateRule[];
  presets: Preset[];
}

export type DocId = 'soul' | 'agents';

export interface Pack {
  packVersion: string;
  schemaVersion: number;
  publishedAt: string;
  summary: string;
  docTypes: Record<DocId, DocTypePack>;
}

function isDocTypePack(v: unknown): v is DocTypePack {
  if (typeof v !== 'object' || v === null) return false;
  const d = v as Record<string, unknown>;
  return (
    Array.isArray(d.sections) &&
    Array.isArray(d.rubric) &&
    Array.isArray(d.gate) &&
    Array.isArray(d.presets)
  );
}

/** Structural validation. Returns the typed pack or null. Never throws. */
export function validatePack(raw: unknown): Pack | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.packVersion !== 'string') return null;
  if (typeof p.schemaVersion !== 'number') return null;
  if (typeof p.publishedAt !== 'string') return null;
  if (typeof p.summary !== 'string') return null;
  if (typeof p.docTypes !== 'object' || p.docTypes === null) return null;
  const dt = p.docTypes as Record<string, unknown>;
  if (!isDocTypePack(dt.soul) || !isDocTypePack(dt.agents)) return null;
  return raw as Pack;
}
