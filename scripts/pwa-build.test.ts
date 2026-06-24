import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

describe('PWA build artifacts', () => {
  beforeAll(() => {
    execSync('npm run build', { stdio: 'inherit' });
  }, 120_000);

  it('emits a service worker and web manifest', () => {
    expect(existsSync('dist/sw.js')).toBe(true);
    expect(existsSync('dist/manifest.webmanifest')).toBe(true);
  });
});
