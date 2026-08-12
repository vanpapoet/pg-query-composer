import DataLoader from 'dataloader';
import type { ModelDefinition, BelongsToRelation } from './types';
import { getRelation } from './define';
import { getBatchLoadConfig } from './batch-load-config';
import type { RelationKey } from './batch-load-config';

// Query building for each relation type lives in batch-load-config.ts; it is
// re-exported here so `relations/loader` stays the single import path.
export {
  getBatchLoadConfig,
  batchLoadBelongsTo,
  batchLoadHasOne,
  batchLoadHasMany,
  batchLoadHasManyThrough,
} from './batch-load-config';
export type { RelationKey, BatchLoadConfig } from './batch-load-config';

/**
 * Query executor function type
 */
export type QueryExecutor = (
  query: { text: string; values: unknown[] }
) => Promise<Record<string, unknown>[]>;

/**
 * Normalize a relation key to a string.
 *
 * Grouping and lookup MUST go through this: a parent row's `id` of `1` (number)
 * has to match a child row's `user_id` of `1`, and `Map` uses SameValueZero, so
 * `1` and `'1'` would otherwise be distinct buckets.
 */
export function normalizeKey(value: unknown): string {
  return String(value);
}

/**
 * Group array items by a key.
 *
 * Keys are normalized to strings so numeric and string representations of the
 * same id land in the same bucket.
 *
 * @param items - Array of items to group
 * @param key - Key to group by
 * @returns Map of stringified key -> items
 */
export function groupByKey<T extends Record<string, unknown>>(
  items: T[],
  key: string
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    const keyValue = normalizeKey(item[key]);
    let arr = grouped.get(keyValue);
    if (!arr) {
      arr = [];
      grouped.set(keyValue, arr);
    }
    arr.push(item);
  }

  return grouped;
}

/**
 * Dedupe keys on their normalized form while sending the ORIGINAL value onward.
 *
 * A stringified id would force a text->int cast in PostgreSQL and can cost an
 * index scan, so `1` and `'1'` collapse to one entry but the first-seen value
 * keeps its own type.
 */
function dedupeKeys(keys: readonly RelationKey[]): RelationKey[] {
  const seen = new Set<string>();
  const unique: RelationKey[] = [];

  for (const key of keys) {
    const norm = normalizeKey(key);
    if (seen.has(norm)) continue;
    seen.add(norm);
    unique.push(key);
  }

  return unique;
}

/**
 * Create a DataLoader for a relation
 *
 * Use this when relation loads originate from independent call sites (GraphQL
 * resolvers, for instance) that must coalesce into one query, or when the
 * per-key cache is worth keeping for the length of a request. When every key is
 * already known upfront, prefer `loadRelation()` — it skips DataLoader.
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
): DataLoader<RelationKey, Record<string, unknown>[]> {
  const relation = getRelation(model, relationName);
  if (!relation) {
    throw new Error(`Relation '${relationName}' not found on model '${model.name}'`);
  }

  return new DataLoader<RelationKey, Record<string, unknown>[]>(
    async (keys) => {
      const config = getBatchLoadConfig(model, relation, dedupeKeys(keys));

      // Execute the batch query
      const results = await executor(config.query);

      // Group results by the batch key
      const grouped = groupByKey(results, config.batchKey);

      // Return results in the same order as keys
      return keys.map((key) => grouped.get(normalizeKey(key)) || []);
    },
    {
      // Normalize cache keys so load(1) and load('1') hit the same entry
      cacheKeyFn: normalizeKey,
    }
  );
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
): Map<string, DataLoader<RelationKey, Record<string, unknown>[]>> {
  const loaders = new Map<string, DataLoader<RelationKey, Record<string, unknown>[]>>();

  if (model.relations) {
    for (const relationName in model.relations) {
      loaders.set(relationName, createRelationLoader(model, relationName, executor));
    }
  }

  return loaders;
}

/**
 * Load relations for a set of records
 *
 * Pass an existing `loader` to reuse its cache across several `loadRelation`
 * calls in the same request. Without one, DataLoader is skipped entirely —
 * every key is already known here, so its tick scheduling and per-key promises
 * would be pure overhead.
 *
 * A failing executor rejects rather than yielding empty relations, so a dead
 * connection can never masquerade as "this parent has no children".
 *
 * @param records - Parent records
 * @param model - Parent model definition
 * @param relationName - Relation to load
 * @param executor - Query executor
 * @param loader - Optional pre-built loader to reuse
 * @returns Records with loaded relations
 */
export async function loadRelation<T extends Record<string, unknown>>(
  records: T[],
  model: ModelDefinition,
  relationName: string,
  executor: QueryExecutor,
  loader?: DataLoader<RelationKey, Record<string, unknown>[]>
): Promise<T[]> {
  const relation = getRelation(model, relationName);
  if (!relation) {
    throw new Error(`Relation '${relationName}' not found`);
  }

  // Get the key field based on relation type
  const keyField = relation.type === 'belongsTo'
    ? (relation as BelongsToRelation).foreignKey
    : model.primaryKey || 'id';

  const isSingle = relation.type === 'belongsTo' || relation.type === 'hasOne';

  // Collect keys in the record's own type — normalization happens at grouping
  // time, so integer ids reach PostgreSQL as integers.
  const keys: RelationKey[] = new Array(records.length);
  for (let i = 0; i < records.length; i++) {
    keys[i] = records[i][keyField] as RelationKey;
  }

  // related[i] holds the rows belonging to records[i]
  const related: Record<string, unknown>[][] = new Array(records.length);

  if (loader) {
    // A supplied loader carries a cache worth hitting, so go through it:
    // one loadMany instead of a promise per record.
    const loaded = await loader.loadMany(keys);
    for (let i = 0; i < records.length; i++) {
      const entry = loaded[i];
      // loadMany reports per-key failures as Error values rather than
      // rejecting, so re-throw instead of silently yielding an empty relation
      if (entry instanceof Error) throw entry;
      related[i] = entry;
    }
  } else {
    // No cache to share, so skip DataLoader: dedupe -> one query -> group is
    // the whole job.
    let grouped = new Map<string, Record<string, unknown>[]>();

    // Records missing the key would only bind a useless NULL parameter
    const batchKeys = dedupeKeys(keys).filter(
      key => key !== null && key !== undefined
    );

    if (batchKeys.length > 0) {
      const config = getBatchLoadConfig(model, relation, batchKeys);
      grouped = groupByKey(await executor(config.query), config.batchKey);
    }

    for (let i = 0; i < records.length; i++) {
      related[i] = grouped.get(normalizeKey(keys[i])) ?? [];
    }
  }

  const results: T[] = new Array(records.length);
  for (let i = 0; i < records.length; i++) {
    const rows = related[i];
    results[i] = {
      ...records[i],
      [relationName]: isSingle ? rows[0] ?? null : rows,
    };
  }

  return results;
}
