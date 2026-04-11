import * as z from 'zod';
import { QueryComposer } from '../core/query-composer';
import { validateIdentifier } from '../core/identifier-validation';

/**
 * Recursive CTE Builder
 *
 * Builds WITH RECURSIVE queries for hierarchical data traversal.
 */
export class RecursiveCTEBuilder<T extends z.ZodTypeAny> {
  private name: string;
  private schema: T;
  private baseQuery: QueryComposer | null = null;
  private recursiveTable: string = '';
  private recursiveJoinCondition: string = '';
  private sourceTable: string = '';
  private includeDepth: boolean = false;
  private maxDepth: number | null = null;
  private additionalColumns: string[] = [];

  constructor(name: string, schema: T) {
    validateIdentifier(name);
    this.name = name;
    this.schema = schema;
  }

  /**
   * Define the base case (anchor member)
   *
   * @param queryFn - Function that configures the base query
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * cte.baseCase(q => q.where({ parent_id__isnull: true }));
   * ```
   */
  baseCase(queryFn: (qc: QueryComposer) => QueryComposer): this {
    const qc = new QueryComposer(this.schema, this.sourceTable || 'source', {
      strict: false,
    });
    this.baseQuery = queryFn(qc);
    return this;
  }

  /**
   * Define the recursive case
   *
   * @param table - Source table to join with
   * @param joinCondition - Join condition between CTE and source table
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * cte.recursiveCase('categories', 'tree.id = categories.parent_id');
   * ```
   */
  recursiveCase(table: string, joinCondition: string): this {
    validateIdentifier(table);
    validateIdentifier(joinCondition);
    this.recursiveTable = table;
    this.recursiveJoinCondition = joinCondition;
    return this;
  }

  /**
   * Set the source table
   *
   * @param table - Table name
   * @returns this for chaining
   */
  from(table: string): this {
    validateIdentifier(table);
    this.sourceTable = table;
    // Update base query table if already set
    if (this.baseQuery) {
      const qc = new QueryComposer(this.schema, table, { strict: false });
      // Re-apply the base case with correct table
      this.baseQuery = qc;
    }
    return this;
  }

  /**
   * Add depth tracking column
   *
   * @returns this for chaining
   */
  withDepth(): this {
    this.includeDepth = true;
    return this;
  }

  /**
   * Set maximum recursion depth
   *
   * @param depth - Maximum depth
   * @returns this for chaining
   */
  withMaxDepth(depth: number): this {
    this.maxDepth = depth;
    return this;
  }

  /**
   * Add additional columns to track through recursion
   *
   * @param columns - Column names
   * @returns this for chaining
   */
  withColumns(...columns: string[]): this {
    this.additionalColumns.push(...columns);
    return this;
  }

  /**
   * Generate parameterized query.
   * Uses $N placeholders for base query values to prevent SQL injection.
   *
   * @returns Object with text and values
   */
  toParam(): { text: string; values: unknown[] } {
    const columns = this.getColumnList();
    const depthCol = this.includeDepth ? ', depth' : '';
    const depthInit = this.includeDepth ? ', 0 AS depth' : '';
    const depthInc = this.includeDepth ? ', depth + 1' : '';
    const depthWhere = this.maxDepth !== null ? ' WHERE depth < ' + this.maxDepth : '';

    // Base case — use toParam() to preserve $N placeholders
    let baseSQL: string;
    let baseValues: unknown[];
    if (this.baseQuery) {
      const param = this.baseQuery.toParam();
      baseSQL = param.text.replace('SELECT', 'SELECT ' + columns + depthInit + ',');
      // Fix double comma if SELECT * → SELECT cols, *, remove trailing *
      baseSQL = baseSQL.replace(columns + depthInit + ', *', columns + depthInit);
      baseValues = param.values;
    } else {
      baseSQL = 'SELECT ' + columns + depthInit + ' FROM ' + this.sourceTable;
      baseValues = [];
    }

    // Recursive case — no user values, safe string construction
    const recursiveSQL =
      'SELECT ' + this.recursiveTable + '.' + columns.replace(/, /g, ', ' + this.recursiveTable + '.') + depthInc +
      ' FROM ' + this.recursiveTable +
      ' JOIN ' + this.name + ' ON ' + this.recursiveJoinCondition + depthWhere;

    const text =
      'WITH RECURSIVE ' + this.name + ' AS (\n  ' +
      baseSQL + '\n  UNION ALL\n  ' +
      recursiveSQL + '\n)\nSELECT ' + columns + depthCol + ' FROM ' + this.name;

    return { text, values: baseValues };
  }

  /**
   * Generate SQL string with inlined values (for debugging only).
   * WARNING: Do NOT use for query execution — use toParam() instead.
   *
   * @returns SQL string with inlined values
   */
  toSQL(): string {
    const { text, values } = this.toParam();
    let result = text;
    for (let i = values.length; i >= 1; i--) {
      const val = values[i - 1];
      const replacement = typeof val === 'string'
        ? "'" + val.replace(/'/g, "''") + "'"
        : val === null ? 'NULL' : String(val);
      result = result.replace('$' + i, replacement);
    }
    return result;
  }

  /**
   * Get column list
   */
  private getColumnList(): string {
    const schemaKeys = Object.keys((this.schema as unknown as z.ZodObject<z.ZodRawShape>).shape || {});
    const allColumns = [...schemaKeys, ...this.additionalColumns];
    return allColumns.join(', ') || '*';
  }
}

/**
 * Create a recursive CTE builder
 *
 * @param name - CTE name
 * @param schema - Zod schema for the table
 * @returns RecursiveCTEBuilder instance
 *
 * @example
 * ```typescript
 * // Find all descendants of a category
 * const descendants = createRecursiveCTE('descendants', CategorySchema)
 *   .from('categories')
 *   .baseCase(q => q.where({ id: rootId }))
 *   .recursiveCase('categories', 'descendants.id = categories.parent_id')
 *   .withDepth();
 *
 * const { text, values } = descendants.toParam();
 * // Execute: db.query(text, values)
 * ```
 */
export function createRecursiveCTE<T extends z.ZodTypeAny>(
  name: string,
  schema: T
): RecursiveCTEBuilder<T> {
  return new RecursiveCTEBuilder(name, schema);
}

/**
 * Create ancestors traversal CTE
 *
 * Helper for common ancestor traversal pattern.
 *
 * @param table - Table name
 * @param schema - Zod schema
 * @param startId - Starting node ID
 * @param parentColumn - Column pointing to parent (default: 'parent_id')
 * @returns RecursiveCTEBuilder configured for ancestor traversal
 */
export function ancestorsCTE<T extends z.ZodTypeAny>(
  table: string,
  schema: T,
  startId: string,
  parentColumn = 'parent_id'
): RecursiveCTEBuilder<T> {
  return createRecursiveCTE('ancestors', schema)
    .from(table)
    .baseCase((q) => q.where({ id: startId }))
    .recursiveCase(table, `ancestors.${parentColumn} = ${table}.id`)
    .withDepth();
}

/**
 * Create descendants traversal CTE
 *
 * Helper for common descendant traversal pattern.
 *
 * @param table - Table name
 * @param schema - Zod schema
 * @param rootId - Root node ID
 * @param parentColumn - Column pointing to parent (default: 'parent_id')
 * @returns RecursiveCTEBuilder configured for descendant traversal
 */
export function descendantsCTE<T extends z.ZodTypeAny>(
  table: string,
  schema: T,
  rootId: string,
  parentColumn = 'parent_id'
): RecursiveCTEBuilder<T> {
  return createRecursiveCTE('descendants', schema)
    .from(table)
    .baseCase((q) => q.where({ id: rootId }))
    .recursiveCase(table, `descendants.id = ${table}.${parentColumn}`)
    .withDepth();
}
