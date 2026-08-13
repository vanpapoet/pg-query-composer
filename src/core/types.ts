/**
 * Comparison operators
 */
export type ComparisonOperator =
  | 'exact'
  | 'notexact'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte';

/**
 * Text/string operators
 */
export type TextOperator =
  | 'contains'
  | 'icontains'
  | 'startswith'
  | 'istartswith'
  | 'endswith'
  | 'iendswith'
  | 'regex'
  | 'iregex';

/**
 * Range operators
 */
export type RangeOperator = 'in' | 'notin' | 'between' | 'notbetween';

/**
 * Null operators
 */
export type NullOperator = 'isnull' | 'isnotnull';

/**
 * Date operators
 */
export type DateOperator =
  | 'date'
  | 'datebetween'
  | 'year'
  | 'month'
  | 'day'
  | 'week'
  | 'today'
  | 'thisweek'
  | 'thismonth'
  | 'thisyear';

/**
 * PostgreSQL array operators
 */
export type ArrayOperator =
  | 'arraycontains'
  | 'arrayoverlap'
  | 'arraycontained';

/**
 * All supported operators
 */
export type QueryOperator =
  | ComparisonOperator
  | TextOperator
  | RangeOperator
  | NullOperator
  | DateOperator
  | ArrayOperator;

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  maxLimit?: number;
}

/**
 * Pagination result metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  offset: number;
  total?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

/**
 * Sort direction
 */
export type SortDirection = 'ASC' | 'DESC';

/**
 * Sort option
 */
export interface SortOption {
  column: string;
  direction: SortDirection;
}

/**
 * Query builder options
 */
export interface QueryBuilderOptions {
  strict?: boolean;
  separator?: string;
  extraColumns?: string[];
  /**
   * Columns filterable even when the schema does not declare them.
   *
   * Defaults to `DEFAULT_FILTER_COLUMNS` (`id`, `created_at`, `updated_at`,
   * `deleted_at`) — a convention, not a fact about the table. Override it for
   * a different convention (`inserted_at`, `createdAt`, …), or pass `[]` to
   * accept only what the schema declares.
   *
   * Filter-only: these are never expanded into a projection by `exclude()`,
   * since nothing guarantees the table has them. Declare them in the schema
   * (or in `extraColumns`) if they should be selectable.
   */
  defaultColumns?: readonly string[];
  /**
   * Output column aliases, `alias → source column`.
   *
   * `{ email_addr: 'email' }` makes SELECT emit `email AS email_addr`. Renames
   * the result column only — `where()`, `orderBy()` and `groupBy()` keep taking
   * the real column name, and the alias is never whitelisted as a filter key.
   *
   * With `select()`/`exclude()` the column is renamed in place; without either,
   * `SELECT *` is kept and the aliased copies are appended.
   */
  aliases?: Record<string, string>;
}

/**
 * Internal condition structure
 */
export interface Condition {
  column: string;
  operator: QueryOperator;
  value: unknown;
  raw?: boolean;
  rawCondition?: string;
}

/**
 * OR group structure
 */
export interface OrGroup {
  conditions: Condition[];
}

/**
 * Join configuration
 */
export interface JoinConfig {
  type: 'inner' | 'left' | 'right' | 'full';
  table: string;
  alias?: string;
  on: string;
}

/**
 * Having condition
 */
export interface HavingCondition {
  condition: string;
  values: unknown[];
}
