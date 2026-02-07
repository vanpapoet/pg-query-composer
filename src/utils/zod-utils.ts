import * as z from 'zod';

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
 * Supports both zod v3 and v4 schemas via duck-typing fallback.
 */
export function extractZodColumns(schema: z.ZodTypeAny): string[] {
  // Prefer instanceof for exact match (same zod version)
  if (schema instanceof z.ZodObject) {
    return Object.keys(schema.shape);
  }

  // Duck-typing fallback for cross-version compatibility (e.g., zod v4 schema in zod v3 consumer)
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
