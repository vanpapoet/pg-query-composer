import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { defineModel, getModel, hasRelation } from '../../src/relations/define';

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

const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
});

describe('defineModel()', () => {
  it('creates a model definition', () => {
    const League = defineModel({
      name: 'League',
      table: 'leagues',
      schema: LeagueSchema,
    });

    expect(League.name).toBe('League');
    expect(League.table).toBe('leagues');
    expect(League.schema).toBe(LeagueSchema);
  });

  it('sets default primary key to id', () => {
    const League = defineModel({
      name: 'League',
      table: 'leagues',
      schema: LeagueSchema,
    });

    expect(League.primaryKey).toBe('id');
  });

  it('allows custom primary key', () => {
    const League = defineModel({
      name: 'League',
      table: 'leagues',
      schema: LeagueSchema,
      primaryKey: 'uuid',
    });

    expect(League.primaryKey).toBe('uuid');
  });

  it('defines relations', () => {
    const League = defineModel({
      name: 'League',
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

    expect(League.relations).toBeDefined();
    expect(League.relations?.posts).toBeDefined();
    expect(League.relations?.posts.type).toBe('hasMany');
  });

  it('defines multiple relations', () => {
    const League = defineModel({
      name: 'League',
      table: 'leagues',
      schema: LeagueSchema,
      relations: {
        posts: {
          type: 'hasMany',
          target: 'posts',
          foreignKey: 'league_id',
          primaryKey: 'id',
        },
        teams: {
          type: 'hasManyThrough',
          target: 'teams',
          through: 'league_teams',
          foreignKey: 'league_id',
          throughForeignKey: 'team_id',
          primaryKey: 'id',
          throughPrimaryKey: 'id',
        },
      },
    });

    expect(Object.keys(League.relations || {}).length).toBe(2);
  });
});

describe('getModel()', () => {
  it('retrieves registered model', () => {
    const League = defineModel({
      name: 'LeagueTest',
      table: 'leagues',
      schema: LeagueSchema,
    });

    const retrieved = getModel('LeagueTest');
    expect(retrieved).toBe(League);
  });

  it('returns undefined for unregistered model', () => {
    const retrieved = getModel('NonExistent');
    expect(retrieved).toBeUndefined();
  });
});

describe('hasRelation()', () => {
  it('returns true if model has the relation', () => {
    const League = defineModel({
      name: 'LeagueWithRelations',
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

    expect(hasRelation(League, 'posts')).toBe(true);
  });

  it('returns false if model does not have the relation', () => {
    const League = defineModel({
      name: 'LeagueNoTeams',
      table: 'leagues',
      schema: LeagueSchema,
    });

    expect(hasRelation(League, 'posts')).toBe(false);
  });
});
