import * as z from 'zod';
import { QueryComposer } from '../core/query-composer';
import { RelationNotFoundError } from '../core/errors';
import type { ModelDefinition, IncludeOptions, RelationConfig } from './types';
import { getRelation, hasRelation } from './define';

/**
 * Include configuration tracked by ModelQueryComposer
 */
interface TrackedInclude {
  relation: string;
  config: RelationConfig;
  query?: (qc: QueryComposer) => QueryComposer;
  nested?: TrackedInclude[];
}

/**
 * Extended QueryComposer with model-aware features
 *
 * Adds support for:
 * - Eager loading relations with `.include()`
 * - Nested includes
 * - Filtered includes
 */
export class ModelQueryComposer extends QueryComposer {
  private model: ModelDefinition;
  private includes: TrackedInclude[] = [];

  constructor(model: ModelDefinition) {
    super(model.schema, model.table, { strict: false });
    this.model = model;
  }

  /**
   * Include a relation for eager loading
   *
   * @param relation - Relation name to include
   * @param queryCallback - Optional callback to filter/modify the relation query
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * // Basic include
   * query.include('posts');
   *
   * // With filtering
   * query.include('posts', q => q.where({ status: 'active' }).limit(10));
   *
   * // Multiple includes
   * query.include('posts').include('country');
   * ```
   */
  include(
    relation: string,
    queryCallback?: (qc: QueryComposer) => QueryComposer
  ): this {
    if (!hasRelation(this.model, relation)) {
      throw new RelationNotFoundError(relation, this.model.name);
    }

    const relationConfig = getRelation(this.model, relation)!;

    this.includes.push({
      relation,
      config: relationConfig,
      query: queryCallback,
    });

    return this;
  }

  /**
   * Get all tracked includes
   */
  getIncludes(): TrackedInclude[] {
    return [...this.includes];
  }

  /**
   * Get the model definition
   */
  getModel(): ModelDefinition {
    return this.model;
  }

  /**
   * Generate queries for all included relations
   *
   * Returns an array of query configurations that can be executed
   * to load related data.
   */
  getIncludeQueries(): Array<{
    relation: string;
    type: RelationConfig['type'];
    query: { text: string; values: unknown[] };
    foreignKey: string;
    primaryKey: string;
  }> {
    return this.includes.map((inc) => {
      const baseQuery = new QueryComposer(
        z.object({}), // Will be replaced with actual schema
        inc.config.target,
        { strict: false }
      );

      // Apply custom query modifications if provided
      const finalQuery = inc.query ? inc.query(baseQuery) : baseQuery;

      return {
        relation: inc.relation,
        type: inc.config.type,
        query: finalQuery.toParam(),
        foreignKey: this.getForeignKey(inc.config),
        primaryKey: inc.config.primaryKey,
      };
    });
  }

  /**
   * Get foreign key from relation config
   */
  private getForeignKey(config: RelationConfig): string {
    switch (config.type) {
      case 'belongsTo':
      case 'hasOne':
      case 'hasMany':
        return config.foreignKey;
      case 'hasManyThrough':
        return config.foreignKey;
    }
  }

  /**
   * Clone this query composer
   */
  override clone(): ModelQueryComposer {
    const cloned = new ModelQueryComposer(this.model);
    // Copy base QueryComposer state
    const baseClone = super.clone();
    Object.assign(cloned, baseClone);
    // Copy includes
    cloned.includes = [...this.includes];
    return cloned;
  }
}

/**
 * Create a model-aware query composer
 *
 * @param model - Model definition with relations
 * @returns ModelQueryComposer instance
 *
 * @example
 * ```typescript
 * const League = defineModel({
 *   name: 'League',
 *   table: 'leagues',
 *   schema: LeagueSchema,
 *   relations: {
 *     posts: { type: 'hasMany', target: 'posts', ... }
 *   }
 * });
 *
 * const query = createModelQuery(League)
 *   .where({ status: 'active' })
 *   .include('posts')
 *   .orderBy('-name');
 * ```
 */
export function createModelQuery(model: ModelDefinition): ModelQueryComposer {
  return new ModelQueryComposer(model);
}

/**
 * Build include configuration from options
 *
 * @param options - Include options or relation name
 * @returns Normalized include options
 */
export function normalizeIncludeOptions(
  options: string | IncludeOptions
): IncludeOptions {
  if (typeof options === 'string') {
    return { relation: options };
  }
  return options;
}
