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

  // Penalty-based categories reward the *absence* of problems, but an empty
  // draft has no content to be portable or hype-free — so they earn nothing.
  const hasContent = id.length > 0 || style.length > 0 || avoid.length > 0 || defaults.length > 0;

  // portability (16) — penalty
  const leaks = findLeaks(text);
  const portability = hasContent ? Math.max(0, 16 - leaks.length * 8) : 0;

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
  const noHype = hasContent ? Math.max(0, 8 - hypeHits * 4) : 0;

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
