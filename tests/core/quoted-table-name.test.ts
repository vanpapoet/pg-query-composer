import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { QueryComposer } from '../../src/core/query-composer';
import { quoteIdentifier, validateIdentifier } from '../../src/core/identifier-validation';

const TestSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
});

describe('quoteTable option', () => {
  it('emits the table verbatim by default (PG folds it to lower case)', () => {
    const qc = new QueryComposer(TestSchema, 'settings_hangXe');
    expect(qc.toParam().text).toBe('SELECT * FROM settings_hangXe');
  });

  it('double-quotes the table so PG keeps its letter case', () => {
    const qc = new QueryComposer(TestSchema, 'settings_hangXe', { quoteTable: true });
    expect(qc.toParam().text).toBe('SELECT * FROM "settings_hangXe"');
  });

  it('quotes each part of a schema-qualified name separately', () => {
    const qc = new QueryComposer(TestSchema, 'public.settings_hangXe', { quoteTable: true });
    expect(qc.toParam().text).toBe('SELECT * FROM "public"."settings_hangXe"');
  });

  it('quotes the table in COUNT queries too', () => {
    const qc = new QueryComposer(TestSchema, 'settings_hangXe', { quoteTable: true });
    expect(qc.toCountParam().text).toBe('SELECT COUNT(*) AS total FROM "settings_hangXe"');
  });

  it('keeps quoting alongside filters, projection and sorting', () => {
    const qc = new QueryComposer(TestSchema, 'settings_hangXe', { quoteTable: true })
      .select(['id', 'name'])
      .where({ status: 'active' })
      .orderBy('-id');
    const { text, values } = qc.toParam();
    expect(text).toBe(
      'SELECT id, name FROM "settings_hangXe" WHERE status = $1 ORDER BY id DESC'
    );
    expect(values).toEqual(['active']);
  });

  it('survives clone() — the quoted form is re-derived, not re-validated as raw SQL', () => {
    const qc = new QueryComposer(TestSchema, 'settings_hangXe', { quoteTable: true })
      .where({ status: 'active' });
    expect(qc.clone().toParam().text).toBe(
      'SELECT * FROM "settings_hangXe" WHERE status = $1'
    );
  });

  it('rejects an expression as a table when quoting is on', () => {
    expect(
      () => new QueryComposer(TestSchema, 'users u', { quoteTable: true })
    ).toThrow(/Unsafe column name/);
  });

  it('rejects a caller-supplied quote instead of nesting it', () => {
    expect(
      () => new QueryComposer(TestSchema, 'a" ; DROP TABLE users --', { quoteTable: true })
    ).toThrow();
  });
});

describe('joining case-sensitive tables', () => {
  it('joins a camelCase table with a quoted ON condition', () => {
    const qc = new QueryComposer(TestSchema, 'settings_hangXe', { quoteTable: true })
      .join('"donHang"', '"settings_hangXe".id = "donHang"."hangXeId"');
    expect(qc.toParam().text).toBe(
      'SELECT * FROM "settings_hangXe" ' +
      'INNER JOIN "donHang" ON ("settings_hangXe".id = "donHang"."hangXeId")'
    );
  });

  it('accepts a quoted alias', () => {
    const qc = new QueryComposer(TestSchema, 'users')
      .leftJoin('"donHang"', 'users.id = "dh"."userId"', '"dh"');
    expect(qc.toParam().text).toBe(
      'SELECT * FROM users LEFT JOIN "donHang" "dh" ON (users.id = "dh"."userId")'
    );
  });

  it('mixes quoted and unquoted references in one ON condition', () => {
    const qc = new QueryComposer(TestSchema, 'users')
      .rightJoin('"donHang"', 'users.id = "donHang".user_id');
    expect(qc.toParam().text).toBe(
      'SELECT * FROM users RIGHT JOIN "donHang" ON (users.id = "donHang".user_id)'
    );
  });

  it('lets quoteIdentifier build the join reference', () => {
    const qc = new QueryComposer(TestSchema, 'users')
      .join(quoteIdentifier('public.donHang'), 'users.id = "donHang".user_id');
    expect(qc.toParam().text).toContain('INNER JOIN "public"."donHang" ON');
  });
});

describe('quoted identifiers are validated, not trusted', () => {
  it.each([
    ['stray closing quote', 'users"'],
    ['unbalanced opening quote', '"users'],
    ['break out of the quoting', '"users"; DROP TABLE users --'],
    ['smuggle a statement inside quotes', '"users; DROP TABLE users"'],
    ['empty quoted identifier', '""'],
    ['quoted single quote', '"a\'b"'],
    ['quoted comment marker', '"a--b"'],
  ])('rejects %s', (_label, evil) => {
    expect(() => new QueryComposer(TestSchema, 'users').join(evil, 'a.id = b.id'))
      .toThrow('Unsafe SQL identifier');
  });

  it('rejects an injected ON condition even when it looks quoted', () => {
    expect(
      () => new QueryComposer(TestSchema, 'users')
        .join('"donHang"', '"a".id = "b".id; DROP TABLE users --')
    ).toThrow('Unsafe SQL identifier');
  });

  // validateIdentifier is an expression guard, not a column guard: `users OR 1=1`
  // has always been accepted as a join reference. Quoting must not widen that —
  // wrapping a part in quotes may only ever restrict what gets through, since
  // the quoted text is checked against the *stricter* plain-identifier rule.
  it.each([
    'users OR 1=1',
    'a.id = b.id',
    'COUNT(*)',
    'users u',
  ])('accepts %j identically whether or not its parts are quoted', (expr) => {
    const quoted = expr.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, '"$&"');
    expect(() => validateIdentifier(expr)).not.toThrow();
    // Quoting never turns a rejected string into an accepted one, and the
    // reverse (quoting narrowing acceptance) is safe by construction.
    expect(() => validateIdentifier(quoted)).not.toThrow();
  });

  it('does not let quotes smuggle in a character the unquoted rule forbids', () => {
    // Every character banned outside quotes stays banned inside them.
    for (const bad of [';', '--', "'", '\\', '/', '\n', '\t', '\0']) {
      expect(() => validateIdentifier(`"a${bad}b"`)).toThrow('Unsafe SQL identifier');
    }
  });
});

describe('quoteIdentifier', () => {
  it('quotes a bare identifier', () => {
    expect(quoteIdentifier('settings_hangXe')).toBe('"settings_hangXe"');
  });

  it('quotes each dot-separated part', () => {
    expect(quoteIdentifier('public.tblFoo')).toBe('"public"."tblFoo"');
  });

  it.each([
    'a"b',
    'a; DROP TABLE users',
    "a'b",
    'users u',
    'COUNT(*)',
    '',
  ])('rejects %j', (name) => {
    expect(() => quoteIdentifier(name)).toThrow(/Unsafe column name/);
  });
});
