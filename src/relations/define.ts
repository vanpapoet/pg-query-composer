import type * as z from 'zod';
import type { ModelDefinition, RelationConfig } from './types';

/**
 * Registry of defined models
 */
const modelRegistry = new Map<string, ModelDefinition>();

/**
 * Define a model with its schema and relations
 *
 * Creates a model definition that can be used for type-safe queries
 * and eager loading of relations.
 *
 * @param config - Model configuration
 * @returns The model definition
 *
 * @example
 * ```typescript
 * const League = defineModel({
 *   name: 'League',
 *   table: 'leagues',
 *   schema: LeagueSchema,
 *   relations: {
 *     posts: {
 *       type: 'hasMany',
 *       target: 'posts',
 *       foreignKey: 'league_id',
 *       primaryKey: 'id',
 *     },
 *     country: {
 *       type: 'belongsTo',
 *       target: 'countries',
 *       foreignKey: 'country_id',
 *       primaryKey: 'id',
 *     },
 *   },
 * });
 * ```
 */
export function defineModel<T extends z.ZodTypeAny>(
  config: {
    name: string;
    table: string;
    schema: T;
    primaryKey?: string;
    relations?: Record<string, RelationConfig>;
  }
): ModelDefinition<T> {
  const model: ModelDefinition<T> = {
    name: config.name,
    table: config.table,
    schema: config.schema,
    primaryKey: config.primaryKey ?? 'id',
    relations: config.relations,
  };

  // Register the model
  modelRegistry.set(config.name, model);

  return model;
}

/**
 * Get a registered model by name
 *
 * @param name - Model name
 * @returns The model definition or undefined
 *
 * @example
 * ```typescript
 * const League = getModel('League');
 * if (League) {
 *   // Use the model
 * }
 * ```
 */
export function getModel(name: string): ModelDefinition | undefined {
  return modelRegistry.get(name);
}

/**
 * Check if a model has a specific relation
 *
 * @param model - Model definition
 * @param relationName - Name of the relation to check
 * @returns True if the relation exists
 *
 * @example
 * ```typescript
 * if (hasRelation(League, 'posts')) {
 *   // League has posts relation
 * }
 * ```
 */
export function hasRelation(
  model: ModelDefinition,
  relationName: string
): boolean {
  return model.relations !== undefined && relationName in model.relations;
}

/**
 * Get a relation configuration from a model
 *
 * @param model - Model definition
 * @param relationName - Name of the relation
 * @returns The relation configuration or undefined
 *
 * @example
 * ```typescript
 * const postsRelation = getRelation(League, 'posts');
 * if (postsRelation?.type === 'hasMany') {
 *   // Handle hasMany relation
 * }
 * ```
 */
export function getRelation(
  model: ModelDefinition,
  relationName: string
): RelationConfig | undefined {
  return model.relations?.[relationName];
}

/**
 * Get all relation names for a model
 *
 * @param model - Model definition
 * @returns Array of relation names
 */
export function getRelationNames(model: ModelDefinition): string[] {
  return Object.keys(model.relations ?? {});
}

/**
 * Clear the model registry (useful for testing)
 */
export function clearModelRegistry(): void {
  modelRegistry.clear();
}

/**
 * Get all registered models
 */
export function getAllModels(): Map<string, ModelDefinition> {
  return new Map(modelRegistry);
}
