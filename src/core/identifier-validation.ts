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
