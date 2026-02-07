import type * as z from 'zod';
import type { QueryComposer } from '../core/query-composer';

/**
 * Relation type identifiers
 */
export type RelationType = 'belongsTo' | 'hasOne' | 'hasMany' | 'hasManyThrough';

/**
 * Base relation configuration
 */
export interface BaseRelation {
  /** Relation type */
  type: RelationType;
  /** Target table name */
  target: string;
  /** Target schema for validation */
  targetSchema?: z.ZodTypeAny;
  /** Primary key on the source table */
  primaryKey: string;
  /** Alias for the relation (used in SQL and results) */
  alias?: string;
}

/**
 * BelongsTo relation (N:1)
 *
 * The current model has a foreign key pointing to another model.
 *
 * @example
 * ```typescript
 * // Post belongs to League
 * // posts.league_id -> leagues.id
 * {
 *   type: 'belongsTo',
 *   target: 'leagues',
 *   foreignKey: 'league_id',
 *   primaryKey: 'id',
 * }
 * ```
 */
export interface BelongsToRelation extends BaseRelation {
  type: 'belongsTo';
  /** Foreign key column on the current model */
  foreignKey: string;
}

/**
 * HasOne relation (1:1)
 *
 * Another model has a foreign key pointing to this model.
 *
 * @example
 * ```typescript
 * // User has one Profile
 * // profiles.user_id -> users.id
 * {
 *   type: 'hasOne',
 *   target: 'profiles',
 *   foreignKey: 'user_id',
 *   primaryKey: 'id',
 * }
 * ```
 */
export interface HasOneRelation extends BaseRelation {
  type: 'hasOne';
  /** Foreign key column on the target model */
  foreignKey: string;
}

/**
 * HasMany relation (1:N)
 *
 * Multiple records in another model reference this model.
 *
 * @example
 * ```typescript
 * // League has many Posts
 * // posts.league_id -> leagues.id
 * {
 *   type: 'hasMany',
 *   target: 'posts',
 *   foreignKey: 'league_id',
 *   primaryKey: 'id',
 * }
 * ```
 */
export interface HasManyRelation extends BaseRelation {
  type: 'hasMany';
  /** Foreign key column on the target model */
  foreignKey: string;
}

/**
 * HasManyThrough relation (N:M via pivot table)
 *
 * Many-to-many relationship through a pivot/junction table.
 *
 * @example
 * ```typescript
 * // League has many Teams through league_teams
 * // leagues.id -> league_teams.league_id
 * // league_teams.team_id -> teams.id
 * {
 *   type: 'hasManyThrough',
 *   target: 'teams',
 *   through: 'league_teams',
 *   foreignKey: 'league_id',
 *   throughForeignKey: 'team_id',
 *   primaryKey: 'id',
 *   throughPrimaryKey: 'id',
 * }
 * ```
 */
export interface HasManyThroughRelation extends BaseRelation {
  type: 'hasManyThrough';
  /** Pivot/junction table name */
  through: string;
  /** Foreign key on pivot table pointing to current model */
  foreignKey: string;
  /** Foreign key on pivot table pointing to target model */
  throughForeignKey: string;
  /** Primary key on target model */
  throughPrimaryKey: string;
  /** Pivot table schema for validation */
  throughSchema?: z.ZodTypeAny;
}

/**
 * Union type for all relation configurations
 */
export type RelationConfig =
  | BelongsToRelation
  | HasOneRelation
  | HasManyRelation
  | HasManyThroughRelation;

/**
 * Model definition with relations
 */
export interface ModelDefinition<T extends z.ZodTypeAny = z.ZodTypeAny> {
  /** Model name */
  name: string;
  /** Table name */
  table: string;
  /** Zod schema for the model */
  schema: T;
  /** Primary key column (default: 'id') */
  primaryKey?: string;
  /** Relation definitions */
  relations?: Record<string, RelationConfig>;
}

/**
 * Include options for eager loading
 */
export interface IncludeOptions {
  /** Relation name to include */
  relation: string;
  /** Custom query modifications */
  query?: (qc: QueryComposer) => QueryComposer;
  /** Nested includes */
  include?: IncludeOptions[];
  /** Alias for the included relation */
  alias?: string;
  /** Limit results */
  limit?: number;
  /** Order by */
  orderBy?: string[];
}

/**
 * Loaded relation data
 */
export interface LoadedRelation<T = unknown> {
  /** Relation name */
  name: string;
  /** Loaded data */
  data: T | T[] | null;
  /** Whether this was a single (belongsTo/hasOne) or multiple (hasMany) relation */
  isSingle: boolean;
}

/**
 * Batch load configuration for DataLoader
 */
export interface BatchLoadConfig {
  /** Column to batch on */
  batchColumn: string;
  /** Values to batch load */
  batchValues: unknown[];
  /** Target table */
  table: string;
  /** Target schema */
  schema: z.ZodTypeAny;
  /** Additional query modifications */
  query?: (qc: QueryComposer) => QueryComposer;
}
