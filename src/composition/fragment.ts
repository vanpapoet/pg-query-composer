import type { QueryOperator } from '../core/types';

/**
 * Fragment return type
 */
export type FilterFragment = Record<string, unknown>;

/**
 * Create a query fragment with any operator
 *
 * @example
 * ```typescript
 * const filter = fragment('age', 'gte', 18);
 * // { age__gte: 18 }
 * ```
 */
export function fragment(
  field: string,
  operator: QueryOperator,
  value: unknown
): FilterFragment {
  return { [`${field}__${operator}`]: value };
}

/**
 * Create date range fragment (between dates)
 *
 * @example
 * ```typescript
 * const filter = dateRange('created_at', '2024-01-01', '2024-12-31');
 * // { created_at__between: ['2024-01-01', '2024-12-31'] }
 * ```
 */
export function dateRange(
  field: string,
  from: string,
  to: string
): FilterFragment {
  return { [`${field}__between`]: [from, to] };
}

/**
 * Create IN list fragment
 *
 * @example
 * ```typescript
 * const filter = inList('status', ['active', 'pending']);
 * // { status__in: ['active', 'pending'] }
 * ```
 */
export function inList(field: string, values: unknown[]): FilterFragment {
  return { [`${field}__in`]: values };
}

/**
 * Create NOT IN list fragment
 *
 * @example
 * ```typescript
 * const filter = notInList('status', ['deleted', 'banned']);
 * // { status__notin: ['deleted', 'banned'] }
 * ```
 */
export function notInList(field: string, values: unknown[]): FilterFragment {
  return { [`${field}__notin`]: values };
}

/**
 * Create IS NULL fragment
 *
 * @example
 * ```typescript
 * const filter = isNull('deleted_at');
 * // { deleted_at__isnull: true }
 * ```
 */
export function isNull(field: string): FilterFragment {
  return { [`${field}__isnull`]: true };
}

/**
 * Create IS NOT NULL fragment
 *
 * @example
 * ```typescript
 * const filter = isNotNull('published_at');
 * // { published_at__isnotnull: true }
 * ```
 */
export function isNotNull(field: string): FilterFragment {
  return { [`${field}__isnotnull`]: true };
}

/**
 * Create text contains fragment (case-insensitive)
 *
 * @example
 * ```typescript
 * const filter = contains('name', 'john');
 * // { name__contains: 'john' }
 * ```
 */
export function contains(field: string, value: string): FilterFragment {
  return { [`${field}__contains`]: value };
}

/**
 * Create starts with fragment
 *
 * @example
 * ```typescript
 * const filter = startsWith('email', 'admin@');
 * // { email__startswith: 'admin@' }
 * ```
 */
export function startsWith(field: string, value: string): FilterFragment {
  return { [`${field}__startswith`]: value };
}

/**
 * Create ends with fragment
 *
 * @example
 * ```typescript
 * const filter = endsWith('email', '@gmail.com');
 * // { email__endswith: '@gmail.com' }
 * ```
 */
export function endsWith(field: string, value: string): FilterFragment {
  return { [`${field}__endswith`]: value };
}

/**
 * Create BETWEEN fragment for numeric/date ranges
 *
 * @example
 * ```typescript
 * const filter = between('age', 18, 65);
 * // { age__between: [18, 65] }
 * ```
 */
export function between(
  field: string,
  from: unknown,
  to: unknown
): FilterFragment {
  return { [`${field}__between`]: [from, to] };
}

/**
 * Create greater than fragment
 *
 * @example
 * ```typescript
 * const filter = greaterThan('age', 18);
 * // { age__gt: 18 }
 * ```
 */
export function greaterThan(field: string, value: unknown): FilterFragment {
  return { [`${field}__gt`]: value };
}

/**
 * Create greater than or equal fragment
 *
 * @example
 * ```typescript
 * const filter = greaterThanOrEqual('age', 18);
 * // { age__gte: 18 }
 * ```
 */
export function greaterThanOrEqual(
  field: string,
  value: unknown
): FilterFragment {
  return { [`${field}__gte`]: value };
}

/**
 * Create less than fragment
 *
 * @example
 * ```typescript
 * const filter = lessThan('age', 65);
 * // { age__lt: 65 }
 * ```
 */
export function lessThan(field: string, value: unknown): FilterFragment {
  return { [`${field}__lt`]: value };
}

/**
 * Create less than or equal fragment
 *
 * @example
 * ```typescript
 * const filter = lessThanOrEqual('age', 65);
 * // { age__lte: 65 }
 * ```
 */
export function lessThanOrEqual(field: string, value: unknown): FilterFragment {
  return { [`${field}__lte`]: value };
}

/**
 * Create exact match fragment
 *
 * @example
 * ```typescript
 * const filter = exact('status', 'active');
 * // { status: 'active' }
 * ```
 */
export function exact(field: string, value: unknown): FilterFragment {
  return { [field]: value };
}

/**
 * Create not equal fragment
 *
 * @example
 * ```typescript
 * const filter = notEqual('status', 'deleted');
 * // { status__notexact: 'deleted' }
 * ```
 */
export function notEqual(field: string, value: unknown): FilterFragment {
  return { [`${field}__notexact`]: value };
}
