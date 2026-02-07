import DataLoader from 'dataloader';
import { QueryComposer } from '../core/query-composer';
import type {
  ModelDefinition,
  RelationConfig,
  BelongsToRelation,
  HasOneRelation,
  HasManyRelation,
  HasManyThroughRelation,
} from './types';
import { getRelation } from './define';

/**
 * Query executor function type
 */
export type QueryExecutor = (
  query: { text: string; values: unknown[] }
) => Promise<Record<string, unknown>[]>;

/**
 * Batch load configuration
 */
export interface BatchLoadConfig {
  query: { text: string; values: unknown[] };
  batchKey: string;
  isSingle: boolean;
}

/**
 * Group array items by a key
 *
 * @param items - Array of items to group
 * @param key - Key to group by
 * @returns Map of key -> items
 */
export function groupByKey<T extends Record<string, unknown>>(
  items: T[],
  key: string
): Map<unknown, T[]> {
  const grouped = new Map<unknown, T[]>();

  for (const item of items) {
    const keyValue = item[key];
    const existing = grouped.get(keyValue) || [];
    existing.push(item);
    grouped.set(keyValue, existing);
  }

  return grouped;
}

/**
 * Create a DataLoader for a relation
 *
 * Uses DataLoader to batch and cache relation loading,
 * preventing N+1 query problems.
 *
 * @param model - Model definition
 * @param relationName - Name of the relation
 * @param executor - Function to execute queries
 * @returns DataLoader instance
 *
 * @example
 * ```typescript
 * const postsLoader = createRelationLoader(League, 'posts', async (query) => {
 *   return db.query(query.text, query.values);
 * });
 *
 * // Will batch multiple loads into single query
 * const posts1 = await postsLoader.load('league-1');
 * const posts2 = await postsLoader.load('league-2');
 * ```
 */
export function createRelationLoader(
  model: ModelDefinition,
  relationName: string,
  executor: QueryExecutor
): DataLoader<string, Record<string, unknown>[]> {
  const relation = getRelation(model, relationName);
  if (!relation) {
    throw new Error(`Relation '${relationName}' not found on model '${model.name}'`);
  }

  return new DataLoader<string, Record<string, unknown>[]>(
    async (keys) => {
      const uniqueKeys = [...new Set(keys)];
      const config = getBatchLoadConfig(model, relationName, uniqueKeys);

      // Execute the batch query
      const results = await executor(config.query);

      // Group results by the batch key
      const grouped = groupByKey(results, config.batchKey);

      // Return results in the same order as keys
      return keys.map((key) => grouped.get(key) || []);
    },
    {
      // Use string representation for cache key
      cacheKeyFn: (key) => String(key),
    }
  );
}

/**
 * Get batch load configuration based on relation type
 */
function getBatchLoadConfig(
  model: ModelDefinition,
  relationName: string,
  keys: string[]
): BatchLoadConfig {
  const relation = getRelation(model, relationName)!;

  switch (relation.type) {
    case 'belongsTo':
      return batchLoadBelongsTo(model, relationName, keys);
    case 'hasOne':
      return batchLoadHasOne(model, relationName, keys);
    case 'hasMany':
      return batchLoadHasMany(model, relationName, keys);
    case 'hasManyThrough':
      return batchLoadHasManyThrough(model, relationName, keys);
  }
}

/**
 * Generate batch load config for belongsTo relation
 */
export function batchLoadBelongsTo(
  model: ModelDefinition,
  relationName: string,
  keys: string[]
): BatchLoadConfig {
  const relation = getRelation(model, relationName) as BelongsToRelation;

  const qc = new QueryComposer(
    model.schema, // Using parent schema as placeholder
    relation.target,
    { strict: false, extraColumns: [relation.primaryKey] }
  );

  qc.whereIn(relation.primaryKey, keys);

  return {
    query: qc.toParam(),
    batchKey: relation.primaryKey,
    isSingle: true,
  };
}

/**
 * Generate batch load config for hasOne relation
 */
export function batchLoadHasOne(
  model: ModelDefinition,
  relationName: string,
  keys: string[]
): BatchLoadConfig {
  const relation = getRelation(model, relationName) as HasOneRelation;

  const qc = new QueryComposer(
    model.schema,
    relation.target,
    { strict: false, extraColumns: [relation.foreignKey] }
  );

  qc.whereIn(relation.foreignKey, keys);

  return {
    query: qc.toParam(),
    batchKey: relation.foreignKey,
    isSingle: true,
  };
}

/**
 * Generate batch load config for hasMany relation
 */
export function batchLoadHasMany(
  model: ModelDefinition,
  relationName: string,
  keys: string[]
): BatchLoadConfig {
  const relation = getRelation(model, relationName) as HasManyRelation;

  const qc = new QueryComposer(
    model.schema,
    relation.target,
    { strict: false, extraColumns: [relation.foreignKey] }
  );

  qc.whereIn(relation.foreignKey, keys);

  return {
    query: qc.toParam(),
    batchKey: relation.foreignKey,
    isSingle: false,
  };
}

/**
 * Generate batch load config for hasManyThrough relation
 */
export function batchLoadHasManyThrough(
  model: ModelDefinition,
  relationName: string,
  keys: string[]
): BatchLoadConfig {
  const relation = getRelation(model, relationName) as HasManyThroughRelation;

  // For hasManyThrough, we need a JOIN query
  const qc = new QueryComposer(
    model.schema,
    relation.target,
    { strict: false, extraColumns: [relation.foreignKey, relation.throughForeignKey] }
  );

  // Join through the pivot table
  qc.join(
    relation.through,
    `${relation.target}.${relation.throughPrimaryKey} = ${relation.through}.${relation.throughForeignKey}`
  );

  qc.whereIn(`${relation.through}.${relation.foreignKey}`, keys);

  return {
    query: qc.toParam(),
    batchKey: relation.foreignKey,
    isSingle: false,
  };
}

/**
 * Create loaders for all relations of a model
 *
 * @param model - Model definition
 * @param executor - Query executor function
 * @returns Map of relation name -> DataLoader
 */
export function createAllRelationLoaders(
  model: ModelDefinition,
  executor: QueryExecutor
): Map<string, DataLoader<string, Record<string, unknown>[]>> {
  const loaders = new Map<string, DataLoader<string, Record<string, unknown>[]>>();

  if (model.relations) {
    for (const relationName of Object.keys(model.relations)) {
      loaders.set(relationName, createRelationLoader(model, relationName, executor));
    }
  }

  return loaders;
}

/**
 * Load relations for a set of records
 *
 * @param records - Parent records
 * @param model - Parent model definition
 * @param relationName - Relation to load
 * @param executor - Query executor
 * @returns Records with loaded relations
 */
export async function loadRelation<T extends Record<string, unknown>>(
  records: T[],
  model: ModelDefinition,
  relationName: string,
  executor: QueryExecutor
): Promise<T[]> {
  const relation = getRelation(model, relationName);
  if (!relation) {
    throw new Error(`Relation '${relationName}' not found`);
  }

  const loader = createRelationLoader(model, relationName, executor);

  // Get the key field based on relation type
  const keyField = relation.type === 'belongsTo'
    ? (relation as BelongsToRelation).foreignKey
    : model.primaryKey || 'id';

  // Load relations for all records
  const results = await Promise.all(
    records.map(async (record) => {
      const key = String(record[keyField]);
      const related = await loader.load(key);

      return {
        ...record,
        [relationName]: relation.type === 'belongsTo' || relation.type === 'hasOne'
          ? related[0] || null
          : related,
      };
    })
  );

  return results;
}
