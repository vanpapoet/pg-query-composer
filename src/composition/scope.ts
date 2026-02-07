import type { QueryComposer } from '../core/query-composer';

/**
 * Scope callback type
 */
export type ScopeCallback<T> = (qc: QueryComposer) => QueryComposer;

/**
 * Scope definition
 */
export interface Scope<T> {
  apply: (qc: QueryComposer) => QueryComposer;
}

/**
 * Create a reusable query scope
 *
 * Scopes are reusable query modifications that can be applied to any QueryComposer.
 * They encapsulate common query patterns like:
 * - Filtering for specific statuses
 * - Adding default ordering
 * - Applying pagination defaults
 *
 * @example
 * ```typescript
 * const published = scope<typeof PostSchema>(q =>
 *   q.where({ status: 'active' })
 * );
 *
 * const recent = scope<typeof PostSchema>(q =>
 *   q.orderBy('-created_at')
 * );
 *
 * // Apply to query
 * const qc = new QueryComposer(PostSchema, 'posts')
 *   .apply(published)
 *   .apply(recent);
 * ```
 */
export function scope<T>(callback: ScopeCallback<T>): Scope<T> {
  return {
    apply: (qc: QueryComposer) => callback(qc),
  };
}

/**
 * Create a parameterized scope
 *
 * @example
 * ```typescript
 * const byStatus = (status: string) => scope<typeof PostSchema>(q =>
 *   q.where({ status })
 * );
 *
 * // Apply with different values
 * qc.apply(byStatus('active'));
 * qc.apply(byStatus('pending'));
 * ```
 */
export function parameterizedScope<T, P extends unknown[]>(
  factory: (...params: P) => ScopeCallback<T>
): (...params: P) => Scope<T> {
  return (...params: P) => scope<T>(factory(...params));
}
