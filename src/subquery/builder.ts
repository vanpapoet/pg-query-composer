import * as z from 'zod';
import { QueryComposer } from '../core/query-composer';

/**
 * Create a subquery builder
 *
 * Returns a QueryComposer configured for use as a subquery (non-strict mode).
 * Subqueries are typically used in:
 * - WHERE IN (SELECT ...)
 * - EXISTS (SELECT ...)
 * - NOT EXISTS (SELECT ...)
 * - Correlated subqueries
 *
 * @param schema - Zod schema for column validation
 * @param table - Table name
 * @returns QueryComposer instance configured as subquery
 *
 * @example
 * ```typescript
 * // Basic subquery
 * const activeLeagues = subquery(LeagueSchema, 'leagues')
 *   .select(['id'])
 *   .where({ status: 'active' });
 *
 * // Use in main query
 * new QueryComposer(PostSchema, 'posts')
 *   .whereIn('league_id', activeLeagues);
 *
 * // With filtering
 * const spanishLeagues = subquery(LeagueSchema, 'leagues')
 *   .select(['id'])
 *   .where({ country: 'Spain', status: 'active' });
 * ```
 */
export function subquery(
  schema: z.ZodTypeAny,
  table: string
): QueryComposer {
  return new QueryComposer(schema, table, { strict: false });
}

/**
 * Create a subquery with alias
 *
 * @param schema - Zod schema for column validation
 * @param table - Table name
 * @param alias - Table alias
 * @returns Object containing the QueryComposer and alias
 *
 * @example
 * ```typescript
 * const { query: sq, alias } = subqueryAs(LeagueSchema, 'leagues', 'l');
 * sq.select(['id']).where({ 'l.status': 'active' });
 * ```
 */
export function subqueryAs(
  schema: z.ZodTypeAny,
  table: string,
  alias: string
): { query: QueryComposer; alias: string } {
  return {
    query: new QueryComposer(schema, `${table} AS ${alias}`, { strict: false }),
    alias,
  };
}

/**
 * Create a raw subquery from SQL string
 *
 * Use this when you need a subquery that cannot be expressed with QueryComposer.
 * Note: Ensure proper escaping to prevent SQL injection.
 *
 * @param sql - Raw SQL string
 * @returns Raw subquery object
 *
 * @example
 * ```typescript
 * const raw = rawSubquery('SELECT id FROM leagues WHERE status = $1');
 * ```
 */
export function rawSubquery(sql: string): { toSQL: () => string } {
  return {
    toSQL: () => sql,
  };
}
