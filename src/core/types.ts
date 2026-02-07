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
