# System Architecture

## Architectural Overview

pg-query-composer follows a **layered, modular architecture** designed for extensibility, type safety, and performance. The system decomposes into 7 functional layers plus utilities.

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 7: Integration & Extensions (consumers using library)  │
├─────────────────────────────────────────────────────────────┤
│ Layer 6: Specialized Features (JSONB, FTS, Recursive CTEs)   │
├─────────────────────────────────────────────────────────────┤
│ Layer 5: Relations & Eager Loading (multi-table queries)     │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: Type Safety (Zod-based type inference)              │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Composition & Reusability (fragments, scopes, merge)│
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Advanced Queries (subqueries, EXISTS, references)   │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Core Builder (operators, WHERE/GROUP/ORDER BY)      │
├─────────────────────────────────────────────────────────────┤
│ Foundation: squel (SQL primitives) + Zod (schema validation) │
└─────────────────────────────────────────────────────────────┘
```

## Layer Details

### Layer 1: Core Builder

**Location:** `src/core/`
**Responsibility:** Fundamental query building with operator support

**Components:**

| Component | LOC | Purpose |
|-----------|-----|---------|
| query-composer.ts | 653 | Main QueryComposer class with fluent API |
| types.ts | 149 | Type definitions (34 operators, pagination, sorting) |
| operators.ts | 114 | Operator handlers (comparison, text, range, null, date, array) |
| errors.ts | 62 | Custom error classes (InvalidColumn, InvalidOperator, etc.) |

**Key Abstractions:**

- `QueryComposer` class: Stateful builder maintaining conditions, sort, pagination
- Operator registry: Maps operator names to handler functions
- Column whitelist: Validates against Zod schema + extraColumns
- Parameterized values: Accumulates with `$1, $2, ...` placeholders

**Design Pattern:** Builder (fluent, chainable)

**Data Flow:**
```
User calls .where(column, value)
    ↓
Parse field__operator format
    ↓
Validate column + operator
    ↓
Apply operator handler
    ↓
Add condition to internal list
    ↓
Return this (chain)
```

### Layer 2: Advanced Queries

**Location:** `src/subquery/`
**Responsibility:** Subqueries and complex reference patterns

**Components:**

| Component | LOC | Purpose |
|-----------|-----|---------|
| builder.ts | 86 | Subquery creation (subquery, subqueryAs, rawSubquery) |
| exists.ts | 135 | EXISTS/NOT EXISTS, ref(), raw(), lateral() patterns |

**Key Functions:**

- `subquery(composer)` → Returns nested SQL for IN/NOT IN
- `exists(query)` → EXISTS subquery pattern
- `ref(field)` → Reference field from outer query
- `raw(sql)` → Raw SQL with parameter placeholders
- `lateral(subquery)` → PostgreSQL LATERAL for correlated subqueries

**Pattern Samples:**

```sql
-- IN subquery
WHERE id IN (SELECT user_id FROM orders WHERE status = $1)

-- EXISTS
WHERE EXISTS (SELECT 1 FROM posts WHERE user_id = users.id)

-- LATERAL
SELECT * FROM users,
  LATERAL (SELECT * FROM posts WHERE user_id = users.id LIMIT 5)
```

### Layer 3: Composition & Reusability

**Location:** `src/composition/`
**Responsibility:** Reusable query patterns and combination logic

**Components:**

| Component | LOC | Purpose |
|-----------|-----|---------|
| fragment.ts | 230 | 13 pre-built filters (dateRange, inList, contains, etc.) |
| scope.ts | 65 | Reusable query transformations (parameterized or fixed) |
| merge.ts | 57 | Combine multiple QueryComposer instances |

**Fragment Library (13 total):**

| Fragment | Example |
|----------|---------|
| dateRange | `dateRange(field, start, end)` → between filter |
| inList | `inList(field, values)` → IN operator |
| notInList | `notInList(field, values)` → NOT IN |
| contains | `contains(field, value)` → LIKE/ILIKE |
| startsWith | `startsWith(field, value)` → starts with text |
| endsWith | `endsWith(field, value)` → ends with text |
| exact | `exact(field, value)` → equality |
| notEqual | `notEqual(field, value)` → inequality |
| greaterThan | `greaterThan(field, value)` → > operator |
| greaterThanOrEqual | `greaterThanOrEqual(field, value)` → >= |
| lessThan | `lessThan(field, value)` → < |
| lessThanOrEqual | `lessThanOrEqual(field, value)` → <= |
| between | `between(field, min, max)` → BETWEEN |
| isNull | `isNull(field)` → IS NULL |
| isNotNull | `isNotNull(field)` → IS NOT NULL |

**Scope Pattern:**

```typescript
// Fixed scope
const activeScope = scope((q) => q.where('deleted_at__isnull', true));

// Parameterized scope
const recentScope = parameterizedScope((q, params) =>
  q.where('created_at__gte', params.days_ago)
);

// Usage
composer.applyScope(activeScope).applyScope(recentScope);
```

**Merge Logic:**

Combines multiple composers with conflict resolution:
- AND conditions from all composers
- Later conditions override earlier for same column
- Pagination/sort from last composer wins

### Layer 4: Type Safety

**Location:** `src/types/`
**Responsibility:** Compile-time validation of columns and operations

**Component:**

| Component | LOC | Purpose |
|-----------|-----|---------|
| infer.ts | 216 | TypedQueryComposer with TypeScript generic inference |

**Key Capabilities:**

- Infers column names from Zod schema
- Validates WHERE clause fields at compile-time
- Type-safe ORDER BY (only valid columns)
- Type-safe SELECT (column existence)
- Error messages include valid columns

**Type Inference Flow:**

```typescript
const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
});

// TypeScript infers type parameter T
const typed = createTypedComposer(userSchema, 'users');

// Compile error: 'invalid_col' not in schema
typed.where('invalid_col__exact', 'value');  // ✗

// Type-safe: 'email' exists in schema
typed.where('email__contains', 'example.com');  // ✓
```

### Layer 5: Relations & Eager Loading

**Location:** `src/relations/`
**Responsibility:** Multi-table queries, eager loading, N+1 prevention

**Components:**

| Component | LOC | Purpose |
|-----------|-----|---------|
| define.ts | 148 | Model registry and relation definitions |
| include.ts | 188 | ModelQueryComposer with eager loading API |
| types.ts | 199 | Relation type definitions (belongsTo, hasOne, hasMany, hasManyThrough) |
| loader.ts | 300 | DataLoader-based batch loading |

**Relation Types Supported:**

```typescript
// 1:1 reverse
BelongsToRelation = { type: 'belongsTo'; modelName: string; foreignKey: string }

// 1:1 forward
HasOneRelation = { type: 'hasOne'; modelName: string; foreignKey: string }

// 1:N forward
HasManyRelation = { type: 'hasMany'; modelName: string; foreignKey: string }

// N:M through junction table
HasManyThroughRelation = {
  type: 'hasManyThrough';
  modelName: string;
  throughModelName: string;
  fromKey: string;  // on source
  toKey: string;    // on target
  throughFromKey: string;  // junction -> source
  throughToKey: string;    // junction -> target
}
```

**Eager Loading Pattern:**

```typescript
const query = createModelQuery(userModel, 'users');

const users = await query
  .where('status__exact', 'active')
  .include('posts', { limit: 5 })  // eager load posts
  .include('profile')              // eager load profile
  .build();

// users[i].posts[j], users[i].profile auto-populated
```

**N+1 Prevention:**

DataLoader batches queries to single round-trip per relation depth:

```
Without DataLoader (N+1):
SELECT * FROM users;                      -- 1 query
SELECT * FROM posts WHERE user_id = 1;    -- 1 query per user (N)
SELECT * FROM posts WHERE user_id = 2;
... (N queries total)

With DataLoader (1+1):
SELECT * FROM users;                                  -- 1 query
SELECT * FROM posts WHERE user_id IN ($1, $2, ...);  -- 1 query (batched)
```

**Batch Loading API:**

```typescript
const loader = createRelationLoader({
  relation: 'posts',
  batchFn: async (userIds) => {
    // Receives array of user IDs, returns array of arrays
    return Promise.all(
      userIds.map(id => fetchPostsForUser(id))
    );
  }
});

// Load single record
const posts = await loader.load(userId);

// Load many
const postsByUser = await loader.loadMany([userId1, userId2]);
```

### Layer 6: Specialized Features

**Location:** `src/pg/`
**Responsibility:** PostgreSQL-specific advanced query patterns

**Components:**

| Component | LOC | Purpose |
|-----------|-----|---------|
| jsonb.ts | 226 | 11 JSONB operators (contains, path, set ops) |
| fts.ts | 219 | 5 Full-Text Search methods |
| recursive.ts | 241 | Recursive CTE builder for hierarchies |

**JSONB Operations (11 total):**

| Operation | Purpose | Example |
|-----------|---------|---------|
| jsonbContains | Check containment | `data @> '{"key": "value"}'` |
| jsonbContainedBy | Reverse containment | `data <@ '{"key": "value"}'` |
| jsonbHasKey | Single key exists | `data ? 'key'` |
| jsonbHasAllKeys | All keys exist | `data ?& ARRAY['k1', 'k2']` |
| jsonbHasAnyKey | Any key exists | `data ?\| ARRAY['k1', 'k2']` |
| jsonbPath | Extract value (JSON) | `data -> 'path'` |
| jsonbPathText | Extract value (text) | `data ->> 'path'` |
| jsonbExtract | Deep path extract | `data #> '{a,b,c}'` |
| jsonbExtractText | Deep path as text | `data #>> '{a,b,c}'` |
| jsonbSet | Set/update value | `jsonb_set(data, '{path}', $1)` |
| jsonbArrayElements | Unnest array | `jsonb_array_elements(data)` |
| jsonbObjectKeys | Extract keys | `jsonb_object_keys(data)` |

**Full-Text Search Methods (5 total):**

| Method | Vector Building | Query Parsing |
|--------|-----------------|---------------|
| fullTextSearch | `to_tsvector(col)` | `to_tsquery($1)` (operators) |
| fullTextWebSearch | `to_tsvector(col)` | `websearch_to_tsquery($1)` |
| fullTextRawSearch | `to_tsvector(col)` | Custom tsquery |
| fullTextRank | Rank by ts_rank | Returns relevance score |
| fullTextRankCd | Rank by ts_rank_cd | Cover density ranking |

**Example FTS Query:**
```sql
SELECT *, ts_rank(to_tsvector(title), websearch_to_tsquery($1)) as rank
FROM documents
WHERE to_tsvector(title || ' ' || content) @@ websearch_to_tsquery($1)
ORDER BY rank DESC
```

**Recursive CTE Builders:**

| Builder | Use Case |
|---------|----------|
| ancestorsCTE | Find all parents/ancestors in hierarchy |
| descendantsCTE | Find all children/descendants in hierarchy |
| createRecursiveCTE | Custom hierarchical queries |

**Example Ancestors Query:**
```sql
WITH RECURSIVE hierarchy AS (
  SELECT * FROM categories WHERE id = $1
  UNION ALL
  SELECT c.* FROM categories c
  INNER JOIN hierarchy h ON c.id = h.parent_id
)
SELECT * FROM hierarchy
```

### Layer 7: Utilities

**Location:** `src/utils/`
**Responsibility:** General-purpose utilities for schema introspection

**Component:**

| Component | LOC | Purpose |
|-----------|-----|---------|
| zod-utils.ts | 59 | Extract columns from Zod schemas (v3/v4 compatible) |

**Function:** `extractZodColumns(schema: ZodTypeAny): string[]`

Introspects Zod schema to extract column names, handling:
- Simple types: number, string, boolean, etc.
- Complex types: z.object(), z.record()
- Both Zod v3 and v4 API differences

## Module Dependency Graph

```
┌─ index.ts (Barrel exports)
│
├─ core/ ◄────────────────────────────────┐
│  │                                       │
│  ├─ query-composer.ts                   │
│  │  └─ squel + zod + operators.ts       │
│  │     + errors.ts + zod-utils.ts       │
│  │                                       │
│  ├─ operators.ts (34 handlers)          │
│  ├─ types.ts (Type definitions)         │
│  ├─ errors.ts (Custom errors)           │
│  └─ @exports: QueryComposer, etc.       │
│                                          │
├─ composition/                            │
│  ├─ fragment.ts ──→ depends on core     │
│  │ @exports: 13 fragment functions      │
│  │                                       │
│  ├─ scope.ts ──→ depends on core        │
│  │ @exports: scope, parameterizedScope  │
│  │                                       │
│  └─ merge.ts ──→ depends on core        │
│    @exports: merge, mergeAll            │
│                                          │
├─ subquery/                               │
│  ├─ builder.ts ──→ depends on core      │
│  │ @exports: subquery, subqueryAs, raw  │
│  │                                       │
│  └─ exists.ts ──→ depends on core       │
│    @exports: exists, notExists, ref...  │
│                                          │
├─ relations/                              │
│  ├─ define.ts ──→ depends on core       │
│  │ @exports: defineModel, getModel, etc │
│  │                                       │
│  ├─ include.ts ──→ depends on core      │
│  │ @exports: createModelQuery,          │
│  │           ModelQueryComposer         │
│  │                                       │
│  ├─ loader.ts ──→ depends on core       │
│  │ + dataloader                         │
│  │ @exports: createRelationLoader       │
│  │           batch load functions       │
│  │                                       │
│  └─ types.ts (Type definitions)         │
│                                          │
├─ types/                                  │
│  └─ infer.ts ──→ depends on core        │
│    @exports: TypedQueryComposer,        │
│              createTypedComposer        │
│                                          │
├─ pg/                                     │
│  ├─ jsonb.ts (Standalone)               │
│  │ @exports: 11 JSONB operators         │
│  │                                       │
│  ├─ fts.ts (Standalone)                 │
│  │ @exports: 5 FTS methods              │
│  │                                       │
│  └─ recursive.ts ──→ depends on core    │
│    @exports: RecursiveCTEBuilder        │
│              CTE builders               │
│                                          │
└─ utils/                                  │
   └─ zod-utils.ts ──→ depends on zod ────┘
     @exports: extractZodColumns
```

## Data Flow Patterns

### Pattern 1: Simple Query Building

```
User Code
   │
   ├─ Create schema: z.object({ email, name, ... })
   │
   ├─ createQueryComposer(schema, 'users')
   │  └─ Extracts columns via extractZodColumns
   │
   ├─ .where('email__contains', 'example.com')
   │  ├─ Parse field__operator
   │  ├─ Validate column against whitelist
   │  ├─ Validate operator against VALID_OPERATORS
   │  ├─ Apply operator handler
   │  └─ Return this
   │
   ├─ .orderBy('created_at', 'DESC')
   │  └─ Add sort option
   │
   ├─ .paginate({ page: 1, limit: 20 })
   │  └─ Add LIMIT/OFFSET metadata
   │
   └─ .build()
      ├─ Generate SQL via squel
      ├─ Bind values as $1, $2, ...
      └─ Return { sql, values }
```

### Pattern 2: Eager Loading with Relations

```
User Code
   │
   ├─ defineModel('User', { relations: { posts: ... } })
   │  └─ Register in model registry
   │
   ├─ createModelQuery(UserModel, 'users')
   │  └─ Create ModelQueryComposer
   │
   ├─ .where('status__exact', 'active')
   │
   ├─ .include('posts', { limit: 5 })
   │  ├─ Create DataLoader for posts relation
   │  ├─ Queue batch loading
   │  └─ Return this
   │
   ├─ .build()
   │  ├─ Execute main query (get user IDs)
   │  ├─ DataLoader batches post IDs
   │  ├─ Execute single batch query
   │  ├─ Populate posts on each user
   │  └─ Return users with .posts property
```

### Pattern 3: Type-Safe Query

```
User Code
   │
   ├─ const schema = z.object({ id, email, name, ... })
   │
   ├─ createTypedComposer(schema, 'users')
   │  └─ Infer column type from schema
   │
   ├─ .where('email__contains', 'value')
   │  ├─ TypeScript checks 'email' in schema
   │  ├─ TypeScript checks operator valid
   │  └─ Runtime: same as basic flow
   │
   └─ Type Error at compile-time (not runtime!)
```

## Extension Points

### Adding New Operators

Extend `core/operators.ts`:

```typescript
export const OPERATORS: Record<QueryOperator, OperatorHandler> = {
  // ... existing
  myoperator: (field, value) => field.custom(value),
};

// Update type in core/types.ts
export type QueryOperator = /* ... */ | 'myoperator';
```

### Adding New Fragments

Create in `composition/fragment.ts`:

```typescript
export function myFragment(field: string, value: unknown): FilterFragment {
  return [field, 'myoperator', value];
}
```

### PostgreSQL Operators

Add to `pg/jsonb.ts`, `pg/fts.ts`, or create `pg/newthing.ts`:

```typescript
export function newPgFeature(field: string): string {
  return `${field} @@ some_postgres_operator`;
}
```

### Relation Types

Add to `relations/types.ts` and implement loader in `relations/loader.ts`.

## Performance Characteristics

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Parse field__operator | O(1) | String split, map lookup |
| Validate column | O(n) | n = columns (avg 20) |
| Build WHERE clause | O(c) | c = conditions |
| Generate SQL | O(n) | n = total clauses |
| Batch load relations | O(1) batch | 1 query per level depth |

## Security Model

### SQL Injection Prevention

All values parameterized via squel:

```typescript
// Input: { email: "'; DROP TABLE users; --" }
// Generated: WHERE email = $1 with values = ["'; DROP TABLE users; --"]
// Never concatenated into SQL string
```

### Column Validation

Whitelist approach:

```typescript
// Only columns in schema OR extraColumns allowed
// Hard error (throw) if strict=true, silent ignore if strict=false
```

### Type Validation

Zod schemas prevent type mismatches before SQL generation.

---

**Document Version:** 1.0
**Last Updated:** 2026-02-07
**Architect:** Documentation Team
