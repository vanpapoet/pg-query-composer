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

  const result = extractZodColumnsUncached(schema);
  zodColumnsCache.set(schema, result);
  return result;
}

function extractZodColumnsUncached(schema: z.ZodTypeAny): string[] {
  // Prefer instanceof for exact match (same zod version)
  if (schema instanceof z.ZodObject) {
    return Object.keys(schema.shape);
  }

  // Duck-typing fallback for cross-version compatibility
  if (isZodObjectLike(schema)) {
    return Object.keys(schema.shape);
  }

  // Handle ZodEffects (e.g., .refine(), .transform())
  if (schema instanceof z.ZodEffects) {
    return extractZodColumns(schema._def.schema);
  }

  // Handle ZodOptional
  if (schema instanceof z.ZodOptional) {
    return extractZodColumns(schema._def.innerType);
  }

  // Handle ZodNullable
  if (schema instanceof z.ZodNullable) {
    return extractZodColumns(schema._def.innerType);
  }

  // Duck-typing fallback for effects/optional/nullable
  if (schema && typeof schema === 'object') {
    const def = (schema as any)._def;
    if (def) {
      if (def.schema) return extractZodColumns(def.schema);
      if (def.innerType) return extractZodColumns(def.innerType);
    }
  }

  return [];
}
