import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { extractZodColumns } from '../../src/utils/zod-utils';

/**
 * Regression guard for the zod v4 break shipped in 1.1.0.
 *
 * The old implementation branched on `schema instanceof z.ZodEffects`. zod v4
 * removed `ZodEffects`, so the right-hand side was `undefined` and *every*
 * schema that is not object-like threw `TypeError` — including the plain
 * `z.string()` case that is only supposed to return `[]`.
 *
 * These cases must hold identically on zod v3 and v4, so nothing here may
 * reference a version-specific class. See the CI matrix in `.github/workflows/ci.yml`:
 * without this suite a two-major matrix goes green on the broken code.
 */

const COLUMNS = ['id', 'title'];
const schema = z.object({ id: z.number(), title: z.string() });

describe('extractZodColumns — cross-version schema unwrapping', () => {
  it('reads a plain object shape', () => {
    expect(extractZodColumns(schema)).toEqual(COLUMNS);
  });

  it('unwraps .transform() (v3 ZodEffects / v4 ZodPipe)', () => {
    expect(extractZodColumns(schema.transform((v) => v))).toEqual(COLUMNS);
  });

  it('unwraps .optional()', () => {
    expect(extractZodColumns(schema.optional())).toEqual(COLUMNS);
  });

  it('unwraps .nullable()', () => {
    expect(extractZodColumns(schema.nullable())).toEqual(COLUMNS);
  });

  it('unwraps .default()', () => {
    expect(extractZodColumns(schema.default({ id: 0, title: '' }))).toEqual(COLUMNS);
  });

  it('unwraps nested wrappers', () => {
    expect(extractZodColumns(schema.optional().nullable())).toEqual(COLUMNS);
    expect(extractZodColumns(schema.transform((v) => v).optional())).toEqual(COLUMNS);
  });

  // The v4 TypeError hit these hardest: they never reached the `return []`.
  it('returns [] for non-object schemas instead of throwing', () => {
    expect(extractZodColumns(z.string())).toEqual([]);
    expect(extractZodColumns(z.number())).toEqual([]);
    expect(extractZodColumns(z.array(schema))).toEqual([]);
  });

  it('returns [] for null/undefined without throwing', () => {
    expect(extractZodColumns(null as never)).toEqual([]);
    expect(extractZodColumns(undefined as never)).toEqual([]);
  });

  it('caches per schema reference', () => {
    const wrapped = schema.optional();
    expect(extractZodColumns(wrapped)).toBe(extractZodColumns(wrapped));
  });
});
