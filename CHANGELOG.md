# Changelog

All notable changes to **pg-query-composer** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-08-13

> Minor, not a patch: `exclude()` changes what it selects, and both `exclude()`
> and `extraColumns` now throw where they used to pass silently. See Fixed.

### Added

- **`QueryBuilderOptions.aliases` now does something.** The option was declared,
  defaulted, stored on the instance and documented in `docs/guide-core-builder.md`
  since the initial commit, but `this.options.aliases` was never read — no code
  path outside the constructor touched it, and no test covered it. Passing
  `{ email_addr: 'email' }` changed nothing except costing the `DEFAULT_OPTIONS`
  fast path, and `where({ email_addr })` threw `InvalidColumnError` while SELECT
  emitted no `AS`.

  It is now an **output** alias, `alias → source column`: SELECT emits
  `email AS email_addr`. Filters, sorting and grouping still take the real column
  name — the alias is never whitelisted as a filter key, so this adds no new way
  to reach a column. With `select()`/`exclude()` the column is renamed in place;
  with neither, `*` is kept and the aliased copies are appended
  (`SELECT *, email AS email_addr`), leaving the source column in the result set.

  Both halves land in SQL unparameterized, so both are validated once at
  construction: the alias through the new `validateAliasName()` (plain
  unqualified identifier — stricter than `validateColumnName`, which permits
  `table.col`), the source through `validateColumnName()`, plus a whitelist check
  when `strict`. Alias handling lives in `src/core/column-aliases.ts`; the map is
  `null` when no alias is declared, so the common path is unchanged.

- **`QueryBuilderOptions.defaultColumns`** makes the always-filterable column
  set configurable. `id` / `created_at` / `updated_at` / `deleted_at` were
  hard-coded, which silently assumed one naming convention: a schema on
  `inserted_at` (Ecto), `createdAt` (camelCase) or with no soft-delete column
  could neither filter on its own convention without listing it in
  `extraColumns`, nor stop accepting four columns it does not have. The list now
  defaults to the exported `DEFAULT_FILTER_COLUMNS` and can be replaced
  (`[...DEFAULT_FILTER_COLUMNS, 'tenant_id']` to extend, `[]` to accept only
  schema columns). The per-schema whitelist cache is keyed to the untouched
  default, so a customized composer neither reads nor writes it.

### Fixed

- **`extraColumns` was never validated.** Entries land in SQL through the
  operator handlers — `where({ 'x; DROP TABLE u': 1 })` passes the whitelist
  once the same string is in `extraColumns` — but nothing checked them, unlike
  every other raw identifier context in the library. Both `extraColumns` and
  `defaultColumns` now go through `validateColumnName()` at construction.
  Qualified names for joined tables (`orders.total`) still pass.
- **`exclude()` projected columns that may not exist.** It expanded `*` from the
  full filter whitelist, which includes the conventional `id` / `created_at` /
  `updated_at` / `deleted_at` set that is whitelisted whether or not the schema
  declares it. `exclude(['password'])` on a three-column schema emitted
  `SELECT id, email, id, created_at, updated_at, deleted_at` — `id` twice
  (schema + defaults, never deduplicated) and three columns taken on faith, so
  any table without them failed at PostgreSQL. The documented output for that
  exact example was `SELECT id, email FROM users`, which is what it now emits.

  Projections are now built from a separate `projectable` list — schema columns
  plus `extraColumns`, deduplicated — while the filter whitelist keeps the
  conventional columns. The whitelist itself is deduplicated too, so
  `InvalidColumnError` stops listing `id` twice in its hint.

  `exclude()` had no test coverage of any kind before this.
- **`exclude()` silently ignored unknown columns.** `exclude(['pasword'])` kept
  no exclusion at all and fell through to `SELECT *`, returning the column the
  caller meant to hide. It now validates like `select()` / `orderBy()`: throws
  `InvalidColumnError` when `strict` (the default), skips when not. Likewise,
  excluding every projectable column throws instead of falling back to
  `SELECT *` and shipping the excluded columns.
- Corrected `select()` / `exclude()` signatures in `docs/codebase-summary.md` —
  both take an array, not rest parameters.

## [1.1.1] - 2026-08-13

Hotfix: 1.1.0 could not be installed alongside zod v4, and one code path threw
at runtime on it. Reported from a downstream consumer that needs `z.iso`, a
zod-v4-only API, so staying on v3 was not an option for them.

zod v3 support is unchanged — the fixes are version-agnostic, not a migration.

### Fixed

- **`peerDependencies` now accepts zod v4** (`^3.23.0 || ^4.0.0`). Installing
  1.1.0 into any zod v4 project failed with `ERESOLVE`.
- **`extractZodColumns()` threw `TypeError` on zod v4.** It branched on
  `schema instanceof z.ZodEffects`, and v4 removed `ZodEffects`, so the
  right-hand side was `undefined`. This killed the `ZodOptional` / `ZodNullable`
  branches below it and the duck-typing fallback that would otherwise have
  covered them, so `.transform()`, `.optional()`, `.nullable()` and `.default()`
  schemas all crashed — as did plain `z.string()` / `z.array()`, which are only
  supposed to return `[]`. Wrapper types are now unwrapped structurally via
  `_def` (`schema` / `in` / `innerType`): zod class identity is not stable
  across majors, but the `_def` shape is. Plain `z.object()` was never affected
  — the duck-typed `.shape` check returned first — so the blast radius was
  top-level wrapped and non-object schemas.
- **`extractZodColumns(null)` threw `Invalid value used as weak map key`** on
  both majors: the guard ran after the `WeakMap.set()`, not before it.
- **`InferResult<T, Selected>` failed to compile against zod v4** with
  `TS2344: Type 'Selected[number]' does not satisfy the constraint 'keyof output<T>'`.
  While `T` is an unresolved generic, v4 collapses `keyof output<T>` to `never`.
  Intersecting with `keyof InferZodType<T>` fixes it. This blocked the library's
  own build on v4 and every consumer compiling the shipped `.d.ts` with
  `skipLibCheck: false` (TypeScript's default).

### Changed

- CI now runs the test matrix against **both zod majors**. A single-version CI
  could not have caught any of the above. Note the matrix alone is not enough
  either: the unpatched 1.1.0 source passes all 286 pre-existing tests on zod
  4.4.3, because nothing exercised a wrapped or non-object top-level schema.
  `tests/utils/zod-schema-unwrapping.test.ts` is what makes the v4 leg
  meaningful; the matrix without it goes green on broken code.

### Notes

- `z.ZodTypeAny` is **not** removed in zod v4 — it survives as a type alias for
  `ZodType` in zod's `v4/classic/compat` module, so the 7 declaration files that
  reference it compile clean on 4.4.3. Only the runtime *value* is `undefined`,
  and it is never used as one. It was reported as a third break; it is not one,
  and is left in place rather than churned.

## [1.1.0] - 2026-08-12

> Shipped as a minor despite the breaking items below: every subpath import
> was broken in 1.0.2, so no consumer can have depended on `toParam().values`
> shape from `/relations` or `groupByKey()`. Check the Breaking section before
> upgrading if you imported from the root entry.

### Breaking

- **Node 18 is no longer supported** — `engines` is now `>=20.0.0`. Node 18 left
  maintenance in April 2025, and the linter (`oxlint`, `engines:
  ^20.19.0 || >=22.12.0`) cannot run on it, so CI could not verify the claim.
  Tested on Node 20 and 22.
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
