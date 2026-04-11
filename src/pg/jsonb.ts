/**
 * PostgreSQL JSONB operators and functions
 *
 * Provides type-safe helpers for working with JSONB columns.
 * All filter functions return parameterized queries to prevent SQL injection.
 */

import { validateIdentifier } from '../core/identifier-validation';

type RawFilter = { __raw: string; __rawValues?: unknown[] };

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
 * // Generates: data @> $1::jsonb (parameterized)
 * ```
 */
export function jsonbContains(column: string, value: unknown): RawFilter {
  validateIdentifier(column);
  return { __raw: column + ' @> ?::jsonb', __rawValues: [JSON.stringify(value)] };
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
  validateIdentifier(column);
  return { __raw: column + ' <@ ?::jsonb', __rawValues: [JSON.stringify(value)] };
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
 * // Generates: data ? $1 (parameterized)
 * ```
 */
export function jsonbHasKey(column: string, key: string): RawFilter {
  validateIdentifier(column);
  return { __raw: column + ' ? ?', __rawValues: [key] };
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
 * // Generates: data ?& array[$1, $2] (parameterized)
 * ```
 */
export function jsonbHasAllKeys(column: string, keys: string[]): RawFilter {
  validateIdentifier(column);
  const placeholders = keys.map(() => '?').join(', ');
  return { __raw: column + ' ?& array[' + placeholders + ']', __rawValues: keys };
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
 * // Generates: data ?| array[$1, $2] (parameterized)
 * ```
 */
export function jsonbHasAnyKey(column: string, keys: string[]): RawFilter {
  validateIdentifier(column);
  const placeholders = keys.map(() => '?').join(', ');
  return { __raw: column + ' ?| array[' + placeholders + ']', __rawValues: keys };
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
  validateIdentifier(column);
  for (const p of path) validateIdentifier(p);
  let expr = column;
  for (let i = 0; i < path.length; i++) expr += "->'" + path[i] + "'";
  return expr;
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
  validateIdentifier(column);
  for (const p of path) validateIdentifier(p);
  if (path.length === 0) return column;
  if (path.length === 1) return column + "->>'" + path[0] + "'";

  let expr = column;
  for (let i = 0; i < path.length - 1; i++) expr += "->'" + path[i] + "'";
  return expr + "->>'" + path[path.length - 1] + "'";
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
  validateIdentifier(column);
  for (const p of path) validateIdentifier(p);
  let args = "'" + path[0] + "'";
  for (let i = 1; i < path.length; i++) args += ", '" + path[i] + "'";
  return 'jsonb_extract_path(' + column + ', ' + args + ')';
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
  validateIdentifier(column);
  for (const p of path) validateIdentifier(p);
  let args = "'" + path[0] + "'";
  for (let i = 1; i < path.length; i++) args += ", '" + path[i] + "'";
  return 'jsonb_extract_path_text(' + column + ', ' + args + ')';
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
  validateIdentifier(column);
  for (const p of path) validateIdentifier(p);
  const pathArray = "'{" + path.join(',') + "}'";
  const jsonValue = JSON.stringify(value);
  return 'jsonb_set(' + column + ', ' + pathArray + ", '" + jsonValue + "'::jsonb, " + createMissing + ')';
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
  validateIdentifier(column);
  return 'jsonb_array_elements(' + column + ')';
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
  validateIdentifier(column);
  return 'jsonb_object_keys(' + column + ')';
}
