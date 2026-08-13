import * as z from 'zod';

/**
 * WeakMap cache for extractZodColumns results.
 * Same schema object always yields same columns — avoid re-extracting.
 */
const zodColumnsCache = new WeakMap<object, string[]>();

/**
 * Check if an object looks like a ZodObject (duck-typing).
 * Supports both zod v3 and v4 schemas by checking for .shape property
 * instead of relying solely on instanceof.
 */
function isZodObjectLike(schema: unknown): schema is { shape: Record<string, unknown> } {
  return (
    schema != null &&
    typeof schema === 'object' &&
    'shape' in schema &&
    typeof (schema as any).shape === 'object' &&
    (schema as any).shape !== null
  );
}

/**
 * Extract column names from a Zod schema.
 * Results are cached per schema reference via WeakMap.
 */
export function extractZodColumns(schema: z.ZodTypeAny): string[] {
  // Guard before touching the WeakMap: a non-object key makes `.set()` throw
  // `TypeError: Invalid value used as weak map key`.
  if (schema == null || typeof schema !== 'object') return [];

  const cached = zodColumnsCache.get(schema);
  if (cached) return cached;

  const result = extractColumnsUncached(schema);
  zodColumnsCache.set(schema, result);
  return result;
}

/**
 * Walk the schema to find the underlying ZodObject shape.
 *
 * Unwraps structurally rather than via `instanceof`: zod class identity is not
 * stable across majors (`z.ZodEffects` is `undefined` on v4, so
 * `schema instanceof z.ZodEffects` throws `TypeError` for anything that is not
 * object-like), but the `_def` shape is. Covers ZodObject, `.transform()`
 * (v3 `ZodEffects._def.schema` / v4 `ZodPipe._def.in`), `.optional()`,
 * `.nullable()` and `.default()` (`_def.innerType`, both majors).
 */
function extractColumnsUncached(schema: z.ZodTypeAny): string[] {
  // ZodObject — `.shape` exists on both v3 and v4
  if (isZodObjectLike(schema)) return Object.keys(schema.shape);

  const def = (schema as any)._def;
  if (def) {
    if (def.schema) return extractZodColumns(def.schema); // v3 ZodEffects
    if (def.in) return extractZodColumns(def.in); // v4 ZodPipe (.transform)
    if (def.innerType) return extractZodColumns(def.innerType); // optional/nullable/default
  }

  return [];
}
