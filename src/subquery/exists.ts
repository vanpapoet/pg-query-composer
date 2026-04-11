import { QueryComposer } from '../core/query-composer';
import { validateIdentifier } from '../core/identifier-validation';

/**
 * Create EXISTS condition for use in where()
 *
 * Returns a filter object that when passed to where() generates an EXISTS clause.
 * Optimizes the subquery by replacing SELECT columns with SELECT 1.
 * Uses parameterized queries to prevent SQL injection.
 *
 * @param subquery - QueryComposer subquery
 * @returns Filter object with parameterized EXISTS condition
 *
 * @example
 * ```typescript
 * const qc = new QueryComposer(PostSchema, 'posts')
 *   .where(exists(
 *     subquery(CommentSchema, 'comments')
 *       .whereRaw('comments.post_id = posts.id')
 *       .where({ approved: true })
 *   ));
 * // Generates: WHERE EXISTS (SELECT 1 FROM comments WHERE ... AND approved = $N)
 * ```
 */
export function exists(subquery: QueryComposer): Record<string, unknown> {
  const { text, values } = subquery.toParam();
  const existsSql = convertToExists(text);
  // Convert $N placeholders to ? for re-numbering by outer query
  const rawText = existsSql.replace(/\$\d+/g, '?');
  return { __raw: 'EXISTS (' + rawText + ')', __rawValues: values };
}

/**
 * Create NOT EXISTS condition for use in where()
 *
 * Returns a filter object that when passed to where() generates a NOT EXISTS clause.
 * Uses parameterized queries to prevent SQL injection.
 *
 * @param subquery - QueryComposer subquery
 * @returns Filter object with parameterized NOT EXISTS condition
 *
 * @example
 * ```typescript
 * const qc = new QueryComposer(PostSchema, 'posts')
 *   .where(notExists(
 *     subquery(CommentSchema, 'comments')
 *       .whereRaw('comments.post_id = posts.id')
 *   ));
 * // Generates: WHERE NOT EXISTS (SELECT 1 FROM comments WHERE ...)
 * ```
 */
export function notExists(subquery: QueryComposer): Record<string, unknown> {
  const { text, values } = subquery.toParam();
  const existsSql = convertToExists(text);
  const rawText = existsSql.replace(/\$\d+/g, '?');
  return { __raw: 'NOT EXISTS (' + rawText + ')', __rawValues: values };
}

/**
 * Convert SELECT ... FROM to SELECT 1 FROM for EXISTS optimization
 *
 * @internal
 */
function convertToExists(sql: string): string {
  const fromIdx = sql.indexOf(' FROM');
  if (fromIdx === -1) return sql;
  return 'SELECT 1' + sql.slice(fromIdx);
}

/**
 * Create a correlated reference for use in subqueries
 *
 * @param table - Table name or alias
 * @param column - Column name
 * @returns Reference string
 *
 * @example
 * ```typescript
 * subquery(CommentSchema, 'comments')
 *   .whereRaw(`comments.post_id = ${ref('posts', 'id')}`);
 * ```
 */
export function ref(table: string, column: string): string {
  validateIdentifier(table);
  validateIdentifier(column);
  return table + '.' + column;
}

/**
 * Create a raw SQL expression
 *
 * WARNING: This passes the expression through unchanged. Do NOT use with
 * user-controlled input. Only use for developer-authored SQL expressions.
 *
 * @param expression - Raw SQL expression
 * @returns The expression unchanged
 */
export function raw(expression: string): string {
  return expression;
}

/**
 * Create a lateral subquery for correlated expressions.
 * Uses parameterized queries to prevent SQL injection.
 *
 * @param subquery - QueryComposer subquery
 * @param alias - Alias for the subquery
 * @returns Lateral subquery configuration with parameterized SQL
 */
export function lateral(
  subquery: QueryComposer,
  alias: string
): { sql: string; values: unknown[]; alias: string; type: 'lateral' } {
  validateIdentifier(alias);
  const { text, values } = subquery.toParam();
  return {
    sql: text,
    values,
    alias,
    type: 'lateral',
  };
}
