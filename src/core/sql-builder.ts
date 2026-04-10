/**
 * Lightweight SQL builder for PostgreSQL.
 * Replaces squel dependency with minimal overhead — builds SQL strings
 * directly with $N numbered parameter placeholders.
 */

/**
 * Result of a parameterized query build
 */
export interface ParamResult {
  text: string;
  values: unknown[];
}

/**
 * Minimal SELECT query builder for PostgreSQL.
 * Produces parameterized queries with $1, $2, ... placeholders.
 * Uses parallel arrays instead of object arrays to minimize allocations.
 */
export class SelectBuilder {
  private _table = '';
  private _fields: string[] = [];
  private _joins: string[] = [];
  // Parallel arrays for WHERE clauses — avoids per-clause object allocation
  private _wConds: string[] = [];
  private _wVals: unknown[][] = [];
  private _groups: string[] = [];
  // Parallel arrays for HAVING clauses
  private _hConds: string[] = [];
  private _hVals: unknown[][] = [];
  private _orders: string[] = [];
  private _limit: number | null = null;
  private _offset: number | null = null;

  from(table: string): this {
    this._table = table;
    return this;
  }

  field(expr: string, _alias?: string): this {
    this._fields.push(_alias ? expr + ' AS ' + _alias : expr);
    return this;
  }

  fields(fieldList: string[]): this {
    this._fields = fieldList;
    return this;
  }

  join(tableRef: string, _alias: undefined, on: string): this {
    this._joins.push('INNER JOIN ' + tableRef + ' ON (' + on + ')');
    return this;
  }

  left_join(tableRef: string, _alias: undefined, on: string): this {
    this._joins.push('LEFT JOIN ' + tableRef + ' ON (' + on + ')');
    return this;
  }

  right_join(tableRef: string, _alias: undefined, on: string): this {
    this._joins.push('RIGHT JOIN ' + tableRef + ' ON (' + on + ')');
    return this;
  }

  where(condition: string, ...values: unknown[]): this {
    this._wConds.push(condition);
    this._wVals.push(values);
    return this;
  }

  /**
   * Add WHERE clause with values as array (avoids spread overhead)
   */
  whereArr(condition: string, values: unknown[]): this {
    this._wConds.push(condition);
    this._wVals.push(values);
    return this;
  }

  group(field: string): this {
    this._groups.push(field);
    return this;
  }

  having(condition: string, values: unknown[]): this {
    this._hConds.push(condition);
    this._hVals.push(values);
    return this;
  }

  order(column: string, asc: boolean): this {
    this._orders.push(column + (asc ? ' ASC' : ' DESC'));
    return this;
  }

  limit(n: number): this {
    this._limit = n;
    return this;
  }

  offset(n: number): this {
    this._offset = n;
    return this;
  }

  /**
   * Build parameterized query with $1, $2, ... placeholders
   */
  toParam(): ParamResult {
    const allValues: unknown[] = [];
    let paramIndex = 0;

    // Replace ? placeholders with $N without regex
    const replaceParams = (clause: string, values: unknown[]): string => {
      // Fast path: no params to replace (isnull, today, thisweek, etc.)
      if (values.length === 0) return clause;
      let vi = 0;
      let result = '';
      let lastIdx = 0;
      for (let i = 0; i < clause.length; i++) {
        if (clause.charCodeAt(i) === 63) { // '?'
          paramIndex++;
          allValues.push(values[vi++]);
          result += clause.slice(lastIdx, i) + '$' + paramIndex;
          lastIdx = i + 1;
        }
      }
      return lastIdx === 0 ? clause : result + clause.slice(lastIdx);
    };

    // SELECT — build fields inline to avoid join
    let sql: string;
    if (this._fields.length > 0) {
      sql = 'SELECT ' + this._fields[0];
      for (let i = 1; i < this._fields.length; i++) {
        sql += ', ' + this._fields[i];
      }
      sql += ' FROM ' + this._table;
    } else {
      sql = 'SELECT * FROM ' + this._table;
    }

    // JOINs
    for (let i = 0; i < this._joins.length; i++) {
      sql += ' ' + this._joins[i];
    }

    // WHERE — build inline using parallel arrays
    if (this._wConds.length > 0) {
      let whereStr = '(' + replaceParams(this._wConds[0], this._wVals[0]) + ')';
      for (let i = 1; i < this._wConds.length; i++) {
        whereStr += ' AND (' + replaceParams(this._wConds[i], this._wVals[i]) + ')';
      }
      sql += ' WHERE ' + whereStr;
    }

    // GROUP BY — build inline
    if (this._groups.length > 0) {
      sql += ' GROUP BY ' + this._groups[0];
      for (let i = 1; i < this._groups.length; i++) {
        sql += ', ' + this._groups[i];
      }
    }

    // HAVING — build inline using parallel arrays
    if (this._hConds.length > 0) {
      let havingStr = '(' + replaceParams(this._hConds[0], this._hVals[0]) + ')';
      for (let i = 1; i < this._hConds.length; i++) {
        havingStr += ' AND (' + replaceParams(this._hConds[i], this._hVals[i]) + ')';
      }
      sql += ' HAVING ' + havingStr;
    }

    // ORDER BY — build inline
    if (this._orders.length > 0) {
      sql += ' ORDER BY ' + this._orders[0];
      for (let i = 1; i < this._orders.length; i++) {
        sql += ', ' + this._orders[i];
      }
    }

    // LIMIT / OFFSET
    if (this._limit !== null) {
      sql += ' LIMIT ' + this._limit;
    }
    if (this._offset !== null) {
      sql += ' OFFSET ' + this._offset;
    }

    return { text: sql, values: allValues };
  }

  /**
   * Build SQL string with inline values (for debugging / subqueries)
   */
  toString(): string {
    const { text, values } = this.toParam();
    let result = text;
    // Replace $N with inline values (reverse order to avoid $1 matching $10)
    for (let i = values.length; i >= 1; i--) {
      const val = values[i - 1];
      const replacement = typeof val === 'string'
        ? "'" + val.replace(/'/g, "''") + "'"
        : val === null ? 'NULL' : String(val);
      result = result.replace('$' + i, replacement);
    }
    return result;
  }
}

/**
 * Create a new SELECT builder
 */
export function select(): SelectBuilder {
  return new SelectBuilder();
}
