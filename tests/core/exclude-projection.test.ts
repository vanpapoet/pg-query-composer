import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { QueryComposer } from '../../src/core/query-composer';
import { InvalidColumnError } from '../../src/core/errors';

const TestSchema = z.object({
  id: z.number(),
  email: z.string(),
  password: z.string(),
});

describe('exclude() projection', () => {
  it('selects only the schema columns that survive', () => {
    const qc = new QueryComposer(TestSchema, 'users');
    qc.exclude(['password']);
    expect(qc.toParam().text).toBe('SELECT id, email FROM users');
  });

  it('does not select conventional columns the schema never declared', () => {
    const qc = new QueryComposer(TestSchema, 'users');
    qc.exclude(['password']);
    const { text } = qc.toParam();
    // created_at/updated_at/deleted_at are filterable by convention, but the
    // table is not guaranteed to have them — projecting them breaks the query
    expect(text).not.toContain('created_at');
    expect(text).not.toContain('updated_at');
    expect(text).not.toContain('deleted_at');
  });

  it('emits a column declared by both the schema and the defaults only once', () => {
    const qc = new QueryComposer(TestSchema, 'users');
    qc.exclude(['password']);
    const cols = qc.toParam().text.replace('SELECT ', '').replace(' FROM users', '').split(', ');
    expect(cols).toEqual([...new Set(cols)]);
    expect(cols.filter((c) => c === 'id')).toHaveLength(1);
  });

  it('includes extraColumns in the projection', () => {
    const qc = new QueryComposer(TestSchema, 'users', { extraColumns: ['tenant_id'] });
    qc.exclude(['password']);
    expect(qc.toParam().text).toBe('SELECT id, email, tenant_id FROM users');
  });

  it('keeps every schema column when excluding a convention-only column', () => {
    const qc = new QueryComposer(TestSchema, 'users');
    qc.exclude(['deleted_at']);
    expect(qc.toParam().text).toBe('SELECT id, email, password FROM users');
  });

  it('throws on an unknown column when strict, instead of silently returning it', () => {
    const qc = new QueryComposer(TestSchema, 'users');
    expect(() => qc.exclude(['pasword'])).toThrow(InvalidColumnError);
  });

  it('skips unknown columns when strict is off', () => {
    const qc = new QueryComposer(TestSchema, 'users', { strict: false });
    qc.exclude(['nope']);
    expect(qc.toParam().text).toBe('SELECT * FROM users');
  });

  it('throws rather than falling back to SELECT * when nothing is left', () => {
    const qc = new QueryComposer(TestSchema, 'users');
    qc.exclude(['id', 'email', 'password']);
    expect(() => qc.toParam()).toThrow(/no columns left to select/);
  });

  it('throws when the schema declares no columns to expand', () => {
    const qc = new QueryComposer(z.string(), 'users');
    qc.exclude(['deleted_at']);
    expect(() => qc.toParam()).toThrow(/no columns left to select/);
  });

  it('does not repeat a column in the InvalidColumnError hint', () => {
    const qc = new QueryComposer(TestSchema, 'users');
    let message = '';
    try {
      qc.where({ nope: 1 });
    } catch (err) {
      message = (err as Error).message;
    }
    const listed = message.split('Allowed columns: ')[1].split(', ');
    expect(listed).toEqual([...new Set(listed)]);
  });

  it('leaves COUNT queries on SELECT COUNT(*)', () => {
    const qc = new QueryComposer(TestSchema, 'users');
    qc.exclude(['password']);
    expect(qc.toCountParam().text).toBe('SELECT COUNT(*) AS total FROM users');
  });

  it('survives clone()', () => {
    const qc = new QueryComposer(TestSchema, 'users');
    qc.exclude(['password']);
    expect(qc.clone().toParam().text).toBe('SELECT id, email FROM users');
  });
});
