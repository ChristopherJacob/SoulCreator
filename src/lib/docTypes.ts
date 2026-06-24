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
