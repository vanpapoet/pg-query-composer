/**
 * Branded raw-filter objects.
 *
 * Helper functions (JSONB, FTS, EXISTS) return `{ __raw, __rawValues }` objects
 * that `where()` expands into raw SQL. Because `where()` is designed to accept
 * user-supplied filter objects (Django-style query params), a plain `__raw` key
 * would let an attacker smuggle arbitrary SQL via `?__raw=...`.
 *
 * The brand is a Symbol, which JSON — and therefore any user-supplied payload —
 * can never carry. Only filters produced by `rawFilter()` are trusted as raw SQL;
 * a literal `__raw` string key coming from untrusted input is treated as an
 * ordinary column name and rejected by the whitelist.
 */

/** Runtime brand marking an object as library-produced raw SQL. */
export const RAW_FILTER = Symbol.for('pg-query-composer.rawFilter');

/**
 * Raw SQL fragment with its parameter values.
 * Declared as a type alias (not an interface) so it stays assignable to
 * `Record<string, unknown>` when passed to `where()`.
 */
export type RawFilter = { __raw: string; __rawValues?: unknown[] };

/**
 * Create a trusted raw filter.
 *
 * The brand is set as an enumerable own symbol property so spreading still
 * carries it — `where({ ...jsonbContains('data', v), status: 'active' })` works.
 *
 * @param sql - SQL fragment using `?` placeholders (use `??` for a literal `?`)
 * @param values - Values bound to the `?` placeholders
 */
export function rawFilter(sql: string, values: unknown[] = []): RawFilter {
  const filter: RawFilter = { __raw: sql, __rawValues: values };
  (filter as Record<symbol, unknown>)[RAW_FILTER] = true;
  return filter;
}

/**
 * Check whether a value is a library-produced raw filter.
 * Untrusted objects carrying a plain `__raw` string key return false.
 */
export function isRawFilter(value: unknown): value is RawFilter {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<symbol, unknown>)[RAW_FILTER] === true &&
    typeof (value as RawFilter).__raw === 'string'
  );
}
