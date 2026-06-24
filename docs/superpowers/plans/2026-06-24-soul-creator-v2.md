# SOUL Creator v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AGENTS.md authoring, an offline-first PWA, and a versioned data-driven knowledge pack (fetched from GitHub, notify-and-apply) to SOUL Creator, by generalizing the app into a DocType abstraction with a safe declarative rule engine.

**Architecture:** SOUL and AGENTS become two instances of one generic doc model. A bundled knowledge pack (JSON) defines each doc type's sections, scoring rubric, gates, and presets. A safe in-app interpreter runs a fixed vocabulary of six check primitives over that data — never remote code. The same engine, generator, and builder UI serve both doc types, parameterized by the active pack.

**Tech Stack:** React 19 + Vite 8 + TypeScript, Vitest, `react-markdown`, `vite-plugin-pwa` (Workbox).

**Source of truth:** [docs/superpowers/specs/2026-06-24-soul-creator-v2-design.md](../specs/2026-06-24-soul-creator-v2-design.md)

---

## Phases

- **Phase 1 — Pack foundation** (Tasks 1–8): schema, engine, generic model/generator, baseline SOUL pack (reproduces v1 scoring exactly), docTypes, storage, presets accessor. Ends with pure modules that are behavior-neutral vs v1.
- **Phase 2 — Wire SOUL UI through the pack** (Tasks 9–13): generic components + App rendering SOUL via the pack. Ends with the app working exactly as v1 did, now data-driven.
- **Phase 3 — AGENTS.md + tabs + cross-tab** (Tasks 14–16).
- **Phase 4 — Update mechanism** (Tasks 17–20).
- **Phase 5 — PWA** (Tasks 21–23).

Each task is a TDD cycle. Commit after every task.

---

> **Note on scope of this file:** This plan document is written incrementally. Phase 1 (the foundation, where all the tricky logic lives) is fully specified below. Phases 2–5 are appended in follow-up edits to this same file before execution begins, so the executor has the complete plan top-to-bottom. If you are executing and a later phase is not yet present, stop and request it.

---

# Phase 1 — Pack foundation

## Task 1: Knowledge-pack schema + validator

**Files:**
- Create: `src/lib/pack/schema.ts`
- Test: `src/lib/pack/schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/pack/schema.test.ts
import { describe, it, expect } from 'vitest';
import { validatePack, SUPPORTED_SCHEMA_VERSION } from './schema';

const minimalPack = {
  packVersion: '1',
  schemaVersion: SUPPORTED_SCHEMA_VERSION,
  publishedAt: '2026-06-24',
  summary: 'seed',
  docTypes: {
    soul: { sections: [], rubric: [], gate: [], presets: [] },
    agents: { sections: [], rubric: [], gate: [], presets: [] },
  },
};

describe('validatePack', () => {
  it('accepts a structurally valid pack', () => {
    expect(validatePack(minimalPack)?.packVersion).toBe('1');
  });

  it('rejects a pack missing docTypes', () => {
    const { docTypes, ...bad } = minimalPack;
    expect(validatePack(bad)).toBeNull();
  });

  it('rejects a non-object', () => {
    expect(validatePack('nope')).toBeNull();
    expect(validatePack(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pack/schema.test.ts`
Expected: FAIL — cannot find module `./schema`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/pack/schema.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pack/schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pack/schema.ts src/lib/pack/schema.test.ts
git commit -m "feat: add knowledge-pack schema and validator"
```

---

## Task 2: Generic draft model

**Files:**
- Modify: `src/lib/model.ts` (replace the SOUL-specific types with the generic `Draft`; keep `cleanLines`)
- Test: `src/lib/model.test.ts` (create)

**Note:** `SoulDraft`, `DomainPosture`, and `EMPTY_DRAFT` are removed here. Tasks that referenced them are updated in later tasks. The generic `Draft` is a map of section-id → value.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/model.test.ts
import { describe, it, expect } from 'vitest';
import { cleanLines, emptyDraft } from './model';
import type { SectionDef } from './pack/schema';

const sections: SectionDef[] = [
  { id: 'identity', heading: 'Personality', level: 1, kind: 'text', optional: false, placeholder: '' },
  { id: 'style', heading: 'Style', level: 2, kind: 'list', optional: false, placeholder: '' },
];

describe('cleanLines', () => {
  it('trims and drops empties', () => {
    expect(cleanLines([' a ', '', '  ', 'b'])).toEqual(['a', 'b']);
  });
  it('handles undefined', () => {
    expect(cleanLines(undefined)).toEqual([]);
  });
});

describe('emptyDraft', () => {
  it('builds empty values per section kind', () => {
    expect(emptyDraft(sections)).toEqual({ identity: '', style: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/model.test.ts`
Expected: FAIL — `emptyDraft` not exported.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/model.ts
import type { SectionDef } from './pack/schema';

export type SectionValue = string | string[];
export type Draft = Record<string, SectionValue>;

/** Trim and drop empty entries from a string list. */
export function cleanLines(items: string[] | undefined): string[] {
  return (items ?? []).map((s) => s.trim()).filter(Boolean);
}

/** Build an empty draft: '' for text sections, [] for list sections. */
export function emptyDraft(sections: SectionDef[]): Draft {
  const draft: Draft = {};
  for (const s of sections) draft[s.id] = s.kind === 'text' ? '' : [];
  return draft;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/model.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/model.ts src/lib/model.test.ts
git commit -m "feat: generalize draft model to section-id map"
```

---

## Task 3: Rule engine — scoreDraft

**Files:**
- Create: `src/lib/pack/engine.ts`
- Test: `src/lib/pack/engine.test.ts`

This is the safe interpreter. It supports exactly the six primitives. No `eval`/`Function`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/pack/engine.test.ts
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
    // 2 of 2 match -> full 18
    expect(scoreDraft([rule], { identity: '', style: ['Be x', 'Say y'] }, sections).score).toBe(18);
    // single matching line capped at 9
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
    expect(scoreDraft([rule], { identity: '', style: [] }, sections).score).toBe(0); // empty -> 0
    expect(scoreDraft([rule], { identity: 'plain text', style: [] }, sections).score).toBe(16);
    const leaked = scoreDraft([rule], { identity: 'run npm install', style: [] }, sections);
    expect(leaked.score).toBe(8);
    expect(leaked.categories[0].tip).toContain('command: npm');
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pack/engine.test.ts`
Expected: FAIL — cannot find module `./engine`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/pack/engine.ts
import { cleanLines } from '../model';
import type { Draft } from '../model';
import type { Rule, GateRule, SectionDef, PatternSpec, Band } from './schema';

export interface CategoryScore {
  key: string;
  label: string;
  score: number;
  max: number;
  tip: string;
  /** Raw hits collected by patternPenalty rules (used by cross-tab UI). */
  hits?: string[];
}

export interface DraftScore {
  score: number;
  categories: CategoryScore[];
}

export interface GateResult {
  ok: boolean;
  reasons: string[];
}

function textOf(draft: Draft, id: string): string {
  const v = draft[id];
  return typeof v === 'string' ? v.trim() : '';
}

function listOf(draft: Draft, id: string): string[] {
  const v = draft[id];
  return cleanLines(Array.isArray(v) ? v : undefined);
}

function totalLines(draft: Draft, sections: SectionDef[]): number {
  return sections
    .filter((s) => s.kind === 'list')
    .reduce((n, s) => n + listOf(draft, s.id).length, 0);
}

function allText(draft: Draft, sections: SectionDef[]): string {
  const parts: string[] = [];
  for (const s of sections) {
    if (s.kind === 'text') parts.push(textOf(draft, s.id));
    else parts.push(...listOf(draft, s.id));
  }
  return parts.join('\n');
}

function hasContent(draft: Draft, sections: SectionDef[]): boolean {
  return sections.some((s) =>
    s.kind === 'text' ? textOf(draft, s.id).length > 0 : listOf(draft, s.id).length > 0,
  );
}

function bandPoints(bands: Band[], n: number): number {
  for (const b of bands) {
    if (n >= b.min && (b.max === undefined || n <= b.max)) return b.points;
  }
  return 0;
}

function resolveText(draft: Draft, sections: SectionDef[], target: string): string {
  return target === '*' ? allText(draft, sections) : textOf(draft, target);
}

function resolveCount(draft: Draft, sections: SectionDef[], target: string): number {
  return target === '#total' ? totalLines(draft, sections) : listOf(draft, target).length;
}

function resolveLines(draft: Draft, sections: SectionDef[], target: string): string[] {
  if (target === '*') return allText(draft, sections).split('\n').filter(Boolean);
  return listOf(draft, target);
}

function isEmptySection(draft: Draft, sections: SectionDef[], id: string): boolean {
  const def = sections.find((s) => s.id === id);
  return def?.kind === 'list' ? listOf(draft, id).length === 0 : textOf(draft, id).length === 0;
}

function collectHits(text: string, patterns: PatternSpec[], countMode: 'patterns' | 'matches'): string[] {
  const hits: string[] = [];
  for (const p of patterns) {
    if (countMode === 'matches') {
      const flags = (p.flags ?? 'i').includes('g') ? (p.flags ?? 'gi') : `${p.flags ?? 'i'}g`;
      const m = text.match(new RegExp(p.source, flags));
      if (m) hits.push(...m);
    } else {
      const m = text.match(new RegExp(p.source, p.flags ?? 'i'));
      if (m) hits.push(p.name ? `${p.name}: ${m[0]}` : m[0]);
    }
  }
  return hits;
}

function scoreRule(rule: Rule, draft: Draft, sections: SectionDef[]): CategoryScore {
  const { check, params, max } = rule;
  let score = 0;
  let hits: string[] = [];

  switch (check) {
    case 'textLength':
      score = bandPoints(params.bands ?? [], resolveText(draft, sections, rule.target).length);
      break;
    case 'lineCount':
    case 'listSize':
      score = bandPoints(params.bands ?? [], resolveCount(draft, sections, rule.target));
      break;
    case 'patternRatio': {
      const lines = resolveLines(draft, sections, rule.target);
      if (lines.length > 0) {
        const patterns = params.patterns ?? [];
        const matching = lines.filter((l) =>
          patterns.some((p) => new RegExp(p.source, p.flags ?? 'i').test(l)),
        ).length;
        score = Math.round((matching / lines.length) * max);
        if (params.lowCountCap && lines.length < params.lowCountCap.whenBelow) {
          score = Math.min(score, params.lowCountCap.cap);
        }
      }
      break;
    }
    case 'patternPenalty': {
      if (params.requiresContent && !hasContent(draft, sections)) {
        score = 0;
        break;
      }
      hits = collectHits(
        resolveText(draft, sections, rule.target),
        params.patterns ?? [],
        params.countMode ?? 'patterns',
      );
      score = max - hits.length * (params.perHit ?? 0);
      break;
    }
    case 'structure': {
      const req = params.requiredSections ?? [];
      if (req.length > 0 && isEmptySection(draft, sections, req[0])) {
        score = 0;
      } else {
        const present = req.filter((id) => !isEmptySection(draft, sections, id)).length;
        score = Math.round((max * present) / req.length);
      }
      break;
    }
  }

  score = Math.max(0, Math.min(max, score));
  const tip = score >= max ? rule.tips.pass : rule.tips.fail.replace('{hits}', hits.join('; '));
  return { key: rule.id, label: rule.label, score, max, tip, hits: hits.length ? hits : undefined };
}

export function scoreDraft(rubric: Rule[], draft: Draft, sections: SectionDef[]): DraftScore {
  const categories = rubric.map((r) => scoreRule(r, draft, sections));
  return { score: categories.reduce((s, c) => s + c.score, 0), categories };
}

export function evaluateGate(gates: GateRule[], draft: Draft, sections: SectionDef[]): GateResult {
  const reasons: string[] = [];
  for (const g of gates) {
    if (g.check === 'nonEmptyText') {
      if (textOf(draft, g.target).length < 1) reasons.push(g.message);
    } else if (g.check === 'nonEmptyList') {
      if (listOf(draft, g.target).length < 1) reasons.push(g.message);
    } else if (g.check === 'noPatterns') {
      const text = g.target === '*' ? allText(draft, sections) : textOf(draft, g.target);
      const hits = collectHits(text, g.patterns ?? [], g.countMode ?? 'patterns');
      if (hits.length > 0) reasons.push(g.message.replace('{hits}', hits.join('; ')));
    }
  }
  return { ok: reasons.length === 0, reasons };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pack/engine.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pack/engine.ts src/lib/pack/engine.test.ts
git commit -m "feat: add safe declarative rule-engine interpreter"
```

---

## Task 4: Generic generator

**Files:**
- Modify: `src/lib/generator.ts` (replace `generateSoul` with generic `generate`)
- Modify: `src/lib/generator.test.ts` (replace SOUL-specific tests)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/generator.test.ts
import { describe, it, expect } from 'vitest';
import { generate } from './generator';
import type { SectionDef } from './pack/schema';

const sections: SectionDef[] = [
  { id: 'identity', heading: 'Personality', level: 1, kind: 'text', optional: false, placeholder: '' },
  { id: 'style', heading: 'Style', level: 2, kind: 'list', optional: false, placeholder: '' },
  { id: 'examples', heading: 'Examples', level: 2, kind: 'list', optional: true, placeholder: '' },
];

describe('generate', () => {
  it('emits H1 for level-1 text and H2 bullet lists, omitting empty sections', () => {
    const md = generate(sections, { identity: 'I am Hermes.', style: ['Be direct.', ' '], examples: [] });
    expect(md).toBe('# Personality\nI am Hermes.\n\n## Style\n- Be direct.\n');
  });

  it('trims and ends with a single trailing newline', () => {
    const md = generate(sections, { identity: '  hi  ', style: [] });
    expect(md).toBe('# Personality\nhi\n');
  });

  it('returns just a newline for a fully empty draft', () => {
    expect(generate(sections, { identity: '', style: [] })).toBe('\n');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/generator.test.ts`
Expected: FAIL — `generate` not exported (only `generateSoul`).

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/generator.ts
import { cleanLines } from './model';
import type { Draft } from './model';
import type { SectionDef } from './pack/schema';

function sectionMarkdown(def: SectionDef, draft: Draft): string | null {
  const hashes = def.level === 1 ? '#' : '##';
  const value = draft[def.id];

  if (def.kind === 'text') {
    const text = typeof value === 'string' ? value.trim() : '';
    return text ? `${hashes} ${def.heading}\n${text}` : null;
  }

  const items = cleanLines(Array.isArray(value) ? value : undefined);
  if (items.length === 0) return null;
  return `${hashes} ${def.heading}\n${items.map((s) => `- ${s}`).join('\n')}`;
}

export function generate(sections: SectionDef[], draft: Draft): string {
  const blocks = sections
    .map((def) => sectionMarkdown(def, draft))
    .filter((b): b is string => b !== null);
  return blocks.join('\n\n') + '\n';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/generator.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/generator.ts src/lib/generator.test.ts
git commit -m "feat: make generator section-driven for any doc type"
```

---

## Task 5: Baseline pack — SOUL rubric (reproduces v1 scoring exactly)

**Files:**
- Create: `src/lib/pack/baseline.ts` (SOUL doc type only in this task; AGENTS added in Task 14 as a placeholder-free full entry)
- Test: `src/lib/pack/baseline.soul.test.ts`

**Parity targets (computed from v1 `scoring.ts`):** the "Pragmatic Engineer" preset draft scores **100**; an empty draft scores **0**; a draft whose only content is `identity: 'I am Hermes, a careful engineer.'` + `style: ['Use ./src/index.ts as the entry.']` triggers the file-path leak → portability `8`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/pack/baseline.soul.test.ts
import { describe, it, expect } from 'vitest';
import { BASELINE_PACK } from './baseline';
import { scoreDraft, evaluateGate } from './engine';
import type { Draft } from '../model';

const soul = BASELINE_PACK.docTypes.soul;
const score = (d: Draft) => scoreDraft(soul.rubric, d, soul.sections).score;

const pragmatic: Draft = {
  identity: 'You are Hermes, a pragmatic senior engineer who values clarity and correctness over ceremony.',
  style: ['Be direct.', 'Be concise unless complexity requires depth.', 'Say when something is a bad idea.'],
  avoid: ['Avoid hype language.', 'Avoid hedging when you are confident.'],
  defaults: ['When a request is ambiguous, ask one focused clarifying question.', 'Prefer the simplest solution that is correct.'],
};

describe('baseline SOUL rubric parity with v1', () => {
  it('scores the Pragmatic Engineer draft at 100', () => {
    expect(score(pragmatic)).toBe(100);
  });

  it('scores an empty draft at 0', () => {
    expect(score({ identity: '', style: [], avoid: [], defaults: [] })).toBe(0);
  });

  it('penalizes a file-path leak in portability (16 -> 8)', () => {
    const d: Draft = { identity: 'I am Hermes, a careful engineer.', style: ['Use ./src/index.ts as the entry.'], avoid: [], defaults: [] };
    const cats = scoreDraft(soul.rubric, d, soul.sections).categories;
    expect(cats.find((c) => c.key === 'portability')?.score).toBe(8);
  });

  it('gate blocks empty and clears on a valid draft', () => {
    expect(evaluateGate(soul.gate, { identity: '', style: [], avoid: [], defaults: [] }, soul.sections).ok).toBe(false);
    expect(evaluateGate(soul.gate, pragmatic, soul.sections).ok).toBe(true);
  });

  it('rubric weights sum to 100', () => {
    expect(soul.rubric.reduce((s, r) => s + r.max, 0)).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pack/baseline.soul.test.ts`
Expected: FAIL — cannot find module `./baseline`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/pack/baseline.ts
import { SUPPORTED_SCHEMA_VERSION } from './schema';
import type { Pack, PatternSpec, DocTypePack } from './schema';

const STRONG_VERB: PatternSpec = {
  source:
    '^(be|say|avoid|prefer|explain|ask|distinguish|point|prioritize|keep|use|focus|challenge|state|admit|flag|push|default|treat|assume|lead|stay|surface|name|call)\\b',
  flags: 'i',
};

const HYPE: PatternSpec = {
  source:
    '\\b(blazing[- ]?fast|revolutionary|world[- ]?class|cutting[- ]?edge|game[- ]?changer|best[- ]?in[- ]?class|seamless(ly)?|synergy|10x|next[- ]?generation|state[- ]?of[- ]?the[- ]?art|paradigm)\\b',
  flags: 'gi',
};

const LEAKS: PatternSpec[] = [
  { name: 'file path', source: '(\\.{0,2}\\/)?[\\w-]+\\/[\\w./-]+' },
  { name: 'port', source: ':\\d{2,5}\\b' },
  { name: 'command', source: '\\b(npm|npx|yarn|pnpm|pip|pytest|git|docker|make|cargo|go run|curl)\\b', flags: 'i' },
  { name: 'env/flag token', source: '\\b[A-Z_]{3,}=|--[a-z][\\w-]+' },
];

const soul: DocTypePack = {
  sections: [
    { id: 'identity', heading: 'Personality', level: 1, kind: 'text', optional: false,
      placeholder: 'Who is Hermes? e.g. You are Hermes, a pragmatic engineer…',
      help: '1–3 sentences: who the agent is.' },
    { id: 'style', heading: 'Style', level: 2, kind: 'list', optional: false,
      placeholder: 'Be direct.', help: 'How it sounds — imperative lines.' },
    { id: 'avoid', heading: 'What to avoid', level: 2, kind: 'list', optional: false,
      placeholder: 'Avoid hype language.', help: 'Stylistic boundaries.' },
    { id: 'defaults', heading: 'Defaults', level: 2, kind: 'list', optional: false,
      placeholder: 'When ambiguous, ask one question.', help: 'Behavior under ambiguity.' },
    { id: 'domain', heading: 'Domain posture', level: 2, kind: 'list', optional: true,
      placeholder: 'Prioritize correctness.', help: 'Optional domain-specific posture.' },
    { id: 'examples', heading: 'Examples', level: 2, kind: 'list', optional: true,
      placeholder: 'Say when something is a bad idea.', help: 'Optional illustrative lines.' },
  ],
  rubric: [
    { id: 'identity', label: 'Identity', max: 18, target: 'identity', check: 'textLength', direction: 'reward',
      params: { bands: [{ min: 20, points: 18 }, { min: 1, points: 9 }, { min: 0, points: 0 }] },
      tips: { pass: 'Clear identity statement.', fail: 'Write a 1–3 sentence identity describing who Hermes is.' } },
    { id: 'style', label: 'Style specificity', max: 18, target: 'style', check: 'patternRatio', direction: 'reward',
      params: { patterns: [STRONG_VERB], lowCountCap: { whenBelow: 2, cap: 9 } },
      tips: { pass: 'Concrete, imperative style lines.', fail: 'Use imperative verbs ("Be direct.", "Say when…"); add at least 2.' } },
    { id: 'avoid', label: 'Avoid clarity', max: 12, target: 'avoid', check: 'listSize', direction: 'reward',
      params: { bands: [{ min: 2, points: 12 }, { min: 1, points: 7 }, { min: 0, points: 0 }] },
      tips: { pass: 'Clear stylistic boundaries.', fail: 'List a couple of things the agent should never do stylistically.' } },
    { id: 'defaults', label: 'Defaults', max: 12, target: 'defaults', check: 'listSize', direction: 'reward',
      params: { bands: [{ min: 2, points: 12 }, { min: 1, points: 7 }, { min: 0, points: 0 }] },
      tips: { pass: 'Defines behavior under ambiguity.', fail: 'Describe how the agent behaves when input is underspecified.' } },
    { id: 'portability', label: 'Portability', max: 16, target: '*', check: 'patternPenalty', direction: 'penalty',
      params: { patterns: LEAKS, perHit: 8, countMode: 'patterns', requiresContent: true },
      tips: { pass: 'No task-specific leakage.', fail: 'Move to AGENTS.md — found {hits}.' } },
    { id: 'conciseness', label: 'Conciseness', max: 12, target: '#total', check: 'lineCount', direction: 'reward',
      params: { bands: [
        { min: 0, max: 0, points: 0 },
        { min: 1, max: 3, points: 8 },
        { min: 4, max: 8, points: 12 },
        { min: 9, max: 12, points: 8 },
        { min: 13, points: 5 },
      ] },
      tips: { pass: 'In the 4–8 line sweet spot.', fail: 'Aim for 4–8 defining lines.' } },
    { id: 'noHype', label: 'No hype', max: 8, target: '*', check: 'patternPenalty', direction: 'penalty',
      params: { patterns: [HYPE], perHit: 4, countMode: 'matches', requiresContent: true },
      tips: { pass: 'No marketing language.', fail: 'Remove hype words (e.g. "blazing fast", "world-class").' } },
    { id: 'structure', label: 'Structure', max: 4, target: '*', check: 'structure', direction: 'reward',
      params: { requiredSections: ['identity', 'style'] },
      tips: { pass: 'Canonical Markdown structure.', fail: 'Add an identity and at least one style line.' } },
  ],
  gate: [
    { id: 'identity', check: 'nonEmptyText', target: 'identity', message: 'Add an Identity statement.' },
    { id: 'style', check: 'nonEmptyList', target: 'style', message: 'Add at least one Style line.' },
    { id: 'portability', check: 'noPatterns', target: '*', patterns: LEAKS, countMode: 'patterns',
      message: 'Remove task-specific content (belongs in AGENTS.md): {hits}.' },
  ],
  presets: [
    { id: 'pragmatic-engineer', name: 'Pragmatic Engineer', description: 'Direct, concise, willing to say when something is a bad idea.',
      draft: {
        identity: 'You are Hermes, a pragmatic senior engineer who values clarity and correctness over ceremony.',
        style: ['Be direct.', 'Be concise unless complexity requires depth.', 'Say when something is a bad idea.'],
        avoid: ['Avoid hype language.', 'Avoid hedging when you are confident.'],
        defaults: ['When a request is ambiguous, ask one focused clarifying question.', 'Prefer the simplest solution that is correct.'],
      } },
    { id: 'research-partner', name: 'Research Partner', description: 'Explores possibilities without pretending certainty.',
      draft: {
        identity: 'You are Hermes, a research partner who thinks alongside the user and reasons carefully about open problems.',
        style: ['Explore possibilities without pretending certainty.', 'Distinguish speculation from evidence.', 'Ask clarifying questions when the idea space is underspecified.'],
        avoid: ['Avoid overclaiming.', 'Avoid presenting guesses as facts.'],
        defaults: ['When evidence is thin, state confidence explicitly.', 'Offer multiple framings before converging.'],
      } },
    { id: 'teacher', name: 'Teacher / Explainer', description: 'Explains clearly, builds from intuition to detail.',
      draft: {
        identity: 'You are Hermes, a patient teacher who makes hard ideas approachable.',
        style: ['Explain clearly using examples when helpful.', 'Build from intuition to details.', 'Do not assume prior knowledge unless signaled.'],
        avoid: ['Avoid jargon without definition.', 'Avoid condescension.'],
        defaults: ['When a concept is broad, start with the simplest accurate model.', 'Check understanding before adding depth.'],
      } },
    { id: 'tough-reviewer', name: 'Tough Reviewer', description: 'Prioritizes correctness over harmony; names risks directly.',
      draft: {
        identity: 'You are Hermes, a rigorous reviewer who protects quality and tells the user what they need to hear.',
        style: ['Point out weak assumptions directly.', 'Prioritize correctness over harmony.', 'Be explicit about risks and tradeoffs.'],
        avoid: ['Avoid rubber-stamping.', 'Avoid softening real problems.'],
        defaults: ['When something looks wrong, flag it even if unprompted.', 'Separate blocking issues from nits.'],
      } },
    { id: 'blank', name: 'Blank Slate', description: 'Start from an empty file.',
      draft: { identity: '', style: [], avoid: [], defaults: [] } },
  ],
};

// AGENTS doc type is fully populated in Task 14. Until then it is a valid empty
// shell so the pack validates; no UI references it before Task 14/15.
const agents: DocTypePack = { sections: [], rubric: [], gate: [], presets: [] };

export const BASELINE_PACK: Pack = {
  packVersion: '1',
  schemaVersion: SUPPORTED_SCHEMA_VERSION,
  publishedAt: '2026-06-24',
  summary: 'Initial pack: SOUL rubric (Hermes docs) + AGENTS rubric (agents.md standard).',
  docTypes: { soul, agents },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pack/baseline.soul.test.ts`
Expected: PASS (5 tests). If "Pragmatic Engineer" ≠ 100, recheck band boundaries against v1 `scoring.ts` — do not adjust the test target.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pack/baseline.ts src/lib/pack/baseline.soul.test.ts
git commit -m "feat: add baseline pack with v1-equivalent SOUL rubric"
```

---

## Task 6: DocType registry

**Files:**
- Create: `src/lib/docTypes.ts`
- Test: `src/lib/docTypes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/docTypes.test.ts
import { describe, it, expect } from 'vitest';
import { DOC_TYPES, docTypeById } from './docTypes';

describe('docTypes', () => {
  it('exposes soul and agents in order', () => {
    expect(DOC_TYPES.map((d) => d.id)).toEqual(['soul', 'agents']);
  });
  it('looks up by id', () => {
    expect(docTypeById('agents').filename).toBe('AGENTS.md');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/docTypes.test.ts`
Expected: FAIL — cannot find module `./docTypes`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/docTypes.ts
import type { DocId } from './pack/schema';

export interface DocType {
  id: DocId;
  label: string;
  filename: string;
  blurb: string;
}

export const DOC_TYPES: DocType[] = [
  { id: 'soul', label: 'SOUL.md', filename: 'SOUL.md',
    blurb: 'Your agent’s durable identity — tone, voice, boundaries, defaults. Goes in ~/.hermes/SOUL.md.' },
  { id: 'agents', label: 'AGENTS.md', filename: 'AGENTS.md',
    blurb: 'Project-specific instructions — setup, commands, conventions. Lives in your repo root.' },
];

export function docTypeById(id: DocId): DocType {
  const found = DOC_TYPES.find((d) => d.id === id);
  if (!found) throw new Error(`unknown doc type: ${id}`);
  return found;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/docTypes.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/docTypes.ts src/lib/docTypes.test.ts
git commit -m "feat: add doc-type registry"
```

---

## Task 7: Storage — namespaced drafts, pack state, legacy migration

**Files:**
- Modify: `src/lib/storage.ts` (full rewrite)
- Modify: `src/lib/storage.test.ts` (full rewrite)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/storage.test.ts
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
    // does not overwrite an existing soul draft on a second run
    saveDraft('soul', { identity: 'new', style: [] });
    migrateLegacyDraft();
    expect(loadDraft('soul')).toEqual({ identity: 'new', style: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: FAIL — new exports missing.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/storage.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat: namespaced drafts, pack state, and legacy migration in storage"
```

---

## Task 8: Presets accessor

**Files:**
- Modify: `src/lib/presets.ts` (full rewrite — thin accessor over a pack)
- Modify: `src/lib/presets.test.ts` (full rewrite)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/presets.test.ts
import { describe, it, expect } from 'vitest';
import { presetsFor } from './presets';
import { BASELINE_PACK } from './pack/baseline';

describe('presetsFor', () => {
  it('returns the soul presets from a pack, including Blank Slate', () => {
    const ids = presetsFor(BASELINE_PACK, 'soul').map((p) => p.id);
    expect(ids).toContain('pragmatic-engineer');
    expect(ids).toContain('blank');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/presets.test.ts`
Expected: FAIL — `presetsFor` not exported.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/presets.ts
import type { Pack, Preset, DocId } from './pack/schema';

export function presetsFor(pack: Pack, docId: DocId): Preset[] {
  return pack.docTypes[docId].presets;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/presets.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/presets.ts src/lib/presets.test.ts
git commit -m "feat: replace preset library with pack accessor"
```

---

## End of Phase 1

At this point the pure modules compile and all pure-module tests pass, but the
UI components still import the old `SoulDraft`/`scoring`/`generateSoul` symbols
and will not type-check. **Phase 2 rewires the components and App; do not run a
full `npm run build` until Task 13.** Run `npx vitest run src/lib` to confirm
the foundation is green before proceeding.

---

# Phase 2 — Wire SOUL UI through the pack

All components become generic (driven by `SectionDef[]` + engine results). App
holds the active pack and a per-doc-type draft. End state: the app behaves
exactly as v1, now data-driven and rendering only the SOUL tab (tabs arrive in
Phase 3).

## Task 9: Generic BuilderForm (section-driven)

**Files:**
- Modify: `src/components/BuilderForm.tsx` (full rewrite)
- Modify: `src/components/BuilderForm.test.tsx` (full rewrite)

The form renders required sections always, and optional sections behind an
"+ Add {heading}" / "Remove" toggle, driven entirely by `SectionDef[]`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/BuilderForm.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BuilderForm } from './BuilderForm';
import type { SectionDef } from '../lib/pack/schema';

const sections: SectionDef[] = [
  { id: 'identity', heading: 'Personality', level: 1, kind: 'text', optional: false, placeholder: 'who…' },
  { id: 'style', heading: 'Style', level: 2, kind: 'list', optional: false, placeholder: 'Be direct.' },
  { id: 'examples', heading: 'Examples', level: 2, kind: 'list', optional: true, placeholder: 'eg' },
];

describe('BuilderForm', () => {
  it('edits a text section', () => {
    const onChange = vi.fn();
    render(<BuilderForm sections={sections} draft={{ identity: '', style: [] }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Personality'), { target: { value: 'I am Hermes.' } });
    expect(onChange).toHaveBeenCalledWith({ identity: 'I am Hermes.', style: [] });
  });

  it('reveals an optional section on demand', () => {
    const onChange = vi.fn();
    render(<BuilderForm sections={sections} draft={{ identity: '', style: [] }} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Add Examples'));
    expect(onChange).toHaveBeenCalledWith({ identity: '', style: [], examples: [''] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/BuilderForm.test.tsx`
Expected: FAIL — new props shape not implemented.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/BuilderForm.tsx
import type { Draft } from '../lib/model';
import type { SectionDef } from '../lib/pack/schema';
import { ListEditor } from './ListEditor';

interface Props {
  sections: SectionDef[];
  draft: Draft;
  onChange: (draft: Draft) => void;
}

export function BuilderForm({ sections, draft, onChange }: Props) {
  const set = (id: string, value: string | string[] | undefined) => {
    const next = { ...draft };
    if (value === undefined) delete next[id];
    else next[id] = value;
    onChange(next);
  };

  const present = (s: SectionDef) => draft[s.id] !== undefined;

  return (
    <div className="builder">
      {sections.map((s) => {
        if (s.optional && !present(s)) {
          return (
            <button key={s.id} type="button" className="add-section"
              onClick={() => set(s.id, s.kind === 'text' ? '' : [''])}>
              + Add {s.heading}
            </button>
          );
        }

        if (s.kind === 'text') {
          return (
            <label className="field" key={s.id}>
              <span>{s.heading}</span>
              <textarea aria-label={s.heading} rows={3} placeholder={s.placeholder}
                value={(draft[s.id] as string) ?? ''}
                onChange={(e) => set(s.id, e.target.value)} />
              {s.optional && (
                <button type="button" className="remove-section" onClick={() => set(s.id, undefined)}>
                  Remove {s.heading}
                </button>
              )}
            </label>
          );
        }

        return (
          <section className={`field${s.optional ? ' optional' : ''}`} key={s.id}>
            <span>{s.heading}</span>
            <ListEditor label={s.heading} items={(draft[s.id] as string[]) ?? []} placeholder={s.placeholder}
              onChange={(items) => set(s.id, items)} />
            {s.optional && (
              <button type="button" className="remove-section" onClick={() => set(s.id, undefined)}>
                Remove {s.heading}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/BuilderForm.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/BuilderForm.tsx src/components/BuilderForm.test.tsx
git commit -m "feat: make BuilderForm section-driven"
```

---

## Task 10: Generic PreviewPane (generate + gate + filename)

**Files:**
- Modify: `src/components/PreviewPane.tsx` (full rewrite)
- Modify: `src/components/PreviewPane.test.tsx` (full rewrite)

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/PreviewPane.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PreviewPane } from './PreviewPane';
import { BASELINE_PACK } from '../lib/pack/baseline';

const soul = BASELINE_PACK.docTypes.soul;

describe('PreviewPane', () => {
  it('disables export when gated and lists reasons', () => {
    render(<PreviewPane sections={soul.sections} gate={soul.gate} filename="SOUL.md"
      draft={{ identity: '', style: [], avoid: [], defaults: [] }} />);
    expect(screen.getByText('Download SOUL.md')).toBeDisabled();
    expect(screen.getByText('Add an Identity statement.')).toBeInTheDocument();
  });

  it('enables export for a valid draft', () => {
    render(<PreviewPane sections={soul.sections} gate={soul.gate} filename="SOUL.md"
      draft={{ identity: 'I am Hermes, careful.', style: ['Be direct.'], avoid: [], defaults: [] }} />);
    expect(screen.getByText('Download SOUL.md')).not.toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PreviewPane.test.tsx`
Expected: FAIL — new props not implemented.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/PreviewPane.tsx
import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Draft } from '../lib/model';
import type { SectionDef, GateRule } from '../lib/pack/schema';
import { generate } from '../lib/generator';
import { evaluateGate } from '../lib/pack/engine';

interface Props {
  sections: SectionDef[];
  gate: GateRule[];
  draft: Draft;
  filename: string;
}

export function PreviewPane({ sections, gate, draft, filename }: Props) {
  const markdown = useMemo(() => generate(sections, draft), [sections, draft]);
  const result = useMemo(() => evaluateGate(gate, draft, sections), [gate, draft, sections]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="preview-pane">
      <div className="export-bar">
        <button type="button" onClick={copy} disabled={!result.ok}>{copied ? 'Copied!' : 'Copy'}</button>
        <button type="button" onClick={download} disabled={!result.ok}>Download {filename}</button>
      </div>
      {!result.ok && (
        <ul className="gate-reasons">
          {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
      <div className="preview-markdown"><ReactMarkdown>{markdown}</ReactMarkdown></div>
      <details className="preview-raw"><summary>Raw Markdown</summary><pre>{markdown}</pre></details>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/PreviewPane.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/PreviewPane.tsx src/components/PreviewPane.test.tsx
git commit -m "feat: make PreviewPane doc-type-agnostic"
```

---

## Task 11: ScorePanel — consume engine result, expose move action

**Files:**
- Modify: `src/components/ScorePanel.tsx`
- Modify: `src/components/ScorePanel.test.tsx`

ScorePanel now takes a `DraftScore` and an optional `onMoveLeaks` callback. When
a category has `hits` and `onMoveLeaks` is provided, it renders a "Move to
AGENTS.md" button under that category's tip.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ScorePanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScorePanel } from './ScorePanel';
import type { DraftScore } from '../lib/pack/engine';

const result: DraftScore = {
  score: 50,
  categories: [
    { key: 'identity', label: 'Identity', score: 18, max: 18, tip: 'Clear identity statement.' },
    { key: 'portability', label: 'Portability', score: 8, max: 16, tip: 'Move to AGENTS.md — found command: npm.', hits: ['command: npm'] },
  ],
};

describe('ScorePanel', () => {
  it('shows total and a tip only for sub-max categories', () => {
    render(<ScorePanel result={result} />);
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.queryByText('Clear identity statement.')).toBeNull();
    expect(screen.getByText(/Move to AGENTS\.md — found/)).toBeInTheDocument();
  });

  it('offers the move action when hits + callback present', () => {
    const onMove = vi.fn();
    render(<ScorePanel result={result} onMoveLeaks={onMove} />);
    fireEvent.click(screen.getByText('Move to AGENTS.md'));
    expect(onMove).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ScorePanel.test.tsx`
Expected: FAIL — `DraftScore` import / `onMoveLeaks` not implemented.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/ScorePanel.tsx
import type { DraftScore } from '../lib/pack/engine';

interface Props {
  result: DraftScore;
  /** When provided, sub-max categories that carry leak hits get a move button. */
  onMoveLeaks?: () => void;
}

function tier(score: number): string {
  if (score >= 80) return 'great';
  if (score >= 60) return 'ok';
  return 'weak';
}

export function ScorePanel({ result, onMoveLeaks }: Props) {
  return (
    <div className={`score-panel tier-${tier(result.score)}`}>
      <div className="score-gauge">
        <span className="score-number">{result.score}</span>
        <span className="score-max">/100</span>
      </div>
      <ul className="score-rows">
        {result.categories.map((c) => (
          <li key={c.key} className="score-row">
            <div className="score-row-head">
              <span className="score-row-label">{c.label}</span>
              <span className="score-row-value">{c.score}/{c.max}</span>
            </div>
            <div className="score-bar">
              <div className="score-bar-fill" style={{ width: `${(c.score / c.max) * 100}%` }} />
            </div>
            {c.score < c.max && <p className="score-tip">{c.tip}</p>}
            {onMoveLeaks && c.hits && c.hits.length > 0 && (
              <button type="button" className="move-leaks" onClick={onMoveLeaks}>
                Move to AGENTS.md
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ScorePanel.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ScorePanel.tsx src/components/ScorePanel.test.tsx
git commit -m "feat: ScorePanel consumes engine result and offers move action"
```

---

## Task 12: Generic PresetPicker

**Files:**
- Modify: `src/components/PresetPicker.tsx`
- Modify: `src/components/PresetPicker.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/PresetPicker.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PresetPicker } from './PresetPicker';
import { presetsFor } from '../lib/presets';
import { BASELINE_PACK } from '../lib/pack/baseline';

describe('PresetPicker', () => {
  it('renders presets and applies a deep copy of the draft', () => {
    const onApply = vi.fn();
    render(<PresetPicker presets={presetsFor(BASELINE_PACK, 'soul')} onApply={onApply} />);
    fireEvent.click(screen.getByText('Pragmatic Engineer'));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect((onApply.mock.calls[0][0] as { identity: string }).identity).toContain('pragmatic');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PresetPicker.test.tsx`
Expected: FAIL — new props not implemented.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/PresetPicker.tsx
import type { Draft } from '../lib/model';
import type { Preset } from '../lib/pack/schema';

interface Props {
  presets: Preset[];
  onApply: (draft: Draft) => void;
}

export function PresetPicker({ presets, onApply }: Props) {
  return (
    <div className="presets">
      {presets.map((p) => (
        <button key={p.id} type="button" className="preset" title={p.description}
          onClick={() => onApply(structuredClone(p.draft))}>
          {p.name}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/PresetPicker.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/PresetPicker.tsx src/components/PresetPicker.test.tsx
git commit -m "feat: make PresetPicker take presets as a prop"
```

---

## Task 13: App — compose with active pack (SOUL only), restore build green

**Files:**
- Modify: `src/App.tsx` (full rewrite)
- Modify: `src/App.test.tsx` (full rewrite)

App holds the active pack (from storage or baseline) and the SOUL draft. It runs
the legacy migration once and autosaves. Tabs are added in Task 15; for now it
renders the SOUL doc type only, proving v1 parity end-to-end.

- [ ] **Step 1: Write the failing test**

```tsx
// src/App.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

beforeEach(() => localStorage.clear());

describe('App', () => {
  it('renders the SOUL builder and updates the live score when a preset is applied', () => {
    render(<App />);
    expect(screen.getByText('SOUL Creator')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument(); // empty score
    fireEvent.click(screen.getByText('Pragmatic Engineer'));
    expect(screen.getByText('100')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — App still uses old `scoreSoul`/`SoulDraft` API and will not compile.

- [ ] **Step 3: Write the implementation**

```tsx
// src/App.tsx
import { useEffect, useMemo, useState } from 'react';
import { emptyDraft, type Draft } from './lib/model';
import { scoreDraft } from './lib/pack/engine';
import { presetsFor } from './lib/presets';
import { BASELINE_PACK } from './lib/pack/baseline';
import { docTypeById } from './lib/docTypes';
import {
  loadDraft, saveDraft, loadActivePack, migrateLegacyDraft,
} from './lib/storage';
import { BuilderForm } from './components/BuilderForm';
import { PresetPicker } from './components/PresetPicker';
import { ScorePanel } from './components/ScorePanel';
import { PreviewPane } from './components/PreviewPane';
import './App.css';

export default function App() {
  const pack = useMemo(() => loadActivePack() ?? BASELINE_PACK, []);
  const docType = docTypeById('soul');
  const docPack = pack.docTypes.soul;

  const [draft, setDraft] = useState<Draft>(() => {
    migrateLegacyDraft();
    return loadDraft('soul') ?? emptyDraft(docPack.sections);
  });

  const score = useMemo(
    () => scoreDraft(docPack.rubric, draft, docPack.sections),
    [docPack, draft],
  );

  useEffect(() => {
    const id = setTimeout(() => saveDraft('soul', draft), 300);
    return () => clearTimeout(id);
  }, [draft]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>SOUL Creator</h1>
        <p>{docType.blurb}</p>
      </header>

      <PresetPicker presets={presetsFor(pack, 'soul')} onApply={setDraft} />

      <main className="panes">
        <section className="pane pane-left">
          <BuilderForm sections={docPack.sections} draft={draft} onChange={setDraft} />
        </section>
        <section className="pane pane-right">
          <PreviewPane sections={docPack.sections} gate={docPack.gate} draft={draft} filename={docType.filename} />
          <ScorePanel result={score} />
        </section>
      </main>

      <footer className="app-footer">
        Place the result at <code>~/.hermes/SOUL.md</code>. Project-specific rules belong in <code>AGENTS.md</code>.
      </footer>
    </div>
  );
}
```

- [ ] **Step 4: Verify tests AND the full build**

Run: `npx vitest run` then `npm run build`
Expected: All tests PASS; `tsc -b && vite build` succeeds with no type errors. (This is the Phase-2 gate: the app is now fully data-driven and behaves as v1.)

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: compose app from active pack (SOUL), data-driven parity with v1"
```

---

## End of Phase 2

The app now works exactly as v1 did, but every scoring rule, gate, section, and
preset comes from the pack. `npm run build` is green. Proceed to Phase 3.

---

# Phase 3 — AGENTS.md + tabs + cross-tab

## Task 14: Populate the AGENTS.md doc type in the baseline pack

**Files:**
- Modify: `src/lib/pack/baseline.ts` (replace the empty `agents` shell)
- Test: `src/lib/pack/baseline.agents.test.ts`

AGENTS rubric weights sum to 100: commands 24, conciseness 18, boundaries 16,
specificity 16, no-hype 10, structure 16. The signature inversion: real command
tokens are **rewarded** here (the opposite of SOUL's portability penalty).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/pack/baseline.agents.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pack/baseline.agents.test.ts`
Expected: FAIL — `agents` is the empty shell.

- [ ] **Step 3: Write the implementation**

Replace the `agents` constant in `src/lib/pack/baseline.ts` (it currently reads
`const agents: DocTypePack = { sections: [], rubric: [], gate: [], presets: [] };`).
Reuse the existing `HYPE` constant already defined in the file. Add this above
the `agents` definition, then replace the shell:

```ts
const COMMAND_TOKENS: PatternSpec = {
  source: '`[^`]+`|\\b(npm|npx|yarn|pnpm|pip|pytest|ruff|mypy|tox|git|docker|make|cargo|go|node|deno|bun|vite|eslint|tsc|curl)\\b',
  flags: 'i',
};

const VAGUE_FILLER: PatternSpec = {
  source: '\\b(best practices?|good code|clean code|as needed|as appropriate|appropriately|follow conventions|the usual)\\b',
  flags: 'gi',
};

const agents: DocTypePack = {
  sections: [
    { id: 'overview', heading: 'Project overview', level: 1, kind: 'text', optional: false,
      placeholder: 'One or two sentences: what this repo is.', help: 'What the project is and does.' },
    { id: 'commands', heading: 'Setup & commands', level: 2, kind: 'list', optional: false,
      placeholder: 'Run `npm test` before pushing.', help: 'Exact build/test/run commands — the highest-ROI section.' },
    { id: 'codeStyle', heading: 'Code style', level: 2, kind: 'list', optional: true,
      placeholder: 'Prefer named exports.', help: 'Conventions, formatting, idioms.' },
    { id: 'testing', heading: 'Testing', level: 2, kind: 'list', optional: true,
      placeholder: 'All tests must pass before a PR.', help: 'How to run tests; what must pass.' },
    { id: 'architecture', heading: 'Architecture', level: 2, kind: 'list', optional: true,
      placeholder: 'Pure modules live in src/lib.', help: 'Key modules and boundaries.' },
    { id: 'boundaries', heading: 'Boundaries', level: 2, kind: 'list', optional: false,
      placeholder: 'Always: run tests. Ask first: schema changes. Never: commit secrets.',
      help: 'Always do / Ask first / Never do.' },
    { id: 'commitPr', heading: 'Commit & PR', level: 2, kind: 'list', optional: true,
      placeholder: 'Use Conventional Commits.', help: 'Message format and review expectations.' },
  ],
  rubric: [
    { id: 'commands', label: 'Commands concreteness', max: 24, target: 'commands', check: 'patternRatio', direction: 'reward',
      params: { patterns: [COMMAND_TOKENS] },
      tips: { pass: 'Concrete, runnable commands.', fail: 'List exact commands with flags, e.g. `npm test`, `npm run build`.' } },
    { id: 'conciseness', label: 'Conciseness', max: 18, target: '#total', check: 'lineCount', direction: 'reward',
      params: { bands: [
        { min: 0, max: 0, points: 0 },
        { min: 1, max: 120, points: 18 },
        { min: 121, max: 200, points: 10 },
        { min: 201, points: 4 },
      ] },
      tips: { pass: 'Tight and scannable (≤120 lines).', fail: 'Trim toward ≤150 lines — long files bury signal.' } },
    { id: 'boundaries', label: 'Boundaries', max: 16, target: 'boundaries', check: 'listSize', direction: 'reward',
      params: { bands: [{ min: 3, points: 16 }, { min: 1, points: 8 }, { min: 0, points: 0 }] },
      tips: { pass: 'Explicit Always/Ask/Never boundaries.', fail: 'Add an Always do / Ask first / Never do triad.' } },
    { id: 'specificity', label: 'Specificity', max: 16, target: '*', check: 'patternPenalty', direction: 'penalty',
      params: { patterns: [VAGUE_FILLER], perHit: 4, countMode: 'matches', requiresContent: true },
      tips: { pass: 'Specific, not boilerplate.', fail: 'Replace vague filler ({hits}) with concrete instructions.' } },
    { id: 'noHype', label: 'No hype', max: 10, target: '*', check: 'patternPenalty', direction: 'penalty',
      params: { patterns: [HYPE], perHit: 5, countMode: 'matches', requiresContent: true },
      tips: { pass: 'No marketing language.', fail: 'Remove hype words (e.g. "world-class", "cutting-edge").' } },
    { id: 'structure', label: 'Structure', max: 16, target: '*', check: 'structure', direction: 'reward',
      params: { requiredSections: ['overview', 'commands'] },
      tips: { pass: 'Overview and commands present.', fail: 'Add a project overview and a commands section.' } },
  ],
  gate: [
    { id: 'overview', check: 'nonEmptyText', target: 'overview', message: 'Add a one-line project overview.' },
    { id: 'commands', check: 'nonEmptyList', target: 'commands', message: 'Add at least one concrete command.' },
  ],
  presets: [
    { id: 'node-web-app', name: 'Node web app', description: 'Vite/React-style project with npm scripts.',
      draft: {
        overview: 'A React + Vite single-page app. Local-first, no backend.',
        commands: ['Install: `npm install`.', 'Dev server: `npm run dev`.', 'Test: `npm test`.', 'Build: `npm run build`.'],
        codeStyle: ['Prefer named exports.', 'Keep pure logic in src/lib.'],
        testing: ['All Vitest tests must pass before a PR.'],
        boundaries: ['Always run the tests before committing.', 'Ask first before adding a dependency.', 'Never commit secrets or .env files.'],
        commitPr: ['Use Conventional Commits (feat:, fix:, chore:).'],
      } },
    { id: 'python-lib', name: 'Python library', description: 'pytest + ruff project layout.',
      draft: {
        overview: 'A Python library packaged with pyproject.toml.',
        commands: ['Install: `pip install -e .[dev]`.', 'Test: `pytest`.', 'Lint: `ruff check .`.', 'Types: `mypy src`.'],
        codeStyle: ['Follow ruff formatting.', 'Type-annotate public functions.'],
        testing: ['Run `pytest` and keep coverage above the current baseline.'],
        boundaries: ['Always run `ruff` and `pytest` before a PR.', 'Ask first before changing the public API.', 'Never break semver without a major bump.'],
        commitPr: ['One logical change per PR.'],
      } },
    { id: 'blank', name: 'Blank Slate', description: 'Start from an empty file.',
      draft: { overview: '', commands: [], boundaries: [] } },
  ],
};
```

Note: also update the `summary` field of `BASELINE_PACK` if desired (optional;
no test depends on it).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pack/baseline.agents.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pack/baseline.ts src/lib/pack/baseline.agents.test.ts
git commit -m "feat: add AGENTS.md doc type to the baseline pack"
```

---

## Task 15: Tab bar + per-doc-type App routing

**Files:**
- Create: `src/components/TabBar.tsx`
- Create: `src/components/TabBar.test.tsx`
- Modify: `src/App.tsx` (full rewrite — generalize across doc types)
- Modify: `src/App.test.tsx` (extend)
- Modify: `src/App.css` (append tab styles)

- [ ] **Step 1: Write the failing test (TabBar)**

```tsx
// src/components/TabBar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabBar } from './TabBar';

describe('TabBar', () => {
  it('marks the active tab and fires onSelect', () => {
    const onSelect = vi.fn();
    render(<TabBar active="soul" onSelect={onSelect} />);
    expect(screen.getByRole('tab', { name: 'SOUL.md' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'AGENTS.md' }));
    expect(onSelect).toHaveBeenCalledWith('agents');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/TabBar.test.tsx`
Expected: FAIL — cannot find module `./TabBar`.

- [ ] **Step 3: Write TabBar**

```tsx
// src/components/TabBar.tsx
import { DOC_TYPES } from '../lib/docTypes';
import type { DocId } from '../lib/pack/schema';

interface Props {
  active: DocId;
  onSelect: (id: DocId) => void;
}

export function TabBar({ active, onSelect }: Props) {
  return (
    <div className="tab-bar" role="tablist">
      {DOC_TYPES.map((d) => (
        <button key={d.id} role="tab" type="button"
          aria-selected={active === d.id}
          className={`tab${active === d.id ? ' active' : ''}`}
          onClick={() => onSelect(d.id)}>
          {d.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run TabBar test to verify it passes**

Run: `npx vitest run src/components/TabBar.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Rewrite App to route across doc types**

```tsx
// src/App.tsx
import { useEffect, useMemo, useState } from 'react';
import { emptyDraft, type Draft } from './lib/model';
import { scoreDraft } from './lib/pack/engine';
import { presetsFor } from './lib/presets';
import { BASELINE_PACK } from './lib/pack/baseline';
import { docTypeById } from './lib/docTypes';
import type { DocId } from './lib/pack/schema';
import {
  loadDraft, saveDraft, loadActivePack, migrateLegacyDraft,
  loadActiveTab, saveActiveTab,
} from './lib/storage';
import { TabBar } from './components/TabBar';
import { BuilderForm } from './components/BuilderForm';
import { PresetPicker } from './components/PresetPicker';
import { ScorePanel } from './components/ScorePanel';
import { PreviewPane } from './components/PreviewPane';
import './App.css';

export default function App() {
  const pack = useMemo(() => loadActivePack() ?? BASELINE_PACK, []);
  const [active, setActive] = useState<DocId>(() => loadActiveTab() ?? 'soul');

  // One draft per doc type, lazily initialized from storage.
  const [drafts, setDrafts] = useState<Record<DocId, Draft>>(() => {
    migrateLegacyDraft();
    return {
      soul: loadDraft('soul') ?? emptyDraft(pack.docTypes.soul.sections),
      agents: loadDraft('agents') ?? emptyDraft(pack.docTypes.agents.sections),
    };
  });

  const docType = docTypeById(active);
  const docPack = pack.docTypes[active];
  const draft = drafts[active];

  const setDraft = (next: Draft) => setDrafts((prev) => ({ ...prev, [active]: next }));

  const score = useMemo(
    () => scoreDraft(docPack.rubric, draft, docPack.sections),
    [docPack, draft],
  );

  useEffect(() => {
    const id = setTimeout(() => saveDraft(active, draft), 300);
    return () => clearTimeout(id);
  }, [active, draft]);

  const selectTab = (id: DocId) => {
    setActive(id);
    saveActiveTab(id);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>SOUL Creator</h1>
        <p>{docType.blurb}</p>
      </header>

      <TabBar active={active} onSelect={selectTab} />
      <PresetPicker presets={presetsFor(pack, active)} onApply={setDraft} />

      <main className="panes">
        <section className="pane pane-left">
          <BuilderForm sections={docPack.sections} draft={draft} onChange={setDraft} />
        </section>
        <section className="pane pane-right">
          <PreviewPane sections={docPack.sections} gate={docPack.gate} draft={draft} filename={docType.filename} />
          <ScorePanel result={score} />
        </section>
      </main>

      <footer className="app-footer">
        <code>SOUL.md</code> → <code>~/.hermes/SOUL.md</code> (identity). <code>AGENTS.md</code> → your repo root (project rules).
      </footer>
    </div>
  );
}
```

- [ ] **Step 6: Extend the App test**

```tsx
// add inside the existing describe('App', ...) in src/App.test.tsx
  it('switches to the AGENTS tab and shows its sections', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'AGENTS.md' }));
    expect(screen.getByText('Project overview')).toBeInTheDocument();
    expect(screen.getByText('Setup & commands')).toBeInTheDocument();
  });
```

- [ ] **Step 7: Append tab styles to App.css**

```css
/* Tab bar */
.tab-bar { display: flex; gap: 0.25rem; margin: 0 0 1rem; }
.tab {
  background: transparent; border: none; border-bottom: 2px solid transparent;
  color: var(--muted, #9aa); padding: 0.5rem 1rem; cursor: pointer; font-size: 1rem;
}
.tab.active { color: #fff; border-bottom-color: #7c5cff; }
.move-leaks {
  margin-top: 0.4rem; font-size: 0.8rem; background: #7c5cff22;
  border: 1px solid #7c5cff66; color: #cbb8ff; border-radius: 6px;
  padding: 0.2rem 0.5rem; cursor: pointer;
}
```

- [ ] **Step 8: Run tests and build**

Run: `npx vitest run && npm run build`
Expected: All tests PASS; build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/components/TabBar.tsx src/components/TabBar.test.tsx src/App.tsx src/App.test.tsx src/App.css
git commit -m "feat: add SOUL/AGENTS tabs with per-doc-type drafts"
```

---

## Task 16: Cross-tab "Move to AGENTS.md"

**Files:**
- Create: `src/lib/crossTab.ts`
- Create: `src/lib/crossTab.test.ts`
- Modify: `src/App.tsx` (wire `onMoveLeaks`)

`crossTab` is pure: given the SOUL and AGENTS drafts + their sections, it finds
SOUL list-lines that trip a leak pattern, removes them from SOUL, and appends
them to the best-fit AGENTS section (command-like → `commands`, else
`architecture`). Returns both updated drafts.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/crossTab.test.ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/crossTab.test.ts`
Expected: FAIL — cannot find module `./crossTab`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/crossTab.ts
import { cleanLines } from './model';
import type { Draft } from './model';
import type { SectionDef } from './pack/schema';

const COMMAND_RE = /\b(npm|npx|yarn|pnpm|pip|pytest|git|docker|make|cargo|go run|curl)\b/i;
const PATH_RE = /(\.{0,2}\/)?[\w-]+\/[\w./-]+/;
const PORT_RE = /:\d{2,5}\b/;
const FLAG_RE = /\b[A-Z_]{3,}=|--[a-z][\w-]+/;

function isLeak(line: string): boolean {
  return COMMAND_RE.test(line) || PATH_RE.test(line) || PORT_RE.test(line) || FLAG_RE.test(line);
}

function target(line: string): 'commands' | 'architecture' {
  return COMMAND_RE.test(line) ? 'commands' : 'architecture';
}

function appendTo(draft: Draft, sectionId: string, line: string): void {
  const existing = Array.isArray(draft[sectionId]) ? (draft[sectionId] as string[]) : [];
  draft[sectionId] = [...existing, line];
}

/**
 * Move every leak-tripping line out of SOUL's list sections and into the
 * best-fit AGENTS section. Pure: returns new drafts, mutates neither input.
 */
export function moveLeaksToAgents(
  soul: Draft,
  agents: Draft,
  soulSections: SectionDef[],
): { soul: Draft; agents: Draft } {
  const nextSoul: Draft = structuredClone(soul);
  const nextAgents: Draft = structuredClone(agents);

  for (const s of soulSections) {
    if (s.kind !== 'list') continue;
    const lines = cleanLines(nextSoul[s.id] as string[] | undefined);
    const keep: string[] = [];
    for (const line of lines) {
      if (isLeak(line)) appendTo(nextAgents, target(line), line);
      else keep.push(line);
    }
    nextSoul[s.id] = keep;
  }

  return { soul: nextSoul, agents: nextAgents };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/crossTab.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire it into App**

In `src/App.tsx`, add the import:

```tsx
import { moveLeaksToAgents } from './lib/crossTab';
```

Add a handler before the `return`:

```tsx
  const handleMoveLeaks = () => {
    const moved = moveLeaksToAgents(drafts.soul, drafts.agents, pack.docTypes.soul.sections);
    setDrafts({ soul: moved.soul, agents: moved.agents });
    selectTab('agents');
  };
```

Pass it to ScorePanel only on the SOUL tab:

```tsx
          <ScorePanel result={score} onMoveLeaks={active === 'soul' ? handleMoveLeaks : undefined} />
```

- [ ] **Step 6: Run tests and build**

Run: `npx vitest run && npm run build`
Expected: All PASS; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/lib/crossTab.ts src/lib/crossTab.test.ts src/App.tsx
git commit -m "feat: one-click move of leaked lines from SOUL to AGENTS"
```

---

## End of Phase 3

Both doc types are fully authored, scored, and gated, with cross-tab leak
migration. Proceed to Phase 4.

---

# Phase 4 — GitHub update mechanism

## Task 17: Update checker (pure, injectable fetch)

**Files:**
- Create: `src/lib/pack/update.ts`
- Create: `src/lib/pack/update.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/pack/update.test.ts
import { describe, it, expect, vi } from 'vitest';
import { checkForUpdate } from './update';
import { BASELINE_PACK } from './baseline';
import { SUPPORTED_SCHEMA_VERSION } from './schema';

function fetchReturning(manifest: unknown, pack: unknown): typeof fetch {
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    const body = u.endsWith('manifest.json') ? manifest : pack;
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as unknown as typeof fetch;
}

const base = { baseUrl: 'https://x/packs', online: true, activeVersion: '1' };

describe('checkForUpdate', () => {
  it('reports offline without fetching', async () => {
    const fetchSpy = vi.fn() as unknown as typeof fetch;
    const out = await checkForUpdate({ ...base, online: false, fetch: fetchSpy });
    expect(out.kind).toBe('offline');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports up-to-date when latest <= active', async () => {
    const manifest = { latest: '1', schemaVersion: SUPPORTED_SCHEMA_VERSION, url: 'pack-1.json', publishedAt: 'x', summary: 's' };
    const out = await checkForUpdate({ ...base, fetch: fetchReturning(manifest, null) });
    expect(out.kind).toBe('up-to-date');
  });

  it('flags needs-app-update when schemaVersion exceeds support', async () => {
    const manifest = { latest: '9', schemaVersion: SUPPORTED_SCHEMA_VERSION + 1, url: 'pack-9.json', publishedAt: 'x', summary: 's' };
    const out = await checkForUpdate({ ...base, fetch: fetchReturning(manifest, null) });
    expect(out.kind).toBe('needs-app-update');
  });

  it('returns the validated pack when a newer compatible one exists', async () => {
    const manifest = { latest: '2', schemaVersion: SUPPORTED_SCHEMA_VERSION, url: 'pack-2.json', publishedAt: 'x', summary: 's' };
    const pack = { ...BASELINE_PACK, packVersion: '2' };
    const out = await checkForUpdate({ ...base, fetch: fetchReturning(manifest, pack) });
    expect(out.kind).toBe('available');
    if (out.kind === 'available') expect(out.pack.packVersion).toBe('2');
  });

  it('errors on an invalid fetched pack', async () => {
    const manifest = { latest: '2', schemaVersion: SUPPORTED_SCHEMA_VERSION, url: 'pack-2.json', publishedAt: 'x', summary: 's' };
    const out = await checkForUpdate({ ...base, fetch: fetchReturning(manifest, { junk: true }) });
    expect(out.kind).toBe('error');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pack/update.test.ts`
Expected: FAIL — cannot find module `./update`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/pack/update.ts
import { validatePack, SUPPORTED_SCHEMA_VERSION } from './schema';
import type { Pack } from './schema';

export interface Manifest {
  latest: string;
  schemaVersion: number;
  url: string;
  publishedAt: string;
  summary: string;
}

export type UpdateOutcome =
  | { kind: 'offline' }
  | { kind: 'up-to-date' }
  | { kind: 'needs-app-update'; manifest: Manifest }
  | { kind: 'available'; pack: Pack }
  | { kind: 'error'; error: string };

export interface UpdateDeps {
  fetch: typeof fetch;
  baseUrl: string;
  online: boolean;
  activeVersion: string;
}

const newer = (a: string, b: string) => Number(a) > Number(b);

export async function checkForUpdate(deps: UpdateDeps): Promise<UpdateOutcome> {
  if (!deps.online) return { kind: 'offline' };
  try {
    const mres = await deps.fetch(`${deps.baseUrl}/manifest.json`, { cache: 'no-cache' });
    if (!mres.ok) return { kind: 'error', error: `manifest ${mres.status}` };
    const manifest = (await mres.json()) as Manifest;

    if (!newer(manifest.latest, deps.activeVersion)) return { kind: 'up-to-date' };
    if (manifest.schemaVersion > SUPPORTED_SCHEMA_VERSION) return { kind: 'needs-app-update', manifest };

    const pres = await deps.fetch(`${deps.baseUrl}/${manifest.url}`, { cache: 'no-cache' });
    if (!pres.ok) return { kind: 'error', error: `pack ${pres.status}` };
    const pack = validatePack(await pres.json());
    if (!pack) return { kind: 'error', error: 'invalid pack' };
    return { kind: 'available', pack };
  } catch (e) {
    return { kind: 'error', error: String(e) };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pack/update.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pack/update.ts src/lib/pack/update.test.ts
git commit -m "feat: add pure update checker for the knowledge pack"
```

---

## Task 18: Config constant for the pack base URL

**Files:**
- Create: `src/lib/config.ts`
- Create: `src/lib/config.test.ts`

The base URL is a build-time constant sourced from a Vite env var, defaulting to
the GitHub Pages path for this repo.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/config.test.ts
import { describe, it, expect } from 'vitest';
import { PACK_BASE_URL } from './config';

describe('config', () => {
  it('exposes a non-empty pack base URL ending in /packs', () => {
    expect(PACK_BASE_URL).toMatch(/\/packs$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/config.test.ts`
Expected: FAIL — cannot find module `./config`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/config.ts
// Override at build time with VITE_PACK_BASE_URL. Default targets GitHub Pages
// for this repo (update the owner/repo if it is forked or renamed).
export const PACK_BASE_URL: string =
  (import.meta.env.VITE_PACK_BASE_URL as string | undefined) ??
  'https://christopherjacob.github.io/SoulCreator/packs';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/config.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/config.ts src/lib/config.test.ts
git commit -m "feat: add configurable pack base URL"
```

---

## Task 19: UpdateBanner + header indicator + apply/revert wiring

**Files:**
- Create: `src/components/UpdateBanner.tsx`
- Create: `src/components/UpdateBanner.test.tsx`
- Modify: `src/App.tsx` (run the check on mount; render banner + indicator; apply/revert)
- Modify: `src/App.css` (append banner styles)

- [ ] **Step 1: Write the failing test (UpdateBanner)**

```tsx
// src/components/UpdateBanner.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateBanner } from './UpdateBanner';

describe('UpdateBanner', () => {
  it('renders nothing when there is no update', () => {
    const { container } = render(<UpdateBanner state={{ kind: 'none' }} onApply={() => {}} onDismiss={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows version + summary and fires apply/dismiss', () => {
    const onApply = vi.fn();
    const onDismiss = vi.fn();
    render(<UpdateBanner state={{ kind: 'available', version: '3', summary: 'Tightened hype list.' }} onApply={onApply} onDismiss={onDismiss} />);
    expect(screen.getByText(/v3/)).toBeInTheDocument();
    expect(screen.getByText(/Tightened hype list\./)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Apply'));
    fireEvent.click(screen.getByText('Dismiss'));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows an app-update notice without an apply button', () => {
    render(<UpdateBanner state={{ kind: 'needs-app-update', version: '9' }} onApply={() => {}} onDismiss={() => {}} />);
    expect(screen.getByText(/update the app/i)).toBeInTheDocument();
    expect(screen.queryByText('Apply')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/UpdateBanner.test.tsx`
Expected: FAIL — cannot find module `./UpdateBanner`.

- [ ] **Step 3: Write UpdateBanner**

```tsx
// src/components/UpdateBanner.tsx
export type BannerState =
  | { kind: 'none' }
  | { kind: 'available'; version: string; summary: string }
  | { kind: 'needs-app-update'; version: string };

interface Props {
  state: BannerState;
  onApply: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({ state, onApply, onDismiss }: Props) {
  if (state.kind === 'none') return null;

  return (
    <div className="update-banner" role="status">
      {state.kind === 'available' ? (
        <>
          <span>Best-practices update <strong>v{state.version}</strong> available — {state.summary}</span>
          <span className="update-actions">
            <button type="button" onClick={onApply}>Apply</button>
            <button type="button" className="ghost" onClick={onDismiss}>Dismiss</button>
          </span>
        </>
      ) : (
        <>
          <span>A newer pack (<strong>v{state.version}</strong>) needs a newer app version. Please update the app.</span>
          <span className="update-actions">
            <button type="button" className="ghost" onClick={onDismiss}>Dismiss</button>
          </span>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run UpdateBanner test to verify it passes**

Run: `npx vitest run src/components/UpdateBanner.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire into App**

Add imports to `src/App.tsx`:

```tsx
import { useCallback } from 'react';
import { checkForUpdate } from './lib/pack/update';
import { PACK_BASE_URL } from './lib/config';
import { saveActivePack, saveAvailablePack, clearAvailablePack, loadAvailablePack } from './lib/storage';
import { UpdateBanner, type BannerState } from './components/UpdateBanner';
import type { Pack } from './lib/pack/schema';
```

Convert the active pack from a `useMemo` to state so it can change at runtime.
Replace the `const pack = useMemo(...)` line with:

```tsx
  const [pack, setPack] = useState<Pack>(() => loadActivePack() ?? BASELINE_PACK);
  const [banner, setBanner] = useState<BannerState>({ kind: 'none' });
```

Add the on-mount check and apply/revert handlers:

```tsx
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = loadAvailablePack();
      if (cached) {
        setBanner({ kind: 'available', version: cached.packVersion, summary: cached.summary });
        return;
      }
      const out = await checkForUpdate({
        fetch: fetch.bind(window),
        baseUrl: PACK_BASE_URL,
        online: navigator.onLine,
        activeVersion: pack.packVersion,
      });
      if (cancelled) return;
      if (out.kind === 'available') {
        saveAvailablePack(out.pack);
        setBanner({ kind: 'available', version: out.pack.packVersion, summary: out.pack.summary });
      } else if (out.kind === 'needs-app-update') {
        setBanner({ kind: 'needs-app-update', version: out.manifest.latest });
      }
    })();
    return () => { cancelled = true; };
  }, [pack.packVersion]);

  const applyUpdate = useCallback(() => {
    const next = loadAvailablePack();
    if (!next) return;
    saveActivePack(next);
    clearAvailablePack();
    setPack(next);
    setBanner({ kind: 'none' });
  }, []);

  const dismissUpdate = useCallback(() => setBanner({ kind: 'none' }), []);
```

Render the banner + a version/connectivity indicator in the header (place the
`<UpdateBanner>` directly above `<TabBar>`, and add the indicator inside
`app-header`):

```tsx
        <p className="pack-indicator">
          {navigator.onLine ? 'online' : 'offline'} · pack v{pack.packVersion}
        </p>
```

```tsx
      <UpdateBanner state={banner} onApply={applyUpdate} onDismiss={dismissUpdate} />
```

- [ ] **Step 6: Append banner styles to App.css**

```css
/* Update banner + indicator */
.update-banner {
  display: flex; justify-content: space-between; align-items: center; gap: 1rem;
  background: #2a2350; border: 1px solid #7c5cff66; color: #e7e2ff;
  padding: 0.6rem 1rem; border-radius: 8px; margin: 0 0 1rem; font-size: 0.9rem;
}
.update-actions { display: flex; gap: 0.5rem; flex: none; }
.update-banner button { padding: 0.3rem 0.8rem; border-radius: 6px; cursor: pointer; border: none; background: #7c5cff; color: #fff; }
.update-banner button.ghost { background: transparent; border: 1px solid #ffffff33; color: #cbb8ff; }
.pack-indicator { font-size: 0.8rem; color: #8a8aa0; margin: 0.2rem 0 0; }
```

- [ ] **Step 7: Make the App test hermetic (stub fetch)**

The on-mount check would otherwise hit the real network in jsdom. Add a stub at
the top of the existing `describe('App', ...)` block in `src/App.test.tsx` so
`checkForUpdate` resolves to `up-to-date` (no banner) deterministically:

```tsx
// add alongside the existing beforeEach in src/App.test.tsx
import { vi, afterEach } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) =>
    String(url).endsWith('manifest.json')
      ? ({ ok: true, status: 200, json: async () => ({ latest: '1', schemaVersion: 2, url: 'pack-1.json', publishedAt: 'x', summary: 's' }) } as Response)
      : ({ ok: false, status: 404, json: async () => ({}) } as Response),
  ));
});

afterEach(() => vi.unstubAllGlobals());
```

(If the file already imports `vi`/`beforeEach`, merge rather than duplicate the
imports, and fold the `localStorage.clear()` into the single `beforeEach`.)

- [ ] **Step 8: Run tests and build**

Run: `npx vitest run && npm run build`
Expected: All PASS; build succeeds. With `fetch` stubbed to a v1 manifest, the
check returns `up-to-date`, so no banner renders and existing App assertions stay
green.

- [ ] **Step 9: Commit**

```bash
git add src/components/UpdateBanner.tsx src/components/UpdateBanner.test.tsx src/App.tsx src/App.test.tsx src/App.css
git commit -m "feat: notify-and-apply knowledge-pack updates with revertable active pack"
```

---

## Task 20: Publish the v1 pack as static files

**Files:**
- Create: `public/packs/manifest.json`
- Create: `public/packs/pack-1.json`
- Create: `scripts/build-pack.mjs` (serializes `BASELINE_PACK` → `pack-1.json` to prevent drift)
- Create: `scripts/build-pack.test.ts` (asserts the published file matches the baseline)
- Modify: `package.json` (add a `pack:build` script)

Files in `public/` are copied verbatim into `dist/` by Vite, so GitHub Pages
serves them at `/<repo>/packs/...`. The published `pack-1.json` must equal the
bundled `BASELINE_PACK` so a fresh fetch is a no-op for v1 users.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/build-pack.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BASELINE_PACK } from '../src/lib/pack/baseline';

describe('published packs', () => {
  it('pack-1.json matches the bundled baseline', () => {
    const published = JSON.parse(readFileSync('public/packs/pack-1.json', 'utf8'));
    expect(published).toEqual(BASELINE_PACK);
  });

  it('manifest points at the latest pack', () => {
    const manifest = JSON.parse(readFileSync('public/packs/manifest.json', 'utf8'));
    expect(manifest.latest).toBe(BASELINE_PACK.packVersion);
    expect(manifest.schemaVersion).toBe(BASELINE_PACK.schemaVersion);
    expect(manifest.url).toBe('pack-1.json');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/build-pack.test.ts`
Expected: FAIL — the public/packs files do not exist.

- [ ] **Step 3: Write the generator script and run it**

```js
// scripts/build-pack.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { register } from 'node:module';

// Import the TS baseline via Vite's transform is overkill here; instead we keep
// pack data importable by also exporting a JSON-ready object. Simplest robust
// approach: read through the app's own bundling. To avoid a TS loader, this
// script imports the compiled JSON by requiring the source through tsx if
// available; otherwise hand-run `npm run pack:build` which uses tsx.
register('tsx/esm', import.meta.url);
const { BASELINE_PACK } = await import('../src/lib/pack/baseline.ts');

mkdirSync('public/packs', { recursive: true });
writeFileSync('public/packs/pack-1.json', JSON.stringify(BASELINE_PACK, null, 2) + '\n');
writeFileSync(
  'public/packs/manifest.json',
  JSON.stringify(
    {
      latest: BASELINE_PACK.packVersion,
      schemaVersion: BASELINE_PACK.schemaVersion,
      url: 'pack-1.json',
      publishedAt: BASELINE_PACK.publishedAt,
      summary: BASELINE_PACK.summary,
    },
    null,
    2,
  ) + '\n',
);
console.log('wrote public/packs/{manifest,pack-1}.json');
```

Add to `package.json` scripts and install `tsx` as a dev dependency:

```jsonc
// package.json — add to "scripts"
"pack:build": "node scripts/build-pack.mjs"
```

Run:

```bash
npm install -D tsx
npm run pack:build
```

Expected: writes `public/packs/manifest.json` and `public/packs/pack-1.json`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/build-pack.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add public/packs/manifest.json public/packs/pack-1.json scripts/build-pack.mjs scripts/build-pack.test.ts package.json package-lock.json
git commit -m "feat: publish v1 knowledge pack as static GitHub Pages files"
```

---

## End of Phase 4

The app fetches `packs/manifest.json` on load, shows a revertable banner when a
newer compatible pack exists, and the v1 pack is published. Proceed to Phase 5.

---

# Phase 5 — Offline-first PWA

## Task 21: Add vite-plugin-pwa with an app manifest

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json` / `package-lock.json` (add `vite-plugin-pwa`)
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png` (PWA install icons)

**Caching strategy (per spec):** app shell precached (cache-first); pack
manifest/files network-first with cache fallback.

- [ ] **Step 1: Install the plugin**

```bash
npm install -D vite-plugin-pwa
```

- [ ] **Step 2: Create install icons**

Generate two PNG icons from the existing `public/favicon.svg` (192×192 and
512×512). If no image tooling is available, use any 192/512 PNGs as placeholders
named exactly `public/icons/icon-192.png` and `public/icons/icon-512.png`;
visual polish is not gated by a test.

```bash
# Example using rsvg-convert if available:
mkdir -p public/icons
rsvg-convert -w 192 -h 192 public/favicon.svg -o public/icons/icon-192.png
rsvg-convert -w 512 -h 512 public/favicon.svg -o public/icons/icon-512.png
```

- [ ] **Step 3: Configure the plugin**

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Base path for GitHub Pages project sites; keep in sync with the repo name.
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'SOUL Creator',
        short_name: 'SOUL',
        description: 'Author best-of-breed SOUL.md and AGENTS.md files for Hermes agents.',
        theme_color: '#0e0b1e',
        background_color: '#0e0b1e',
        display: 'standalone',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          {
            // Knowledge packs: fresh when online, last-known when offline.
            urlPattern: ({ url }) => url.pathname.includes('/packs/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'knowledge-packs',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
});
```

Note: preserve any existing fields in `vite.config.ts` (e.g. the `test` block
shown above mirrors the current config — confirm against the real file and keep
its values).

- [ ] **Step 4: Verify the build emits a service worker**

Run: `npm run build`
Expected: build succeeds and `dist/sw.js` + `dist/manifest.webmanifest` are
emitted. Confirm with:

```bash
ls dist/sw.js dist/manifest.webmanifest
```

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts package.json package-lock.json public/icons
git commit -m "feat: make the app an installable offline-first PWA"
```

---

## Task 22: Build assertion test for PWA artifacts

**Files:**
- Create: `scripts/pwa-build.test.ts`

A lightweight guard that the production build emits the service worker and web
manifest. It runs the build once and asserts the artifacts exist.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/pwa-build.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

describe('PWA build artifacts', () => {
  beforeAll(() => {
    execSync('npm run build', { stdio: 'inherit' });
  }, 120_000);

  it('emits a service worker and web manifest', () => {
    expect(existsSync('dist/sw.js')).toBe(true);
    expect(existsSync('dist/manifest.webmanifest')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it passes (build already configured in Task 21)**

Run: `npx vitest run scripts/pwa-build.test.ts`
Expected: PASS (1 test). If the test runner picks this up in the default `npm
test` run and the repeated build is too slow, exclude it from the default
pattern and run it explicitly — see Step 3.

- [ ] **Step 3: Keep the default test run fast**

In `package.json`, scope the default test command to `src` and add a separate
script for build-level tests:

```jsonc
// package.json scripts
"test": "vitest run src",
"test:build": "vitest run scripts"
```

- [ ] **Step 4: Verify both commands**

Run: `npm test && npm run test:build`
Expected: `npm test` runs all `src` unit/component tests (fast); `npm run
test:build` runs the pack-publish and PWA build assertions.

- [ ] **Step 5: Commit**

```bash
git add scripts/pwa-build.test.ts package.json
git commit -m "test: assert PWA build emits service worker and manifest"
```

---

## Task 23: Update README + final full verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README**

Add an "AGENTS.md" bullet to the Use section, a note that the app is an
installable offline PWA, and a "Best-practices updates" subsection explaining
the notify-and-apply pack mechanism and `npm run pack:build`. Keep it concise
and consistent with the existing README voice.

- [ ] **Step 2: Full verification**

Run:

```bash
npm test
npm run test:build
npm run build
npm run lint
```

Expected: all green. This is the project-wide completion gate.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document AGENTS.md tab, PWA install, and pack updates"
```

---

## End of Phase 5 — feature complete

All five phases done: data-driven SOUL parity, AGENTS.md authoring, cross-tab
move, GitHub update mechanism, and an installable offline PWA. Use the
`finishing-a-development-branch` skill to integrate `feat/soul-creator-v2`.

---

## Self-review checklist (run before execution)

- **Spec coverage:** AGENTS tab (T14–15), full mirror scoring/gates (T14),
  offline PWA (T21–22), updatable pack notify-and-apply (T17–20), Hermes +
  agents.md sources baked into the baseline (T5, T14), DocType abstraction
  (T2–8), safe rule engine / no remote code (T3), schemaVersion fallback (T17),
  cross-tab move (T16), legacy migration (T7) — all mapped to tasks.
- **No placeholders:** every code step shows complete code; the only
  intentionally non-coded step is the README prose (T23) and binary icon assets
  (T21), both explicitly described.
- **Type consistency:** `Draft`, `SectionDef`, `Rule`, `GateRule`, `Pack`,
  `DocId`, `DraftScore`, `CategoryScore`, `BannerState`, `UpdateOutcome` are
  defined once and reused with identical shapes across tasks. `scoreDraft`,
  `evaluateGate`, `generate`, `presetsFor`, `checkForUpdate`, `moveLeaksToAgents`
  signatures match every call site.
