import squel from 'squel';
import * as z from 'zod';
import { extractZodColumns } from '../utils/zod-utils';
import { OPERATORS, VALID_OPERATORS } from './operators';
import { InvalidColumnError, InvalidOperatorError } from './errors';
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

// Configure squel for PostgreSQL
const sql = squel.useFlavour('postgres');

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
  private options: Required<QueryBuilderOptions>;
  private whitelist: readonly string[];

  private conditions: Condition[] = [];
  private orGroups: OrGroup[] = [];
  private notConditions: Condition[] = [];

  private sortOptions: SortOption[] = [];
  private paginationOptions: PaginationOptions | null = null;
  private selectedFields: string[] = [];
  private excludedFields: string[] = [];

  private joins: JoinConfig[] = [];
  private groupByFields: string[] = [];
  private havingConditions: HavingCondition[] = [];

  /**
   * Create a new QueryComposer instance
   */
  constructor(
    schema: z.ZodTypeAny,
    table: string,
    options: QueryBuilderOptions = {}
  ) {
    this.schema = schema;
    this.table = table;
    this.options = {
      strict: options.strict ?? true,
      separator: options.separator ?? '__',
      extraColumns: options.extraColumns ?? [],
      aliases: options.aliases ?? {},
    };

    // Build whitelist from schema + extra columns
    const schemaColumns = extractZodColumns(schema);
    this.whitelist = [
      ...schemaColumns,
      ...this.options.extraColumns,
      'id',
      'created_at',
      'updated_at',
      'deleted_at',
    ];
  }

  // ===========================================================================
  // VALIDATION METHODS
  // ===========================================================================

  private validateColumn(column: string): boolean {
    const isValid = this.whitelist.includes(column);
    if (!isValid && this.options.strict) {
      throw new InvalidColumnError(column, this.whitelist);
    }
    return isValid;
  }

  private validateOperator(operator: string): operator is QueryOperator {
    const isValid = VALID_OPERATORS.includes(operator as QueryOperator);
    if (!isValid && this.options.strict) {
      throw new InvalidOperatorError(operator);
    }
    return isValid;
  }

  private parseFieldOperator(key: string): {
    column: string;
    operator: QueryOperator;
  } {
    const parts = key.split(this.options.separator);
    const column = parts[0];
    const operator = (parts[1] || 'exact') as QueryOperator;

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
   */
  where(filters: Record<string, unknown>): this {
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined) continue;

      // Handle raw conditions
      if (key === '__raw' && typeof value === 'string') {
        this.whereRaw(value);
        continue;
      }

      try {
        const { column, operator } = this.parseFieldOperator(key);
        this.conditions.push({ column, operator, value });
      } catch (e) {
        if (this.options.strict) throw e;
      }
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

    for (const filters of filterGroups) {
      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined) continue;

        try {
          const { column, operator } = this.parseFieldOperator(key);
          conditions.push({ column, operator, value });
        } catch (e) {
          if (this.options.strict) throw e;
        }
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
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined) continue;

      try {
        const { column, operator } = this.parseFieldOperator(key);
        this.notConditions.push({ column, operator, value });
      } catch (e) {
        if (this.options.strict) throw e;
      }
    }
    return this;
  }

  // ===========================================================================
  // SUBQUERY METHODS
  // ===========================================================================

  /**
   * Add WHERE IN with subquery or array values
   */
  whereIn(column: string, subqueryOrValues: QueryComposer | unknown[]): this {
    if (subqueryOrValues instanceof QueryComposer) {
      const subquerySql = subqueryOrValues.toSelect().toString();
      this.whereRaw(`${column} IN (${subquerySql})`);
    } else {
      this.where({ [`${column}__in`]: subqueryOrValues });
    }
    return this;
  }

  /**
   * Add WHERE NOT IN with subquery or array values
   */
  whereNotIn(column: string, subqueryOrValues: QueryComposer | unknown[]): this {
    if (subqueryOrValues instanceof QueryComposer) {
      const subquerySql = subqueryOrValues.toSelect().toString();
      this.whereRaw(`${column} NOT IN (${subquerySql})`);
    } else {
      this.where({ [`${column}__notin`]: subqueryOrValues });
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
    this.excludedFields = fields.filter((f) => this.whitelist.includes(f));
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
    this.joins.push({ type: 'inner', table, on, alias });
    return this;
  }

  /**
   * Add LEFT JOIN
   */
  leftJoin(table: string, on: string, alias?: string): this {
    this.joins.push({ type: 'left', table, on, alias });
    return this;
  }

  /**
   * Add RIGHT JOIN
   */
  rightJoin(table: string, on: string, alias?: string): this {
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
  private applyConditions(query: any): any {
    // Apply AND conditions
    for (const cond of this.conditions) {
      if (cond.raw && cond.rawCondition) {
        query = query.where(cond.rawCondition, ...(cond.value as unknown[]));
        continue;
      }

      const handler = OPERATORS[cond.operator];
      const [condStr, values] = handler(cond.column, cond.value);
      query = query.where(condStr, ...values);
    }

    // Apply OR groups
    for (const group of this.orGroups) {
      const orConditions: string[] = [];
      const orValues: unknown[] = [];

      for (const cond of group.conditions) {
        const handler = OPERATORS[cond.operator];
        const [condStr, values] = handler(cond.column, cond.value);
        orConditions.push(condStr);
        orValues.push(...values);
      }

      if (orConditions.length > 0) {
        const orExpr = `(${orConditions.join(' OR ')})`;
        query = query.where(orExpr, ...orValues);
      }
    }

    // Apply NOT conditions
    for (const cond of this.notConditions) {
      const handler = OPERATORS[cond.operator];
      const [condStr, values] = handler(cond.column, cond.value);
      query = query.where(`NOT (${condStr})`, ...values);
    }

    return query;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private applyJoins(query: any): any {
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

  private getSelectFields(): string[] {
    if (this.selectedFields.length > 0) {
      return this.selectedFields;
    }

    return this.whitelist.filter(
      (f) => !this.excludedFields.includes(f)
    ) as string[];
  }

  /**
   * Build SELECT query
   */
  toSelect(): squel.Select {
    let query = sql.select().from(this.table);

    // Apply fields
    const fields = this.getSelectFields();
    query = query.fields(fields);

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
      query = query.having(having.condition, ...having.values);
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
  toCount(): squel.Select {
    let query = sql.select().from(this.table).field('COUNT(*)', 'total');

    query = this.applyJoins(query);
    query = this.applyConditions(query);

    for (const field of this.groupByFields) {
      query = query.group(field);
    }

    for (const having of this.havingConditions) {
      query = query.having(having.condition, ...having.values);
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
    cloned.excludedFields = [...this.excludedFields];
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
    this.excludedFields = [];
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
