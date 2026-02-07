import { QueryComposer } from '../core/query-composer';

/**
 * Create EXISTS condition for use in where()
 *
 * Returns a filter object that when passed to where() generates an EXISTS clause.
 * Optimizes the subquery by replacing SELECT columns with SELECT 1.
 *
 * @param subquery - QueryComposer subquery
 * @returns Filter object with raw EXISTS condition
 *
 * @example
 * ```typescript
 * // Find posts that have at least one approved comment
 * const qc = new QueryComposer(PostSchema, 'posts')
 *   .where(exists(
 *     subquery(CommentSchema, 'comments')
 *       .whereRaw('comments.post_id = posts.id')
 *       .where({ approved: true })
 *   ));
 *
 * // Generates: WHERE EXISTS (SELECT 1 FROM comments WHERE ...)
 * ```
 */
export function exists(subquery: QueryComposer): Record<string, unknown> {
  const sql = convertToExists(subquery.toSelect().toString());
  return { __raw: `EXISTS (${sql})` };
}

/**
 * Create NOT EXISTS condition for use in where()
 *
 * Returns a filter object that when passed to where() generates a NOT EXISTS clause.
 * Useful for finding records that don't have related records.
 *
 * @param subquery - QueryComposer subquery
 * @returns Filter object with raw NOT EXISTS condition
 *
 * @example
 * ```typescript
 * // Find posts that have no comments
 * const qc = new QueryComposer(PostSchema, 'posts')
 *   .where(notExists(
 *     subquery(CommentSchema, 'comments')
 *       .whereRaw('comments.post_id = posts.id')
 *   ));
 *
 * // Generates: WHERE NOT EXISTS (SELECT 1 FROM comments WHERE ...)
 * ```
 */
export function notExists(subquery: QueryComposer): Record<string, unknown> {
  const sql = convertToExists(subquery.toSelect().toString());
  return { __raw: `NOT EXISTS (${sql})` };
}

/**
 * Convert SELECT ... FROM to SELECT 1 FROM for EXISTS optimization
 *
 * @internal
 */
function convertToExists(sql: string): string {
  // Replace SELECT ... FROM with SELECT 1 FROM for performance
  // The EXISTS clause only checks for row existence, not the actual values
  return sql.replace(/^SELECT .* FROM/i, 'SELECT 1 FROM');
}

/**
 * Create a correlated reference for use in subqueries
 *
 * Use this to reference columns from the outer query in correlated subqueries.
 *
 * @param table - Table name or alias
 * @param column - Column name
 * @returns Reference string
 *
 * @example
 * ```typescript
 * // Explicit table.column reference
 * subquery(CommentSchema, 'comments')
 *   .whereRaw(`comments.post_id = ${ref('posts', 'id')}`);
 * ```
 */
export function ref(table: string, column: string): string {
  return `${table}.${column}`;
}

/**
 * Create a raw SQL expression
 *
 * Use this for expressions that cannot be represented with the query builder.
 *
 * @param expression - Raw SQL expression
 * @returns The expression unchanged
 *
 * @example
 * ```typescript
 * qc.where({ __raw: raw('LOWER(name) = LOWER(email)') });
 * ```
 */
export function raw(expression: string): string {
  return expression;
}

/**
 * Create a lateral subquery for correlated expressions
 *
 * @param subquery - QueryComposer subquery
 * @param alias - Alias for the subquery
 * @returns Lateral subquery configuration
 *
 * @example
 * ```typescript
 * // Use in join
 * qc.joinLateral(
 *   lateral(
 *     subquery(CommentSchema, 'comments')
 *       .where({ 'post_id': raw('posts.id') })
 *       .orderBy('-created_at')
 *       .paginate({ limit: 5 }),
 *     'recent_comments'
 *   )
 * );
 * ```
 */
export function lateral(
  subquery: QueryComposer,
  alias: string
): { sql: string; alias: string; type: 'lateral' } {
  return {
    sql: subquery.toSelect().toString(),
    alias,
    type: 'lateral',
  };
}
