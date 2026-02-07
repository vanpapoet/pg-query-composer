import { QueryComposer } from '../core/query-composer';

/**
 * Merge two QueryComposer instances
 *
 * Creates a new QueryComposer by cloning the first query and merging conditions from the second.
 * The original queries are not modified.
 *
 * @param qc1 - First QueryComposer
 * @param qc2 - Second QueryComposer to merge
 * @returns New QueryComposer with combined conditions
 *
 * @example
 * ```typescript
 * const baseQuery = new QueryComposer(UserSchema, 'users')
 *   .where({ status: 'active' });
 *
 * const ageFilter = new QueryComposer(UserSchema, 'users')
 *   .where({ 'age__gte': 18 });
 *
 * const combined = merge(baseQuery, ageFilter);
 * // Generates: WHERE status = 'active' AND age >= 18
 * ```
 */
export function merge(qc1: QueryComposer, qc2: QueryComposer): QueryComposer {
  // Clone first query to avoid mutation
  const merged = qc1.clone();

  // Get internal state from qc2 and apply to merged
  merged.mergeFrom(qc2);

  return merged;
}

/**
 * Merge multiple QueryComposer instances
 *
 * @param queries - Array of QueryComposer instances to merge
 * @returns New QueryComposer with all conditions combined
 *
 * @example
 * ```typescript
 * const combined = mergeAll([
 *   new QueryComposer(UserSchema, 'users').where({ status: 'active' }),
 *   new QueryComposer(UserSchema, 'users').where({ 'age__gte': 18 }),
 *   new QueryComposer(UserSchema, 'users').where({ 'name__contains': 'john' }),
 * ]);
 * ```
 */
export function mergeAll(queries: QueryComposer[]): QueryComposer {
  if (queries.length === 0) {
    throw new Error('mergeAll requires at least one QueryComposer');
  }

  return queries.reduce((acc, qc) => merge(acc, qc));
}
