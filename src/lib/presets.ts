import type { Pack, Preset, DocId } from './pack/schema';

export function presetsFor(pack: Pack, docId: DocId): Preset[] {
  return pack.docTypes[docId].presets;
}
