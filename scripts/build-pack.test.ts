import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BASELINE_PACK } from '../src/lib/pack/baseline';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

describe('published packs', () => {
  it('pack-1.json matches the bundled baseline', () => {
    expect(JSON.parse(read('../public/packs/pack-1.json'))).toEqual(BASELINE_PACK);
  });

  it('manifest points at the latest pack and carries its metadata', () => {
    const manifest = JSON.parse(read('../public/packs/manifest.json'));
    expect(manifest.latest).toBe(BASELINE_PACK.packVersion);
    expect(manifest.schemaVersion).toBe(BASELINE_PACK.schemaVersion);
    expect(manifest.url).toBe('pack-1.json');
    expect(manifest.publishedAt).toBe(BASELINE_PACK.publishedAt);
    expect(manifest.summary).toBe(BASELINE_PACK.summary);
  });
});
