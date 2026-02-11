# Codebase Summary: pg-query-composer

## Overview

**pg-query-composer** is a feature-rich PostgreSQL query builder for TypeScript, organized as a 3,485 LOC library across 19 source files in 7 functional modules. The codebase follows a layered architecture with no circular dependencies, enabling extensibility and maintainability.

**Metrics:**
- **Total Source LOC:** 3,485
- **Total Files:** 19 TypeScript modules
- **Test Coverage:** 120+ test cases across 20 test files
- **Entry Points:** 5 named exports (main + 4 specialized modules)
- **Public API Surface:** 100+ functions, classes, and types

## Module Architecture

### 1. Core Module (`src/core/`)

**Purpose:** Foundation layer providing query building with 34 operators and parameterization.

**Files:**

| File | LOC | Purpose |
|------|-----|---------|
| query-composer.ts | 653 | QueryComposer class, fluent builder API, method chaining |
| types.ts | 149 | Type definitions (QueryOperator, Condition, PaginationOptions) |
| operators.ts | 114 | 34 operator implementations (exact, contains, between, etc.) |
| errors.ts | 62 | Custom error classes (InvalidColumnError, InvalidOperatorError, etc.) |

**Total:** 978 LOC

**Key Exports:**

```typescript
// Classes
export class QueryComposer

// Factory Functions
export function createQueryComposer(schema, table, options?)

// Constants
export const OPERATORS: Record<QueryOperator, OperatorHandler>
export const VALID_OPERATORS: readonly string[]

// Types
export type QueryOperator = /* 34 union members */
export type Condition = /* AND/OR/NOT conditions */
export type PaginationOptions = { page, limit, maxLimit }
```

**API Methods:**

```typescript
class QueryComposer {
  // WHERE conditions
  where(column: string, value: unknown): this
  andWhere(column: string, value: unknown): this
  orWhere(filterGroups: Record<string, unknown>[]): this
  notWhere(filters: Record<string, unknown>): this
  whereRaw(condition: string, values?: unknown[]): this

  // JOINs
  join(table: string, on: string, alias?: string): this
  leftJoin(table: string, on: string, alias?: string): this
  rightJoin(table: string, on: string, alias?: string): this

  // Aggregation
  groupBy(...fields: string[]): this
  having(condition: string, values?: unknown[]): this

  // Sorting & Selection
  orderBy(...fields: string[]): this
  select(...fields: string[]): this
  exclude(...fields: string[]): this

  // Pagination
  paginate(options: PaginationOptions): this
  getPaginationMeta(total?: number): PaginationMeta

  // Conditional Building
  when(condition: boolean, callback: (q: this) => this): this
  unless(condition: boolean, callback: (q: this) => this): this

  // Query Management
  apply(scope: Scope): this
  toSelect(): string
  toCount(): string
  toParam(): { text: string; values: unknown[] }
  toSQL(): string
  clone(): QueryComposer
  reset(): this
  getInternalState(): QueryState
  mergeFrom(other: QueryComposer): this
}
```

**Operator Categories (34 total):**

| Category | Count | Examples |
|----------|-------|----------|
| Comparison | 6 | exact, notexact, gt, gte, lt, lte |
| Text | 8 | contains, icontains, startswith, istartswith, endswith, iendswith, regex, iregex |
| Range | 4 | in, notin, between, notbetween |
| Null | 2 | isnull, isnotnull |
| Date | 10 | date, datebetween, year, month, day, week, today, thisweek, thismonth, thisyear |
| Array | 3 | arraycontains, arrayoverlap, arraycontained |

**Error Classes:**

```typescript
QueryComposerError (base)
  ├─ InvalidColumnError
  ├─ InvalidOperatorError
  ├─ RelationNotFoundError
  ├─ SubqueryError
  └─ TypeMismatchError
```

---

### 2. Composition Module (`src/composition/`)

**Purpose:** Reusable query patterns, fragments, and composition utilities.

**Files:**

| File | LOC | Purpose |
|------|-----|---------|
| fragment.ts | 230 | 15 pre-built filter fragment factory functions |
| scope.ts | 65 | Reusable query scopes (fixed and parameterized) |
| merge.ts | 57 | Combine multiple QueryComposer instances intelligently |

**Total:** 352 LOC

**Fragment Library (15 functions):**

```typescript
// Date operations
dateRange(field: string, start: Date, end: Date): FilterFragment
dateBetween(field: string, start: Date, end: Date): FilterFragment

// List operations
inList(field: string, values: unknown[]): FilterFragment
notInList(field: string, values: unknown[]): FilterFragment

// String matching
contains(field: string, value: string): FilterFragment
startsWith(field: string, value: string): FilterFragment
endsWith(field: string, value: string): FilterFragment

// Comparison
exact(field: string, value: unknown): FilterFragment
notEqual(field: string, value: unknown): FilterFragment
greaterThan(field: string, value: unknown): FilterFragment
greaterThanOrEqual(field: string, value: unknown): FilterFragment
lessThan(field: string, value: unknown): FilterFragment
lessThanOrEqual(field: string, value: unknown): FilterFragment

// Range
between(field: string, min: unknown, max: unknown): FilterFragment

// Null checks
isNull(field: string): FilterFragment
isNotNull(field: string): FilterFragment
```

**Scope Functions:**

```typescript
// Fixed scope
function scope(callback: (q: QueryComposer) => QueryComposer): Scope

// Parameterized scope
function parameterizedScope(
  callback: (q: QueryComposer, params: Record<string, unknown>) => QueryComposer
): ParameterizedScope
```

**Merge Functions:**

```typescript
// Merge two composers
function merge(composer1: QueryComposer, composer2: QueryComposer): QueryComposer

// Merge multiple composers
function mergeAll(composers: QueryComposer[]): QueryComposer
```

---

### 3. Subquery Module (`src/subquery/`)

**Purpose:** Support for subqueries, EXISTS patterns, and advanced SQL references.

**Files:**

| File | LOC | Purpose |
|------|-----|---------|
| builder.ts | 86 | Subquery builders (subquery, subqueryAs, rawSubquery) |
| exists.ts | 135 | EXISTS/NOT EXISTS patterns, references, LATERAL joins |

**Total:** 221 LOC

**Subquery Builders:**

```typescript
// Create IN subquery
function subquery(composer: QueryComposer): SubqueryBuilder

// Named subquery
function subqueryAs(composer: QueryComposer, alias: string): SubqueryBuilder

// Raw SQL subquery
function rawSubquery(sql: string, values?: unknown[]): SubqueryBuilder
```

**Existence & Reference Functions:**

```typescript
// EXISTS check
function exists(subquery: string | SubqueryBuilder): string

// NOT EXISTS check
function notExists(subquery: string | SubqueryBuilder): string

// Reference outer query field
function ref(field: string): string

// Raw SQL with parameters
function raw(sql: string, values?: unknown[]): RawSQL

// PostgreSQL LATERAL join
function lateral(subquery: string | SubqueryBuilder): string
```

**Example Usage:**

```typescript
import { subquery, exists, ref } from 'pg-query-composer/subquery';

const composer = createQueryComposer(schema, 'users');

// IN subquery
const activePostsSubquery = new QueryComposer(postSchema, 'posts')
  .where('status__exact', 'published');

composer.whereIn('id', subquery(activePostsSubquery));

// EXISTS
const hasPostsQuery = exists(
  new QueryComposer(postSchema, 'posts')
    .whereRaw(`posts.user_id = ${ref('users.id')}`)
);
composer.whereRaw(hasPostsQuery);
```

---

### 4. Relations Module (`src/relations/`)

**Purpose:** Model registry, relation definitions, eager loading, and N+1 prevention via DataLoader.

**Files:**

| File | LOC | Purpose |
|------|-----|---------|
| define.ts | 148 | Model registry, defineModel, getModel |
| include.ts | 188 | ModelQueryComposer with eager loading API |
| types.ts | 199 | Relation type definitions and interfaces |
| loader.ts | 300 | DataLoader-based batch loading implementation |

**Total:** 835 LOC

**Model Registry Functions:**

```typescript
function defineModel(
  modelName: string,
  config: ModelDefinition
): void

function getModel(modelName: string): ModelDefinition

function hasRelation(modelName: string, relationName: string): boolean

function getRelation(modelName: string, relationName: string): RelationConfig

function clearModelRegistry(): void

function getAllModels(): Map<string, ModelDefinition>
```

**Model Query Composer:**

```typescript
class ModelQueryComposer {
  // All QueryComposer methods plus:
  include(relationName: string, options?: IncludeOptions): this
  build(): Promise<Record<string, unknown>[]>
}

function createModelQuery(
  model: ModelDefinition,
  table: string
): ModelQueryComposer
```

**Relation Types (4):**

```typescript
type RelationType = 'belongsTo' | 'hasOne' | 'hasMany' | 'hasManyThrough'

// One-to-one (reverse)
interface BelongsToRelation {
  type: 'belongsTo'
  modelName: string
  foreignKey: string
}

// One-to-one (forward)
interface HasOneRelation {
  type: 'hasOne'
  modelName: string
  foreignKey: string
}

// One-to-many
interface HasManyRelation {
  type: 'hasMany'
  modelName: string
  foreignKey: string
}

// Many-to-many
interface HasManyThroughRelation {
  type: 'hasManyThrough'
  modelName: string
  throughModelName: string
  fromKey: string
  toKey: string
  throughFromKey: string
  throughToKey: string
}
```

**Batch Loading Functions:**

```typescript
function createRelationLoader(config: BatchLoadConfig): RelationLoader

function batchLoadBelongsTo(
  relation: BelongsToRelation,
  records: Record<string, unknown>[],
  executor: QueryExecutor
): Promise<Record<string, unknown>[]>

function batchLoadHasMany(
  relation: HasManyRelation,
  records: Record<string, unknown>[],
  executor: QueryExecutor
): Promise<Record<string, unknown>[]>

function createAllRelationLoaders(
  model: ModelDefinition,
  executor: QueryExecutor
): Map<string, RelationLoader>

function loadRelation(
  records: Record<string, unknown>[],
  relationName: string,
  loader: RelationLoader
): Promise<Record<string, unknown>[]>
```

**Example:**

```typescript
import { defineModel, createModelQuery } from 'pg-query-composer/relations';

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

const userQuery = createModelQuery(User, 'users');
const users = await userQuery
  .where('status__exact', 'active')
  .include('posts', { limit: 5 })
  .include('profile')
  .build();

console.log(users[0].posts); // Auto-populated via DataLoader
console.log(users[0].profile); // Auto-populated via DataLoader
```

---

### 5. Types Module (`src/types/`)

**Purpose:** Type-safe wrapper providing compile-time column and operation validation.

**Files:**

| File | LOC | Purpose |
|------|-----|---------|
| infer.ts | 216 | TypedQueryComposer with Zod schema type inference |

**Total:** 216 LOC

**Type-Safe Wrapper:**

```typescript
class TypedQueryComposer<T extends z.ZodTypeAny> {
  // Same methods as QueryComposer, with compile-time type checking
  where<K extends InferColumns<T>>(
    fieldOperator: `${K & string}__${QueryOperator}`,
    value: unknown
  ): this

  select<K extends InferColumns<T>>(...fields: K[]): this

  orderBy<K extends InferColumns<T>>(...fields: K[]): this
}

function createTypedComposer<T extends z.ZodTypeAny>(
  schema: T,
  table: string
): TypedQueryComposer<T>

function typedFilter<T extends z.ZodTypeAny>(
  schema: T,
  field: InferColumns<T>,
  operator: QueryOperator,
  value: unknown
): FilterFragment
```

**Type Utilities:**

```typescript
type InferColumns<T> = T extends z.ZodObject<infer U> ? keyof U : never

type InferZodType<T> = T extends z.ZodType<infer U> ? U : never

type TypedWhere<T> = {
  [K in InferColumns<T> as `${K & string}__${QueryOperator}`]: unknown
}

type TypedSelect<T> = {
  [K in InferColumns<T>]: boolean
}

type TypedOrderBy<T> = {
  [K in InferColumns<T>]: 'ASC' | 'DESC'
}

type InferResult<T> = T extends z.ZodObject<infer U>
  ? z.infer<z.ZodObject<U>>
  : never
```

**Example:**

```typescript
import { createTypedComposer } from 'pg-query-composer/types';

const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
});

const typed = createTypedComposer(userSchema, 'users');

// Compile-time validation
typed.where('email__contains', 'example.com'); // ✓ Type-safe
typed.where('invalid__exact', 'value'); // ✗ TypeScript error

const { text, values } = typed.toParam();
console.log('Type-safe query generated');
```

---

### 6. PostgreSQL Module (`src/pg/`)

**Purpose:** PostgreSQL-specific advanced features (JSONB, Full-Text Search, Recursive CTEs).

**Files:**

| File | LOC | Purpose |
|------|-----|---------|
| jsonb.ts | 226 | 11 JSONB operators and functions |
| fts.ts | 219 | 10 Full-Text Search methods |
| recursive.ts | 241 | Recursive CTE builder for hierarchies |

**Total:** 686 LOC

**JSONB Functions (11):**

```typescript
// Containment
jsonbContains(field: string, value: Record<string, unknown>): string
jsonbContainedBy(field: string, value: Record<string, unknown>): string

// Key operations
jsonbHasKey(field: string, key: string): string
jsonbHasAllKeys(field: string, keys: string[]): string
jsonbHasAnyKey(field: string, keys: string[]): string

// Path extraction
jsonbPath(field: string, path: string): string
jsonbPathText(field: string, path: string): string
jsonbExtract(field: string, path: string[]): string
jsonbExtractText(field: string, path: string[]): string

// Mutations
jsonbSet(field: string, path: string[], value: unknown): string

// Unnesting
jsonbArrayElements(field: string): string
jsonbObjectKeys(field: string): string
```

**Full-Text Search Functions (10):**

```typescript
// Search vectors
toTsVector(field: string | string[]): string
toTsQuery(query: string): string
plainto_tsquery(query: string): string
websearch_to_tsquery(query: string): string

// Search methods
fullTextSearch(field: string | string[], query: string): string
fullTextWebSearch(field: string | string[], query: string): string
fullTextRawSearch(field: string | string[], tsquery: string): string

// Ranking
fullTextRank(field: string | string[], query: string): string
fullTextRankCd(field: string | string[], query: string): string
tsHeadline(field: string, query: string): string
```

**Recursive CTE Builder:**

```typescript
class RecursiveCTEBuilder {
  addAnchor(sql: string, values?: unknown[]): this
  addRecursion(sql: string, values?: unknown[]): this
  setMaxDepth(depth: number): this
  build(): { sql: string; values: unknown[] }
}

function createRecursiveCTE(): RecursiveCTEBuilder

// Helper functions
function ancestorsCTE(
  table: string,
  idCol: string,
  parentCol: string,
  maxDepth?: number
): string

function descendantsCTE(
  table: string,
  idCol: string,
  parentCol: string,
  maxDepth?: number
): string
```

**Examples:**

```typescript
import { jsonbContains, fullTextWebSearch, ancestorsCTE } from 'pg-query-composer/pg';

// JSONB query
const composer = createQueryComposer(schema, 'products');
composer.where(jsonbContains('metadata', { color: 'blue' }));

// Full-Text Search
const searchComposer = createQueryComposer(schema, 'documents');
searchComposer.where(fullTextWebSearch('content', 'search terms'));

// Recursive CTE
const hierarchyQuery = ancestorsCTE('categories', 'id', 'parent_id', 5);
const results = await db.query(hierarchyQuery);
```

---

### 7. Utils Module (`src/utils/`)

**Purpose:** General-purpose utilities for schema introspection and type extraction.

**Files:**

| File | LOC | Purpose |
|------|-----|---------|
| zod-utils.ts | 59 | Zod schema introspection (v3/v4 compatible) |

**Total:** 59 LOC

**Schema Introspection:**

```typescript
function extractZodColumns(schema: z.ZodTypeAny): string[]
```

Handles:
- Simple types: string, number, boolean, etc.
- Complex types: z.object(), z.record()
- Zod v3 and v4 API differences
- Nested schema extraction

---

### 8. Main Entry Point (`src/index.ts`)

**Purpose:** Barrel export aggregating all public APIs from 7 modules.

**File:**

| File | LOC | Purpose |
|------|-----|---------|
| index.ts | 157 | Re-export all public APIs, VERSION constant |

**Total:** 157 LOC

**Version:**

```typescript
export const VERSION = '1.0.1'
```

**All Public Exports:** 100+ named exports covering classes, functions, and types from all modules.

---

## Module Summary Table

| Module | Files | LOC | Exports | Key Feature |
|--------|-------|-----|---------|------------|
| core | 4 | 978 | QueryComposer, 34 operators | Query building foundation |
| composition | 3 | 352 | 15 fragments, scopes, merge | Reusable patterns |
| subquery | 2 | 221 | Subqueries, EXISTS, LATERAL | Advanced SQL patterns |
| relations | 4 | 835 | Models, eager load, DataLoader | N+1 prevention |
| types | 1 | 216 | TypedQueryComposer | Compile-time validation |
| pg | 3 | 686 | JSONB, FTS, Recursive CTEs | PostgreSQL features |
| utils | 1 | 59 | extractZodColumns | Schema introspection |
| index | 1 | 157 | Barrel exports | Public API |
| **TOTAL** | **19** | **3,485** | **100+** | **Complete Query Builder** |

---

## Test Coverage Structure

**20 test files, 120+ test cases**

| Module | Files | Cases | Focus |
|--------|-------|-------|-------|
| core | 4 | ~40 | Operators, validation, errors |
| composition | 4 | ~30 | Fragments, scopes, merge |
| subquery | 3 | ~25 | Builders, EXISTS, IN patterns |
| relations | 4 | ~20 | Models, eager load, batch load |
| pg | 3 | ~15 | JSONB, FTS, Recursive CTEs |
| types | 1 | ~5 | Type inference |
| integration | 1 | ~11 | Real-world full-workflow scenarios |

**Test Framework:** Vitest with V8 coverage

---

## Dependency Tree

```
pg-query-composer/
├─ Runtime Dependencies
│  └─ squel ^5.13.0 (SQL builder)
│
├─ Peer Dependencies
│  └─ zod ^3.23.0 (schema validation)
│
├─ Dev Dependencies
│  ├─ TypeScript ^5.4.0
│  ├─ Vitest ^1.6.0
│  ├─ dataloader ^2.2.0
│  └─ @types/node ^20.0.0
│
└─ Module Dependencies
   core/ (no internal deps)
   ├─ squel, zod, operators, errors, zod-utils
   composition/ ← core/
   subquery/ ← core/
   relations/ ← core/ + dataloader
   types/ ← core/
   pg/ (mostly standalone, recursive ← core/)
   utils/ ← zod
```

---

## Build & Distribution

**Output:** CommonJS modules with TypeScript definitions

```
dist/
├── index.js / index.d.ts (main entry)
├── core/                  (4 files)
├── composition/           (3 files)
├── subquery/             (2 files)
├── relations/            (4 files)
├── types/                (1 file)
├── pg/                   (3 files)
└── utils/                (1 file)
```

**Entry Points (package.json exports):**

```json
{
  ".": "./dist/index.js",
  "./composition": "./dist/composition/index.js",
  "./subquery": "./dist/subquery/index.js",
  "./relations": "./dist/relations/index.js",
  "./pg": "./dist/pg/index.js"
}
```

---

## Code Metrics

| Metric | Value | Context |
|--------|-------|---------|
| Average file size | 183 LOC | Well-distributed |
| Largest file | 653 LOC | query-composer.ts (tight control) |
| Smallest file | 57 LOC | merge.ts (focused) |
| Classes | 3 | QueryComposer, TypedQueryComposer, ModelQueryComposer |
| Factory Functions | 6 | createQueryComposer, createTypedComposer, etc. |
| Public Methods | 20+ | Per QueryComposer |
| Test-to-code ratio | 1:0.67 | ~2,100 LOC tests for 3,485 LOC src |
| Cyclomatic Complexity | Low | Minimal nesting, clear control flow |

---

## Key Characteristics

✓ **No circular dependencies** - Acyclic module graph
✓ **Type-safe** - Strict TypeScript mode throughout
✓ **Parameterized queries** - 100% SQL injection prevention
✓ **Batch loading** - DataLoader integration for N+1 prevention
✓ **Extensible** - Clear patterns for adding operators, fragments, and features
✓ **Well-tested** - 120+ test cases, V8 coverage reporting
✓ **Named exports** - 5 entry points for flexible imports
✓ **v3/v4 compatible** - Zod version agnostic schema introspection

---

**Document Version:** 1.1
**Last Updated:** 2026-02-11
**Maintainer:** Documentation Team
