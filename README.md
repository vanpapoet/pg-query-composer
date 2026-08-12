# pg-query-composer

[![npm version](https://img.shields.io/npm/v/pg-query-composer.svg?style=flat-square)](https://www.npmjs.com/package/pg-query-composer)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4%2B-blue?style=flat-square)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-286-brightgreen?style=flat-square)](tests/)
[![Dependencies](https://img.shields.io/badge/Core%20runtime%20deps-0-brightgreen?style=flat-square)](package.json)

Advanced PostgreSQL query builder for TypeScript with dynamic composition, type safety, and N+1 prevention.

## Overview

**pg-query-composer** eliminates the need for raw SQL strings while preventing SQL injection through automatic parameterization. Build complex PostgreSQL queries programmatically with a fluent API, type-safe operations, and production-ready features like batch loading and eager loading.

**Key Strengths:**
- Django-style operator syntax for intuitive filtering
- Compile-time type validation via Zod schemas
- Automatic SQL injection prevention (parameterized queries)
- Batch loading eliminates N+1 database queries
- PostgreSQL-native features (JSONB, Full-Text Search, Recursive CTEs)
- Reusable scopes and fragments for DRY queries
- Zero runtime dependencies in the core builder (`zod` is a peer dependency; the
  optional `/relations` module pulls in `dataloader`)

## Installation

```bash
npm install pg-query-composer zod
```

**Requirements:** Node.js 18+, TypeScript 5.4+, PostgreSQL 12+ (built with TypeScript 7.0)

## Quick Start

### Basic Query

```typescript
import { z } from 'zod';
import { createQueryComposer } from 'pg-query-composer';

// Define schema (also used for Zod validation)
const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  status: z.string(),
  created_at: z.string().datetime(),
});

// Create composer
const composer = createQueryComposer(userSchema, 'users');

// Build query with multiple conditions — where() takes a filter object,
// so a request query string can be passed straight in
const result = composer
  .where({ email__contains: 'example.com', status__exact: 'active' })
  .orderBy('-created_at') // Negative prefix = DESC
  .paginate({ page: 1, limit: 20 })
  .toParam();

console.log(result.text);
// SELECT * FROM users WHERE email ILIKE $1 AND status = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4

console.log(result.values);
// ['%example.com%', 'active', 20, 0]
```

`LIMIT` / `OFFSET` are parameterized too, so one SQL text serves every page and
PostgreSQL reuses the same plan.

### Type-Safe Queries

```typescript
import { createTypedComposer } from 'pg-query-composer/types';

const typed = createTypedComposer(userSchema, 'users');

// Compile-time error: 'invalid_field' not in schema
typed.where({ invalid_field__exact: 'value' }); // ✗ TypeScript error

// Type-safe: 'email' exists in schema
typed.where({ email__exact: 'test@example.com' }); // ✓

const { text, values } = typed.toParam();
// SELECT * FROM users WHERE email = $1   |   ['test@example.com']
```

### Eager Loading with Relations

The library builds queries and groups results — it never opens a connection.
You supply an *executor*, so any `pg` Pool, Client or transaction works.

```typescript
import { Pool } from 'pg';
import { z } from 'zod';
import {
  defineModel,
  createModelQuery,
  loadRelation,
  type QueryExecutor,
} from 'pg-query-composer/relations';

const pool = new Pool();
const execute: QueryExecutor = async ({ text, values }) =>
  (await pool.query(text, values)).rows;

const postSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  title: z.string(),
  status: z.string(),
});

// Define the model once — `targetSchema` gives the relation query its own
// column whitelist
const User = defineModel({
  name: 'User',
  table: 'users',
  schema: userSchema,
  primaryKey: 'id',
  relations: {
    posts: {
      type: 'hasMany',
      target: 'posts',
      targetSchema: postSchema,
      foreignKey: 'user_id',
      primaryKey: 'id',
    },
  },
});

// 1. Load the parents
const query = createModelQuery(User).where({ status__exact: 'active' });
const users = await execute(query.toParam());
// SELECT * FROM users WHERE status = $1   |   ['active']

// 2. Load the relation — one query for every parent, no N+1
const withPosts = await loadRelation(users, User, 'posts', execute);
// SELECT * FROM posts WHERE user_id = ANY($1)   |   [[1, 2, 3]]
// → [{ id: 1, name: 'Ann', posts: [{ id: 9, title: 'Hello', ... }] }, ...]
```

`hasMany` / `hasManyThrough` yield an array, `belongsTo` / `hasOne` a single
record or `null`. Pass a `DataLoader` from `createRelationLoader()` as the fifth
argument when several call sites (GraphQL resolvers, say) must coalesce into one
query and share a per-request cache.

`ModelQueryComposer` also tracks `.include()` declarations, which
`getIncludeQueries()` renders as filterable relation queries:

```typescript
const q = createModelQuery(User)
  .where({ status__exact: 'active' })
  .include('posts', (qc) => qc.where({ status__exact: 'published' }).orderBy('-id'));

q.getIncludeQueries();
// [{ relation: 'posts', type: 'hasMany', foreignKey: 'user_id', primaryKey: 'id',
//    query: { text: 'SELECT * FROM posts WHERE status = $1 ORDER BY id DESC',
//             values: ['published'] } }]
```

Note the parent-key predicate is **not** part of that text — `getIncludeQueries()`
hands you the filter and the key names, and you add the key restriction (or use
`loadRelation()`, which builds `WHERE user_id = ANY($1)` itself but does not
apply the `.include()` callback).

### Reusable Filters

```typescript
import { dateRange, contains, fragment } from 'pg-query-composer/composition';

const composer = createQueryComposer(userSchema, 'users');

// Fragments are plain filter objects, so they compose with where()
const dateFilter = dateRange('created_at', '2024-01-01', '2024-12-31');
const nameFilter = contains('name', 'John');

const { text, values } = composer.where(dateFilter).where(nameFilter).toParam();
// SELECT * FROM users WHERE created_at BETWEEN $1 AND $2 AND name ILIKE $3
// ['2024-01-01', '2024-12-31', '%John%']

// Or merge them into one call
composer.where({ ...dateFilter, ...nameFilter });
```

### PostgreSQL Features

#### JSONB Operations

```typescript
import { jsonbContains, jsonbPath } from 'pg-query-composer/pg';

composer.where(jsonbContains('metadata', { role: 'admin' }));
// WHERE metadata @> $1::jsonb   |   ['{"role":"admin"}']

const pathValue = jsonbPath('metadata', ['profile', 'city']);
// metadata->'profile'->'city'   (path is an array, not a dotted string)
```

#### Full-Text Search

```typescript
import { fullTextSearch, fullTextRank } from 'pg-query-composer/pg';

// First argument is a tsvector column (or a plain identifier) — expressions
// such as `title || content` are rejected by identifier validation
composer.where(fullTextSearch('search_vector', 'react hooks'));
// WHERE search_vector @@ plainto_tsquery('english', $1)   |   ['react hooks']

const ranked = fullTextRank('search_vector', 'react hooks');
// ts_rank(search_vector, plainto_tsquery('english', 'react hooks'))
```

#### Recursive CTEs

```typescript
import { ancestorsCTE } from 'pg-query-composer/pg';

const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  parent_id: z.number().nullable(),
});

// (table, schema, startId, parentColumn?)
const { text, values } = ancestorsCTE('categories', categorySchema, '42')
  .withMaxDepth(5)
  .toParam();

// WITH RECURSIVE ancestors AS (
//   SELECT id, name, parent_id, 0 AS depth FROM categories WHERE id = $1
//   UNION ALL
//   SELECT categories.id, categories.name, categories.parent_id, depth + 1
//   FROM categories JOIN ancestors ON ancestors.parent_id = categories.id
//   WHERE depth < 5
// )
// SELECT id, name, parent_id, depth FROM ancestors      |   ['42']
```

## Feature Highlights

### 34 Built-In Operators

| Category | Operators |
|----------|-----------|
| Comparison | exact, notexact, gt, gte, lt, lte |
| Text | contains, icontains, startswith, istartswith, endswith, iendswith, regex, iregex |
| Range | in, notin, between, notbetween |
| Null | isnull, isnotnull |
| Date | date, datebetween, year, month, day, week, today, thisweek, thismonth, thisyear |
| Array | arraycontains, arrayoverlap, arraycontained |

### Advanced Capabilities

- **Composition:** AND/OR conditions, complex WHERE clauses, JOIN support
- **Pagination:** Automatic LIMIT/OFFSET with metadata (page, total, hasNext)
- **Sorting:** Multi-field sorting with custom directions
- **Relations:** belongsTo, hasOne, hasMany, hasManyThrough eager loading
- **Subqueries:** IN subqueries, EXISTS checks, LATERAL joins
- **JSONB:** 11 operators for JSON data manipulation
- **Full-Text Search:** 5 methods including websearch and ranking
- **Recursive CTEs:** Hierarchical query builder
- **Type Safety:** Compile-time column validation with Zod schemas

## Module Overview

| Module | Purpose | Import |
|--------|---------|--------|
| **Main** | QueryComposer, operators, types | `pg-query-composer` |
| **Composition** | Fragments, scopes, merge | `pg-query-composer/composition` |
| **Subquery** | Subqueries, EXISTS, LATERAL | `pg-query-composer/subquery` |
| **Relations** | Models, eager loading, batch load | `pg-query-composer/relations` |
| **Types** | Compile-time column validation | `pg-query-composer/types` |
| **PostgreSQL** | JSONB, FTS, Recursive CTEs | `pg-query-composer/pg` |

Every subpath is also re-exported from the root entry, so
`import { jsonbContains } from 'pg-query-composer'` works too.

## API Reference

See full API docs in [`/docs`](docs/):

| API | Method | Returns |
|-----|--------|---------|
| `createQueryComposer(schema, table)` | `.where()` `.or()` `.not()` `.orderBy()` `.paginate()` `.join()` `.groupBy()` `.having()` `.select()` `.exclude()` | `.toParam()` → `{ text, values }` |
| `createTypedComposer(schema, table)` | Same as above + compile-time type checking | `.toParam()` → `{ text, values }` |
| `createModelQuery(model)` | All above + `.include(relation, queryFn?)` | `.toParam()`, `.getIncludeQueries()` |
| `loadRelation(rows, model, name, exec)` | Batch-loads one relation for a row set | `Promise<rows with relation>` |
| `scope(callback)` | Reusable query modifier | `.apply(scope)` |
| `merge(qc1, qc2)` | Combine composers | QueryComposer |

## Documentation

- **[System Architecture](docs/system-architecture.md)** - Design, data flow
- **[Code Standards](docs/code-standards.md)** - Conventions, patterns
- **[Changelog](CHANGELOG.md)** - Release history and engineering decisions

### Feature Guides

- **[Core Builder](docs/guide-core-builder.md)** - WHERE, JOINs, pagination, sorting
- **[Composition](docs/guide-composition.md)** - Fragments, scopes, merge
- **[Subqueries](docs/guide-subqueries.md)** - IN, EXISTS, LATERAL
- **[Relations](docs/guide-relations.md)** - Models, eager loading, batch loading
- **[PostgreSQL](docs/guide-postgresql.md)** - JSONB, Full-Text Search, CTEs

## Performance

- **Query Building:** O(n) where n = conditions
- **SQL Generation:** Single pass, no rebuilding
- **Batch Loading:** one query per relation depth (not O(n) with N+1)
- **Stable SQL text:** `IN` lists bind as one array parameter and LIMIT/OFFSET
  are parameterized, so list length and page number never fragment PostgreSQL's
  plan cache

Measured numbers and the reasoning behind each decision live in
[CHANGELOG.md](CHANGELOG.md) → *Engineering decisions*.

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

286 test cases across 23 files, including 59 dedicated SQL injection prevention
tests plus guards over the published `exports` map and the version constant.
Verified against TypeScript 7.0 on Node 18, 20 and 22.

## Contributing

Contributions welcome! Please:

1. Read [code-standards.md](docs/code-standards.md) for conventions
2. Add tests for new features
3. Ensure TypeScript strict mode passes
4. Update docs if adding new operators or features

## License

MIT - See LICENSE file

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

---

**pg-query-composer** • [GitHub](https://github.com/vanpapoet/pg-query-composer) • [npm](https://www.npmjs.com/package/pg-query-composer)
