/**
 * PostgreSQL JSONB operators and functions
 *
 * Provides type-safe helpers for working with JSONB columns.
 */

type RawFilter = { __raw: string };

/**
 * JSONB contains operator (@>)
 *
 * Tests if the JSONB column contains the given value.
 *
 * @param column - JSONB column name
 * @param value - Value to check for containment
 * @returns Filter object for use with where()
 *
 * @example
 * ```typescript
 * qc.where(jsonbContains('data', { status: 'active' }));
 * // Generates: data @> '{"status":"active"}'
 * ```
 */
export function jsonbContains(column: string, value: unknown): RawFilter {
  const jsonValue = JSON.stringify(value);
  return { __raw: `${column} @> '${jsonValue}'::jsonb` };
}

/**
 * JSONB is contained by operator (<@)
 *
 * Tests if the JSONB column is contained by the given value.
 *
 * @param column - JSONB column name
 * @param value - Value to check containment against
 * @returns Filter object for use with where()
 */
export function jsonbContainedBy(column: string, value: unknown): RawFilter {
  const jsonValue = JSON.stringify(value);
  return { __raw: `${column} <@ '${jsonValue}'::jsonb` };
}

/**
 * JSONB has key operator (?)
 *
 * Tests if the JSONB column has a specific key.
 *
 * @param column - JSONB column name
 * @param key - Key to check for
 * @returns Filter object for use with where()
 *
 * @example
 * ```typescript
 * qc.where(jsonbHasKey('data', 'status'));
 * // Generates: data ? 'status'
 * ```
 */
export function jsonbHasKey(column: string, key: string): RawFilter {
  return { __raw: `${column} ? '${key}'` };
}

/**
 * JSONB has all keys operator (?&)
 *
 * Tests if the JSONB column has all specified keys.
 *
 * @param column - JSONB column name
 * @param keys - Keys to check for
 * @returns Filter object for use with where()
 *
 * @example
 * ```typescript
 * qc.where(jsonbHasAllKeys('data', ['status', 'type']));
 * // Generates: data ?& array['status', 'type']
 * ```
 */
export function jsonbHasAllKeys(column: string, keys: string[]): RawFilter {
  const keysArray = keys.map((k) => `'${k}'`).join(', ');
  return { __raw: `${column} ?& array[${keysArray}]` };
}

/**
 * JSONB has any key operator (?|)
 *
 * Tests if the JSONB column has any of the specified keys.
 *
 * @param column - JSONB column name
 * @param keys - Keys to check for
 * @returns Filter object for use with where()
 *
 * @example
 * ```typescript
 * qc.where(jsonbHasAnyKey('data', ['status', 'state']));
 * // Generates: data ?| array['status', 'state']
 * ```
 */
export function jsonbHasAnyKey(column: string, keys: string[]): RawFilter {
  const keysArray = keys.map((k) => `'${k}'`).join(', ');
  return { __raw: `${column} ?| array[${keysArray}]` };
}

/**
 * JSONB path extraction (->)
 *
 * Extracts a JSON object at the specified path (returns JSONB).
 *
 * @param column - JSONB column name
 * @param path - Array of path elements
 * @returns SQL expression string
 *
 * @example
 * ```typescript
 * const expr = jsonbPath('data', ['user', 'profile']);
 * // Returns: data->'user'->'profile'
 * ```
 */
export function jsonbPath(column: string, path: string[]): string {
  const pathExpr = path.map((p) => `'${p}'`).join('->');
  return `${column}->${pathExpr}`;
}

/**
 * JSONB path text extraction (->>)
 *
 * Extracts a JSON value at the specified path (returns text).
 * Uses ->> for the last element to get text output.
 *
 * @param column - JSONB column name
 * @param path - Array of path elements
 * @returns SQL expression string
 *
 * @example
 * ```typescript
 * const expr = jsonbPathText('data', ['user', 'name']);
 * // Returns: data->'user'->>'name'
 * ```
 */
export function jsonbPathText(column: string, path: string[]): string {
  if (path.length === 0) return column;
  if (path.length === 1) return `${column}->>'${path[0]}'`;

  const parentPath = path.slice(0, -1).map((p) => `'${p}'`).join('->');
  const lastKey = path[path.length - 1];
  return `${column}->${parentPath}->>'${lastKey}'`;
}

/**
 * JSONB extract path function
 *
 * Uses jsonb_extract_path for path extraction.
 *
 * @param column - JSONB column name
 * @param path - Array of path elements
 * @returns SQL expression string
 *
 * @example
 * ```typescript
 * const expr = jsonbExtract('data', ['settings', 'theme']);
 * // Returns: jsonb_extract_path(data, 'settings', 'theme')
 * ```
 */
export function jsonbExtract(column: string, path: string[]): string {
  const pathArgs = path.map((p) => `'${p}'`).join(', ');
  return `jsonb_extract_path(${column}, ${pathArgs})`;
}

/**
 * JSONB extract path text function
 *
 * Uses jsonb_extract_path_text for text extraction.
 *
 * @param column - JSONB column name
 * @param path - Array of path elements
 * @returns SQL expression string
 */
export function jsonbExtractText(column: string, path: string[]): string {
  const pathArgs = path.map((p) => `'${p}'`).join(', ');
  return `jsonb_extract_path_text(${column}, ${pathArgs})`;
}

/**
 * JSONB set function
 *
 * Creates a jsonb_set expression for updating nested values.
 *
 * @param column - JSONB column name
 * @param path - Array of path elements
 * @param value - New value to set
 * @param createMissing - Whether to create missing path elements
 * @returns SQL expression string
 */
export function jsonbSet(
  column: string,
  path: string[],
  value: unknown,
  createMissing = true
): string {
  const pathArray = `'{${path.join(',')}}'`;
  const jsonValue = JSON.stringify(value);
  return `jsonb_set(${column}, ${pathArray}, '${jsonValue}'::jsonb, ${createMissing})`;
}

/**
 * JSONB array elements
 *
 * Creates a jsonb_array_elements expression.
 *
 * @param column - JSONB column or expression
 * @returns SQL expression string
 */
export function jsonbArrayElements(column: string): string {
  return `jsonb_array_elements(${column})`;
}

/**
 * JSONB object keys
 *
 * Creates a jsonb_object_keys expression.
 *
 * @param column - JSONB column or expression
 * @returns SQL expression string
 */
export function jsonbObjectKeys(column: string): string {
  return `jsonb_object_keys(${column})`;
}
