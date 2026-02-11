/**
 * pg-query-composer
 *
 * Advanced PostgreSQL query builder with dynamic composition,
 * subqueries, relations, and type-safe queries.
 *
 * @packageDocumentation
 */

export const VERSION = '1.0.1';

// Core exports
export { QueryComposer, createQueryComposer } from './core/query-composer';
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

// Composition exports
export { scope, parameterizedScope } from './composition/scope';
export type { Scope, ScopeCallback } from './composition/scope';
export {
  fragment,
  dateRange,
  inList,
  notInList,
  isNull,
  isNotNull,
  contains,
  startsWith,
  endsWith,
  between,
  greaterThan,
  greaterThanOrEqual,
  lessThan,
  lessThanOrEqual,
  exact,
  notEqual,
} from './composition/fragment';
export type { FilterFragment } from './composition/fragment';
export { merge, mergeAll } from './composition/merge';

// Subquery exports
export { subquery, subqueryAs, rawSubquery } from './subquery/builder';
export { exists, notExists, ref, raw, lateral } from './subquery/exists';

// Relations exports
export {
  defineModel,
  getModel,
  hasRelation,
  getRelation,
  getRelationNames,
  clearModelRegistry,
  getAllModels,
} from './relations/define';
export {
  createModelQuery,
  ModelQueryComposer,
  normalizeIncludeOptions,
} from './relations/include';
export type {
  RelationType,
  BelongsToRelation,
  HasOneRelation,
  HasManyRelation,
  HasManyThroughRelation,
  RelationConfig,
  ModelDefinition,
  IncludeOptions,
  LoadedRelation,
  BatchLoadConfig,
} from './relations/types';
export {
  createRelationLoader,
  batchLoadBelongsTo,
  batchLoadHasMany,
  groupByKey,
  createAllRelationLoaders,
  loadRelation,
} from './relations/loader';
export type { QueryExecutor } from './relations/loader';

// Type-safe exports
export { TypedQueryComposer, createTypedComposer, typedFilter } from './types/infer';
export type {
  InferColumns,
  InferZodType,
  TypedWhere,
  TypedSelect,
  TypedOrderBy,
  InferResult,
} from './types/infer';

// PostgreSQL-specific exports
export {
  jsonbContains,
  jsonbContainedBy,
  jsonbHasKey,
  jsonbHasAllKeys,
  jsonbHasAnyKey,
  jsonbPath,
  jsonbPathText,
  jsonbExtract,
  jsonbExtractText,
  jsonbSet,
  jsonbArrayElements,
  jsonbObjectKeys,
} from './pg/jsonb';

export {
  fullTextSearch,
  fullTextWebSearch,
  fullTextRawSearch,
  fullTextRank,
  fullTextRankCd,
  toTsVector,
  toTsQuery,
  plainto_tsquery,
  websearch_to_tsquery,
  tsHeadline,
} from './pg/fts';

export {
  RecursiveCTEBuilder,
  createRecursiveCTE,
  ancestorsCTE,
  descendantsCTE,
} from './pg/recursive';

// Utility exports
export { extractZodColumns } from './utils/zod-utils';
