/**
 * pg-query-composer
 *
 * Advanced PostgreSQL query builder with dynamic composition,
 * subqueries, relations, and type-safe queries.
 *
 * The root entry point re-exports every module barrel, so
 * `import { jsonbContains } from 'pg-query-composer'` and
 * `import { jsonbContains } from 'pg-query-composer/pg'` resolve to the same
 * binding. Barrels are the single source of truth for what each subpath
 * exports — keeping the list here would only drift.
 *
 * @packageDocumentation
 */

export const VERSION = '1.3.0';

// ===========================================================================
// CORE
// ===========================================================================

export { QueryComposer, createQueryComposer, DEFAULT_FILTER_COLUMNS } from './core/query-composer';
export type {
  QueryOperator,
  ComparisonOperator,
  TextOperator,
  RangeOperator,
  NullOperator,
  DateOperator,
  ArrayOperator,
  PaginationOptions,
  PaginationMeta,
  SortDirection,
  SortOption,
  QueryBuilderOptions,
  Condition,
  OrGroup,
  JoinConfig,
  HavingCondition,
} from './core/types';
export { OPERATORS, VALID_OPERATORS } from './core/operators';
export type { OperatorHandler } from './core/operators';
export {
  InvalidColumnError,
  InvalidOperatorError,
  RelationNotFoundError,
  SubqueryError,
  TypeMismatchError,
  QueryComposerError,
} from './core/errors';

// Raw SQL fragments — `RawFilter` is the return type of the JSONB / FTS /
// EXISTS helpers, so consumers need it to annotate their own helpers.
export { rawFilter, isRawFilter } from './core/raw-filter';
export type { RawFilter } from './core/raw-filter';

// ===========================================================================
// MODULE BARRELS (also available as subpath imports)
// ===========================================================================

export * from './composition';
export * from './subquery';
export * from './relations';
export * from './types';
export * from './pg';

// ===========================================================================
// UTILITIES
// ===========================================================================

export { extractZodColumns } from './utils/zod-utils';
export { validateIdentifier, validateColumnName, validateAliasName, quoteIdentifier } from './core/identifier-validation';
