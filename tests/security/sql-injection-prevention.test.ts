import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { QueryComposer } from '../../src/core/query-composer';
import { validateIdentifier } from '../../src/core/identifier-validation';
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
import { ref } from '../../src/subquery/exists';

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
    expect(values).toContain("'; DROP TABLE users;--");
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
