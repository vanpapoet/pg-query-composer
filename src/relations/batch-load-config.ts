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
 * Relation key as it can arrive from PostgreSQL. node-pg returns integer
 * columns as JS numbers and uuid/text columns as strings, so both must be
 * accepted and compared consistently.
 */
export type RelationKey = string | number;

/**
 * A batch query plus the metadata needed to fan its rows back out to parents.
 *
 * `batchKey` is the column the rows must be grouped on; `isSingle` says whether
 * a parent takes one row (belongsTo/hasOne) or an array (hasMany).
 */
export interface BatchLoadConfig {
  query: { text: string; values: unknown[] };
  batchKey: string;
  isSingle: boolean;
}

/**
 * Build the batch query for a relation, dispatching on its type.
 * Accepts a pre-resolved relation to avoid redundant lookups.
 */
export function getBatchLoadConfig(
  model: ModelDefinition,
  relation: RelationConfig,
  keys: readonly RelationKey[]
): BatchLoadConfig {
  switch (relation.type) {
    case 'belongsTo':
      return batchLoadBelongsToWithRelation(model, relation, keys);
    case 'hasOne':
      return batchLoadHasOneWithRelation(model, relation, keys);
    case 'hasMany':
      return batchLoadHasManyWithRelation(model, relation, keys);
    case 'hasManyThrough':
      return batchLoadHasManyThroughWithRelation(model, relation, keys);
  }
}

/**
 * Internal: batch load with pre-resolved BelongsTo relation
 */
function batchLoadBelongsToWithRelation(
  model: ModelDefinition,
  relation: BelongsToRelation,
  keys: readonly RelationKey[]
): BatchLoadConfig {
  const qc = new QueryComposer(
    model.schema,
    relation.target,
    { extraColumns: [relation.primaryKey] }
  );
  qc.whereIn(relation.primaryKey, keys);
  return { query: qc.toParam(), batchKey: relation.primaryKey, isSingle: true };
}

/**
 * Internal: batch load with pre-resolved HasOne relation
 */
function batchLoadHasOneWithRelation(
  model: ModelDefinition,
  relation: HasOneRelation,
  keys: readonly RelationKey[]
): BatchLoadConfig {
  const qc = new QueryComposer(
    model.schema,
    relation.target,
    { extraColumns: [relation.foreignKey] }
  );
  qc.whereIn(relation.foreignKey, keys);
  return { query: qc.toParam(), batchKey: relation.foreignKey, isSingle: true };
}

/**
 * Internal: batch load with pre-resolved HasMany relation
 */
function batchLoadHasManyWithRelation(
  model: ModelDefinition,
  relation: HasManyRelation,
  keys: readonly RelationKey[]
): BatchLoadConfig {
  const qc = new QueryComposer(
    model.schema,
    relation.target,
    { extraColumns: [relation.foreignKey] }
  );
  qc.whereIn(relation.foreignKey, keys);
  return { query: qc.toParam(), batchKey: relation.foreignKey, isSingle: false };
}

/**
 * Internal: batch load with pre-resolved HasManyThrough relation
 */
function batchLoadHasManyThroughWithRelation(
  model: ModelDefinition,
  relation: HasManyThroughRelation,
  keys: readonly RelationKey[]
): BatchLoadConfig {
  const qc = new QueryComposer(
    model.schema,
    relation.target,
    { extraColumns: [relation.foreignKey, relation.throughForeignKey, `${relation.through}.${relation.foreignKey}`] }
  );
  qc.join(
    relation.through,
    `${relation.target}.${relation.throughPrimaryKey} = ${relation.through}.${relation.throughForeignKey}`
  );
  qc.whereIn(`${relation.through}.${relation.foreignKey}`, keys);
  return { query: qc.toParam(), batchKey: relation.foreignKey, isSingle: false };
}

/**
 * Generate batch load config for belongsTo relation (public API)
 */
export function batchLoadBelongsTo(
  model: ModelDefinition,
  relationName: string,
  keys: readonly RelationKey[]
): BatchLoadConfig {
  return batchLoadBelongsToWithRelation(model, getRelation(model, relationName) as BelongsToRelation, keys);
}

/**
 * Generate batch load config for hasOne relation (public API)
 */
export function batchLoadHasOne(
  model: ModelDefinition,
  relationName: string,
  keys: readonly RelationKey[]
): BatchLoadConfig {
  return batchLoadHasOneWithRelation(model, getRelation(model, relationName) as HasOneRelation, keys);
}

/**
 * Generate batch load config for hasMany relation (public API)
 */
export function batchLoadHasMany(
  model: ModelDefinition,
  relationName: string,
  keys: readonly RelationKey[]
): BatchLoadConfig {
  return batchLoadHasManyWithRelation(model, getRelation(model, relationName) as HasManyRelation, keys);
}

/**
 * Generate batch load config for hasManyThrough relation (public API)
 */
export function batchLoadHasManyThrough(
  model: ModelDefinition,
  relationName: string,
  keys: readonly RelationKey[]
): BatchLoadConfig {
  return batchLoadHasManyThroughWithRelation(model, getRelation(model, relationName) as HasManyThroughRelation, keys);
}
