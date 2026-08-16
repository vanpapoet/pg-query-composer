/**
 * SQL identifier validation to prevent injection via table/column names.
 *
 * Allows: letters, digits, underscores, dots (schema.table),
 * parentheses/spaces (COUNT(*), table aliases), equals (JOIN ON),
 * commas (multi-column expressions), and well-formed double-quoted identifiers
 * ("tblFoo", for case-sensitive names PostgreSQL would otherwise fold).
 * Rejects: single quotes, stray/unbalanced double quotes, semicolons,
 * comment markers (--), slashes, backslashes, and other characters that could
 * alter SQL structure.
 */

// Safe SQL expression pattern — permits characters needed for:
//   identifiers (a-z, 0-9, _), schema refs (.), aliases/expressions (space, parens, *),
//   join conditions (=), multi-column (,)
// Rejects: ', ", ;, --, /, \, and other injection vectors
const SAFE_SQL_EXPR_RE = /^[a-zA-Z0-9_.*() =,]+$/;

// A complete double-quoted identifier: an opening quote, a plain identifier,
// a closing quote. Nothing else may appear between the quotes — no spaces,
// no operators, no second quote — so a quoted segment can never carry SQL
// structure of its own.
const QUOTED_IDENT_RE = /"[a-zA-Z_][a-zA-Z0-9_]*"/g;

/**
 * Validate that a string is a safe SQL identifier or expression.
 * Throws if the string contains potentially dangerous characters.
 *
 * Double-quoted identifiers are accepted so callers can reach tables and
 * columns whose names PostgreSQL would otherwise fold to lower case
 * (`ON "tblFoo".id = orders."userId"`). They are checked by substitution:
 * every well-formed `"ident"` is replaced with a bare identifier, then the
 * remainder must satisfy the unquoted rule. A quote that survives that pass is
 * unbalanced or wraps something other than a plain identifier — either way it
 * could break out of the quoting, so the whole string is rejected.
 *
 * @param identifier - The identifier or expression to validate
 * @throws Error if identifier contains unsafe characters
 */
export function validateIdentifier(identifier: string): void {
  // Substituting `q` (a valid bare identifier) keeps the remainder well-formed
  // for SAFE_SQL_EXPR_RE without inventing characters the original lacked.
  const unquoted = identifier ? identifier.replace(QUOTED_IDENT_RE, 'q') : identifier;

  if (!identifier || unquoted.includes('"') || !SAFE_SQL_EXPR_RE.test(unquoted)) {
    throw new Error(
      `Unsafe SQL identifier: "${identifier}". Only alphanumeric, underscore, dot, space, parentheses, asterisk, equals, comma, and complete double-quoted identifiers are allowed.`
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

/**
 * Wrap an identifier in double quotes, preserving its original letter case.
 *
 * PostgreSQL folds unquoted identifiers to lower case before resolving them, so
 * a table created as `CREATE TABLE "settings_hangXe"` (what most ORMs emit) is
 * unreachable through a bare `settings_hangXe` reference — PG looks up
 * `settings_hangxe` and reports `relation "settings_hangxe" does not exist`.
 *
 * Each dot-separated part is quoted individually: `public.tblFoo` becomes
 * `"public"."tblFoo"`, not `"public.tblFoo"` (which would name a single table
 * containing a dot).
 *
 * The name is validated as a plain identifier first, so no `"` from the caller
 * can ever reach the output — the quotes are ours, never theirs.
 *
 * @param name - Plain identifier, optionally qualified (`table`, `schema.table`)
 * @returns The quoted form, e.g. `"settings_hangXe"`
 * @throws Error if the name is not a plain (optionally qualified) identifier
 */
export function quoteIdentifier(name: string): string {
  validateColumnName(name);
  return name
    .split('.')
    .map((part) => `"${part}"`)
    .join('.');
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
