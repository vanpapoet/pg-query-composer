# Changelog

All notable changes to **pg-query-composer** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-08-12

> Shipped as a minor despite the two breaking items below: every subpath import
> was broken in 1.0.2, so no consumer can have depended on `toParam().values`
> shape from `/relations` or `groupByKey()`. Check the Breaking section before
> upgrading if you imported from the root entry.

### Breaking

- `in` / `notin` now emit `col = ANY($1)` / `col <> ALL($1)` instead of
  `col IN ($1, $2, ...)`. The whole list binds as a **single array parameter**,
  so `toParam().values` is `[[a, b, c]]` rather than `[a, b, c]`. One SQL text now
  serves every list length, which stops PostgreSQL plan-cache fragmentation and
  removes the 65535 bind-parameter ceiling. Measured 16.6% faster on PostgreSQL with
  varying list lengths, 9.8% faster at fixed length; 89.7% faster to build in JS.
- `groupByKey()` now keys its result `Map` by stringified keys (`Map<string, T[]>`).

### Fixed

- **Every subpath import was broken.** `exports` mapped `./composition`, `./subquery`,
  `./relations` and `./pg` to `./dist/<mod>/index.js`, but no `src/<mod>/index.ts`
  existed, so consumers got `MODULE_NOT_FOUND`; `./types` was documented in the
  README yet absent from the map entirely (`ERR_PACKAGE_PATH_NOT_EXPORTED`). Each
  module now has a barrel, `./types` is exported, and every entry carries a `types`
  condition so TypeScript's `node16` resolution finds the declarations. The root
  entry re-exports the barrels, so both import styles reach the same binding.
  `tests/package/exports-map.test.ts` fails the build if the map and the sources
  drift again.
- `RawFilter` — the return type of every JSONB / FTS / EXISTS helper — was not
  exported, so consumers could not annotate their own helpers. `rawFilter()`,
  `isRawFilter()` and the type are now public.
- README documented an API that never existed: `defineModel('User', {...})`,
  `createModelQuery(model, table)`, `.include(rel, { limit })` and a `.build()`
  method. Examples now match the real signatures and their output is copied from
  actual runs (`ILIKE` not `LIKE`, parameterized `LIMIT`/`OFFSET`, array `jsonbPath`
  paths, `ancestorsCTE(table, schema, startId)`).
- CI and release workflows ran a hand-listed set of test directories, silently
  skipping any newly added suite. Both now run `npm test`.
- Relations silently resolved to `[]` / `null` whenever the primary key was
  numeric: parent keys were stringified while child keys kept their `number` type,
  so the grouping `Map` never matched. Keys are now normalized on both sides, and
  the original (unstringified) value is what reaches PostgreSQL.
- `dataloader` was imported at runtime but declared in `devDependencies`, so
  `import 'pg-query-composer/relations'` crashed with `MODULE_NOT_FOUND` for
  consumers. It is now a real dependency.

### Performance

- `loadRelation()` uses a single `loadMany()` instead of one promise per record,
  and accepts an optional pre-built loader so its cache can be reused across calls.
- `mergeAll()` no longer clones a growing accumulator on each step (was O(n²)).

### Security

- Raw SQL filters are branded with a `Symbol` (`rawFilter()`, `src/core/raw-filter.ts`).
  `where()` only expands raw SQL for branded objects, so a bare `{ __raw: '...' }`
  coming from user input (e.g. `req.query`) is treated as a column name and rejected.

## [1.0.2]

- Replaced `squel` with in-house `SelectBuilder` — core builder is now dependency-free
- Security hardening: identifier validation, FTS config whitelist, JSONB/FTS value
  escaping, parameterized subqueries and recursive CTEs
- Added 44 SQL injection prevention tests (270 total)
- Query building performance optimizations (parameter fast-paths, cached whitelists)
- Verified against TypeScript 7.0 native compiler

## [1.0.1] - 2026-02-11

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

## Engineering decisions

Measured outcomes that shaped the current implementation. Kept here so the
trade-offs are not re-litigated on every change.

### Query generation

- **`= ANY($1)` beats `IN ($1..$N)`** — 16.6% faster on PostgreSQL with varying list
  lengths, 9.8% at fixed length, 89.7% faster to build in JS. A single SQL text for
  all cardinalities means no plan-cache fragmentation. Applied to `in` / `notin`;
  per-length placeholders are not coming back.
- **LIMIT / OFFSET stay parameterized** — an inlined literal `LIMIT` produces an
  *identical* plan (verified with `EXPLAIN`: same cost, same index scan) and the
  runtime delta is within noise (±3%, sign flips between runs). Literals would only
  fragment the plan cache per page.
- **Inlining `toParam()` does not help** — V8 optimizes `SelectBuilder`'s separate
  methods better than a merged hot path. Measured twice, both times a regression.

### Benchmarks

- JS benchmark: `npx tsx benchmarks/benchmark-runner.ts` (`--baseline` to save a
  reference, `--save` for a snapshot).
- PostgreSQL benchmark: `docker-compose up -d && npx tsx benchmarks/pg-execution-benchmark.ts`
  (expects PostgreSQL on port 5499).
- Never call `pool.connect()` and then `pool.query()` on the same `max: 1` pool —
  it deadlocks. Use separate pools for setup and for the benchmark itself.

### Tooling

- **Linter is oxlint, not ESLint** — `typescript-eslint` hard-blocks TypeScript 7
  (typescript-eslint#10940) and this project builds on `typescript@^7`, so ESLint
  fails at startup. oxlint honors `// eslint-disable-next-line <rule>` directives.
  Disabled rules and their rationale live in `docs/code-standards.md` → Linting.
