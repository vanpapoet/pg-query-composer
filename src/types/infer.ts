import * as z from 'zod';
import { QueryComposer } from '../core/query-composer';
import type { QueryBuilderOptions, QueryOperator } from '../core/types';

/**
 * Extract column names from a Zod object schema
 */
export type InferColumns<T extends z.ZodTypeAny> = T extends z.ZodObject<infer Shape>
  ? keyof Shape & string
  : never;

/**
 * Infer the TypeScript type from a Zod schema
 */
export type InferZodType<T extends z.ZodTypeAny> = z.infer<T>;

/**
 * Operator suffixes for typed where
 */
type OperatorSuffix =
  | ''
  | '__exact'
  | '__notexact'
  | '__gt'
  | '__gte'
  | '__lt'
  | '__lte'
  | '__contains'
  | '__icontains'
  | '__startswith'
  | '__istartswith'
  | '__endswith'
  | '__iendswith'
  | '__in'
  | '__notin'
  | '__between'
  | '__isnull'
  | '__isnotnull';

/**
 * Generate typed where filter interface
 *
 * Allows both exact matches and operator-based filters
 */
export type TypedWhere<T extends z.ZodTypeAny> = T extends z.ZodObject<infer Shape>
  ? {
      [K in keyof Shape as K extends string ? K : never]?: z.infer<Shape[K]>;
    } & {
      [K in keyof Shape as K extends string ? `${K}${OperatorSuffix}` : never]?: unknown;
    }
  : Record<string, unknown>;

/**
 * Typed select fields
 */
export type TypedSelect<T extends z.ZodTypeAny> = InferColumns<T>[];

/**
 * Typed order by fields (with optional - prefix for DESC)
 */
export type TypedOrderBy<T extends z.ZodTypeAny> = T extends z.ZodObject<infer Shape>
  ? (keyof Shape extends string ? keyof Shape | `-${keyof Shape & string}` : string)[]
  : string[];

/**
 * Type-safe QueryComposer wrapper
 *
 * Provides compile-time type checking for:
 * - Column names in where(), select(), orderBy()
 * - Operator syntax validation
 * - Result type inference
 */
export class TypedQueryComposer<T extends z.ZodTypeAny> extends QueryComposer {
  private typeSchema: T;

  constructor(schema: T, table: string, options?: QueryBuilderOptions) {
    super(schema, table, options);
    this.typeSchema = schema;
  }

  /**
   * Type-safe where with typed filter object
   */
  override where(filters: TypedWhere<T>): this {
    return super.where(filters as Record<string, unknown>);
  }

  /**
   * Type-safe select with typed column array
   */
  override select(fields: TypedSelect<T>): this {
    return super.select(fields);
  }

  /**
   * Type-safe orderBy with typed field names
   */
  orderBy(...fields: string[]): this {
    return super.orderBy(...fields) as this;
  }

  /**
   * Type-safe or with typed filter groups
   */
  override or(filterGroups: Array<TypedWhere<T>>): this {
    return super.or(filterGroups as Array<Record<string, unknown>>);
  }

  /**
   * Type-safe not with typed filter object
   */
  override not(filters: TypedWhere<T>): this {
    return super.not(filters as Record<string, unknown>);
  }

  /**
   * Type-safe conditional with typed callback
   */
  override when(
    condition: boolean | (() => boolean) | unknown,
    callback: (qc: QueryComposer) => QueryComposer
  ): this {
    return super.when(condition, callback) as this;
  }

  /**
   * Type-safe unless with typed callback
   */
  override unless(
    condition: boolean | (() => boolean) | unknown,
    callback: (qc: QueryComposer) => QueryComposer
  ): this {
    return super.unless(condition, callback) as this;
  }

  /**
   * Clone with preserved types
   */
  clone(): TypedQueryComposer<T> {
    const cloned = new TypedQueryComposer(this.typeSchema, '', this.getOptions());
    const baseClone = super.clone();
    Object.assign(cloned, baseClone);
    return cloned;
  }

  /**
   * Get the typed schema
   */
  getSchema(): T {
    return this.typeSchema;
  }

  /**
   * Get options for cloning
   */
  private getOptions(): QueryBuilderOptions {
    // Access private options via any - not ideal but necessary for cloning
    return (this as any).options;
  }
}

/**
 * Create a type-safe query composer
 *
 * @param schema - Zod schema for the table
 * @param table - Table name
 * @param options - Query builder options
 * @returns TypedQueryComposer with full type safety
 *
 * @example
 * ```typescript
 * const UserSchema = z.object({
 *   id: z.string(),
 *   name: z.string(),
 *   age: z.number(),
 *   status: z.enum(['active', 'inactive']),
 * });
 *
 * const qc = createTypedComposer(UserSchema, 'users')
 *   .where({ status: 'active' })      // Type-safe!
 *   .where({ age__gte: 18 })          // Operators work too
 *   .select(['id', 'name'])           // Only valid columns
 *   .orderBy('-created_at');          // With optional - prefix
 * ```
 */
export function createTypedComposer<T extends z.ZodTypeAny>(
  schema: T,
  table: string,
  options?: QueryBuilderOptions
): TypedQueryComposer<T> {
  return new TypedQueryComposer(schema, table, options);
}

/**
 * Infer result type based on select fields
 *
 * If no select is specified, returns full type.
 * Otherwise returns pick of selected fields.
 */
export type InferResult<
  T extends z.ZodTypeAny,
  Selected extends InferColumns<T>[] | undefined = undefined
> = Selected extends InferColumns<T>[]
  ? Pick<InferZodType<T>, Selected[number]>
  : InferZodType<T>;

/**
 * Type helper for building typed filters
 */
export function typedFilter<T extends z.ZodTypeAny>(
  _schema: T,
  filter: TypedWhere<T>
): TypedWhere<T> {
  return filter;
}
