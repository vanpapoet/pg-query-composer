import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { QueryComposer, DEFAULT_FILTER_COLUMNS } from '../../src/core/query-composer';
import { InvalidColumnError } from '../../src/core/errors';

const NameSchema = z.object({ name: z.string() });

describe('defaultColumns', () => {
  it('exposes the convention as a frozen exported constant', () => {
    expect(DEFAULT_FILTER_COLUMNS).toEqual(['id', 'created_at', 'updated_at', 'deleted_at']);
    expect(Object.isFrozen(DEFAULT_FILTER_COLUMNS)).toBe(true);
  });

  it('accepts the conventional columns by default', () => {
    const qc = new QueryComposer(NameSchema, 't');
    expect(qc.where({ created_at: 1 }).toParam().text).toBe('SELECT * FROM t WHERE created_at = $1');
  });

  it('accepts only schema columns when passed an empty list', () => {
    const qc = new QueryComposer(NameSchema, 't', { defaultColumns: [] });
    expect(() => qc.where({ created_at: 1 })).toThrow(InvalidColumnError);
    expect(qc.where({ name: 'x' }).toParam().text).toContain('name = $1');
  });

  it('supports a different naming convention', () => {
    const qc = new QueryComposer(NameSchema, 't', { defaultColumns: ['inserted_at'] });
    expect(qc.where({ inserted_at: 1 }).toParam().text).toContain('inserted_at = $1');
  });

  it('replaces the defaults rather than extending them', () => {
    const qc = new QueryComposer(NameSchema, 't', { defaultColumns: ['inserted_at'] });
    expect(() => qc.where({ created_at: 1 })).toThrow(InvalidColumnError);
  });

  it('keeps custom defaults out of the exclude() projection', () => {
    const schema = z.object({ id: z.number(), a: z.string(), b: z.string() });
    const qc = new QueryComposer(schema, 't', { defaultColumns: ['zzz'] });
    qc.exclude(['b']);
    expect(qc.toParam().text).toBe('SELECT id, a FROM t');
  });

  it('does not poison the per-schema cache for a default composer', () => {
    // Same schema object, custom composer built first — the cache must only
    // ever hold the fully-default whitelist
    const schema = z.object({ name: z.string() });
    expect(new QueryComposer(schema, 't', { defaultColumns: ['inserted_at'] })).toBeDefined();
    const plain = new QueryComposer(schema, 't');
    expect(plain.where({ created_at: 1 }).toParam().text).toContain('created_at = $1');
  });

  it('does not read a cached default whitelist for a custom composer', () => {
    const schema = z.object({ name: z.string() });
    expect(new QueryComposer(schema, 't')).toBeDefined(); // seeds the cache
    const custom = new QueryComposer(schema, 't', { defaultColumns: [] });
    expect(() => custom.where({ created_at: 1 })).toThrow(InvalidColumnError);
  });

  describe('validation of caller-supplied column names', () => {
    it('rejects an unsafe defaultColumns entry', () => {
      expect(
        () => new QueryComposer(NameSchema, 't', { defaultColumns: ['x; DROP TABLE u'] })
      ).toThrow(/Unsafe column name/);
    });

    it('rejects an unsafe extraColumns entry', () => {
      expect(
        () => new QueryComposer(NameSchema, 't', { extraColumns: ['x; DROP TABLE u'] })
      ).toThrow(/Unsafe column name/);
    });

    it('still accepts a qualified column for joined tables', () => {
      const qc = new QueryComposer(NameSchema, 't', { extraColumns: ['orders.total'] });
      expect(qc.where({ 'orders.total': 5 }).toParam().text).toContain('orders.total = $1');
    });
  });
});
