/**
 * PostgreSQL Full-Text Search operators and functions
 *
 * Provides helpers for working with tsvector and tsquery.
 */

type RawFilter = { __raw: string };

/**
 * Full-text search match operator (@@)
 *
 * Searches a tsvector column using plainto_tsquery.
 *
 * @param column - tsvector column name
 * @param query - Search query string
 * @param config - Text search configuration (default: 'english')
 * @returns Filter object for use with where()
 *
 * @example
 * ```typescript
 * qc.where(fullTextSearch('search_vector', 'react hooks'));
 * // Generates: search_vector @@ plainto_tsquery('english', 'react hooks')
 * ```
 */
export function fullTextSearch(
  column: string,
  query: string,
  config = 'english'
): RawFilter {
  return {
    __raw: `${column} @@ plainto_tsquery('${config}', '${escapeQuery(query)}')`,
  };
}

/**
 * Full-text search with websearch syntax
 *
 * Supports Google-like search syntax with quotes and minus.
 *
 * @param column - tsvector column name
 * @param query - Search query with websearch syntax
 * @param config - Text search configuration (default: 'english')
 * @returns Filter object for use with where()
 *
 * @example
 * ```typescript
 * qc.where(fullTextWebSearch('search_vector', '"react hooks" -angular'));
 * // Supports: quoted phrases, -exclusion, OR
 * ```
 */
export function fullTextWebSearch(
  column: string,
  query: string,
  config = 'english'
): RawFilter {
  return {
    __raw: `${column} @@ websearch_to_tsquery('${config}', '${escapeQuery(query)}')`,
  };
}

/**
 * Full-text search with raw tsquery
 *
 * For advanced queries using tsquery operators.
 *
 * @param column - tsvector column name
 * @param query - tsquery string with operators
 * @param config - Text search configuration (default: 'english')
 * @returns Filter object for use with where()
 *
 * @example
 * ```typescript
 * qc.where(fullTextRawSearch('search_vector', 'react & (hooks | state)'));
 * // Uses tsquery operators: & (AND), | (OR), ! (NOT)
 * ```
 */
export function fullTextRawSearch(
  column: string,
  query: string,
  config = 'english'
): RawFilter {
  return {
    __raw: `${column} @@ to_tsquery('${config}', '${escapeQuery(query)}')`,
  };
}

/**
 * Full-text rank expression
 *
 * Generates ts_rank for ordering by relevance.
 *
 * @param column - tsvector column name
 * @param query - Search query string
 * @param config - Text search configuration (default: 'english')
 * @returns SQL expression string
 *
 * @example
 * ```typescript
 * const rankExpr = fullTextRank('search_vector', 'react');
 * // Use in orderBy or select: ts_rank(search_vector, ...)
 * ```
 */
export function fullTextRank(
  column: string,
  query: string,
  config = 'english'
): string {
  return `ts_rank(${column}, plainto_tsquery('${config}', '${escapeQuery(query)}'))`;
}

/**
 * Full-text rank with cover density
 *
 * Uses ts_rank_cd which considers proximity of matching lexemes.
 *
 * @param column - tsvector column name
 * @param query - Search query string
 * @param config - Text search configuration (default: 'english')
 * @returns SQL expression string
 */
export function fullTextRankCd(
  column: string,
  query: string,
  config = 'english'
): string {
  return `ts_rank_cd(${column}, plainto_tsquery('${config}', '${escapeQuery(query)}'))`;
}

/**
 * to_tsvector expression
 *
 * Converts text to tsvector.
 *
 * @param config - Text search configuration
 * @param column - Column or expression to convert
 * @returns SQL expression string
 *
 * @example
 * ```typescript
 * const expr = toTsVector('english', 'title || \' \' || content');
 * // Generates: to_tsvector('english', title || ' ' || content)
 * ```
 */
export function toTsVector(config: string, column: string): string {
  return `to_tsvector('${config}', ${column})`;
}

/**
 * to_tsquery expression
 *
 * Converts query string to tsquery with operators.
 *
 * @param config - Text search configuration
 * @param query - Query string with tsquery operators
 * @returns SQL expression string
 */
export function toTsQuery(config: string, query: string): string {
  return `to_tsquery('${config}', '${escapeQuery(query)}')`;
}

/**
 * plainto_tsquery expression
 *
 * Converts plain text to tsquery.
 *
 * @param config - Text search configuration
 * @param query - Plain text query
 * @returns SQL expression string
 */
export function plainto_tsquery(config: string, query: string): string {
  return `plainto_tsquery('${config}', '${escapeQuery(query)}')`;
}

/**
 * websearch_to_tsquery expression
 *
 * Converts websearch syntax to tsquery.
 *
 * @param config - Text search configuration
 * @param query - Query with websearch syntax
 * @returns SQL expression string
 */
export function websearch_to_tsquery(config: string, query: string): string {
  return `websearch_to_tsquery('${config}', '${escapeQuery(query)}')`;
}

/**
 * ts_headline expression
 *
 * Generates highlighted search results.
 *
 * @param config - Text search configuration
 * @param document - Document column or text
 * @param query - Search query
 * @param options - Headline options (StartSel, StopSel, MaxWords, etc.)
 * @returns SQL expression string
 */
export function tsHeadline(
  config: string,
  document: string,
  query: string,
  options?: Record<string, string | number>
): string {
  const optStr = options
    ? `, '${Object.entries(options)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}'`
    : '';

  return `ts_headline('${config}', ${document}, plainto_tsquery('${config}', '${escapeQuery(query)}')${optStr})`;
}

/**
 * Escape single quotes in query string
 */
function escapeQuery(query: string): string {
  return query.replace(/'/g, "''");
}
