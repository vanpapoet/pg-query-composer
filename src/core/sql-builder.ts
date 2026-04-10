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
 */
export class SelectBuilder {
  private _table = '';
  private _fields: string[] = [];
  private _joins: string[] = [];
  private _wheres: WhereClause[] = [];
  private _groups: string[] = [];
  private _havings: WhereClause[] = [];
  private _orders: string[] = [];
  private _limit: number | null = null;
  private _offset: number | null = null;

  from(table: string): this {
    this._table = table;
    return this;
  }

  field(expr: string, _alias?: string): this {
    this._fields.push(_alias ? `${expr} AS ${_alias}` : expr);
    return this;
  }

  fields(fieldList: string[]): this {
    for (let i = 0; i < fieldList.length; i++) {
      this._fields.push(fieldList[i]);
    }
    return this;
  }

  join(tableRef: string, _alias: undefined, on: string): this {
    this._joins.push(`INNER JOIN ${tableRef} ON (${on})`);
    return this;
  }

  left_join(tableRef: string, _alias: undefined, on: string): this {
    this._joins.push(`LEFT JOIN ${tableRef} ON (${on})`);
    return this;
  }

  right_join(tableRef: string, _alias: undefined, on: string): this {
    this._joins.push(`RIGHT JOIN ${tableRef} ON (${on})`);
    return this;
  }

  where(condition: string, ...values: unknown[]): this {
    this._wheres.push({ condition, values });
    return this;
  }

  group(field: string): this {
    this._groups.push(field);
    return this;
  }

  having(condition: string, ...values: unknown[]): this {
    this._havings.push({ condition, values });
    return this;
  }

  order(column: string, asc: boolean): this {
    this._orders.push(`${column} ${asc ? 'ASC' : 'DESC'}`);
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
      sql += ` ${this._joins[i]}`;
    }

    // WHERE — build inline to avoid intermediate array + join
    if (this._wheres.length > 0) {
      const w0 = this._wheres[0];
      let whereStr = '(' + replaceParams(w0.condition, w0.values) + ')';
      for (let i = 1; i < this._wheres.length; i++) {
        const w = this._wheres[i];
        whereStr += ' AND (' + replaceParams(w.condition, w.values) + ')';
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

    // HAVING — build inline to avoid intermediate array + join
    if (this._havings.length > 0) {
      const h0 = this._havings[0];
      let havingStr = '(' + replaceParams(h0.condition, h0.values) + ')';
      for (let i = 1; i < this._havings.length; i++) {
        const h = this._havings[i];
        havingStr += ' AND (' + replaceParams(h.condition, h.values) + ')';
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
      sql += ` LIMIT ${this._limit}`;
    }
    if (this._offset !== null) {
      sql += ` OFFSET ${this._offset}`;
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
        ? `'${val.replace(/'/g, "''")}'`
        : val === null ? 'NULL' : String(val);
      result = result.replace(`$${i}`, replacement);
    }
    return result;
  }
}

interface WhereClause {
  condition: string;
  values: unknown[];
}

/**
 * Create a new SELECT builder
 */
export function select(): SelectBuilder {
  return new SelectBuilder();
}
