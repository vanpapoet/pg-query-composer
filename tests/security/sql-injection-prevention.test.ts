import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { QueryComposer } from '../../src/core/query-composer';
import { validateIdentifier } from '../../src/core/identifier-validation';
import { InvalidColumnError } from '../../src/core/errors';
import {
  jsonbContains,
  jsonbContainedBy,
  jsonbHasKey,
  jsonbHasAllKeys,
  jsonbHasAnyKey,
  jsonbPath,
  jsonbSet,
} from '../../src/pg/jsonb';
import {
  fullTextSearch,
  fullTextWebSearch,
  fullTextRawSearch,
} from '../../src/pg/fts';
import { subquery } from '../../src/subquery/builder';
import { ref, exists, notExists } from '../../src/subquery/exists';

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  status: z.string(),
  data: z.record(z.unknown()),
});

// ============================================================
// IDENTIFIER VALIDATION
// ============================================================

describe('Identifier Validation', () => {
  it('allows safe identifiers', () => {
    expect(() => validateIdentifier('users')).not.toThrow();
    expect(() => validateIdentifier('public.users')).not.toThrow();
    expect(() => validateIdentifier('user_name')).not.toThrow();
    expect(() => validateIdentifier('COUNT(*)')).not.toThrow();
    expect(() => validateIdentifier('t1.id = t2.user_id')).not.toThrow();
  });

  it('rejects SQL injection in identifiers', () => {
    expect(() => validateIdentifier("users'; DROP TABLE users;--")).toThrow('Unsafe SQL identifier');
    expect(() => validateIdentifier('users"')).toThrow('Unsafe SQL identifier');
    expect(() => validateIdentifier("users' OR '1'='1")).toThrow('Unsafe SQL identifier');
    expect(() => validateIdentifier('users; DELETE FROM users')).toThrow('Unsafe SQL identifier');
    expect(() => validateIdentifier('users -- comment')).toThrow('Unsafe SQL identifier');
    expect(() => validateIdentifier('')).toThrow('Unsafe SQL identifier');
  });

  it('rejects backslash and special chars', () => {
    expect(() => validateIdentifier('users\\x00')).toThrow('Unsafe SQL identifier');
    expect(() => validateIdentifier('col\nname')).toThrow('Unsafe SQL identifier');
    expect(() => validateIdentifier('col\tname')).toThrow('Unsafe SQL identifier');
  });
});

// ============================================================
// TABLE NAME INJECTION
// ============================================================

describe('Table Name Injection Prevention', () => {
  it('rejects malicious table names in constructor', () => {
    expect(() => new QueryComposer(UserSchema, "users'; DROP TABLE users;--")).toThrow('Unsafe SQL identifier');
    expect(() => new QueryComposer(UserSchema, 'users" OR 1=1')).toThrow('Unsafe SQL identifier');
  });

  it('rejects malicious table names in join', () => {
    const qc = new QueryComposer(UserSchema, 'users');
    expect(() => qc.join("orders'; DROP TABLE orders;--", 'users.id = orders.user_id')).toThrow('Unsafe SQL identifier');
  });

  it('rejects malicious ON conditions in join', () => {
    const qc = new QueryComposer(UserSchema, 'users');
    expect(() => qc.join('orders', "1=1; DROP TABLE users;--")).toThrow('Unsafe SQL identifier');
  });
});

// ============================================================
// COLUMN VALIDATION (Schema Whitelist)
// ============================================================

describe('Column Whitelist Enforcement', () => {
  it('rejects unknown columns in strict mode', () => {
    const qc = new QueryComposer(UserSchema, 'users');
    expect(() => qc.where({ 'nonexistent__exact': 'value' })).toThrow('Invalid column');
  });

  it('rejects SQL injection via column names', () => {
    const qc = new QueryComposer(UserSchema, 'users');
    expect(() => qc.where({ "1=1; DROP TABLE users--__exact": 'x' })).toThrow('Invalid column');
  });

  it('rejects injection via orderBy', () => {
    const qc = new QueryComposer(UserSchema, 'users');
    expect(() => qc.orderBy("name; DROP TABLE users--")).toThrow('Invalid column');
  });

  it('rejects injection via select', () => {
    const qc = new QueryComposer(UserSchema, 'users');
    expect(() => qc.select(["name; DROP TABLE users"])).toThrow('Invalid column');
  });

  it('rejects injection via groupBy', () => {
    const qc = new QueryComposer(UserSchema, 'users');
    expect(() => qc.groupBy("status; DROP TABLE users")).toThrow('Invalid column');
  });
});

// ============================================================
// OPERATOR VALIDATION
// ============================================================

describe('Operator Validation', () => {
  it('rejects invalid operators in strict mode', () => {
    const qc = new QueryComposer(UserSchema, 'users');
    expect(() => qc.where({ 'name__invalid': 'value' })).toThrow('Invalid operator');
  });

  it('rejects SQL injection via operator name', () => {
    const qc = new QueryComposer(UserSchema, 'users');
    expect(() => qc.where({ "name__exact' OR '1'='1": 'x' })).toThrow('Invalid operator');
  });
});

// ============================================================
// PARAMETERIZED VALUES (no inline interpolation)
// ============================================================

describe('Value Parameterization', () => {
  it('parameterizes string values — never inlines them', () => {
    const qc = new QueryComposer(UserSchema, 'users')
      .where({ name__exact: "'; DROP TABLE users;--" });
    const { text, values } = qc.toParam();
    // The malicious string should be in values array, not in the SQL text
    expect(text).not.toContain('DROP TABLE');
    expect(text).toContain('$1');
    expect(values[0]).toBe("'; DROP TABLE users;--");
  });

  it('parameterizes LIKE values', () => {
    const qc = new QueryComposer(UserSchema, 'users')
      .where({ name__contains: "%'; DROP TABLE users;--" });
    const { text, values } = qc.toParam();
    expect(text).not.toContain('DROP TABLE');
    expect(values[0]).toContain("DROP TABLE");
  });

  it('parameterizes IN values', () => {
    const qc = new QueryComposer(UserSchema, 'users')
      .where({ status__in: ["active", "'; DROP TABLE users;--"] });
    const { text, values } = qc.toParam();
    expect(text).not.toContain('DROP TABLE');
    // `= ANY(?)` binds the whole list as one array parameter
    expect(values).toEqual([['active', "'; DROP TABLE users;--"]]);
  });

  it('parameterizes BETWEEN values', () => {
    const qc = new QueryComposer(UserSchema, 'users')
      .where({ id__between: [1, "99; DROP TABLE users"] });
    const { text, values } = qc.toParam();
    expect(text).not.toContain('DROP TABLE');
    expect(values).toContain("99; DROP TABLE users");
  });

  it('parameterizes regex values', () => {
    const qc = new QueryComposer(UserSchema, 'users')
      .where({ name__regex: ".*'; DROP TABLE users;--" });
    const { text, values } = qc.toParam();
    expect(text).not.toContain('DROP TABLE');
    expect(values[0]).toContain("DROP TABLE");
  });
});

// ============================================================
// JSONB INJECTION PREVENTION
// ============================================================

describe('JSONB Injection Prevention', () => {
  it('parameterizes jsonbContains values', () => {
    const filter = jsonbContains('data', { "key': 'injection": true });
    expect(filter.__raw).toBe('data @> ?::jsonb');
    expect(filter.__rawValues).toEqual([JSON.stringify({ "key': 'injection": true })]);
    // Value is in __rawValues, not inlined in __raw
    expect(filter.__raw).not.toContain('injection');
  });

  it('parameterizes jsonbContainedBy values', () => {
    const filter = jsonbContainedBy('data', { evil: "'; DROP TABLE" });
    expect(filter.__raw).toBe('data <@ ?::jsonb');
    expect(filter.__rawValues![0]).toContain('DROP TABLE');
  });

  it('parameterizes jsonbHasKey', () => {
    const filter = jsonbHasKey('data', "key'; DROP TABLE users;--");
    expect(filter.__raw).not.toContain('DROP TABLE');
    expect(filter.__rawValues).toEqual(["key'; DROP TABLE users;--"]);
  });

  it('parameterizes jsonbHasAllKeys', () => {
    const filter = jsonbHasAllKeys('data', ["safe", "evil'; DROP TABLE"]);
    expect(filter.__raw).not.toContain('DROP TABLE');
    expect(filter.__rawValues).toContain("evil'; DROP TABLE");
  });

  it('parameterizes jsonbHasAnyKey', () => {
    const filter = jsonbHasAnyKey('data', ["safe", "evil'; DROP TABLE"]);
    expect(filter.__raw).not.toContain('DROP TABLE');
    expect(filter.__rawValues).toContain("evil'; DROP TABLE");
  });

  it('rejects malicious column names in JSONB functions', () => {
    expect(() => jsonbContains("data'; DROP TABLE--", {})).toThrow('Unsafe SQL identifier');
    expect(() => jsonbHasKey("data'; --", 'key')).toThrow('Unsafe SQL identifier');
  });

  it('rejects injection in jsonbPath path elements', () => {
    expect(() => jsonbPath('data', ["key'; DROP TABLE--"])).toThrow('Unsafe SQL identifier');
  });

  it('JSONB values flow through parameterization in full query', () => {
    const qc = new QueryComposer(UserSchema, 'users', { strict: false })
      .where(jsonbContains('data', { "evil': 'injection": true }));
    const { text, values } = qc.toParam();
    expect(text).not.toContain('injection');
    expect(text).toContain('$1::jsonb');
    expect(values[0]).toContain('injection');
  });
});

// ============================================================
// FTS INJECTION PREVENTION
// ============================================================

describe('FTS Injection Prevention', () => {
  it('parameterizes fullTextSearch query', () => {
    const filter = fullTextSearch('search_vector', "search'; DROP TABLE users;--");
    expect(filter.__raw).not.toContain('DROP TABLE');
    expect(filter.__rawValues).toEqual(["search'; DROP TABLE users;--"]);
  });

  it('parameterizes fullTextWebSearch query', () => {
    const filter = fullTextWebSearch('search_vector', "\"evil\"; DROP TABLE--");
    expect(filter.__raw).not.toContain('DROP TABLE');
    expect(filter.__rawValues![0]).toContain('DROP TABLE');
  });

  it('parameterizes fullTextRawSearch query', () => {
    const filter = fullTextRawSearch('search_vector', "evil & DROP");
    expect(filter.__raw).not.toContain('evil');
    expect(filter.__rawValues).toEqual(['evil & DROP']);
  });

  it('rejects malicious FTS config', () => {
    expect(() => fullTextSearch('col', 'query', "english'; DROP TABLE--")).toThrow('Invalid FTS config');
  });

  it('rejects unknown FTS config', () => {
    expect(() => fullTextSearch('col', 'query', 'malicious_config')).toThrow('Invalid FTS config');
  });

  it('FTS values flow through parameterization in full query', () => {
    const qc = new QueryComposer(UserSchema, 'users', { strict: false })
      .where(fullTextSearch('data', "'; DROP TABLE users;--"));
    const { text, values } = qc.toParam();
    expect(text).not.toContain('DROP TABLE');
    expect(text).toContain('$1');
    expect(values[0]).toBe("'; DROP TABLE users;--");
  });
});

// ============================================================
// SUBQUERY PARAMETERIZATION
// ============================================================

describe('Subquery Parameterization', () => {
  const PostSchema = z.object({
    id: z.string(),
    user_id: z.string(),
    status: z.string(),
  });

  it('preserves subquery parameterization in whereIn', () => {
    const qc = new QueryComposer(UserSchema, 'users', { strict: false })
      .where({ status__exact: 'active' })
      .whereIn('id',
        new QueryComposer(PostSchema, 'posts', { strict: false })
          .select(['user_id'])
          .where({ status__exact: "'; DROP TABLE users;--" })
      );
    const { text, values } = qc.toParam();
    // Malicious value should be parameterized, not inlined
    expect(text).not.toContain('DROP TABLE');
    expect(text).toContain('$1');
    expect(text).toContain('$2');
    expect(values).toContain("'; DROP TABLE users;--");
  });

  it('preserves subquery parameterization in whereNotIn', () => {
    const qc = new QueryComposer(UserSchema, 'users', { strict: false })
      .whereNotIn('id',
        new QueryComposer(PostSchema, 'posts', { strict: false })
          .select(['user_id'])
          .where({ status__exact: 'deleted' })
      );
    const { text, values } = qc.toParam();
    expect(text).toContain('NOT IN (SELECT');
    expect(text).not.toContain("'deleted'");
    expect(values).toContain('deleted');
  });

  it('renumbers subquery parameters correctly', () => {
    const qc = new QueryComposer(UserSchema, 'users', { strict: false })
      .where({ name__exact: 'Alice' })
      .whereIn('id',
        new QueryComposer(PostSchema, 'posts', { strict: false })
          .select(['user_id'])
          .where({ status__exact: 'active' })
      )
      .where({ status__exact: 'verified' });
    const { text, values } = qc.toParam();
    expect(values).toEqual(['Alice', 'active', 'verified']);
    expect(text).toContain('$1');
    expect(text).toContain('$2');
    expect(text).toContain('$3');
  });
});

// ============================================================
// EXISTS/NOT EXISTS PARAMETERIZATION
// ============================================================

describe('EXISTS/NOT EXISTS Parameterization', () => {
  const CommentSchema = z.object({
    id: z.string(),
    post_id: z.string(),
    approved: z.boolean(),
  });

  it('parameterizes exists() subquery values', () => {
    const qc = new QueryComposer(UserSchema, 'users', { strict: false })
      .where(exists(
        new QueryComposer(CommentSchema, 'comments', { strict: false })
          .whereRaw('comments.user_id = users.id')
          .where({ approved__exact: true })
      ));
    const { text, values } = qc.toParam();
    expect(text).toContain('EXISTS (SELECT 1 FROM comments');
    expect(text).not.toContain("'true'");
    expect(text).toContain('$1');
    expect(values).toContain(true);
  });

  it('parameterizes notExists() subquery values', () => {
    const qc = new QueryComposer(UserSchema, 'users', { strict: false })
      .where(notExists(
        new QueryComposer(CommentSchema, 'comments', { strict: false })
          .whereRaw('comments.user_id = users.id')
          .where({ approved__exact: false })
      ));
    const { text, values } = qc.toParam();
    expect(text).toContain('NOT EXISTS (SELECT 1 FROM comments');
    expect(values).toContain(false);
  });

  it('preserves parameterization with injection attempt in exists', () => {
    const qc = new QueryComposer(UserSchema, 'users', { strict: false })
      .where(exists(
        new QueryComposer(CommentSchema, 'comments', { strict: false })
          .where({ post_id__exact: "'; DROP TABLE comments;--" })
      ));
    const { text, values } = qc.toParam();
    expect(text).not.toContain('DROP TABLE');
    expect(values[0]).toBe("'; DROP TABLE comments;--");
  });
});

// ============================================================
// REF INJECTION PREVENTION
// ============================================================

describe('Ref Injection Prevention', () => {
  it('rejects malicious table in ref()', () => {
    expect(() => ref("users'; DROP TABLE--", 'id')).toThrow('Unsafe SQL identifier');
  });

  it('rejects malicious column in ref()', () => {
    expect(() => ref('users', "id'; DROP TABLE--")).toThrow('Unsafe SQL identifier');
  });

  it('allows safe ref()', () => {
    expect(ref('users', 'id')).toBe('users.id');
  });
});

// ============================================================
// PAGINATION SAFETY
// ============================================================

describe('Pagination Safety', () => {
  it('parameterizes LIMIT and OFFSET', () => {
    const qc = new QueryComposer(UserSchema, 'users')
      .paginate({ page: 1, limit: 20 });
    const { text, values } = qc.toParam();
    expect(text).toContain('LIMIT $');
    expect(text).toContain('OFFSET $');
    expect(values).toContain(20);
    expect(values).toContain(0);
  });

  it('enforces maxLimit to prevent large scans', () => {
    const qc = new QueryComposer(UserSchema, 'users')
      .paginate({ page: 1, limit: 999999, maxLimit: 100 });
    const { text, values } = qc.toParam();
    // Limit should be capped at maxLimit
    expect(values).toContain(100);
    expect(values).not.toContain(999999);
  });

  it('enforces minimum page of 1', () => {
    const qc = new QueryComposer(UserSchema, 'users')
      .paginate({ page: -5, limit: 20 });
    const meta = qc.getPaginationMeta();
    expect(meta.page).toBe(1);
    expect(meta.offset).toBe(0);
  });
});

// ============================================================
// RAW FILTER SMUGGLING
// Regression: `where()` accepts user-supplied filter objects, so a plain
// `__raw` key must never be honoured as raw SQL.
// ============================================================

describe('Raw Filter Smuggling Prevention', () => {
  it('rejects a __raw key coming from untrusted input', () => {
    const hostile = JSON.parse('{"__raw":"1=1 OR (SELECT 1)=1"}');
    expect(() => new QueryComposer(UserSchema, 'users').where(hostile)).toThrow(
      InvalidColumnError
    );
  });

  it('rejects __rawValues smuggling', () => {
    const hostile = JSON.parse('{"__rawValues":["x"]}');
    expect(() => new QueryComposer(UserSchema, 'users').where(hostile)).toThrow(
      InvalidColumnError
    );
  });

  it('ignores __raw injected via Object.prototype', () => {
    (Object.prototype as Record<string, unknown>).__raw = '1=1 --';
    try {
      const { text } = new QueryComposer(UserSchema, 'users').where({ id: 1 }).toParam();
      expect(text).toBe('SELECT * FROM users WHERE id = $1');
      expect(text).not.toContain('1=1');
    } finally {
      delete (Object.prototype as Record<string, unknown>).__raw;
    }
  });

  it('still honours branded raw filters from library helpers', () => {
    const { text, values } = new QueryComposer(UserSchema, 'users')
      .where(jsonbContains('data', { role: 'admin' }))
      .toParam();
    expect(text).toBe('SELECT * FROM users WHERE data @> $1::jsonb');
    expect(values).toEqual(['{"role":"admin"}']);
  });

  it('supports mixing a branded raw filter with normal columns', () => {
    const { text, values } = new QueryComposer(UserSchema, 'users')
      .where({ ...jsonbContains('data', { role: 'admin' }), status: 'active' })
      .toParam();
    expect(text).toContain('data @> $1::jsonb');
    expect(text).toContain('status = $2');
    expect(values).toEqual(['{"role":"admin"}', 'active']);
  });
});

// ============================================================
// whereIn / whereNotIn COLUMN VALIDATION
// ============================================================

describe('whereIn Column Validation', () => {
  it('rejects injection via whereIn column with a subquery', () => {
    const sub = subquery(UserSchema, 'admins').select(['id']);
    expect(() =>
      new QueryComposer(UserSchema, 'users').whereIn('1=1) OR (1', sub)
    ).toThrow(/Unsafe column name/);
  });

  it('rejects injection via whereNotIn column with a subquery', () => {
    const sub = subquery(UserSchema, 'admins').select(['id']);
    expect(() =>
      new QueryComposer(UserSchema, 'users').whereNotIn("id') OR 1=1--", sub)
    ).toThrow(/Unsafe column name/);
  });

  it('rejects injection via whereIn column with array values', () => {
    expect(() =>
      new QueryComposer(UserSchema, 'users').whereIn('1=1) OR (1', [1, 2])
    ).toThrow(/Unsafe column name/);
  });

  it('allows safe qualified column names', () => {
    const { text } = new QueryComposer(UserSchema, 'users', {
      extraColumns: ['users.id'],
    })
      .whereIn('users.id', [1, 2])
      .toParam();
    expect(text).toContain('users.id = ANY(');
  });
});

// ============================================================
// JSONB KEY-EXISTENCE OPERATORS vs PARAMETER PLACEHOLDERS
// Regression: PG uses ?, ?& and ?| as operators — they must survive
// placeholder substitution instead of being consumed as parameters.
// ============================================================

describe('JSONB Operator / Placeholder Collision', () => {
  it('emits a literal ? operator for jsonbHasKey', () => {
    const { text, values } = new QueryComposer(UserSchema, 'users')
      .where(jsonbHasKey('data', 'status'))
      .toParam();
    expect(text).toBe('SELECT * FROM users WHERE data ? $1');
    expect(values).toEqual(['status']);
  });

  it('emits a literal ?& operator for jsonbHasAllKeys', () => {
    const { text, values } = new QueryComposer(UserSchema, 'users')
      .where(jsonbHasAllKeys('data', ['a', 'b']))
      .toParam();
    expect(text).toBe('SELECT * FROM users WHERE data ?& array[$1, $2]');
    expect(values).toEqual(['a', 'b']);
  });

  it('emits a literal ?| operator for jsonbHasAnyKey', () => {
    const { text, values } = new QueryComposer(UserSchema, 'users')
      .where(jsonbHasAnyKey('data', ['a', 'b']))
      .toParam();
    expect(text).toBe('SELECT * FROM users WHERE data ?| array[$1, $2]');
    expect(values).toEqual(['a', 'b']);
  });

  it('keeps parameter numbering correct around JSONB operators', () => {
    const { text, values } = new QueryComposer(UserSchema, 'users')
      .where({ status: 'active' })
      .where(jsonbHasAnyKey('data', ['a', 'b']))
      .where({ name: 'x' })
      .toParam();
    expect(text).toBe(
      'SELECT * FROM users WHERE status = $1 AND data ?| array[$2, $3] AND name = $4'
    );
    expect(values).toEqual(['active', 'a', 'b', 'x']);
  });

  it('preserves JSONB operators when nested in a subquery', () => {
    const sub = subquery(UserSchema, 'admins')
      .select(['id'])
      .where(jsonbHasKey('data', 'root'));
    const { text, values } = new QueryComposer(UserSchema, 'users')
      .where({ status: 'active' })
      .whereIn('id', sub)
      .toParam();
    expect(text).toBe(
      'SELECT * FROM users WHERE status = $1 AND id IN (SELECT id FROM admins WHERE data ? $2)'
    );
    expect(values).toEqual(['active', 'root']);
  });

  it('preserves JSONB operators inside EXISTS', () => {
    const sub = subquery(UserSchema, 'admins').where(jsonbHasKey('data', 'root'));
    const { text, values } = new QueryComposer(UserSchema, 'users')
      .where(exists(sub))
      .toParam();
    expect(text).toContain('data ? $1');
    expect(values).toEqual(['root']);
  });
});
