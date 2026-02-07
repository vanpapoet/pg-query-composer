import type { QueryOperator } from './types';

/**
 * Operator handler function type
 */
export type OperatorHandler = (
  column: string,
  value: unknown
) => [string, unknown[]];

/**
 * Built-in operator handlers
 */
export const OPERATORS: Record<QueryOperator, OperatorHandler> = {
  // ===== COMPARISON OPERATORS =====
  exact: (col, val) => [`${col} = ?`, [val]],
  notexact: (col, val) => [`${col} != ?`, [val]],
  gt: (col, val) => [`${col} > ?`, [val]],
  gte: (col, val) => [`${col} >= ?`, [val]],
  lt: (col, val) => [`${col} < ?`, [val]],
  lte: (col, val) => [`${col} <= ?`, [val]],

  // ===== TEXT OPERATORS =====
  contains: (col, val) => [`${col} ILIKE ?`, [`%${val}%`]],
  icontains: (col, val) => [`${col} ILIKE ?`, [`%${val}%`]],
  startswith: (col, val) => [`${col} ILIKE ?`, [`${val}%`]],
  istartswith: (col, val) => [`${col} ILIKE ?`, [`${val}%`]],
  endswith: (col, val) => [`${col} ILIKE ?`, [`%${val}`]],
  iendswith: (col, val) => [`${col} ILIKE ?`, [`%${val}`]],
  regex: (col, val) => [`${col} ~ ?`, [val]],
  iregex: (col, val) => [`${col} ~* ?`, [val]],

  // ===== RANGE OPERATORS =====
  in: (col, val) => {
    const arr = Array.isArray(val) ? val : [val];
    if (arr.length === 0) return ['FALSE', []];
    const placeholders = arr.map(() => '?').join(', ');
    return [`${col} IN (${placeholders})`, arr];
  },
  notin: (col, val) => {
    const arr = Array.isArray(val) ? val : [val];
    if (arr.length === 0) return ['TRUE', []];
    const placeholders = arr.map(() => '?').join(', ');
    return [`${col} NOT IN (${placeholders})`, arr];
  },
  between: (col, val) => {
    const arr = Array.isArray(val) ? val : [];
    if (arr.length !== 2) {
      throw new Error(`between operator requires array of 2 values, got ${arr.length}`);
    }
    return [`${col} BETWEEN ? AND ?`, arr];
  },
  notbetween: (col, val) => {
    const arr = Array.isArray(val) ? val : [];
    if (arr.length !== 2) {
      throw new Error(`notbetween operator requires array of 2 values, got ${arr.length}`);
    }
    return [`${col} NOT BETWEEN ? AND ?`, arr];
  },

  // ===== NULL OPERATORS =====
  isnull: (col, val) => [val ? `${col} IS NULL` : `${col} IS NOT NULL`, []],
  isnotnull: (col, val) => [val ? `${col} IS NOT NULL` : `${col} IS NULL`, []],

  // ===== DATE OPERATORS =====
  date: (col, val) => [`DATE(${col}) = ?`, [val]],
  datebetween: (col, val) => {
    const arr = Array.isArray(val) ? val : [];
    if (arr.length !== 2) {
      throw new Error('datebetween operator requires array of 2 values');
    }
    return [`DATE(${col}) BETWEEN ? AND ?`, arr];
  },
  year: (col, val) => [`EXTRACT(YEAR FROM ${col}) = ?`, [val]],
  month: (col, val) => [`EXTRACT(MONTH FROM ${col}) = ?`, [val]],
  day: (col, val) => [`EXTRACT(DAY FROM ${col}) = ?`, [val]],
  week: (col, val) => [`EXTRACT(WEEK FROM ${col}) = ?`, [val]],
  today: (col) => [`DATE(${col}) = CURRENT_DATE`, []],
  thisweek: (col) => [
    `${col} >= DATE_TRUNC('week', CURRENT_DATE) AND ${col} < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '1 week'`,
    [],
  ],
  thismonth: (col) => [
    `${col} >= DATE_TRUNC('month', CURRENT_DATE) AND ${col} < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'`,
    [],
  ],
  thisyear: (col) => [
    `${col} >= DATE_TRUNC('year', CURRENT_DATE) AND ${col} < DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year'`,
    [],
  ],

  // ===== ARRAY OPERATORS (PostgreSQL) =====
  arraycontains: (col, val) => {
    const arr = Array.isArray(val) ? val : [val];
    const placeholders = arr.map(() => '?').join(', ');
    return [`${col} @> ARRAY[${placeholders}]`, arr];
  },
  arrayoverlap: (col, val) => {
    const arr = Array.isArray(val) ? val : [val];
    const placeholders = arr.map(() => '?').join(', ');
    return [`${col} && ARRAY[${placeholders}]`, arr];
  },
  arraycontained: (col, val) => {
    const arr = Array.isArray(val) ? val : [val];
    const placeholders = arr.map(() => '?').join(', ');
    return [`${col} <@ ARRAY[${placeholders}]`, arr];
  },
};

/**
 * List of all valid operator names
 */
export const VALID_OPERATORS = Object.keys(OPERATORS) as QueryOperator[];
