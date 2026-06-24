// Run this script with: npx tsx scripts/build-pack.mjs
// tsx handles TypeScript imports directly; no separate loader registration needed.
import { writeFileSync, mkdirSync } from 'node:fs';
import { BASELINE_PACK } from '../src/lib/pack/baseline.ts';

mkdirSync('public/packs', { recursive: true });
writeFileSync('public/packs/pack-1.json', JSON.stringify(BASELINE_PACK, null, 2) + '\n');
writeFileSync(
  'public/packs/manifest.json',
  JSON.stringify(
    {
      latest: BASELINE_PACK.packVersion,
      schemaVersion: BASELINE_PACK.schemaVersion,
      url: 'pack-1.json',
      publishedAt: BASELINE_PACK.publishedAt,
      summary: BASELINE_PACK.summary,
    },
    null,
    2,
  ) + '\n',
);
console.log('wrote public/packs/{manifest,pack-1}.json');
