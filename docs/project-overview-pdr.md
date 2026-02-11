# pg-query-composer: Project Overview & PDR

## Project Identity

**Name:** pg-query-composer
**Version:** 1.0.1
**Type:** Advanced PostgreSQL Query Builder Library
**Language:** TypeScript
**Target Audience:** Node.js/TypeScript developers using PostgreSQL
**License:** MIT

## Project Description

pg-query-composer is a feature-rich, type-safe SQL query builder for PostgreSQL designed for Node.js/TypeScript applications. It provides a fluent, chainable API for composing complex queries dynamically, with built-in support for relations, subqueries, and PostgreSQL-specific features.

**Core Philosophy:** Enable developers to write type-safe, parameterized SQL queries without writing raw SQL strings, preventing SQL injection while maintaining readability and flexibility.

## Goals & Non-Goals

### Primary Goals

1. **Type Safety:** Compile-time validation of columns and operations via Zod schemas
2. **Dynamic Composition:** Build queries conditionally and programmatically
3. **SQL Injection Prevention:** Automatic parameterization of all values
4. **Relation Support:** Eager loading with batch loading (N+1 prevention)
5. **PostgreSQL Features:** JSONB, Full-Text Search, Recursive CTEs, Arrays
6. **Developer Experience:** Fluent, intuitive API; minimal boilerplate
7. **Performance:** Efficient batch loading; minimal query overhead

### Non-Goals

- Support for multiple database backends (PostgreSQL only)
- ORM-level features (migrations, model definitions, hooks)
- Query caching/memoization layer
- CLI tools or code generation utilities
- GraphQL/REST API auto-generation

## Key Features

### Core Capabilities

- **Django-style Operators:** `field__operator=value` syntax for 34+ operators
- **Fluent Builder API:** Chainable methods for intuitive query construction
- **WHERE/AND/OR Logic:** Complex condition groups with easy composition
- **Pagination:** Automatic LIMIT/OFFSET with metadata (page, total, hasNext)
- **Sorting:** Multi-field sorting with custom directions
- **Column Selection:** SELECT/EXCLUDE specific columns or all fields
- **Parameterized Queries:** Automatic value binding prevents SQL injection

### Advanced Features

- **Type-Safe Queries:** TypedQueryComposer with compile-time column validation
- **Reusable Fragments:** Pre-defined filter combinations (dateRange, inList, contains)
- **Query Scopes:** Reusable query modifications (parameterized or fixed)
- **Query Merging:** Combine multiple QueryComposer instances intelligently
- **Subqueries:** IN/EXISTS subqueries with raw SQL support
- **Relations (4 types):** belongsTo, hasOne, hasMany, hasManyThrough
- **Eager Loading:** Include relations with nested filtering/pagination
- **Batch Loading:** DataLoader-based loading prevents N+1 queries
- **JSONB Operations:** 11 JSONB operators (contains, path extraction, set operations)
- **Full-Text Search:** 5 FTS methods (websearch, plainto, raw, rank functions, headlines)
- **Recursive CTEs:** Build hierarchical queries (ancestors, descendants)
- **Zod Integration:** Automatic schema introspection (v3 & v4 compatible)

### Operator Categories (34 total)

| Category | Operators | Count |
|----------|-----------|-------|
| Comparison | exact, notexact, gt, gte, lt, lte | 6 |
| Text | contains, icontains, startswith, istartswith, endswith, iendswith, regex, iregex | 8 |
| Range | in, notin, between, notbetween | 4 |
| Null | isnull, isnotnull | 2 |
| Date | date, datebetween, year, month, day, week, today, thisweek, thismonth, thisyear | 10 |
| Array | arraycontains, arrayoverlap, arraycontained | 3 |
| Logical | AND, OR, NOT (implicit in composition) | - |

## Technical Stack

### Core Dependencies
- **Runtime:** squel ^5.13.0 (SQL builder)
- **Peer:** zod ^3.23.0 (schema validation)
- **Dev:** TypeScript 5.4+, Vitest, Node 20+

### Configuration
- **Target:** ES2022 (CommonJS)
- **Strict Mode:** Enabled by default (TypeScript strict=true)
- **Declaration Maps:** Source maps + type definitions
- **Entry Points:** 5 module exports (main, ./composition, ./subquery, ./relations, ./pg)

## Module Architecture

```
┌─ core/                    (Query building foundation)
│  ├─ query-composer.ts    (Main builder class, fluent API)
│  ├─ types.ts             (Type definitions)
│  ├─ operators.ts         (34 operator implementations)
│  └─ errors.ts            (Custom errors)
│
├─ composition/            (Reusable query fragments)
│  ├─ fragment.ts          (13 pre-built filter fragments)
│  ├─ scope.ts             (Reusable query scopes)
│  └─ merge.ts             (Combine multiple composers)
│
├─ subquery/               (Subquery support)
│  ├─ builder.ts           (subquery, subqueryAs, rawSubquery)
│  └─ exists.ts            (EXISTS/NOT EXISTS, refs, laterals)
│
├─ relations/              (Eager loading & batch loading)
│  ├─ define.ts            (Model registry & definitions)
│  ├─ include.ts           (ModelQueryComposer eager loading)
│  ├─ types.ts             (Relation type definitions)
│  └─ loader.ts            (DataLoader-based batch loading)
│
├─ types/                  (Type-safe wrapper)
│  └─ infer.ts             (TypedQueryComposer with validation)
│
├─ pg/                     (PostgreSQL-specific features)
│  ├─ jsonb.ts             (11 JSONB operators)
│  ├─ fts.ts               (5 Full-Text Search methods)
│  └─ recursive.ts         (Recursive CTE builder)
│
└─ utils/                  (Utilities)
   └─ zod-utils.ts         (Zod schema introspection)
```

## Module Dependency Graph

```
index.ts (barrel exports)
│
├─ core/
│  ├─ query-composer.ts ──→ squel + zod + operators + errors + zod-utils
│  ├─ operators.ts (34 handlers)
│  ├─ types.ts
│  └─ errors.ts
│
├─ composition/
│  ├─ fragment.ts ───→ core
│  ├─ scope.ts ──────→ core
│  └─ merge.ts ──────→ core
│
├─ subquery/
│  ├─ builder.ts ────→ core
│  └─ exists.ts ─────→ core
│
├─ relations/
│  ├─ define.ts ────→ core
│  ├─ include.ts ───→ core + dataloader
│  ├─ loader.ts ────→ core + dataloader
│  └─ types.ts
│
├─ types/
│  └─ infer.ts ─────→ core
│
├─ pg/
│  ├─ jsonb.ts ─────→ standalone
│  ├─ fts.ts ───────→ standalone
│  └─ recursive.ts ──→ core
│
└─ utils/
   └─ zod-utils.ts ──→ zod (v3/v4 compatible)
```

## Entry Points & Exports

### Main Export (`.`)
All public API including core, composition, subquery, relations, types, pg, utils.

### Named Exports

| Export | Purpose |
|--------|---------|
| `./composition` | Fragments, scopes, merge utilities |
| `./subquery` | Subquery builders and existence checks |
| `./relations` | Model definition, eager loading, batch loading |
| `./pg` | JSONB, FTS, Recursive CTE operations |

## Design Patterns

### 1. Builder Pattern
Fluent, chainable API for composing queries step-by-step.

```typescript
composer
  .where('status__exact', 'active')
  .andWhere('created_at__gte', new Date('2024-01-01'))
  .orderBy('created_at', 'DESC')
  .paginate({ page: 1, limit: 20 })
```

### 2. Factory Functions
Create instances with sensible defaults.

```typescript
const composer = createQueryComposer(schema, 'users');
const typed = createTypedComposer(schema, 'posts');
```

### 3. Scope Pattern
Encapsulate reusable query modifications.

```typescript
const activeScope = scope((q) => q.where('deleted_at__isnull', true));
const recentScope = scope((q) =>
  q.where('created_at__gte', 30 days ago)
);
```

### 4. Fragment Pattern
Pre-defined, composable filter blocks.

```typescript
const f = dateRange(field, startDate, endDate);
composer.where(...f);
```

### 5. DataLoader Pattern
Batch-load relations to prevent N+1 queries.

```typescript
const loader = createRelationLoader({
  relation: 'author',
  batchFn: async (ids) => fetchAuthorsInBatch(ids)
});
```

## Test Coverage

**20 test files, 120+ test cases**

| Module | Files | Coverage |
|--------|-------|----------|
| core | 4 | operators, composition, type validation |
| composition | 4 | fragments, scopes, merge, conditional |
| subquery | 3 | builders, EXISTS, WHERE IN |
| relations | 4 | definitions, eager load, batch load |
| pg | 3 | JSONB, FTS, Recursive CTEs |
| types | 1 | type inference |
| integration | 1 | 11 real-world scenarios |

**Test Framework:** Vitest with V8 coverage
**Schema Testing:** Zod schemas across all tests
**SQL Assertion:** Parameterized query validation

## Status & Roadmap

### Current Status: v1.0.1
- Core query builder complete
- All operator categories implemented
- Relations and eager loading functional
- PostgreSQL features (JSONB, FTS, Recursive CTE) complete
- Type-safe wrappers ready
- Test suite comprehensive

### Future Roadmap (Post-v1.0.1)

**v0.2.0 - Performance & DevX**
- Query caching layer
- Better error messages with query context
- Extended Zod integration (z.discriminatedUnion support)

**v0.3.0 - SQL Features**
- Window functions
- HAVING clause improvements
- CTEs (non-recursive)
- DISTINCT support

**v0.4.0 - Developer Tools**
- Query logging/debugging utilities
- Performance analysis helpers
- Integration examples (Express, Fastify, NestJS)

## Acceptance Criteria (v1.0.1)

- [x] Core QueryComposer with 34 operators
- [x] Type-safe TypedQueryComposer wrapper
- [x] 13 reusable filter fragments
- [x] Scope and merge utilities
- [x] Subquery support (IN, EXISTS, EXISTS NOT)
- [x] 4 relation types with eager loading
- [x] DataLoader-based batch loading
- [x] 11 JSONB operators
- [x] Full-Text Search (5 methods)
- [x] Recursive CTE builder
- [x] Parameterized queries (SQL injection prevention)
- [x] Pagination with metadata
- [x] 120+ test cases (90%+ coverage)
- [x] TypeScript strict mode compliance
- [x] CommonJS distribution (ES2022 target)
- [x] 5 named module exports
- [x] Zod v3/v4 compatibility

## Dependencies Summary

| Type | Name | Version | Purpose |
|------|------|---------|---------|
| Runtime | squel | ^5.13.0 | SQL builder primitives |
| Peer | zod | ^3.23.0 | Schema validation, introspection |
| Dev | TypeScript | ^5.4.0 | Language & type checking |
| Dev | Vitest | ^1.6.0 | Test framework, coverage |
| Dev | dataloader | ^2.2.0 | Batch loading (batch only in dev) |
| Dev | @types/node | ^20.0.0 | Node.js type definitions |

**Note:** dataloader is in devDependencies for development/examples but should be installed by consumers using relation features.

## Getting Started

### Installation

```bash
npm install pg-query-composer zod
```

### Basic Setup

```typescript
import { z } from 'zod';
import { createQueryComposer } from 'pg-query-composer';

// Step 1: Define Schema
const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  status: z.string(),
  created_at: z.string().datetime(),
});

// Step 2: Create Composer
const composer = createQueryComposer(userSchema, 'users');

// Step 3: Build Query
const result = composer
  .where('status__exact', 'active')
  .where('email__contains', 'gmail.com')
  .orderBy('-created_at')
  .paginate({ page: 1, limit: 10 })
  .toParam();

// Step 4: Execute (example with pg library)
const { text, values } = result;
console.log('SQL:', text);
// SELECT * FROM users WHERE status = $1 AND email LIKE $2 ORDER BY created_at DESC LIMIT 10 OFFSET 0
console.log('Values:', values);
// ['active', '%gmail.com%']
```

## Success Metrics

- **Type Safety:** 0 runtime column/operator errors with TypeScript strict mode
- **SQL Injection:** 100% parameterized queries, 0 string concatenation
- **Performance:** Batch loading reduces N+1 to 1 round-trip per relation depth
- **Developer Time:** Complex queries built in 50% fewer lines vs raw SQL

---

**Document Version:** 1.0
**Last Updated:** 2026-02-07
**Author:** Documentation Team
**Status:** Complete for v1.0.1
