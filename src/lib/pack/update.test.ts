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

  it('errors on a malformed manifest (non-numeric latest)', async () => {
    const manifest = { latest: '1.2.3', schemaVersion: SUPPORTED_SCHEMA_VERSION, url: 'pack.json', publishedAt: 'x', summary: 's' };
    const out = await checkForUpdate({ ...base, fetch: fetchReturning(manifest, null) });
    expect(out.kind).toBe('error');
  });

  it('errors on a manifest missing fields', async () => {
    const out = await checkForUpdate({ ...base, fetch: fetchReturning({ latest: '2' }, null) });
    expect(out.kind).toBe('error');
  });
});
