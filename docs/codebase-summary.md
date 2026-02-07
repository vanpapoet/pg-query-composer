# Codebase Summary

## Overview

**pg-query-composer** is a 3,485 LOC TypeScript query builder library organized into 19 source files across 7 functional modules. Each module focuses on a specific capability layer in the query composition process.

**Total Lines of Code:** 3,485 (source only, excluding tests)
**Total Files:** 19 TypeScript files
**Test Coverage:** 20 test files, 120+ test cases

## Module Breakdown

### 1. Core Module (`src/core/`)

Foundation layer providing basic query building with 34 operators.

#### Files

| File | LOC | Purpose |
|------|-----|---------|
| query-composer.ts | 653 | Main QueryComposer class, fluent builder API |
| types.ts | 149 | Type definitions (operators, pagination, conditions) |
| operators.ts | 114 | 34 operator implementations (comparison, text, range, null, date, array) |
| errors.ts | 62 | Custom error classes (InvalidColumn, InvalidOperator, RelationNotFound, etc.) |

**Total:** 978 LOC

#### Key Exports

- `class QueryComposer` - Main builder class
- `function createQueryComposer()` - Factory for creating instances
- `type QueryOperator` - Union of all 34 operator types
- `const OPERATORS` - Registry mapping operator names to handlers
- `const VALID_OPERATORS` - Array of valid operator strings

#### API Methods

| Method | Purpose |
|--------|---------|
| `.where()` | Add AND condition with field__operator syntax |
| `.andWhere()` | Explicit AND condition |
| `.orWhere()` | Add OR condition (grouped) |
| `.notWhere()` | Add NOT condition |
| `.join()` | Add table join |
| `.groupBy()` | Group results |
| `.having()` | Having clause for aggregates |
| `.orderBy()` | Sort results (ASC/DESC) |
| `.select()` / `.exclude()` | Choose columns |
| `.paginate()` | LIMIT/OFFSET with metadata |
| `.build()` | Generate parameterized SQL + values |

#### Operator Categories (34 total)

- **Comparison (6):** exact, notexact, gt, gte, lt, lte
- **Text (8):** contains, icontains, startswith, istartswith, endswith, iendswith, regex, iregex
- **Range (4):** in, notin, between, notbetween
- **Null (2):** isnull, isnotnull
- **Date (10):** date, datebetween, year, month, day, week, today, thisweek, thismonth, thisyear
- **Array (3):** arraycontains, arrayoverlap, arraycontained

### 2. Composition Module (`src/composition/`)

Reusable query patterns and utility functions for composing queries.

#### Files

| File | LOC | Purpose |
|------|-----|---------|
| fragment.ts | 230 | 13 pre-built filter fragments (dateRange, inList, contains, etc.) |
| scope.ts | 65 | Reusable query scopes (fixed and parameterized) |
| merge.ts | 57 | Combine multiple QueryComposer instances with conflict resolution |

**Total:** 352 LOC

#### Key Exports

**Fragments (13):**
- dateRange, inList, notInList, contains, startsWith, endsWith, between
- exact, notEqual, greaterThan, greaterThanOrEqual, lessThan, lessThanOrEqual
- isNull, isNotNull

**Scopes:**
- `function scope()` - Fixed scope function
- `function parameterizedScope()` - Scope with dynamic parameters

**Merge:**
- `function merge()` - Combine 2 composers
- `function mergeAll()` - Combine multiple composers

### 3. Subquery Module (`src/subquery/`)

Subquery builders for IN/EXISTS/NOT EXISTS patterns.

#### Files

| File | LOC | Purpose |
|------|-----|---------|
| builder.ts | 86 | Create subqueries (subquery, subqueryAs, rawSubquery) |
| exists.ts | 135 | EXISTS/NOT EXISTS patterns, field references, LATERAL |

**Total:** 221 LOC

#### Key Exports

**Builders:**
- `function subquery()` - Create IN subquery
- `function subqueryAs()` - Create named subquery
- `function rawSubquery()` - Raw SQL subquery

**Existence & References:**
- `function exists()` - EXISTS subquery
- `function notExists()` - NOT EXISTS subquery
- `function ref()` - Reference outer query field
- `function raw()` - Raw SQL with parameters
- `function lateral()` - PostgreSQL LATERAL subquery

### 4. Relations Module (`src/relations/`)

Multi-table queries, model definitions, eager loading, and batch loading.

#### Files

| File | LOC | Purpose |
|------|-----|---------|
| define.ts | 148 | Model registry and relation definitions |
| include.ts | 188 | ModelQueryComposer for eager loading |
| types.ts | 199 | Relation type definitions (belongsTo, hasOne, hasMany, hasManyThrough) |
| loader.ts | 300 | DataLoader-based batch loading (N+1 prevention) |

**Total:** 835 LOC

#### Key Exports

**Model Registry:**
- `function defineModel()` - Register model with relations
- `function getModel()` - Retrieve model definition
- `function hasRelation()` - Check if relation exists
- `function getRelation()` - Get specific relation
- `function clearModelRegistry()` - Reset registry (testing)
- `function getAllModels()` - Get all registered models

**Eager Loading:**
- `class ModelQueryComposer` - Query builder with eager loading support
- `function createModelQuery()` - Factory for ModelQueryComposer
- `function normalizeIncludeOptions()` - Options parsing

**Batch Loading:**
- `function createRelationLoader()` - Create batch loader
- `function batchLoadBelongsTo()` - Load belongsTo relations
- `function batchLoadHasMany()` - Load hasMany relations
- `function groupByKey()` - Helper for grouping
- `function createAllRelationLoaders()` - Create loaders for all relations
- `function loadRelation()` - Execute relation load

**Types:**
- RelationType union
- BelongsToRelation, HasOneRelation, HasManyRelation, HasManyThroughRelation
- RelationConfig, ModelDefinition, IncludeOptions
- LoadedRelation, BatchLoadConfig
- QueryExecutor type

### 5. Types Module (`src/types/`)

Type-safe wrapper with compile-time column and operation validation.

#### Files

| File | LOC | Purpose |
|------|-----|---------|
| infer.ts | 216 | TypedQueryComposer with Zod schema inference |

**Total:** 216 LOC

#### Key Exports

- `class TypedQueryComposer` - Type-safe builder
- `function createTypedComposer()` - Factory with type inference
- `function typedFilter()` - Type-safe filter creation

**Types:**
- InferColumns - Extract columns from schema
- InferZodType - Type inference from Zod
- TypedWhere, TypedSelect, TypedOrderBy - Type-safe method signatures
- InferResult - Result type inference

### 6. PostgreSQL Module (`src/pg/`)

PostgreSQL-specific advanced features.

#### Files

| File | LOC | Purpose |
|------|-----|---------|
| jsonb.ts | 226 | 11 JSONB operators (contains, path, set, unnest) |
| fts.ts | 219 | 5 Full-Text Search methods (websearch, plainto, ranking) |
| recursive.ts | 241 | Recursive CTE builder for hierarchies |

**Total:** 686 LOC

#### Key Exports

**JSONB (11 operators):**
- jsonbContains, jsonbContainedBy, jsonbHasKey, jsonbHasAllKeys, jsonbHasAnyKey
- jsonbPath, jsonbPathText, jsonbExtract, jsonbExtractText
- jsonbSet, jsonbArrayElements, jsonbObjectKeys

**Full-Text Search (5 methods):**
- fullTextSearch, fullTextWebSearch, fullTextRawSearch
- fullTextRank, fullTextRankCd
- toTsVector, toTsQuery, plainto_tsquery, websearch_to_tsquery, tsHeadline

**Recursive CTEs (3 builders):**
- RecursiveCTEBuilder class
- createRecursiveCTE factory
- ancestorsCTE, descendantsCTE helpers

### 7. Utils Module (`src/utils/`)

General-purpose utilities.

#### Files

| File | LOC | Purpose |
|------|-----|---------|
| zod-utils.ts | 59 | Extract column names from Zod schemas (v3/v4 compatible) |

**Total:** 59 LOC

#### Key Exports

- `function extractZodColumns()` - Parse Zod schema into column array

### 8. Main Entry Point (`src/index.ts`)

Barrel export file combining all modules.

#### File

| File | LOC | Purpose |
|------|-----|---------|
| index.ts | 157 | Re-export all public API, VERSION constant |

**Total:** 157 LOC

#### Key Exports

All exports from 7 modules plus:
- `const VERSION = '0.1.0'`
- 40+ named exports across types, functions, classes

## Summary Table

| Module | Files | LOC | Key Features | Dependencies |
|--------|-------|-----|--------------|--------------|
| core | 4 | 978 | Query builder, 34 operators | squel, zod |
| composition | 3 | 352 | Fragments, scopes, merge | core |
| subquery | 2 | 221 | Subqueries, EXISTS, LATERAL | core |
| relations | 4 | 835 | Models, eager load, batch load | core, dataloader |
| types | 1 | 216 | Type-safe wrapper | core |
| pg | 3 | 686 | JSONB, FTS, Recursive CTEs | core (recursive only) |
| utils | 1 | 59 | Schema introspection | zod |
| index | 1 | 157 | Barrel export | all modules |
| **TOTAL** | **19** | **3,485** | | |

## Test Structure

**20 test files, 120+ test cases**

### Test Files by Module

| Module | Test Files | Test Cases | Focus |
|--------|-----------|-----------|-------|
| core | 4 | ~40 | Operators, composition, validation, errors |
| composition | 4 | ~30 | Fragments, scopes, merge, conditionals |
| subquery | 3 | ~25 | Builders, EXISTS patterns, WHERE IN |
| relations | 4 | ~20 | Model definitions, eager load, batch load |
| pg | 3 | ~15 | JSONB ops, FTS methods, Recursive CTEs |
| types | 1 | ~5 | Type inference validation |
| integration | 1 | ~11 | Real-world scenarios (full-workflow) |

### Integration Tests

`tests/integration/full-workflow.test.ts` - 11 scenarios:

1. Basic WHERE with operators
2. Pagination with metadata
3. Complex AND/OR conditions
4. Eager loading belongsTo
5. Eager loading hasMany
6. Batch loading N+1 prevention
7. JSONB queries
8. Full-Text Search
9. Recursive CTEs
10. Type-safe queries
11. Query merging and scopes

### Test Coverage Goals
- Line coverage: 85%+
- Branch coverage: 80%+
- Function coverage: 90%+
- All public APIs tested
- Edge cases for operators

## Dependency Tree

```
pg-query-composer
│
├─ Runtime Dependencies
│  └─ squel (SQL builder)
│
├─ Peer Dependencies
│  └─ zod (schema validation)
│
├─ Dev Dependencies
│  ├─ TypeScript (compilation)
│  ├─ Vitest (testing)
│  ├─ dataloader (batch loading)
│  └─ @types/node (type defs)
│
└─ Transitive Dependencies
   ├─ squel (tsql-parser)
   └─ zod (none internal)
```

## File Size Distribution

```
Distribution of file sizes:

Large (200+ LOC):
  - query-composer.ts (653)
  - loader.ts (300)
  - recursive.ts (241)
  - jsonb.ts (226)
  - fragment.ts (230)
  - fts.ts (219)
  - infer.ts (216)

Medium (100-200 LOC):
  - types.ts (199)
  - relations/types.ts (199)
  - include.ts (188)
  - index.ts (157)
  - relations/define.ts (148)
  - core/types.ts (149)

Small (50-100 LOC):
  - operators.ts (114)
  - builder.ts (86)
  - scope.ts (65)
  - errors.ts (62)
  - zod-utils.ts (59)
  - merge.ts (57)

Tiny (<50 LOC):
  - exists.ts (135) - note: not tiny, but reference included
```

## Import Patterns

### Cross-Module Imports

```
index.ts (imports from all 7 modules)
   ↓
composition/ (imports from core/)
subquery/ (imports from core/)
relations/ (imports from core/ + dataloader)
types/ (imports from core/)
pg/recursive.ts (imports from core/)
pg/jsonb.ts, pg/fts.ts (standalone)
utils/ (imports from zod)
```

### No Circular Dependencies

Dependency graph is acyclic (DAG):
- core has no internal imports
- composition, subquery, types depend only on core
- relations depend on core + dataloader
- pg modules have minimal dependencies
- utils only on zod

## API Surface

**Total Public Exports: 100+**

| Category | Count | Examples |
|----------|-------|----------|
| Classes | 3 | QueryComposer, TypedQueryComposer, ModelQueryComposer |
| Factory Functions | 6 | createQueryComposer, createTypedComposer, createModelQuery |
| Query Methods | 15 | where, andWhere, orWhere, join, groupBy, orderBy, paginate, build |
| Fragment Functions | 13 | dateRange, inList, contains, between, isNull |
| Scope Functions | 2 | scope, parameterizedScope |
| Utility Functions | 5 | merge, mergeAll, subquery, exists, notExists |
| JSONB Functions | 11 | jsonbContains, jsonbPath, jsonbSet, etc. |
| FTS Functions | 9 | fullTextSearch, fullTextRank, toTsVector, etc. |
| CTE Builders | 3 | RecursiveCTEBuilder, ancestorsCTE, descendantsCTE |
| Model Functions | 7 | defineModel, getModel, createModelQuery, createRelationLoader |
| Type Exports | 20+ | QueryOperator, Condition, RelationType, TypedWhere, etc. |

## Code Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Average file size | 183 LOC | Well-distributed |
| Largest file | 653 LOC | query-composer (tight control) |
| Smallest file | 57 LOC | merge.ts (focused) |
| Avg methods per class | 12 | QueryComposer has ~20 |
| Cyclomatic complexity | Low | Few nested conditions |
| Test-to-code ratio | 1:0.67 | ~2,100 LOC tests to 3,485 LOC src |

## Build Output

**CommonJS Distribution**

```
dist/
├── index.js / index.d.ts (main export)
├── core/
│   ├── query-composer.js / .d.ts
│   ├── types.js / .d.ts
│   ├── operators.js / .d.ts
│   └── errors.js / .d.ts
├── composition/
│   ├── fragment.js / .d.ts
│   ├── scope.js / .d.ts
│   └── merge.js / .d.ts
├── subquery/
│   ├── builder.js / .d.ts
│   └── exists.js / .d.ts
├── relations/
│   ├── define.js / .d.ts
│   ├── include.js / .d.ts
│   ├── loader.js / .d.ts
│   └── types.js / .d.ts
├── types/
│   └── infer.js / .d.ts
├── pg/
│   ├── jsonb.js / .d.ts
│   ├── fts.js / .d.ts
│   └── recursive.js / .d.ts
└── utils/
    └── zod-utils.js / .d.ts
```

**Declaration Maps:** Source maps enable IDE navigation to TypeScript source.

## Entry Points (package.json exports)

```json
{
  ".": "./dist/index.js",
  "./composition": "./dist/composition/index.js",
  "./subquery": "./dist/subquery/index.js",
  "./relations": "./dist/relations/index.js",
  "./pg": "./dist/pg/index.js"
}
```

Consumers can import:
- `import { QueryComposer } from 'pg-query-composer'` (main)
- `import { fragment } from 'pg-query-composer/composition'`
- `import { exists } from 'pg-query-composer/subquery'`
- `import { defineModel } from 'pg-query-composer/relations'`
- `import { jsonbContains } from 'pg-query-composer/pg'`

## Version History

**Current: v0.1.0 (2026-02-07) - Initial Release**

All 7 modules complete, tested, documented.

## Compilation Target

- **Target:** ES2022 (modern JavaScript)
- **Module System:** CommonJS
- **Output:** dist/ with JavaScript + TypeScript definitions
- **Compile Time:** < 5 seconds (typical)

---

**Document Version:** 1.0
**Last Updated:** 2026-02-07
**Maintainer:** Documentation Team
