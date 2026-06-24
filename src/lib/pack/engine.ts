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

/**
 * Bands are evaluated in array order; the FIRST band whose [min, max] range
 * contains `n` wins. No sorting is applied — array-order-first-match is
 * intentional and ranged bands depend on it. Pack authors must order bands
 * accordingly: open-ended bands high-to-low, ranged bands by range.
 */
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

// Trust boundary: PatternSpec.source strings originate from the first-party,
// structurally-validated knowledge pack and are treated as trusted regex. They
// are NOT sanitized for ReDoS; do not feed user-authored patterns through here.
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
      if (req.length === 0) {
        score = max;
      } else if (isEmptySection(draft, sections, req[0])) {
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
