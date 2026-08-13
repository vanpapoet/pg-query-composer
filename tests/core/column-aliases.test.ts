import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { QueryComposer } from '../../src/core/query-composer';
import { InvalidColumnError } from '../../src/core/errors';

const TestSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  status: z.string(),
  age: z.number(),
});

describe('output column aliases', () => {
  describe('with SELECT * (no explicit projection)', () => {
    it('appends the aliased column to *', () => {
      const qc = new QueryComposer(TestSchema, 'users', {
        aliases: { email_addr: 'email' },
      });
      expect(qc.toParam().text).toBe('SELECT *, email AS email_addr FROM users');
    });

    it('appends every alias when several are declared', () => {
      const qc = new QueryComposer(TestSchema, 'users', {
        aliases: { email_addr: 'email', full_name: 'name' },
      });
      const { text } = qc.toParam();
      expect(text).toContain('email AS email_addr');
      expect(text).toContain('name AS full_name');
      expect(text).toContain('SELECT *,');
    });

    it('emits one entry per alias when two aliases share a column', () => {
      const qc = new QueryComposer(TestSchema, 'users', {
        aliases: { email_addr: 'email', contact: 'email' },
      });
      const { text } = qc.toParam();
      expect(text).toContain('email AS email_addr');
      expect(text).toContain('email AS contact');
    });

    it('keeps plain SELECT * when no alias is declared', () => {
      const qc = new QueryComposer(TestSchema, 'users', { aliases: {} });
      expect(qc.toParam().text).toBe('SELECT * FROM users');
    });
  });

  describe('with select()', () => {
    it('renames the column in place', () => {
      const qc = new QueryComposer(TestSchema, 'users', {
        aliases: { email_addr: 'email' },
      });
      qc.select(['id', 'email']);
      expect(qc.toParam().text).toBe('SELECT id, email AS email_addr FROM users');
    });

    it('leaves non-aliased columns untouched', () => {
      const qc = new QueryComposer(TestSchema, 'users', {
        aliases: { email_addr: 'email' },
      });
      qc.select(['id', 'name']);
      expect(qc.toParam().text).toBe('SELECT id, name FROM users');
    });

    it('drops the alias when its source column is not selected', () => {
      const qc = new QueryComposer(TestSchema, 'users', {
        aliases: { email_addr: 'email' },
      });
      qc.select(['id']);
      expect(qc.toParam().text).not.toContain('email_addr');
    });

    it('emits the column once per alias when two aliases share it', () => {
      const qc = new QueryComposer(TestSchema, 'users', {
        aliases: { email_addr: 'email', contact: 'email' },
      });
      qc.select(['email']);
      expect(qc.toParam().text).toBe('SELECT email AS email_addr, email AS contact FROM users');
    });
  });

  describe('with exclude()', () => {
    it('renames surviving columns in place', () => {
      const qc = new QueryComposer(TestSchema, 'users', {
        aliases: { email_addr: 'email' },
      });
      qc.exclude(['age', 'status']);
      const { text } = qc.toParam();
      expect(text).toContain('email AS email_addr');
      expect(text).not.toContain(', email,');
    });

    it('drops the alias when its source column is excluded', () => {
      const qc = new QueryComposer(TestSchema, 'users', {
        aliases: { email_addr: 'email' },
      });
      qc.exclude(['email']);
      expect(qc.toParam().text).not.toContain('email_addr');
    });
  });

  describe('does not leak into other clauses', () => {
    it('rejects the alias as a filter key (aliases are output-only)', () => {
      const qc = new QueryComposer(TestSchema, 'users', {
        aliases: { email_addr: 'email' },
      });
      expect(() => qc.where({ email_addr: 'a@b.c' })).toThrow(InvalidColumnError);
    });

    it('filters on the source column name', () => {
      const qc = new QueryComposer(TestSchema, 'users', {
        aliases: { email_addr: 'email' },
      });
      qc.where({ email: 'a@b.c' });
      const { text, values } = qc.toParam();
      expect(text).toContain('WHERE email = $1');
      expect(values).toEqual(['a@b.c']);
    });

    it('orders by the source column name, not the alias', () => {
      const qc = new QueryComposer(TestSchema, 'users', {
        aliases: { email_addr: 'email' },
      });
      qc.orderBy('email');
      expect(qc.toParam().text).toContain('ORDER BY email ASC');
    });

    it('leaves COUNT queries alone', () => {
      const qc = new QueryComposer(TestSchema, 'users', {
        aliases: { email_addr: 'email' },
      });
      expect(qc.toCountParam().text).toBe('SELECT COUNT(*) AS total FROM users');
    });
  });

  describe('validation', () => {
    it('rejects an alias carrying SQL punctuation', () => {
      expect(
        () => new QueryComposer(TestSchema, 'users', { aliases: { 'x, 1 AS y': 'email' } })
      ).toThrow(/Unsafe column alias/);
    });

    it('rejects a quoted alias', () => {
      expect(
        () => new QueryComposer(TestSchema, 'users', { aliases: { "a'b": 'email' } })
      ).toThrow(/Unsafe column alias/);
    });

    it('rejects a qualified alias (no valid SQL for `AS a.b`)', () => {
      expect(
        () => new QueryComposer(TestSchema, 'users', { aliases: { 'a.b': 'email' } })
      ).toThrow(/Unsafe column alias/);
    });

    it('rejects a source column that is an expression', () => {
      expect(
        () => new QueryComposer(TestSchema, 'users', { aliases: { x: '(SELECT 1)' } })
      ).toThrow(/Unsafe column name/);
    });

    it('rejects an unknown source column when strict', () => {
      expect(
        () => new QueryComposer(TestSchema, 'users', { aliases: { x: 'nope' } })
      ).toThrow(InvalidColumnError);
    });

    it('allows an unknown source column when strict is off', () => {
      const qc = new QueryComposer(TestSchema, 'users', {
        strict: false,
        aliases: { x: 'nope' },
      });
      expect(qc.toParam().text).toContain('nope AS x');
    });

    it('accepts a whitelisted extraColumn as source', () => {
      const qc = new QueryComposer(TestSchema, 'users', {
        extraColumns: ['legacy_mail'],
        aliases: { email_addr: 'legacy_mail' },
      });
      expect(qc.toParam().text).toContain('legacy_mail AS email_addr');
    });

    it('ignores inherited prototype keys', () => {
      const polluted = Object.create({ evil: 'email' }) as Record<string, string>;
      const qc = new QueryComposer(TestSchema, 'users', { aliases: polluted });
      expect(qc.toParam().text).toBe('SELECT * FROM users');
    });
  });

  it('survives clone()', () => {
    const qc = new QueryComposer(TestSchema, 'users', {
      aliases: { email_addr: 'email' },
    });
    expect(qc.clone().toParam().text).toBe('SELECT *, email AS email_addr FROM users');
  });
});
