# SOUL Creator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A slick, local-first React web tool that guides users to author best-of-breed Hermes `SOUL.md` files, with live Markdown preview and a 1–100 quality score.

**Architecture:** Vite + React + TypeScript single-page app. Pure data modules (`model`, `generator`, `scoring`, `presets`, `storage`) contain all logic and are unit-tested with Vitest; React components are thin consumers wired together in `App`. No backend; drafts autosave to `localStorage`.

**Tech Stack:** Vite, React 18, TypeScript, Vitest + @testing-library/react, react-markdown. Hand-rolled CSS.

Spec: `docs/superpowers/specs/2026-06-22-soul-creator-design.md`

---

### Task 1: Scaffold project and test runner

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/vite-env.d.ts`
- Create: `src/App.tsx` (placeholder)

- [ ] **Step 1: Scaffold with Vite**

Run from project root:
```bash
npm create vite@latest . -- --template react-ts
```
If prompted about the non-empty directory, choose "Ignore files and continue".

- [ ] **Step 2: Install dependencies**

```bash
npm install
npm install react-markdown
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Configure Vitest in `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
});
```

- [ ] **Step 4: Create `src/test-setup.ts`**

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 5: Add scripts to `package.json`**

Ensure the `scripts` block contains:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 6: Verify it builds and tests run**

Run: `npm run build`
Expected: build succeeds (clean Vite scaffold).
Run: `npm test`
Expected: "No test files found" (exit 0) — runner is wired.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React TS app with Vitest"
```

---

### Task 2: Data model

**Files:**
- Create: `src/lib/model.ts`

- [ ] **Step 1: Write `src/lib/model.ts`**

```ts
export interface DomainPosture {
  title: string;
  lines: string[];
}

export interface SoulDraft {
  identity: string;
  style: string[];
  avoid: string[];
  defaults: string[];
  domainPosture?: DomainPosture;
  examples?: string[];
}

export const EMPTY_DRAFT: SoulDraft = {
  identity: '',
  style: [],
  avoid: [],
  defaults: [],
};

/** Trim and drop empty entries from a string list. */
export function cleanLines(items: string[] | undefined): string[] {
  return (items ?? []).map((s) => s.trim()).filter(Boolean);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/model.ts
git commit -m "feat: add SoulDraft model"
```

---

### Task 3: Markdown generator

**Files:**
- Create: `src/lib/generator.ts`
- Test: `src/lib/generator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { generateSoul } from './generator';
import { SoulDraft } from './model';

const base: SoulDraft = {
  identity: 'You are Hermes, a pragmatic engineer.',
  style: ['Be direct.', '  '],
  avoid: ['Avoid hype language.'],
  defaults: ['When ambiguous, ask one clarifying question.'],
};

describe('generateSoul', () => {
  it('emits canonical headings and bullets, dropping empty lines', () => {
    const out = generateSoul(base);
    expect(out).toContain('# Personality\nYou are Hermes, a pragmatic engineer.');
    expect(out).toContain('## Style\n- Be direct.');
    expect(out).toContain('## What to avoid\n- Avoid hype language.');
    expect(out).toContain('## Defaults\n- When ambiguous, ask one clarifying question.');
    expect(out).not.toContain('- \n');
    expect(out.endsWith('\n')).toBe(true);
  });

  it('omits sections with no content', () => {
    const out = generateSoul({ identity: 'X', style: [], avoid: [], defaults: [] });
    expect(out).toContain('# Personality\nX');
    expect(out).not.toContain('## Style');
    expect(out).not.toContain('## What to avoid');
  });

  it('includes optional domain posture and examples when present', () => {
    const out = generateSoul({
      ...base,
      domainPosture: { title: 'Code Review', lines: ['Prioritize correctness.'] },
      examples: ['Say when something is a bad idea.'],
    });
    expect(out).toContain('## Code Review\n- Prioritize correctness.');
    expect(out).toContain('## Examples\n- Say when something is a bad idea.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/generator.test.ts`
Expected: FAIL — `generateSoul` not defined.

- [ ] **Step 3: Implement `src/lib/generator.ts`**

```ts
import { SoulDraft, cleanLines } from './model';

function bullets(items: string[] | undefined): string {
  return cleanLines(items).map((s) => `- ${s}`).join('\n');
}

export function generateSoul(draft: SoulDraft): string {
  const blocks: string[] = [];
  blocks.push(`# Personality\n${draft.identity.trim()}`);

  const style = bullets(draft.style);
  if (style) blocks.push(`## Style\n${style}`);

  const avoid = bullets(draft.avoid);
  if (avoid) blocks.push(`## What to avoid\n${avoid}`);

  const defaults = bullets(draft.defaults);
  if (defaults) blocks.push(`## Defaults\n${defaults}`);

  if (draft.domainPosture) {
    const title = draft.domainPosture.title.trim();
    const lines = bullets(draft.domainPosture.lines);
    if (title && lines) blocks.push(`## ${title}\n${lines}`);
  }

  const examples = bullets(draft.examples);
  if (examples) blocks.push(`## Examples\n${examples}`);

  return blocks.join('\n\n') + '\n';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/generator.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/generator.ts src/lib/generator.test.ts
git commit -m "feat: add SOUL.md markdown generator"
```

---

### Task 4: Scoring + export-gate engine

**Files:**
- Create: `src/lib/scoring.ts`
- Test: `src/lib/scoring.test.ts`

This is the correctness core. `scoreSoul` returns a 0–100 score plus per-category breakdown; `exportGate` enforces the minimum quality bar. The Portability check (penalizing AGENTS.md-type leakage) is the signature Hermes-correctness signal.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/scoring.test.ts`
Expected: FAIL — `scoreSoul` not defined.

- [ ] **Step 3: Implement `src/lib/scoring.ts`**

```ts
import { SoulDraft, cleanLines } from './model';

export interface CategoryScore {
  key: string;
  label: string;
  score: number;
  max: number;
  tip: string;
}

export interface SoulScore {
  score: number;
  categories: CategoryScore[];
}

const STRONG_VERB =
  /^(be|say|avoid|prefer|explain|ask|distinguish|point|prioritize|keep|use|focus|challenge|state|admit|flag|push|default|treat|assume|lead|stay|surface|name|call)\b/i;

const HYPE =
  /\b(blazing[- ]?fast|revolutionary|world[- ]?class|cutting[- ]?edge|game[- ]?changer|best[- ]?in[- ]?class|seamless(ly)?|synergy|10x|next[- ]?generation|state[- ]?of[- ]?the[- ]?art|paradigm)\b/gi;

const LEAK_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'file path', re: /(\.{0,2}\/)?[\w-]+\/[\w./-]+/g },
  { name: 'port', re: /:\d{2,5}\b/g },
  { name: 'command', re: /\b(npm|npx|yarn|pnpm|pip|pytest|git|docker|make|cargo|go run|curl)\b/gi },
  { name: 'env/flag token', re: /\b[A-Z_]{3,}=|--[a-z][\w-]+/g },
];

export function findLeaks(text: string): string[] {
  const hits: string[] = [];
  for (const { name, re } of LEAK_PATTERNS) {
    const m = text.match(re);
    if (m) hits.push(`${name}: ${m[0]}`);
  }
  return hits;
}

function allText(draft: SoulDraft): string {
  return [
    draft.identity,
    ...cleanLines(draft.style),
    ...cleanLines(draft.avoid),
    ...cleanLines(draft.defaults),
    draft.domainPosture?.title ?? '',
    ...cleanLines(draft.domainPosture?.lines),
    ...cleanLines(draft.examples),
  ].join('\n');
}

function totalLines(draft: SoulDraft): number {
  return (
    cleanLines(draft.style).length +
    cleanLines(draft.avoid).length +
    cleanLines(draft.defaults).length +
    cleanLines(draft.domainPosture?.lines).length +
    cleanLines(draft.examples).length
  );
}

export function scoreSoul(draft: SoulDraft): SoulScore {
  const id = draft.identity.trim();
  const style = cleanLines(draft.style);
  const avoid = cleanLines(draft.avoid);
  const defaults = cleanLines(draft.defaults);
  const text = allText(draft);

  // identity (18)
  let identity = id.length >= 20 ? 18 : id.length > 0 ? 9 : 0;

  // style specificity (18)
  let styleScore = 0;
  if (style.length > 0) {
    const concrete = style.filter((l) => STRONG_VERB.test(l)).length;
    styleScore = Math.round((concrete / style.length) * 18);
    if (style.length < 2) styleScore = Math.min(styleScore, 9);
  }

  // avoid clarity (12)
  const avoidScore = avoid.length === 0 ? 0 : avoid.length === 1 ? 7 : 12;

  // defaults (12)
  const defaultsScore = defaults.length === 0 ? 0 : defaults.length === 1 ? 7 : 12;

  // portability (16) — penalty
  const leaks = findLeaks(text);
  const portability = Math.max(0, 16 - leaks.length * 8);

  // conciseness (12) — sweet spot 4–8 lines
  const total = totalLines(draft);
  let conciseness = 0;
  if (total === 0) conciseness = 0;
  else if (total >= 4 && total <= 8) conciseness = 12;
  else if (total > 8 && total <= 12) conciseness = 8;
  else if (total > 12) conciseness = 5;
  else conciseness = 8; // 1–3 lines: usable but thin

  // no-hype (8) — penalty
  const hypeHits = (text.match(HYPE) || []).length;
  const noHype = Math.max(0, 8 - hypeHits * 4);

  // structure (4)
  const structure = id.length > 0 ? (style.length > 0 ? 4 : 2) : 0;

  const categories: CategoryScore[] = [
    { key: 'identity', label: 'Identity', score: identity, max: 18,
      tip: identity === 18 ? 'Clear identity statement.' : 'Write a 1–3 sentence identity describing who Hermes is.' },
    { key: 'style', label: 'Style specificity', score: styleScore, max: 18,
      tip: styleScore >= 14 ? 'Concrete, imperative style lines.' : 'Use imperative verbs ("Be direct.", "Say when…"); add at least 2.' },
    { key: 'avoid', label: 'Avoid clarity', score: avoidScore, max: 12,
      tip: avoidScore === 12 ? 'Clear stylistic boundaries.' : 'List a couple of things the agent should never do stylistically.' },
    { key: 'defaults', label: 'Defaults', score: defaultsScore, max: 12,
      tip: defaultsScore === 12 ? 'Defines behavior under ambiguity.' : 'Describe how the agent behaves when input is underspecified.' },
    { key: 'portability', label: 'Portability', score: portability, max: 16,
      tip: leaks.length === 0 ? 'No task-specific leakage.' : `Move to AGENTS.md — found ${leaks.join('; ')}.` },
    { key: 'conciseness', label: 'Conciseness', score: conciseness, max: 12,
      tip: total >= 4 && total <= 8 ? 'In the 4–8 line sweet spot.' : total > 8 ? 'Trim toward 4–8 defining lines.' : 'Add a few more defining lines (aim for 4–8).' },
    { key: 'noHype', label: 'No hype', score: noHype, max: 8,
      tip: hypeHits === 0 ? 'No marketing language.' : 'Remove hype words (e.g. "blazing fast", "world-class").' },
    { key: 'structure', label: 'Structure', score: structure, max: 4,
      tip: structure === 4 ? 'Canonical Markdown structure.' : 'Add an identity and at least one style line.' },
  ];

  const score = categories.reduce((sum, c) => sum + c.score, 0);
  return { score, categories };
}

export interface GateResult {
  ok: boolean;
  reasons: string[];
}

export function exportGate(draft: SoulDraft): GateResult {
  const reasons: string[] = [];
  if (draft.identity.trim().length < 1) reasons.push('Add an Identity statement.');
  if (cleanLines(draft.style).length < 1) reasons.push('Add at least one Style line.');
  const leaks = findLeaks(allText(draft));
  if (leaks.length > 0) reasons.push(`Remove task-specific content (belongs in AGENTS.md): ${leaks.join('; ')}.`);
  return { ok: reasons.length === 0, reasons };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/scoring.test.ts`
Expected: PASS (all tests). If the strong-draft score test fails, confirm `strong` has no accidental leak tokens; adjust nothing in the test — the engine should clear 80.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts src/lib/scoring.test.ts
git commit -m "feat: add SOUL.md scoring and export-gate engine"
```

---

### Task 5: Preset library

**Files:**
- Create: `src/lib/presets.ts`
- Test: `src/lib/presets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { PRESETS } from './presets';
import { exportGate } from './scoring';

describe('PRESETS', () => {
  it('includes the documented personas plus a blank slate', () => {
    const ids = PRESETS.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining(['pragmatic-engineer', 'research-partner', 'teacher', 'tough-reviewer', 'blank']),
    );
  });

  it('non-blank presets pass the export gate out of the box', () => {
    for (const p of PRESETS.filter((p) => p.id !== 'blank')) {
      expect(exportGate(p.draft).ok, `${p.id} should be export-ready`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/presets.test.ts`
Expected: FAIL — `PRESETS` not defined.

- [ ] **Step 3: Implement `src/lib/presets.ts`**

```ts
import { SoulDraft, EMPTY_DRAFT } from './model';

export interface Preset {
  id: string;
  name: string;
  description: string;
  draft: SoulDraft;
}

export const PRESETS: Preset[] = [
  {
    id: 'pragmatic-engineer',
    name: 'Pragmatic Engineer',
    description: 'Direct, concise, willing to say when something is a bad idea.',
    draft: {
      identity: 'You are Hermes, a pragmatic senior engineer who values clarity and correctness over ceremony.',
      style: ['Be direct.', 'Be concise unless complexity requires depth.', 'Say when something is a bad idea.'],
      avoid: ['Avoid hype language.', 'Avoid hedging when you are confident.'],
      defaults: ['When a request is ambiguous, ask one focused clarifying question.', 'Prefer the simplest solution that is correct.'],
    },
  },
  {
    id: 'research-partner',
    name: 'Research Partner',
    description: 'Explores possibilities without pretending certainty.',
    draft: {
      identity: 'You are Hermes, a research partner who thinks alongside the user and reasons carefully about open problems.',
      style: ['Explore possibilities without pretending certainty.', 'Distinguish speculation from evidence.', 'Ask clarifying questions when the idea space is underspecified.'],
      avoid: ['Avoid overclaiming.', 'Avoid presenting guesses as facts.'],
      defaults: ['When evidence is thin, state confidence explicitly.', 'Offer multiple framings before converging.'],
    },
  },
  {
    id: 'teacher',
    name: 'Teacher / Explainer',
    description: 'Explains clearly, builds from intuition to detail.',
    draft: {
      identity: 'You are Hermes, a patient teacher who makes hard ideas approachable.',
      style: ['Explain clearly using examples when helpful.', 'Build from intuition to details.', 'Do not assume prior knowledge unless signaled.'],
      avoid: ['Avoid jargon without definition.', 'Avoid condescension.'],
      defaults: ['When a concept is broad, start with the simplest accurate model.', 'Check understanding before adding depth.'],
    },
  },
  {
    id: 'tough-reviewer',
    name: 'Tough Reviewer',
    description: 'Prioritizes correctness over harmony; names risks directly.',
    draft: {
      identity: 'You are Hermes, a rigorous reviewer who protects quality and tells the user what they need to hear.',
      style: ['Point out weak assumptions directly.', 'Prioritize correctness over harmony.', 'Be explicit about risks and tradeoffs.'],
      avoid: ['Avoid rubber-stamping.', 'Avoid softening real problems.'],
      defaults: ['When something looks wrong, flag it even if unprompted.', 'Separate blocking issues from nits.'],
    },
  },
  {
    id: 'blank',
    name: 'Blank Slate',
    description: 'Start from an empty file.',
    draft: { ...EMPTY_DRAFT },
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/presets.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/presets.ts src/lib/presets.test.ts
git commit -m "feat: add persona preset library"
```

---

### Task 6: localStorage persistence

**Files:**
- Create: `src/lib/storage.ts`
- Test: `src/lib/storage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: FAIL — `loadDraft` not defined.

- [ ] **Step 3: Implement `src/lib/storage.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat: add localStorage draft persistence"
```

---

### Task 7: List editor primitive

A small reusable control for editing a `string[]` (used by Style, Avoid, Defaults, Examples). Build it before the form.

**Files:**
- Create: `src/components/ListEditor.tsx`
- Test: `src/components/ListEditor.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ListEditor } from './ListEditor';

describe('ListEditor', () => {
  it('renders existing items and adds a new one', async () => {
    const onChange = vi.fn();
    render(<ListEditor label="Style" items={['Be direct.']} onChange={onChange} placeholder="Add a line" />);
    expect(screen.getByDisplayValue('Be direct.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /add style/i }));
    expect(onChange).toHaveBeenCalledWith(['Be direct.', '']);
  });

  it('removes an item', async () => {
    const onChange = vi.fn();
    render(<ListEditor label="Style" items={['a', 'b']} onChange={onChange} placeholder="x" />);
    await userEvent.click(screen.getAllByRole('button', { name: /remove/i })[0]);
    expect(onChange).toHaveBeenCalledWith(['b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ListEditor.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/ListEditor.tsx`**

```tsx
interface Props {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}

export function ListEditor({ label, items, onChange, placeholder }: Props) {
  const update = (i: number, value: string) =>
    onChange(items.map((item, idx) => (idx === i ? value : item)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, '']);

  return (
    <div className="list-editor">
      {items.map((item, i) => (
        <div className="list-row" key={i}>
          <input
            value={item}
            placeholder={placeholder}
            onChange={(e) => update(i, e.target.value)}
          />
          <button type="button" aria-label={`Remove ${label} item`} onClick={() => remove(i)}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="add-btn" onClick={add}>
        + Add {label}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ListEditor.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ListEditor.tsx src/components/ListEditor.test.tsx
git commit -m "feat: add ListEditor primitive"
```

---

### Task 8: Builder form

**Files:**
- Create: `src/components/BuilderForm.tsx`
- Test: `src/components/BuilderForm.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuilderForm } from './BuilderForm';
import { EMPTY_DRAFT } from '../lib/model';

describe('BuilderForm', () => {
  it('edits the identity field', async () => {
    const onChange = vi.fn();
    render(<BuilderForm draft={EMPTY_DRAFT} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText(/identity/i), 'Hi');
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)![0];
    expect(last.identity).toContain('i');
  });

  it('reveals the optional domain posture section on demand', async () => {
    render(<BuilderForm draft={EMPTY_DRAFT} onChange={vi.fn()} />);
    expect(screen.queryByLabelText(/domain title/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /add domain posture/i }));
    expect(screen.getByLabelText(/domain title/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/BuilderForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/BuilderForm.tsx`**

```tsx
import { SoulDraft } from '../lib/model';
import { ListEditor } from './ListEditor';

interface Props {
  draft: SoulDraft;
  onChange: (draft: SoulDraft) => void;
}

export function BuilderForm({ draft, onChange }: Props) {
  const set = (patch: Partial<SoulDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="builder">
      <label className="field">
        <span>Identity</span>
        <textarea
          aria-label="Identity"
          rows={3}
          placeholder="Who is Hermes? e.g. You are Hermes, a pragmatic engineer…"
          value={draft.identity}
          onChange={(e) => set({ identity: e.target.value })}
        />
      </label>

      <section className="field">
        <span>Style — how it sounds</span>
        <ListEditor label="Style" items={draft.style} placeholder="Be direct."
          onChange={(style) => set({ style })} />
      </section>

      <section className="field">
        <span>What to avoid</span>
        <ListEditor label="Avoid" items={draft.avoid} placeholder="Avoid hype language."
          onChange={(avoid) => set({ avoid })} />
      </section>

      <section className="field">
        <span>Defaults — behavior under ambiguity</span>
        <ListEditor label="Defaults" items={draft.defaults} placeholder="When ambiguous, ask one question."
          onChange={(defaults) => set({ defaults })} />
      </section>

      {draft.domainPosture ? (
        <section className="field optional">
          <label>
            <span>Domain title</span>
            <input aria-label="Domain title" value={draft.domainPosture.title}
              placeholder="e.g. Code Review"
              onChange={(e) => set({ domainPosture: { ...draft.domainPosture!, title: e.target.value } })} />
          </label>
          <ListEditor label="Domain line" items={draft.domainPosture.lines} placeholder="Prioritize correctness."
            onChange={(lines) => set({ domainPosture: { ...draft.domainPosture!, lines } })} />
          <button type="button" className="remove-section" onClick={() => set({ domainPosture: undefined })}>
            Remove domain posture
          </button>
        </section>
      ) : (
        <button type="button" className="add-section"
          onClick={() => set({ domainPosture: { title: '', lines: [''] } })}>
          + Add domain posture
        </button>
      )}

      {draft.examples ? (
        <section className="field optional">
          <span>Examples</span>
          <ListEditor label="Example" items={draft.examples} placeholder="Say when something is a bad idea."
            onChange={(examples) => set({ examples })} />
          <button type="button" className="remove-section" onClick={() => set({ examples: undefined })}>
            Remove examples
          </button>
        </section>
      ) : (
        <button type="button" className="add-section" onClick={() => set({ examples: [''] })}>
          + Add examples
        </button>
      )}
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
git commit -m "feat: add builder form with optional sections"
```

---

### Task 9: Preset picker

**Files:**
- Create: `src/components/PresetPicker.tsx`
- Test: `src/components/PresetPicker.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PresetPicker } from './PresetPicker';
import { PRESETS } from '../lib/presets';

describe('PresetPicker', () => {
  it('applies a preset draft when clicked', async () => {
    const onApply = vi.fn();
    render(<PresetPicker onApply={onApply} />);
    await userEvent.click(screen.getByRole('button', { name: /pragmatic engineer/i }));
    const expected = PRESETS.find((p) => p.id === 'pragmatic-engineer')!.draft;
    expect(onApply).toHaveBeenCalledWith(expected);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PresetPicker.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/PresetPicker.tsx`**

```tsx
import { PRESETS } from '../lib/presets';
import { SoulDraft } from '../lib/model';

interface Props {
  onApply: (draft: SoulDraft) => void;
}

export function PresetPicker({ onApply }: Props) {
  return (
    <div className="presets">
      {PRESETS.map((p) => (
        <button key={p.id} type="button" className="preset" title={p.description}
          onClick={() => onApply({ ...p.draft })}>
          {p.name}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/PresetPicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PresetPicker.tsx src/components/PresetPicker.test.tsx
git commit -m "feat: add preset picker"
```

---

### Task 10: Score panel

**Files:**
- Create: `src/components/ScorePanel.tsx`
- Test: `src/components/ScorePanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScorePanel } from './ScorePanel';
import { scoreSoul } from '../lib/scoring';
import { PRESETS } from '../lib/presets';

describe('ScorePanel', () => {
  it('shows the total score and category rows', () => {
    const result = scoreSoul(PRESETS[0].draft);
    render(<ScorePanel result={result} />);
    expect(screen.getByText(String(result.score))).toBeInTheDocument();
    expect(screen.getByText(/identity/i)).toBeInTheDocument();
    expect(screen.getByText(/portability/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ScorePanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/ScorePanel.tsx`**

```tsx
import { SoulScore } from '../lib/scoring';

interface Props {
  result: SoulScore;
}

function tier(score: number): string {
  if (score >= 80) return 'great';
  if (score >= 60) return 'ok';
  return 'weak';
}

export function ScorePanel({ result }: Props) {
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
            <p className="score-tip">{c.tip}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ScorePanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ScorePanel.tsx src/components/ScorePanel.test.tsx
git commit -m "feat: add score panel"
```

---

### Task 11: Preview + export bar with gates

**Files:**
- Create: `src/components/PreviewPane.tsx`
- Test: `src/components/PreviewPane.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreviewPane } from './PreviewPane';
import { EMPTY_DRAFT } from '../lib/model';
import { PRESETS } from '../lib/presets';

describe('PreviewPane', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('disables copy and shows gate reasons for an empty draft', () => {
    render(<PreviewPane draft={EMPTY_DRAFT} />);
    expect(screen.getByRole('button', { name: /copy/i })).toBeDisabled();
    expect(screen.getByText(/add an identity/i)).toBeInTheDocument();
  });

  it('enables copy for a strong preset draft', async () => {
    render(<PreviewPane draft={PRESETS[0].draft} />);
    const copy = screen.getByRole('button', { name: /copy/i });
    expect(copy).toBeEnabled();
    await userEvent.click(copy);
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PreviewPane.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/PreviewPane.tsx`**

```tsx
import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { SoulDraft } from '../lib/model';
import { generateSoul } from '../lib/generator';
import { exportGate } from '../lib/scoring';

interface Props {
  draft: SoulDraft;
}

export function PreviewPane({ draft }: Props) {
  const markdown = useMemo(() => generateSoul(draft), [draft]);
  const gate = useMemo(() => exportGate(draft), [draft]);
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
    a.download = 'SOUL.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="preview-pane">
      <div className="export-bar">
        <button type="button" onClick={copy} disabled={!gate.ok}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button type="button" onClick={download} disabled={!gate.ok}>
          Download SOUL.md
        </button>
      </div>
      {!gate.ok && (
        <ul className="gate-reasons">
          {gate.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
      <div className="preview-markdown">
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </div>
      <details className="preview-raw">
        <summary>Raw Markdown</summary>
        <pre>{markdown}</pre>
      </details>
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
git commit -m "feat: add preview pane with export gates"
```

---

### Task 12: App composition + autosave

**Files:**
- Modify: `src/App.tsx` (replace scaffold)
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App', () => {
  beforeEach(() => localStorage.clear());

  it('applies a preset and reflects it in score and preview', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /pragmatic engineer/i }));
    // export becomes enabled once a strong preset is loaded
    expect(screen.getByRole('button', { name: /download soul\.md/i })).toBeEnabled();
    // preview shows the identity heading text
    expect(screen.getAllByText(/pragmatic/i).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — App still renders the Vite scaffold.

- [ ] **Step 3: Implement `src/App.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { SoulDraft, EMPTY_DRAFT } from './lib/model';
import { scoreSoul } from './lib/scoring';
import { loadDraft, saveDraft } from './lib/storage';
import { BuilderForm } from './components/BuilderForm';
import { PresetPicker } from './components/PresetPicker';
import { ScorePanel } from './components/ScorePanel';
import { PreviewPane } from './components/PreviewPane';
import './App.css';

export default function App() {
  const [draft, setDraft] = useState<SoulDraft>(() => loadDraft() ?? EMPTY_DRAFT);
  const score = useMemo(() => scoreSoul(draft), [draft]);

  useEffect(() => {
    const id = setTimeout(() => saveDraft(draft), 300);
    return () => clearTimeout(id);
  }, [draft]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>SOUL Creator</h1>
        <p>Craft a best-of-breed <code>SOUL.md</code> for your Hermes agent.</p>
      </header>

      <PresetPicker onApply={setDraft} />

      <main className="panes">
        <section className="pane pane-left">
          <BuilderForm draft={draft} onChange={setDraft} />
        </section>
        <section className="pane pane-right">
          <PreviewPane draft={draft} />
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all test files PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: compose app with autosave and live score"
```

---

### Task 13: Visual design (slick theme)

**Files:**
- Modify: `src/App.css` (replace scaffold styles)
- Modify: `src/index.css` (base reset + theme tokens)

- [ ] **Step 1: Replace `src/index.css`**

```css
:root {
  --bg: #0f1117;
  --surface: #171a23;
  --surface-2: #1f2330;
  --border: #2a2f3d;
  --text: #e6e8ee;
  --muted: #9aa1b2;
  --accent: #7c5cff;
  --accent-2: #29d3c2;
  --great: #29d3c2;
  --ok: #f2c14e;
  --weak: #f26d6d;
  --radius: 12px;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); }
input, textarea {
  width: 100%; background: var(--surface-2); color: var(--text);
  border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font: inherit;
}
input:focus, textarea:focus { outline: 2px solid var(--accent); border-color: transparent; }
button { cursor: pointer; font: inherit; }
button:disabled { opacity: 0.45; cursor: not-allowed; }
code { background: var(--surface-2); padding: 1px 5px; border-radius: 5px; }
```

- [ ] **Step 2: Replace `src/App.css`**

```css
.app { max-width: 1200px; margin: 0 auto; padding: 24px 20px 64px; }
.app-header h1 {
  margin: 0; font-size: 28px;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.app-header p { color: var(--muted); margin: 4px 0 16px; }

.presets { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.preset {
  background: var(--surface-2); color: var(--text); border: 1px solid var(--border);
  border-radius: 999px; padding: 7px 14px;
}
.preset:hover { border-color: var(--accent); }

.panes { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
.pane { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; }
@media (max-width: 880px) { .panes { grid-template-columns: 1fr; } }

.field { display: block; margin-bottom: 18px; }
.field > span { display: block; font-size: 13px; color: var(--muted); margin-bottom: 6px; letter-spacing: 0.02em; }
.list-row { display: flex; gap: 8px; margin-bottom: 6px; }
.list-row button { background: transparent; color: var(--muted); border: 1px solid var(--border); border-radius: 8px; width: 36px; }
.add-btn, .add-section, .remove-section {
  background: transparent; color: var(--accent); border: 1px dashed var(--border); border-radius: 8px; padding: 6px 10px;
}
.add-section { display: inline-block; margin-bottom: 18px; }
.optional { border-left: 2px solid var(--accent); padding-left: 12px; }

.export-bar { display: flex; gap: 8px; margin-bottom: 12px; }
.export-bar button { background: var(--accent); color: #fff; border: none; border-radius: 8px; padding: 9px 16px; }
.export-bar button:last-child { background: var(--surface-2); color: var(--text); border: 1px solid var(--border); }
.gate-reasons { background: rgba(242,109,109,0.1); border: 1px solid var(--weak); border-radius: 8px; color: var(--weak); font-size: 13px; padding: 8px 12px 8px 28px; margin: 0 0 12px; }
.preview-markdown { background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 14px 18px; }
.preview-markdown h1 { font-size: 20px; } .preview-markdown h2 { font-size: 15px; color: var(--accent-2); }
.preview-raw { margin-top: 10px; color: var(--muted); }
.preview-raw pre { white-space: pre-wrap; background: var(--surface-2); padding: 12px; border-radius: 8px; }

.score-panel { margin-top: 18px; }
.score-gauge { display: flex; align-items: baseline; gap: 4px; }
.score-number { font-size: 44px; font-weight: 700; }
.tier-great .score-number { color: var(--great); }
.tier-ok .score-number { color: var(--ok); }
.tier-weak .score-number { color: var(--weak); }
.score-max { color: var(--muted); }
.score-rows { list-style: none; padding: 0; margin: 12px 0 0; }
.score-row { margin-bottom: 10px; }
.score-row-head { display: flex; justify-content: space-between; font-size: 13px; }
.score-bar { background: var(--surface-2); border-radius: 999px; height: 6px; margin: 4px 0; overflow: hidden; }
.score-bar-fill { background: linear-gradient(90deg, var(--accent), var(--accent-2)); height: 100%; }
.score-tip { color: var(--muted); font-size: 12px; margin: 2px 0 0; }

.app-footer { color: var(--muted); font-size: 13px; margin-top: 28px; text-align: center; }
```

- [ ] **Step 3: Visual check**

Run: `npm run dev` and open the printed URL.
Expected: two-pane dark UI; clicking a preset fills the form, updates preview + score; export buttons enable for strong drafts; layout collapses to one column under ~880px.

- [ ] **Step 4: Commit**

```bash
git add src/index.css src/App.css
git commit -m "style: add slick dark two-pane theme"
```

---

### Task 14: README and final verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# SOUL Creator

A slick, local-first web tool for authoring best-of-breed [Hermes](https://hermes-agent.nousresearch.com) `SOUL.md` files — your agent's durable identity (tone, voice, boundaries, defaults).

## Why
`SOUL.md` goes into slot #1 of the Hermes system prompt. It should be portable identity, not project detail (that belongs in `AGENTS.md`). SOUL Creator guides you to the canonical structure (Identity → Style → What to avoid → Defaults), scores the draft 1–100, and blocks export until it clears the quality bar — including a portability check that flags task-specific leakage.

## Develop
```bash
npm install
npm run dev      # start the app
npm test         # run the test suite
npm run build    # production build
```

## Use
1. Pick a preset or start blank.
2. Edit Identity, Style, Avoid, Defaults (add optional Domain Posture / Examples).
3. Watch the live preview and score.
4. Copy or Download `SOUL.md`, then place it at `~/.hermes/SOUL.md`.
```

- [ ] **Step 2: Full verification**

Run: `npm test`
Expected: all suites PASS.
Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Self-Review (completed during authoring)

- **Spec coverage:** model→T2, generator→T3, scoring+portability+gates→T4, presets→T5, storage→T6, builder/optional sections→T7-8, presets UI→T9, score panel→T10, preview+export gates→T11, app/autosave→T12, slick theme→T13, README→T14. PWA explicitly out of scope. All spec sections mapped.
- **Type consistency:** `SoulDraft`, `cleanLines`, `generateSoul`, `scoreSoul`/`SoulScore`/`CategoryScore`, `exportGate`/`GateResult`, `findLeaks`, `PRESETS`/`Preset`, `loadDraft`/`saveDraft`/`STORAGE_KEY` — names used identically across all tasks.
- **Placeholder scan:** no TBDs; every code step is complete and runnable.
```
