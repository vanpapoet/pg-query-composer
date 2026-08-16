import * as z from 'zod';
import { extractZodColumns } from '../utils/zod-utils';
import { OPERATORS, VALID_OPERATORS_SET } from './operators';
import { InvalidColumnError, InvalidOperatorError } from './errors';
import { validateIdentifier, validateColumnName, quoteIdentifier } from './identifier-validation';
import { isRawFilter } from './raw-filter';
import { SelectBuilder, toPlaceholders } from './sql-builder';
import { buildAliasMap, aliasProjection, aliasStarProjection, type AliasMap } from './column-aliases';
import type {
  QueryOperator,
  QueryBuilderOptions,
  PaginationOptions,
  PaginationMeta,
  SortOption,
  Condition,
  OrGroup,
  JoinConfig,
  HavingCondition,
} from './types';

// Negation map: operator → its negated form (avoids NOT wrapper in SQL)
const NEGATED_OPERATORS: Partial<Record<QueryOperator, QueryOperator>> = {
  exact: 'notexact',
  notexact: 'exact',
  gt: 'lte',
  gte: 'lt',
  lt: 'gte',
  lte: 'gt',
  isnull: 'isnotnull',
  isnotnull: 'isnull',
  in: 'notin',
  notin: 'in',
  between: 'notbetween',
  notbetween: 'between',
};

/**
 * Columns accepted in filters even when the schema omits them.
 *
 * These are a naming convention, not a fact about the table — a schema using
 * `inserted_at`, `createdAt` or no soft-delete column at all should override
 * them via `QueryBuilderOptions.defaultColumns` (pass `[]` to accept only what
 * the schema declares). Filter-only either way: their presence is an
 * assumption, so they are never expanded into a projection.
 */
export const DEFAULT_FILTER_COLUMNS: readonly string[] = Object.freeze([
  'id',
  'created_at',
  'updated_at',
  'deleted_at',
]);

interface Whitelist {
  /** Everything filterable, deduplicated (drives InvalidColumnError's hint). */
  list: readonly string[];
  set: ReadonlySet<string>;
  /**
   * Columns known to exist on the table — schema + extraColumns, minus the
   * assumed default columns. The only list safe to expand into a SELECT, which
   * `exclude()` has to do to turn `*` into an explicit projection.
   */
  projectable: readonly string[];
}

// Cache whitelist arrays and sets per schema (only for the fully default case)
const whitelistCache = new WeakMap<object, Whitelist>();

function buildWhitelist(
  schema: z.ZodTypeAny,
  extraColumns: string[],
  defaultColumns: readonly string[]
): Whitelist {
  // Cache only when nothing is customized — both lists feed the cached result
  const cacheable = extraColumns.length === 0 && defaultColumns === DEFAULT_FILTER_COLUMNS;
  if (cacheable) {
    const cached = whitelistCache.get(schema);
    if (cached) return cached;
  }

  // Caller-supplied column names reach SQL through the operator handlers, so
  // they get the same guard as any other raw identifier context
  for (const column of extraColumns) validateColumnName(column);
  if (defaultColumns !== DEFAULT_FILTER_COLUMNS) {
    for (const column of defaultColumns) validateColumnName(column);
  }

  const schemaColumns = extractZodColumns(schema);
  // Dedupe both lists: a schema declaring `id` would otherwise collide with
  // the default columns and emit the column twice in an expanded projection
  const projectable = [...new Set([...schemaColumns, ...extraColumns])];
  const set = new Set([...projectable, ...defaultColumns]);
  const result: Whitelist = { list: [...set], set, projectable };

  if (cacheable) {
    whitelistCache.set(schema, result);
  }
  return result;
}

// Pre-built default options to avoid object allocation on common path
const DEFAULT_OPTIONS: Required<QueryBuilderOptions> = {
  strict: true,
  separator: '__',
  extraColumns: [],
  aliases: {},
  defaultColumns: DEFAULT_FILTER_COLUMNS,
  quoteTable: false,
};

/**
 * Advanced SQL Query Composer
 *
 * A fluent, chainable query builder that supports:
 * - Django-style field__operator syntax
 * - AND/OR clause composition
 * - Pagination with metadata
 * - Flexible sorting
 * - Column validation via Zod schema
 * - SQL injection prevention
 */
export class QueryComposer {
  private schema: z.ZodTypeAny;
  private table: string;
  // The table as it goes into FROM — quoted when `quoteTable` is set. Kept
  // separate from `table` so clone() can re-derive it from the raw name.
  private fromTable: string;
  private options: Required<QueryBuilderOptions>;
  private whitelist: readonly string[];
  private whitelistSet: ReadonlySet<string>;
  private projectableColumns: readonly string[];
  // Source column → output aliases; null when none declared (the common path)
  private aliasByColumn: AliasMap | null;

  private conditions: Condition[] = [];
  private orGroups: OrGroup[] = [];
  private notConditions: Condition[] = [];

  private sortOptions: SortOption[] = [];
  private paginationOptions: PaginationOptions | null = null;
  private selectedFields: string[] = [];
  private excludedFields: Set<string> | null = null;

  private joins: JoinConfig[] = [];
  private groupByFields: string[] = [];
  private havingConditions: HavingCondition[] = [];

  /**
   * Create a new QueryComposer instance
   */
  constructor(
    schema: z.ZodTypeAny,
    table: string,
    options?: QueryBuilderOptions
  ) {
    validateIdentifier(table);
    this.schema = schema;
    this.table = table;

    // Use pre-built defaults when no options provided (common path)
    if (!options || (options.strict === undefined && options.separator === undefined
        && !options.extraColumns?.length && !Object.keys(options.aliases ?? {}).length
        && options.defaultColumns === undefined && options.quoteTable === undefined)) {
      this.options = DEFAULT_OPTIONS;
    } else {
      this.options = {
        strict: options.strict ?? true,
        separator: options.separator ?? '__',
        extraColumns: options.extraColumns ?? [],
        aliases: options.aliases ?? {},
        // Identity matters: buildWhitelist only caches the untouched default
        defaultColumns: options.defaultColumns ?? DEFAULT_FILTER_COLUMNS,
        quoteTable: options.quoteTable ?? false,
      };
    }

    // Quoting re-validates under the strict identifier rule — the looser
    // validateIdentifier above admits expressions, which must never be quoted.
    this.fromTable = this.options.quoteTable ? quoteIdentifier(table) : table;

    // Build whitelist from schema + extra + default columns (cached for common case)
    const wl = buildWhitelist(schema, this.options.extraColumns, this.options.defaultColumns);
    this.whitelist = wl.list;
    this.whitelistSet = wl.set;
    this.projectableColumns = wl.projectable;

    // Validate aliases once here — toSelect() then only reads the inverted map
    this.aliasByColumn = buildAliasMap(
      this.options.aliases,
      this.whitelist,
      this.whitelistSet,
      this.options.strict
    );
  }

  // ===========================================================================
  // VALIDATION METHODS
  // ===========================================================================

  private validateColumn(column: string): boolean {
    const isValid = this.whitelistSet.has(column);
    if (!isValid && this.options.strict) {
      throw new InvalidColumnError(column, this.whitelist);
    }
    return isValid;
  }

  private validateOperator(operator: string): operator is QueryOperator {
    const isValid = VALID_OPERATORS_SET.has(operator);
    if (!isValid && this.options.strict) {
      throw new InvalidOperatorError(operator);
    }
    return isValid;
  }

  private parseFieldOperator(key: string): {
    column: string;
    operator: QueryOperator;
  } {
    const sepIdx = key.indexOf(this.options.separator);
    const column = sepIdx === -1 ? key : key.slice(0, sepIdx);
    const operator = (sepIdx === -1 ? 'exact' : key.slice(sepIdx + this.options.separator.length)) as QueryOperator;

    if (!this.validateColumn(column)) {
      throw new InvalidColumnError(column, this.whitelist);
    }
    if (!this.validateOperator(operator)) {
      throw new InvalidOperatorError(operator);
    }

    return { column, operator };
  }

  // ===========================================================================
  // WHERE METHODS
  // ===========================================================================

  /**
   * Add WHERE conditions (AND logic)
   *
   * Accepts a plain filter object (`{ age__gte: 18 }`) and/or a branded raw
   * filter produced by the JSONB/FTS/EXISTS helpers. A `__raw` key that is NOT
   * branded — i.e. anything reaching here from untrusted input such as
   * `req.query` — is treated as an ordinary column name and rejected by the
   * whitelist, so raw SQL cannot be smuggled through user-supplied filters.
   */
  where(filters: Record<string, unknown>): this {
    const sep = this.options.separator;
    const sepLen = sep.length;

    // Expand branded raw filters (jsonbContains, fullTextSearch, exists, ...)
    const branded = isRawFilter(filters);
    if (branded) {
      const rawValues = filters['__rawValues'];
      this.whereRaw(filters['__raw'] as string, Array.isArray(rawValues) ? rawValues : []);
    }

    // Own enumerable keys only — `for...in` would walk the prototype chain and
    // let prototype pollution inject conditions into every query.
    for (const key of Object.keys(filters)) {
      const value = filters[key];
      if (value === undefined) continue;

      // Consumed above; when unbranded these fall through and fail the whitelist
      if (branded && (key === '__raw' || key === '__rawValues')) continue;

      const sepIdx = key.indexOf(sep);
      const column = sepIdx === -1 ? key : key.slice(0, sepIdx);
      const operator = (sepIdx === -1 ? 'exact' : key.slice(sepIdx + sepLen)) as QueryOperator;

      if (!this.whitelistSet.has(column)) {
        // Report the raw key when the separator split leaves an empty column
        // (e.g. a smuggled `__raw` key), otherwise the error names nothing.
        if (this.options.strict) throw new InvalidColumnError(column || key, this.whitelist);
        continue;
      }
      if (!VALID_OPERATORS_SET.has(operator)) {
        if (this.options.strict) throw new InvalidOperatorError(operator);
        continue;
      }

      this.conditions.push({ column, operator, value });
    }
    return this;
  }

  /**
   * Add raw WHERE condition
   */
  whereRaw(condition: string, values: unknown[] = []): this {
    this.conditions.push({
      column: '',
      operator: 'exact',
      value: values,
      raw: true,
      rawCondition: condition,
    });
    return this;
  }

  /**
   * Add OR conditions group
   */
  or(filterGroups: Array<Record<string, unknown>>): this {
    const conditions: Condition[] = [];
    const sep = this.options.separator;
    const sepLen = sep.length;

    for (const filters of filterGroups) {
      for (const key of Object.keys(filters)) {
        const value = filters[key];
        if (value === undefined) continue;

        const sepIdx = key.indexOf(sep);
        const column = sepIdx === -1 ? key : key.slice(0, sepIdx);
        const operator = (sepIdx === -1 ? 'exact' : key.slice(sepIdx + sepLen)) as QueryOperator;

        if (!this.whitelistSet.has(column)) {
          // Report the raw key when the separator split leaves an empty column
          // (e.g. a smuggled `__raw` key), otherwise the error names nothing.
          if (this.options.strict) throw new InvalidColumnError(column || key, this.whitelist);
          continue;
        }
        if (!VALID_OPERATORS_SET.has(operator)) {
          if (this.options.strict) throw new InvalidOperatorError(operator);
          continue;
        }

        conditions.push({ column, operator, value });
      }
    }

    if (conditions.length > 0) {
      this.orGroups.push({ conditions });
    }
    return this;
  }

  /**
   * Add NOT conditions
   */
  not(filters: Record<string, unknown>): this {
    const sep = this.options.separator;
    const sepLen = sep.length;

    for (const key of Object.keys(filters)) {
      const value = filters[key];
      if (value === undefined) continue;

      const sepIdx = key.indexOf(sep);
      const column = sepIdx === -1 ? key : key.slice(0, sepIdx);
      const operator = (sepIdx === -1 ? 'exact' : key.slice(sepIdx + sepLen)) as QueryOperator;

      if (!this.whitelistSet.has(column)) {
        // Report the raw key when the separator split leaves an empty column
        // (e.g. a smuggled `__raw` key), otherwise the error names nothing.
        if (this.options.strict) throw new InvalidColumnError(column || key, this.whitelist);
        continue;
      }
      if (!VALID_OPERATORS_SET.has(operator)) {
        if (this.options.strict) throw new InvalidOperatorError(operator);
        continue;
      }

      this.notConditions.push({ column, operator, value });
    }
    return this;
  }

  // ===========================================================================
  // SUBQUERY METHODS
  // ===========================================================================

  /**
   * Add WHERE IN with subquery or array values.
   * Subqueries preserve parameterization (no inline value interpolation).
   */
  whereIn(column: string, subqueryOrValues: QueryComposer | readonly unknown[]): this {
    validateColumnName(column);
    if (subqueryOrValues instanceof QueryComposer) {
      const { text, values } = subqueryOrValues.toParam();
      // Convert $N placeholders back to ? for re-numbering by outer query
      const rawText = toPlaceholders(text);
      this.whereRaw(column + ' IN (' + rawText + ')', values);
    } else {
      this.where({ [column + '__in']: subqueryOrValues });
    }
    return this;
  }

  /**
   * Add WHERE NOT IN with subquery or array values.
   * Subqueries preserve parameterization (no inline value interpolation).
   */
  whereNotIn(column: string, subqueryOrValues: QueryComposer | readonly unknown[]): this {
    validateColumnName(column);
    if (subqueryOrValues instanceof QueryComposer) {
      const { text, values } = subqueryOrValues.toParam();
      // Convert $N placeholders back to ? for re-numbering by outer query
      const rawText = toPlaceholders(text);
      this.whereRaw(column + ' NOT IN (' + rawText + ')', values);
    } else {
      this.where({ [column + '__notin']: subqueryOrValues });
    }
    return this;
  }

  // ===========================================================================
  // FIELD SELECTION METHODS
  // ===========================================================================

  /**
   * Select specific fields
   */
  select(fields: string[]): this {
    for (const field of fields) {
      if (this.validateColumn(field) || !this.options.strict) {
        this.selectedFields.push(field);
      }
    }
    return this;
  }

  /**
   * Exclude specific fields from selection
   */
  exclude(fields: string[]): this {
    // Validate like select()/orderBy(): dropping an unknown column silently
    // would return it anyway, so a typo'd `exclude(['pasword'])` must not pass
    // for "hidden". Non-strict keeps the old skip-unknown behaviour.
    this.excludedFields = new Set(fields.filter((f) => this.validateColumn(f)));
    return this;
  }

  // ===========================================================================
  // SORTING METHODS
  // ===========================================================================

  /**
   * Add ORDER BY clause
   */
  orderBy(...fields: string[]): this {
    for (const field of fields) {
      const isDesc = field.startsWith('-');
      const column = isDesc ? field.slice(1) : field;

      if (this.validateColumn(column) || !this.options.strict) {
        this.sortOptions.push({
          column,
          direction: isDesc ? 'DESC' : 'ASC',
        });
      }
    }
    return this;
  }

  /**
   * Clear all sorting
   */
  clearSort(): this {
    this.sortOptions = [];
    return this;
  }

  // ===========================================================================
  // PAGINATION METHODS
  // ===========================================================================

  /**
   * Add pagination
   */
  paginate(options: PaginationOptions): this {
    const maxLimit = options.maxLimit ?? 100;
    const limit = Math.min(options.limit ?? 20, maxLimit);
    const page = Math.max(options.page ?? 1, 1);

    this.paginationOptions = { page, limit, maxLimit };
    return this;
  }

  /**
   * Get pagination metadata
   */
  getPaginationMeta(total?: number): PaginationMeta {
    const page = this.paginationOptions?.page ?? 1;
    const limit = this.paginationOptions?.limit ?? 20;
    const offset = (page - 1) * limit;

    const meta: PaginationMeta = { page, limit, offset };

    if (total !== undefined) {
      meta.total = total;
      meta.totalPages = Math.ceil(total / limit);
      meta.hasNext = page < meta.totalPages;
      meta.hasPrev = page > 1;
    }

    return meta;
  }

  // ===========================================================================
  // JOIN METHODS
  // ===========================================================================

  /**
   * Add INNER JOIN
   */
  join(table: string, on: string, alias?: string): this {
    validateIdentifier(table);
    validateIdentifier(on);
    if (alias) validateIdentifier(alias);
    this.joins.push({ type: 'inner', table, on, alias });
    return this;
  }

  /**
   * Add LEFT JOIN
   */
  leftJoin(table: string, on: string, alias?: string): this {
    validateIdentifier(table);
    validateIdentifier(on);
    if (alias) validateIdentifier(alias);
    this.joins.push({ type: 'left', table, on, alias });
    return this;
  }

  /**
   * Add RIGHT JOIN
   */
  rightJoin(table: string, on: string, alias?: string): this {
    validateIdentifier(table);
    validateIdentifier(on);
    if (alias) validateIdentifier(alias);
    this.joins.push({ type: 'right', table, on, alias });
    return this;
  }

  // ===========================================================================
  // AGGREGATION METHODS
  // ===========================================================================

  /**
   * Add GROUP BY clause
   */
  groupBy(...fields: string[]): this {
    for (const field of fields) {
      if (this.validateColumn(field) || !this.options.strict) {
        this.groupByFields.push(field);
      }
    }
    return this;
  }

  /**
   * Add HAVING clause
   */
  having(condition: string, values: unknown[] = []): this {
    this.havingConditions.push({ condition, values });
    return this;
  }

  // ===========================================================================
  // CONDITIONAL COMPOSITION METHODS
  // ===========================================================================

  /**
   * Conditionally apply query modifications
   * @param condition - Boolean or function returning boolean
   * @param callback - Function to apply if condition is truthy
   */
  when(
    condition: boolean | (() => boolean) | unknown,
    callback: (qc: QueryComposer) => QueryComposer
  ): this {
    const shouldApply = typeof condition === 'function'
      ? (condition as () => boolean)()
      : Boolean(condition);
    if (shouldApply) {
      callback(this);
    }
    return this;
  }

  /**
   * Apply query modifications unless condition is true
   * @param condition - Boolean or function returning boolean
   * @param callback - Function to apply if condition is falsy
   */
  unless(
    condition: boolean | (() => boolean) | unknown,
    callback: (qc: QueryComposer) => QueryComposer
  ): this {
    const shouldSkip = typeof condition === 'function'
      ? (condition as () => boolean)()
      : Boolean(condition);
    if (!shouldSkip) {
      callback(this);
    }
    return this;
  }

  /**
   * Apply a scope to the query
   */
  apply(scopeDef: { apply: (qc: QueryComposer) => QueryComposer }): this {
    scopeDef.apply(this);
    return this;
  }

  // ===========================================================================
  // QUERY BUILDING METHODS
  // ===========================================================================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private applyConditions(query: SelectBuilder): SelectBuilder {
    // Apply AND conditions — use whereArr to avoid spread overhead
    for (const cond of this.conditions) {
      if (cond.raw && cond.rawCondition) {
        query = query.whereArr(cond.rawCondition, cond.value as unknown[]);
        continue;
      }

      const handler = OPERATORS[cond.operator];
      const [condStr, values] = handler(cond.column, cond.value);
      query = query.whereArr(condStr, values);
    }

    // Apply OR groups — build expression inline to avoid join()
    for (const group of this.orGroups) {
      const orValues: unknown[] = [];
      let orExpr = '';

      for (let i = 0; i < group.conditions.length; i++) {
        const cond = group.conditions[i];
        const handler = OPERATORS[cond.operator];
        const [condStr, values] = handler(cond.column, cond.value);
        if (i > 0) orExpr += ' OR ';
        orExpr += condStr;
        for (let j = 0; j < values.length; j++) orValues.push(values[j]);
      }

      if (orExpr) {
        query = query.whereArr('(' + orExpr + ')', orValues);
      }
    }

    // Apply NOT conditions — use negated operator when available, else wrap in NOT()
    for (const cond of this.notConditions) {
      const negated = NEGATED_OPERATORS[cond.operator];
      if (negated) {
        const handler = OPERATORS[negated];
        const [condStr, values] = handler(cond.column, cond.value);
        query = query.whereArr(condStr, values);
      } else {
        const handler = OPERATORS[cond.operator];
        const [condStr, values] = handler(cond.column, cond.value);
        query = query.whereArr('NOT (' + condStr + ')', values);
      }
    }

    return query;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private applyJoins(query: SelectBuilder): SelectBuilder {
    for (const join of this.joins) {
      const tableRef = join.alias ? `${join.table} ${join.alias}` : join.table;

      switch (join.type) {
        case 'inner':
          query = query.join(tableRef, undefined, join.on);
          break;
        case 'left':
          query = query.left_join(tableRef, undefined, join.on);
          break;
        case 'right':
          query = query.right_join(tableRef, undefined, join.on);
          break;
      }
    }
    return query;
  }

  /**
   * Build SELECT query
   */
  toSelect(): SelectBuilder {
    let query = new SelectBuilder().from(this.fromTable);

    // Apply fields — use SELECT * when no explicit select/exclude (shorter SQL, faster PG parse)
    const aliases = this.aliasByColumn;
    if (this.selectedFields.length > 0) {
      query = query.fields(aliases ? aliasProjection(this.selectedFields, aliases) : this.selectedFields);
    } else if (this.excludedFields && this.excludedFields.size > 0) {
      // Expanding `*` is the only way to drop a column, so it can only use
      // columns the schema actually declares — never the assumed DEFAULT_COLUMNS
      const fields = this.projectableColumns.filter((f) => !this.excludedFields!.has(f)) as string[];
      if (fields.length === 0) {
        // Silently falling back to `SELECT *` would ship the excluded column
        throw new Error(
          `exclude() cannot build a projection for table "${this.table}": no columns left to select. ` +
          'Declare the table\'s columns in the schema (or via extraColumns), or use select() instead.'
        );
      }
      query = query.fields(aliases ? aliasProjection(fields, aliases) : fields);
    } else if (aliases) {
      // No projection to rename in place — keep `*` and append the aliased copies
      query = query.fields(aliasStarProjection(aliases));
    }
    // else: no fields() call → SelectBuilder uses SELECT *

    // Apply joins
    query = this.applyJoins(query);

    // Apply conditions
    query = this.applyConditions(query);

    // Apply GROUP BY
    for (const field of this.groupByFields) {
      query = query.group(field);
    }

    // Apply HAVING
    for (const having of this.havingConditions) {
      query = query.having(having.condition, having.values);
    }

    // Apply sorting
    for (const sort of this.sortOptions) {
      query = query.order(sort.column, sort.direction === 'ASC');
    }

    // Apply pagination
    if (this.paginationOptions) {
      const { page, limit } = this.paginationOptions;
      const offset = (page! - 1) * limit!;
      query = query.limit(limit!).offset(offset);
    }

    return query;
  }

  /**
   * Build COUNT query
   */
  toCount(): SelectBuilder {
    let query = new SelectBuilder().from(this.fromTable).field('COUNT(*)', 'total');

    query = this.applyJoins(query);
    query = this.applyConditions(query);

    for (const field of this.groupByFields) {
      query = query.group(field);
    }

    for (const having of this.havingConditions) {
      query = query.having(having.condition, having.values);
    }

    return query;
  }

  /**
   * Get parameterized query for SELECT
   */
  toParam(): { text: string; values: unknown[] } {
    return this.toSelect().toParam();
  }

  /**
   * Get parameterized query for COUNT
   */
  toCountParam(): { text: string; values: unknown[] } {
    return this.toCount().toParam();
  }

  /**
   * Get SQL string (for debugging)
   */
  toSQL(): string {
    return this.toSelect().toString();
  }

  /**
   * Clone this composer
   */
  clone(): QueryComposer {
    const cloned = new QueryComposer(this.schema, this.table, this.options);
    cloned.conditions = [...this.conditions];
    cloned.orGroups = [...this.orGroups];
    cloned.notConditions = [...this.notConditions];
    cloned.sortOptions = [...this.sortOptions];
    cloned.paginationOptions = this.paginationOptions
      ? { ...this.paginationOptions }
      : null;
    cloned.selectedFields = [...this.selectedFields];
    cloned.excludedFields = this.excludedFields ? new Set(this.excludedFields) : null;
    cloned.joins = [...this.joins];
    cloned.groupByFields = [...this.groupByFields];
    cloned.havingConditions = [...this.havingConditions];
    return cloned;
  }

  /**
   * Reset all conditions
   */
  reset(): this {
    this.conditions = [];
    this.orGroups = [];
    this.notConditions = [];
    this.sortOptions = [];
    this.paginationOptions = null;
    this.selectedFields = [];
    this.excludedFields = null;
    this.joins = [];
    this.groupByFields = [];
    this.havingConditions = [];
    return this;
  }

  /**
   * Get internal state for merging
   */
  getInternalState(): {
    conditions: Condition[];
    orGroups: OrGroup[];
    notConditions: Condition[];
  } {
    return {
      conditions: [...this.conditions],
      orGroups: [...this.orGroups],
      notConditions: [...this.notConditions],
    };
  }

  /**
   * Merge conditions from another QueryComposer
   */
  mergeFrom(other: QueryComposer): this {
    const otherState = other.getInternalState();
    this.conditions.push(...otherState.conditions);
    this.orGroups.push(...otherState.orGroups);
    this.notConditions.push(...otherState.notConditions);
    return this;
  }
}

/**
 * Create a QueryComposer instance
 */
export function createQueryComposer(
  schema: z.ZodTypeAny,
  table: string,
  options?: QueryBuilderOptions
): QueryComposer {
  return new QueryComposer(schema, table, options);
}
