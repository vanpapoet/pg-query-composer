/**
 * SQL identifier validation to prevent injection via table/column names.
 *
 * Allows: letters, digits, underscores, dots (for schema.table),
 * and parentheses/spaces for expressions like COUNT(*) or table aliases.
 * Rejects anything that could alter SQL structure.
 */

// Safe identifier pattern: alphanumeric, underscore, dot, space, parens, asterisk
// Rejects: quotes, semicolons, dashes (--), slashes, backslashes, etc.
const SAFE_IDENTIFIER_RE = /^[a-zA-Z0-9_.*() ]+$/;

/**
 * Validate that a string is a safe SQL identifier.
 * Throws if the identifier contains potentially dangerous characters.
 *
 * @param identifier - The identifier to validate
 * @throws Error if identifier contains unsafe characters
 */
export function validateIdentifier(identifier: string): void {
  if (!identifier || !SAFE_IDENTIFIER_RE.test(identifier)) {
    throw new Error(
      `Unsafe SQL identifier: "${identifier}". Only alphanumeric, underscore, dot, space, parentheses, and asterisk are allowed.`
    );
  }
}
