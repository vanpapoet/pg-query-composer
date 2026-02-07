import { describe, it, expect, vi } from 'vitest';
import * as z from 'zod';
import { defineModel } from '../../src/relations/define';
import { createModelQuery } from '../../src/relations/include';
import {
  createRelationLoader,
  batchLoadBelongsTo,
  batchLoadHasMany,
  groupByKey,
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

    expect(config.query.text).toContain('id IN');
    expect(config.query.values).toContain('league-1');
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

    expect(config.query.text).toContain('league_id IN');
    expect(config.query.values).toContain('league-1');
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
