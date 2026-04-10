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

    // SELECT
    const fieldsPart = this._fields.length > 0 ? this._fields.join(', ') : '*';
    let sql = `SELECT ${fieldsPart} FROM ${this._table}`;

    // JOINs
    for (let i = 0; i < this._joins.length; i++) {
      sql += ` ${this._joins[i]}`;
    }

    // WHERE
    if (this._wheres.length > 0) {
      const parts: string[] = [];
      for (let i = 0; i < this._wheres.length; i++) {
        const w = this._wheres[i];
        parts.push(replaceParams(w.condition, w.values));
      }
      sql += ` WHERE (${parts.join(') AND (')})`;
    }

    // GROUP BY
    if (this._groups.length > 0) {
      sql += ` GROUP BY ${this._groups.join(', ')}`;
    }

    // HAVING
    if (this._havings.length > 0) {
      const parts: string[] = [];
      for (let i = 0; i < this._havings.length; i++) {
        const h = this._havings[i];
        parts.push(replaceParams(h.condition, h.values));
      }
      sql += ` HAVING (${parts.join(') AND (')})`;
    }

    // ORDER BY
    if (this._orders.length > 0) {
      sql += ` ORDER BY ${this._orders.join(', ')}`;
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
