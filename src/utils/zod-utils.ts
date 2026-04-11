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
  const cached = zodColumnsCache.get(schema);
  if (cached) return cached;

  const result = extractColumnsUncached(schema);
  zodColumnsCache.set(schema, result);
  return result;
}

/**
 * Walk the schema to find the underlying ZodObject shape.
 * Handles ZodObject, ZodEffects, ZodOptional, ZodNullable + duck-typing fallbacks.
 */
function extractColumnsUncached(schema: z.ZodTypeAny): string[] {
  // Fast path: instanceof ZodObject (same zod version)
  if (schema instanceof z.ZodObject) return Object.keys(schema.shape);

  // Duck-typing fallback for cross-version compatibility
  if (isZodObjectLike(schema)) return Object.keys(schema.shape);

  // Wrapper types: unwrap and recurse (ZodEffects, ZodOptional, ZodNullable)
  if (schema instanceof z.ZodEffects) return extractZodColumns(schema._def.schema);
  if (schema instanceof z.ZodOptional) return extractZodColumns(schema._def.innerType);
  if (schema instanceof z.ZodNullable) return extractZodColumns(schema._def.innerType);

  // Duck-typing fallback for wrapper types
  const def = (schema as any)?._def;
  if (def?.schema) return extractZodColumns(def.schema);
  if (def?.innerType) return extractZodColumns(def.innerType);

  return [];
}
