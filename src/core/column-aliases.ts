/**
 * Output column aliases for `QueryBuilderOptions.aliases`.
 *
 * `{ email_addr: 'email' }` reads alias → source column, and makes SELECT emit
 * `email AS email_addr`. This is an *output* rename only: filters, sorting and
 * grouping keep using the real column name, so the alias never has to be
 * whitelisted or resolved back to a column.
 */

import { InvalidColumnError } from './errors';
import { validateAliasName, validateColumnName } from './identifier-validation';

/** Source column → the aliases declared for it (a column may have several). */
export type AliasMap = ReadonlyMap<string, readonly string[]>;

/**
 * Validate the alias option and invert it into a column → aliases lookup.
 *
 * Returns `null` when no aliases are declared, so the common path can skip the
 * alias branch entirely.
 *
 * @throws Error on an alias or target column that is not a bare identifier
 * @throws InvalidColumnError when strict and the target is not whitelisted
 */
export function buildAliasMap(
  aliases: Record<string, string>,
  whitelist: readonly string[],
  whitelistSet: ReadonlySet<string>,
  strict: boolean
): AliasMap | null {
  // Own enumerable keys only — a polluted prototype must not inject aliases
  const entries = Object.entries(aliases);
  if (entries.length === 0) return null;

  const map = new Map<string, string[]>();
  for (const [alias, column] of entries) {
    // Both halves are concatenated into SQL unparameterized
    validateAliasName(alias);
    validateColumnName(column);
    // Fail fast on a typo'd target instead of shipping a broken query to PG
    if (strict && !whitelistSet.has(column)) {
      throw new InvalidColumnError(column, whitelist);
    }

    const existing = map.get(column);
    if (existing) existing.push(alias);
    else map.set(column, [alias]);
  }
  return map;
}

/**
 * Apply aliases to an explicit projection (from `select()` / `exclude()`).
 *
 * An aliased column is renamed in place — emitted once per alias as
 * `col AS alias` — and every other field passes through untouched. A column
 * that is not part of the projection contributes nothing.
 */
export function aliasProjection(fields: readonly string[], map: AliasMap): string[] {
  const out: string[] = [];
  for (const field of fields) {
    const aliases = map.get(field);
    if (!aliases) {
      out.push(field);
      continue;
    }
    for (const alias of aliases) out.push(field + ' AS ' + alias);
  }
  return out;
}

/**
 * Build the projection for a query with no explicit `select()` / `exclude()`.
 *
 * There is no field list to rename in place, so `*` is kept and the aliased
 * columns are appended: `SELECT *, email AS email_addr`. The source column
 * therefore stays in the result set alongside its renamed copy.
 */
export function aliasStarProjection(map: AliasMap): string[] {
  const fields: string[] = ['*'];
  for (const [column, aliases] of map) {
    for (const alias of aliases) fields.push(column + ' AS ' + alias);
  }
  return fields;
}
