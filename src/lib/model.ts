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
