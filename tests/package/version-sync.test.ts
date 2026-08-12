import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { VERSION } from '../../src/index';

/**
 * `VERSION` is hand-written in src/index.ts, so it silently drifts from
 * package.json on every release (it still read 1.0.2 after 1.0.2 shipped).
 */

const ROOT = resolve(__dirname, '../..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string };
const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');

describe('version', () => {
  it('matches package.json', () => {
    expect(VERSION).toBe(pkg.version);
  });

  it('has a CHANGELOG entry', () => {
    expect(changelog).toContain(`## [${pkg.version}]`);
  });
});
