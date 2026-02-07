import { describe, it, expect } from 'vitest';
import type {
  RelationType,
  BelongsToRelation,
  HasOneRelation,
  HasManyRelation,
  HasManyThroughRelation,
  RelationConfig,
} from '../../src/relations/types';

describe('Relation Types', () => {
  describe('RelationType', () => {
    it('supports belongsTo', () => {
      const type: RelationType = 'belongsTo';
      expect(type).toBe('belongsTo');
    });

    it('supports hasOne', () => {
      const type: RelationType = 'hasOne';
      expect(type).toBe('hasOne');
    });

    it('supports hasMany', () => {
      const type: RelationType = 'hasMany';
      expect(type).toBe('hasMany');
    });

    it('supports hasManyThrough', () => {
      const type: RelationType = 'hasManyThrough';
      expect(type).toBe('hasManyThrough');
    });
  });

  describe('BelongsToRelation', () => {
    it('defines belongsTo relation structure', () => {
      const relation: BelongsToRelation = {
        type: 'belongsTo',
        target: 'leagues',
        foreignKey: 'league_id',
        primaryKey: 'id',
      };
      expect(relation.type).toBe('belongsTo');
      expect(relation.target).toBe('leagues');
      expect(relation.foreignKey).toBe('league_id');
    });
  });

  describe('HasOneRelation', () => {
    it('defines hasOne relation structure', () => {
      const relation: HasOneRelation = {
        type: 'hasOne',
        target: 'profiles',
        foreignKey: 'user_id',
        primaryKey: 'id',
      };
      expect(relation.type).toBe('hasOne');
      expect(relation.target).toBe('profiles');
    });
  });

  describe('HasManyRelation', () => {
    it('defines hasMany relation structure', () => {
      const relation: HasManyRelation = {
        type: 'hasMany',
        target: 'posts',
        foreignKey: 'league_id',
        primaryKey: 'id',
      };
      expect(relation.type).toBe('hasMany');
      expect(relation.target).toBe('posts');
    });
  });

  describe('HasManyThroughRelation', () => {
    it('defines hasManyThrough relation structure', () => {
      const relation: HasManyThroughRelation = {
        type: 'hasManyThrough',
        target: 'teams',
        through: 'league_teams',
        foreignKey: 'league_id',
        throughForeignKey: 'team_id',
        primaryKey: 'id',
        throughPrimaryKey: 'id',
      };
      expect(relation.type).toBe('hasManyThrough');
      expect(relation.through).toBe('league_teams');
    });
  });

  describe('RelationConfig', () => {
    it('can be any relation type', () => {
      const belongsTo: RelationConfig = {
        type: 'belongsTo',
        target: 'leagues',
        foreignKey: 'league_id',
        primaryKey: 'id',
      };

      const hasMany: RelationConfig = {
        type: 'hasMany',
        target: 'posts',
        foreignKey: 'league_id',
        primaryKey: 'id',
      };

      expect(belongsTo.type).toBe('belongsTo');
      expect(hasMany.type).toBe('hasMany');
    });
  });
});
