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
  status: z.string(),
  created_at: z.string().datetime(),
});

// Create composer
const composer = createQueryComposer(userSchema, 'users');

// Build query with multiple conditions
const result = composer
  .where('email__contains', 'example.com')
  .where('status__exact', 'active')
  .orderBy('-created_at') // Negative prefix = DESC
  .paginate({ page: 1, limit: 20 })
  .toParam();

console.log(result.text);
// SELECT * FROM users WHERE email LIKE $1 AND status = $2 ORDER BY created_at DESC LIMIT 20 OFFSET 0

console.log(result.values);
// ['%example.com%', 'active']
```

### Type-Safe Queries

```typescript
import { createTypedComposer } from 'pg-query-composer/types';

const typed = createTypedComposer(userSchema, 'users');

// Compile-time error: 'invalid_field' not in schema
typed.where('invalid_field__exact', 'value'); // ✗ TypeScript error

// Type-safe: 'email' exists in schema
typed.where('email__exact', 'test@example.com'); // ✓

const { text, values } = typed.toParam();
console.log('Safe query built with compile-time validation');
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
import { dateRange, contains, fragment } from 'pg-query-composer/composition';

const composer = createQueryComposer(userSchema, 'users');

// Pre-built fragments
const startDate = new Date('2024-01-01');
const endDate = new Date('2024-12-31');
const dateFilter = dateRange('created_at', startDate, endDate);
const nameFilter = contains('name', 'John');

composer.where(...dateFilter).where(...nameFilter);

const { text, values } = composer.toParam();
console.log('Filtered by date range and name');
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

See full API docs in [`/docs`](docs/):

| API | Method | Returns |
|-----|--------|---------|
| `createQueryComposer(schema, table)` | `.where()` `.or()` `.not()` `.orderBy()` `.paginate()` `.join()` `.groupBy()` `.having()` `.select()` `.exclude()` | `.toParam()` → `{ text, values }` |
| `createTypedComposer(schema, table)` | Same as above + compile-time type checking | `.toParam()` → `{ text, values }` |
| `createModelQuery(model, table)` | All above + `.include(relation, opts?)` | `.build()` → records with relations |
| `scope(callback)` | Reusable query modifier | `.apply(scope)` |
| `merge(qc1, qc2)` | Combine composers | QueryComposer |

## Documentation

- **[Project Overview](docs/project-overview-pdr.md)** - Goals, features, requirements
- **[Codebase Summary](docs/codebase-summary.md)** - Module breakdown, metrics
- **[Code Standards](docs/code-standards.md)** - Conventions, patterns
- **[System Architecture](docs/system-architecture.md)** - Design, data flow
- **[Project Roadmap](docs/project-roadmap.md)** - Versioned milestones

### Feature Guides

- **[Core Builder](docs/guide-core-builder.md)** - WHERE, JOINs, pagination, sorting
- **[Composition](docs/guide-composition.md)** - Fragments, scopes, merge
- **[Subqueries](docs/guide-subqueries.md)** - IN, EXISTS, LATERAL
- **[Relations](docs/guide-relations.md)** - Models, eager loading, batch loading
- **[PostgreSQL](docs/guide-postgresql.md)** - JSONB, Full-Text Search, CTEs

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
