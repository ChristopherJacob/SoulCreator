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

function parseManifest(raw: unknown): Manifest | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.latest !== 'string' || !Number.isFinite(Number(m.latest))) return null;
  if (typeof m.schemaVersion !== 'number') return null;
  if (typeof m.url !== 'string') return null;
  if (typeof m.publishedAt !== 'string') return null;
  if (typeof m.summary !== 'string') return null;
  return raw as Manifest;
}

export async function checkForUpdate(deps: UpdateDeps): Promise<UpdateOutcome> {
  if (!deps.online) return { kind: 'offline' };
  try {
    const mres = await deps.fetch(`${deps.baseUrl}/manifest.json`, { cache: 'no-cache' });
    if (!mres.ok) return { kind: 'error', error: `manifest ${mres.status}` };
    const manifest = parseManifest(await mres.json());
    if (!manifest) return { kind: 'error', error: 'invalid manifest' };
    if (!Number.isFinite(Number(deps.activeVersion))) return { kind: 'error', error: 'invalid active version' };

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
