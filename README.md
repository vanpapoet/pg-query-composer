# pg-query-composer

[![npm version](https://img.shields.io/npm/v/pg-query-composer.svg?style=flat-square)](https://www.npmjs.com/package/pg-query-composer)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4%2B-blue?style=flat-square)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-120%2B-brightgreen?style=flat-square)](tests/)

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

## Installation

```bash
npm install pg-query-composer zod
```

**Requirements:** Node.js 18+, TypeScript 5.4+, PostgreSQL 12+

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
  created_at: z.string().datetime(),
});

// Create composer
const composer = createQueryComposer(userSchema, 'users');

// Build query
const result = composer
  .where('email__contains', 'example.com')
  .where('created_at__gte', new Date('2024-01-01'))
  .orderBy('created_at', 'DESC')
  .paginate({ page: 1, limit: 20 })
  .build();

console.log(result.sql);
// SELECT * FROM users WHERE email LIKE $1 AND created_at >= $2 ORDER BY created_at DESC LIMIT 20 OFFSET 0

console.log(result.values);
// ['%example.com%', '2024-01-01T00:00:00Z']
```

### Type-Safe Queries

```typescript
import { createTypedComposer } from 'pg-query-composer';

const typed = createTypedComposer(userSchema, 'users');

// Compile-time error: 'invalid_field' not in schema
typed.where('invalid_field__exact', 'value'); // ✗ TypeScript error

// Type-safe: 'email' exists in schema
typed.where('email__exact', 'test@example.com'); // ✓
```

### Eager Loading with Relations

```typescript
import { defineModel, createModelQuery } from 'pg-query-composer/relations';

// Define models with relationships
defineModel('User', {
  table: 'users',
  relations: {
    posts: { type: 'hasMany', modelName: 'Post', foreignKey: 'user_id' },
    profile: { type: 'hasOne', modelName: 'Profile', foreignKey: 'user_id' },
  },
});

defineModel('Post', {
  table: 'posts',
  relations: {
    author: { type: 'belongsTo', modelName: 'User', foreignKey: 'user_id' },
  },
});

// Build query with eager loading (N+1 prevention via batch loading)
const userQuery = createModelQuery(User, 'users');
const users = await userQuery
  .where('status__exact', 'active')
  .include('posts', { limit: 5 })
  .include('profile')
  .build();

// users[i].posts, users[i].profile auto-populated with batch loading
```

### Reusable Filters

```typescript
import { fragment, dateRange, scope } from 'pg-query-composer/composition';

// Pre-built fragments
const f = dateRange('created_at', startDate, endDate);
composer.where(...f);

// Reusable scopes
const activeScope = scope((q) => q.where('deleted_at__isnull', true));
composer.applyScope(activeScope);
```

### PostgreSQL Features

#### JSONB Operations

```typescript
import { jsonbContains, jsonbPath } from 'pg-query-composer/pg';

composer.where(jsonbContains('metadata', { role: 'admin' }));
const pathValue = jsonbPath('data', 'nested.field');
```

#### Full-Text Search

```typescript
import { fullTextSearch, fullTextRank } from 'pg-query-composer/pg';

composer.where(fullTextSearch('title || content', 'search query'));
const ranked = fullTextRank('title', 'search query');
```

#### Recursive CTEs

```typescript
import { ancestorsCTE } from 'pg-query-composer/pg';

const ancestors = ancestorsCTE('categories', 'id', 'parent_id', 5);
// Finds all parents up to 5 levels deep
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
| **PostgreSQL** | JSONB, FTS, Recursive CTEs | `pg-query-composer/pg` |

## API Reference

### Core Builder

```typescript
createQueryComposer(schema, table, options?)
  .where(column, value)
  .andWhere(column, value)
  .orWhere(column, value)
  .notWhere(column, value)
  .join(table, alias?, on)
  .groupBy(...fields)
  .having(condition)
  .orderBy(field, direction)
  .select(...fields) / .exclude(...fields)
  .paginate({ page, limit, maxLimit })
  .build() // Returns { sql, values }
```

### Type-Safe Wrapper

```typescript
createTypedComposer(schema, table)
  // Same methods as QueryComposer, but with compile-time type checking
```

### Eager Loading

```typescript
createModelQuery(model, table)
  // All QueryComposer methods plus:
  .include(relationName, options?)
  .build() // Returns records with relations populated
```

### Composition

```typescript
// Fragments (13 pre-built)
dateRange(field, start, end)
inList(field, values)
contains(field, value)
// ... and 10 more

// Scopes
scope(callback)
parameterizedScope(callback)

// Merge
merge(composer1, composer2)
mergeAll([composer1, composer2, ...])
```

### PostgreSQL

```typescript
// JSONB (11 operators)
jsonbContains(field, value)
jsonbPath(field, path)
// ... and 9 more

// Full-Text Search
fullTextSearch(field, query)
fullTextRank(field, query)

// Recursive CTE
ancestorsCTE(table, idCol, parentCol, depth)
descendantsCTE(table, idCol, parentCol, depth)
```

## Documentation

Comprehensive documentation available in `/docs`:

- **[project-overview-pdr.md](docs/project-overview-pdr.md)** - Project goals, features, requirements
- **[codebase-summary.md](docs/codebase-summary.md)** - Code structure, modules, metrics
- **[code-standards.md](docs/code-standards.md)** - Development standards, patterns, conventions
- **[system-architecture.md](docs/system-architecture.md)** - System design, data flow, extension points

## Examples

### Conditional Queries

```typescript
const composer = createQueryComposer(userSchema, 'users');

if (email) composer.where('email__exact', email);
if (status) composer.where('status__exact', status);
if (minAge) composer.where('age__gte', minAge);

const { sql, values } = composer.build();
```

### Complex Filtering

```typescript
const query = createQueryComposer(schema, 'posts');

query
  .where('status__exact', 'published')
  .andWhere('created_at__gte', new Date('2024-01-01'))
  .orWhere('featured__exact', true)
  .orderBy('created_at', 'DESC')
  .paginate({ page: 1, limit: 10 });

const { sql, values } = query.build();
```

### Batch Loading

```typescript
import { createRelationLoader } from 'pg-query-composer/relations';
import DataLoader from 'dataloader';

const postLoader = createRelationLoader({
  relation: 'posts',
  batchFn: async (userIds) => {
    // Fetch all posts for all userIds in one query
    const posts = await db.query(
      'SELECT * FROM posts WHERE user_id = ANY($1)',
      [userIds]
    );
    return userIds.map(id => posts.filter(p => p.user_id === id));
  },
});

const post = await postLoader.load(userId);
```

## Performance

- **Query Building:** O(n) where n = conditions
- **SQL Generation:** Single pass, no rebuilding
- **Batch Loading:** O(1) per relation depth (not O(n) with N+1)
- **Type Checking:** < 5s compile time
- **Bundle:** ~50KB minified (before gzip)

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

**Coverage:** 120+ test cases, 85%+ line coverage, all public APIs tested.

## Contributing

Contributions welcome! Please:

1. Read [code-standards.md](docs/code-standards.md) for conventions
2. Add tests for new features
3. Ensure TypeScript strict mode passes
4. Update docs if adding new operators or features

## License

MIT - See LICENSE file

## Changelog

### v0.1.0 (2026-02-07) - Initial Release

- Core QueryComposer with 34 operators
- Type-safe TypedQueryComposer wrapper
- 13 reusable filter fragments
- Full relation support (belongsTo, hasOne, hasMany, hasManyThrough)
- DataLoader-based batch loading
- 11 JSONB operators
- Full-Text Search (5 methods)
- Recursive CTE builder
- 120+ test cases

---

**pg-query-composer** • [GitHub](https://github.com/vanpapoet/pg-query-composer) • [npm](https://www.npmjs.com/package/pg-query-composer)
