import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Guards the published `exports` map against the failure shipped in v1.0.2:
 * every subpath pointed at `./dist/<mod>/index.js`, but no `src/<mod>/index.ts`
 * existed, so `import 'pg-query-composer/pg'` threw MODULE_NOT_FOUND for every
 * consumer while the test suite stayed green (tests import `src/` directly).
 *
 * Checked against `src/` rather than `dist/` so the guard works without a build.
 */

const ROOT = resolve(__dirname, '../..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  exports: Record<string, { types?: string; default?: string } | string>;
  main: string;
  types: string;
};

/** `./dist/pg/index.js` -> `src/pg/index.ts` */
function toSourcePath(distPath: string): string {
  return distPath
    .replace(/^\.\/dist\//, 'src/')
    .replace(/\.d\.ts$/, '.ts')
    .replace(/\.js$/, '.ts');
}

const subpathEntries = Object.entries(pkg.exports).filter(
  ([subpath]) => subpath !== './package.json'
);

describe('package.json exports map', () => {
  it('declares every documented subpath', () => {
    expect(Object.keys(pkg.exports).sort()).toEqual([
      '.',
      './composition',
      './package.json',
      './pg',
      './relations',
      './subquery',
      './types',
    ]);
  });

  it.each(subpathEntries)('%s resolves to an existing source module', (_subpath, target) => {
    const entry = target as { types?: string; default?: string };

    // A bare string target would resolve at runtime but leave TypeScript
    // consumers on node16 resolution without declarations.
    expect(entry.types, 'missing "types" condition').toBeTruthy();
    expect(entry.default, 'missing "default" condition').toBeTruthy();

    expect(existsSync(join(ROOT, toSourcePath(entry.default!)))).toBe(true);
    expect(existsSync(join(ROOT, toSourcePath(entry.types!)))).toBe(true);
  });

  it('keeps main/types in sync with the "." export', () => {
    const root = pkg.exports['.'] as { types: string; default: string };
    expect(root.default).toBe('./' + pkg.main);
    expect(root.types).toBe('./' + pkg.types);
  });

  it('re-exports every subpath from the root entry', async () => {
    const root = await import('../../src/index');

    for (const [subpath, target] of subpathEntries) {
      if (subpath === '.') continue;
      const mod = (await import('../../' + toSourcePath((target as { default: string }).default))) as Record<
        string,
        unknown
      >;

      for (const name of Object.keys(mod)) {
        expect(
          (root as Record<string, unknown>)[name],
          `${name} missing from root entry (exported by ${subpath})`
        ).toBeDefined();
      }
    }
  });
});
