import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { defineModel } from '../../src/relations/define';
import { createModelQuery, ModelQueryComposer } from '../../src/relations/include';

const LeagueSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  status: z.string(),
});

const PostSchema = z.object({
  id: z.string(),
  title: z.string(),
  league_id: z.string(),
  status: z.string(),
});

const CountrySchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
});

// Define models
const Country = defineModel({
  name: 'CountryInclude',
  table: 'countries',
  schema: CountrySchema,
});

const League = defineModel({
  name: 'LeagueInclude',
  table: 'leagues',
  schema: LeagueSchema,
  relations: {
    posts: {
      type: 'hasMany',
      target: 'posts',
      foreignKey: 'league_id',
      primaryKey: 'id',
    },
    country: {
      type: 'belongsTo',
      target: 'countries',
      foreignKey: 'country_id',
      primaryKey: 'id',
    },
  },
});

const Post = defineModel({
  name: 'PostInclude',
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

describe('createModelQuery()', () => {
  it('creates a model query composer', () => {
    const qc = createModelQuery(League);
    expect(qc).toBeInstanceOf(ModelQueryComposer);
  });

  it('inherits QueryComposer methods', () => {
    const qc = createModelQuery(League);
    qc.where({ status: 'active' });
    const { values } = qc.toParam();
    expect(values).toContain('active');
  });
});

describe('ModelQueryComposer.include()', () => {
  it('tracks include for hasMany relation', () => {
    const qc = createModelQuery(League);
    qc.include('posts');

    const includes = qc.getIncludes();
    expect(includes).toHaveLength(1);
    expect(includes[0].relation).toBe('posts');
  });

  it('tracks include for belongsTo relation', () => {
    const qc = createModelQuery(Post);
    qc.include('league');

    const includes = qc.getIncludes();
    expect(includes).toHaveLength(1);
    expect(includes[0].relation).toBe('league');
  });

  it('chains multiple includes', () => {
    const qc = createModelQuery(League);
    qc.include('posts').include('country');

    const includes = qc.getIncludes();
    expect(includes).toHaveLength(2);
  });

  it('throws for invalid relation', () => {
    const qc = createModelQuery(League);
    expect(() => qc.include('nonexistent')).toThrow();
  });
});

describe('Include with filtering', () => {
  it('accepts query callback for filtering', () => {
    const qc = createModelQuery(League);
    qc.include('posts', (q) => q.where({ status: 'active' }));

    const includes = qc.getIncludes();
    expect(includes[0].query).toBeDefined();
  });
});

describe('getIncludeSQL()', () => {
  it('generates SQL for included relations', () => {
    const qc = createModelQuery(League);
    qc.where({ status: 'active' }).include('posts');

    const mainQuery = qc.toParam();
    expect(mainQuery.text).toContain('status = $');

    const includeQueries = qc.getIncludeQueries();
    expect(includeQueries.length).toBeGreaterThan(0);
  });
});
