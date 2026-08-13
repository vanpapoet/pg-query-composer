/**
 * SQL identifier validation to prevent injection via table/column names.
 *
 * Allows: letters, digits, underscores, dots (schema.table),
 * parentheses/spaces (COUNT(*), table aliases), equals (JOIN ON),
 * commas (multi-column expressions).
 * Rejects: quotes, semicolons, comment markers (--), slashes, backslashes,
 * and other characters that could alter SQL structure.
 */

// Safe SQL expression pattern — permits characters needed for:
//   identifiers (a-z, 0-9, _), schema refs (.), aliases/expressions (space, parens, *),
//   join conditions (=), multi-column (,)
// Rejects: ', ", ;, --, /, \, and other injection vectors
const SAFE_SQL_EXPR_RE = /^[a-zA-Z0-9_.*() =,]+$/;

/**
 * Validate that a string is a safe SQL identifier or expression.
 * Throws if the string contains potentially dangerous characters.
 *
 * @param identifier - The identifier or expression to validate
 * @throws Error if identifier contains unsafe characters
 */
export function validateIdentifier(identifier: string): void {
  if (!identifier || !SAFE_SQL_EXPR_RE.test(identifier)) {
    throw new Error(
      `Unsafe SQL identifier: "${identifier}". Only alphanumeric, underscore, dot, space, parentheses, asterisk, equals, and comma are allowed.`
    );
  }
}

// Strict pattern for bare column references: `col` or `table.col` / `schema.table.col`.
// Deliberately narrower than SAFE_SQL_EXPR_RE — that one permits spaces,
// parentheses and `=`, which is enough to build `1=1) OR (1` or `(SELECT ...)`
// without ever using a quote.
const COLUMN_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;

/**
 * Validate that a string is a bare column reference.
 *
 * Use wherever a column name is concatenated into SQL outside the schema
 * whitelist (e.g. the subquery branch of `whereIn`), where the looser
 * `validateIdentifier` would let an expression through.
 *
 * @param column - The column reference to validate
 * @throws Error if the column is not a plain (optionally qualified) identifier
 */
export function validateColumnName(column: string): void {
  if (!column || !COLUMN_NAME_RE.test(column)) {
    throw new Error(
      `Unsafe column name: "${column}". Expected a plain identifier such as "col" or "table.col".`
    );
  }
}

// Output aliases are single, unqualified identifiers — `col AS schema.alias` is
// not valid SQL, so dots are rejected here even though COLUMN_NAME_RE allows them.
const ALIAS_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Validate that a string is usable as an output alias (`expr AS alias`).
 *
 * Stricter than `validateColumnName`: no dots, no expressions. Use wherever an
 * alias is concatenated into SQL (e.g. `QueryBuilderOptions.aliases`).
 *
 * @param alias - The alias to validate
 * @throws Error if the alias is not a plain unqualified identifier
 */
export function validateAliasName(alias: string): void {
  if (!alias || !ALIAS_NAME_RE.test(alias)) {
    throw new Error(
      `Unsafe column alias: "${alias}". Expected a plain unqualified identifier such as "email_addr".`
    );
  }
}
