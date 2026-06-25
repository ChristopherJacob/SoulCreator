import { cleanLines } from './model';
import type { Draft } from './model';
import type { SectionDef } from './pack/schema';

// These mirror the SOUL portability LEAK patterns in pack/baseline.ts. crossTab is
// bundled code and cannot safely read pack-supplied regexes, so if the pack's leak
// patterns change, update these in tandem.
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
    if (s.kind === 'list') {
      const lines = cleanLines(nextSoul[s.id] as string[] | undefined);
      const keep: string[] = [];
      for (const line of lines) {
        if (isLeak(line)) appendTo(nextAgents, target(line), line);
        else keep.push(line);
      }
      nextSoul[s.id] = keep;
    } else {
      // Single-safe-append for a text section: if the whole field trips a leak
      // pattern, relocate it wholesale and clear the SOUL field.
      const text = typeof nextSoul[s.id] === 'string' ? (nextSoul[s.id] as string).trim() : '';
      if (text && isLeak(text)) {
        appendTo(nextAgents, target(text), text);
        nextSoul[s.id] = '';
      }
    }
  }

  return { soul: nextSoul, agents: nextAgents };
}
