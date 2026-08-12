import { describe, it, expect, vi } from 'vitest';
import * as z from 'zod';
import { defineModel } from '../../src/relations/define';
import { createModelQuery } from '../../src/relations/include';
import {
  createRelationLoader,
  batchLoadBelongsTo,
  batchLoadHasMany,
  groupByKey,
  loadRelation,
} from '../../src/relations/loader';

const LeagueSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
});

const PostSchema = z.object({
  id: z.string(),
  title: z.string(),
  league_id: z.string(),
  status: z.string(),
});

const League = defineModel({
  name: 'LeagueLoader',
  table: 'leagues',
  schema: LeagueSchema,
  relations: {
    posts: {
      type: 'hasMany',
      target: 'posts',
      foreignKey: 'league_id',
      primaryKey: 'id',
    },
  },
});

const Post = defineModel({
  name: 'PostLoader',
  table: 'posts',
  schema: PostSchema,
  relations: {
    league: {
      type: 'belongsTo',
      target: 'leagues',
      foreignKey: 'league_id',
      primaryKey: 'id',
    },
  },
});

describe('groupByKey()', () => {
  it('groups items by a key', () => {
    const items = [
      { id: '1', league_id: 'l1' },
      { id: '2', league_id: 'l1' },
      { id: '3', league_id: 'l2' },
    ];

    const grouped = groupByKey(items, 'league_id');

    expect(grouped.get('l1')).toHaveLength(2);
    expect(grouped.get('l2')).toHaveLength(1);
  });

  it('returns empty map for empty array', () => {
    const grouped = groupByKey([], 'id');
    expect(grouped.size).toBe(0);
  });
});

describe('createRelationLoader()', () => {
  it('creates a loader for a relation', () => {
    const mockExecutor = vi.fn().mockResolvedValue([]);
    const loader = createRelationLoader(League, 'posts', mockExecutor);

    expect(loader).toBeDefined();
    expect(typeof loader.load).toBe('function');
  });

  it('batches multiple load calls', async () => {
    const mockExecutor = vi.fn().mockResolvedValue([
      { id: 'p1', league_id: 'l1' },
      { id: 'p2', league_id: 'l1' },
      { id: 'p3', league_id: 'l2' },
    ]);

    const loader = createRelationLoader(League, 'posts', mockExecutor);

    // Make multiple load calls
    const [result1, result2] = await Promise.all([
      loader.load('l1'),
      loader.load('l2'),
    ]);

    // Should batch into single query
    expect(mockExecutor).toHaveBeenCalledTimes(1);

    // Should return correct results
    expect(result1).toHaveLength(2);
    expect(result2).toHaveLength(1);
  });
});

describe('batchLoadBelongsTo()', () => {
  it('generates correct SQL for belongsTo', () => {
    const config = batchLoadBelongsTo(
      Post,
      'league',
      ['league-1', 'league-2', 'league-3']
    );

    expect(config.query.text).toContain('id = ANY(');
    expect(config.query.values).toEqual([['league-1', 'league-2', 'league-3']]);
    expect(config.batchKey).toBe('id');
    expect(config.isSingle).toBe(true);
  });
});

describe('batchLoadHasMany()', () => {
  it('generates correct SQL for hasMany', () => {
    const config = batchLoadHasMany(
      League,
      'posts',
      ['league-1', 'league-2']
    );

    expect(config.query.text).toContain('league_id = ANY(');
    expect(config.query.values).toEqual([['league-1', 'league-2']]);
    expect(config.batchKey).toBe('league_id');
    expect(config.isSingle).toBe(false);
  });
});

describe('Nested includes', () => {
  it('supports nested include configuration', () => {
    const qc = createModelQuery(League);
    qc.include('posts', (q) =>
      q.where({ status: 'active' }).orderBy('-id')
    );

    const includes = qc.getIncludes();
    expect(includes[0].query).toBeDefined();
  });
});

// ============================================================
// NUMERIC KEY REGRESSION
// node-pg returns integer columns as JS numbers. Parent keys and child
// foreign keys must match regardless of which side is a number.
// ============================================================

const NumUserSchema = z.object({ id: z.number(), name: z.string() });

const NumUser = defineModel({
  name: 'NumUser',
  table: 'users',
  schema: NumUserSchema,
  primaryKey: 'id',
  relations: {
    posts: { type: 'hasMany', target: 'posts', foreignKey: 'user_id', primaryKey: 'id' },
    profile: { type: 'hasOne', target: 'profiles', foreignKey: 'user_id', primaryKey: 'id' },
  },
});

describe('loadRelation() with numeric keys', () => {
  const parents = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }];
  const childRows = [
    { id: 10, user_id: 1 },
    { id: 11, user_id: 1 },
    { id: 12, user_id: 2 },
  ];

  it('matches numeric parent ids against numeric foreign keys', async () => {
    const result = await loadRelation(parents, NumUser, 'posts', async () => childRows);

    expect(result[0].posts).toHaveLength(2);
    expect(result[1].posts).toHaveLength(1);
  });

  it('sends the original numeric key to PostgreSQL, not a stringified one', async () => {
    let captured: unknown[] = [];
    await loadRelation(parents, NumUser, 'posts', async (q) => {
      captured = q.values;
      return childRows;
    });

    // `= ANY(?)` binds one array param — elements must stay numbers
    expect(captured).toEqual([[1, 2]]);
  });

  it('issues exactly one query for all parents (no N+1)', async () => {
    const executor = vi.fn().mockResolvedValue(childRows);
    await loadRelation(parents, NumUser, 'posts', executor);

    expect(executor).toHaveBeenCalledTimes(1);
  });

  it('unwraps hasOne to a single record', async () => {
    const result = await loadRelation(parents, NumUser, 'profile', async () => [
      { id: 90, user_id: 2 },
    ]);

    expect(result[0].profile).toBeNull();
    expect(result[1].profile).toEqual({ id: 90, user_id: 2 });
  });

  it('does not mutate the input records', async () => {
    await loadRelation(parents, NumUser, 'posts', async () => childRows);
    expect(parents[0]).not.toHaveProperty('posts');
  });

  it('propagates executor failures through a supplied loader too', async () => {
    const loader = createRelationLoader(NumUser, 'posts', async () => {
      throw new Error('connection terminated');
    });

    await expect(
      loadRelation([{ id: 1 }], NumUser, 'posts', async () => [], loader)
    ).rejects.toThrow('connection terminated');
  });

  it('reuses a supplied loader cache across calls', async () => {
    const executor = vi.fn().mockResolvedValue(childRows);
    const loader = createRelationLoader(NumUser, 'posts', executor);

    await loadRelation(parents, NumUser, 'posts', executor, loader);
    await loadRelation(parents, NumUser, 'posts', executor, loader);

    expect(executor).toHaveBeenCalledTimes(1);
  });
});

describe('loadRelation() without a supplied loader (direct path)', () => {
  it('issues no query at all for an empty record set', async () => {
    const executor = vi.fn().mockResolvedValue([]);
    const result = await loadRelation([], NumUser, 'posts', executor);

    expect(executor).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('dedupes repeated parent keys into a single bound value', async () => {
    let captured: unknown[] = [];
    const parents = [{ id: 1 }, { id: 1 }, { id: 2 }];

    await loadRelation(parents, NumUser, 'posts', async q => {
      captured = q.values;
      return [{ id: 10, user_id: 1 }];
    });

    expect(captured).toEqual([[1, 2]]);
  });

  it('skips null keys instead of binding a useless NULL param', async () => {
    let captured: unknown[] = [];
    const parents = [{ id: 1 }, { id: null }] as unknown as { id: number }[];

    const result = await loadRelation(parents, NumUser, 'posts', async q => {
      captured = q.values;
      return [{ id: 10, user_id: 1 }];
    });

    expect(captured).toEqual([[1]]);
    expect(result[1].posts).toEqual([]);
  });

  it('propagates executor failures instead of yielding empty relations', async () => {
    const parents = [{ id: 1 }];

    await expect(
      loadRelation(parents, NumUser, 'posts', async () => {
        throw new Error('connection terminated');
      })
    ).rejects.toThrow('connection terminated');
  });
});

describe('groupByKey() key normalization', () => {
  it('buckets numeric and string representations together', () => {
    const grouped = groupByKey(
      [{ user_id: 1 }, { user_id: '1' }, { user_id: 2 }],
      'user_id'
    );

    expect(grouped.get('1')).toHaveLength(2);
    expect(grouped.get('2')).toHaveLength(1);
  });
});
