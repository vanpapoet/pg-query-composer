import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import {
  // Core
  QueryComposer,
  createQueryComposer,

  // Composition
  scope,
  dateRange,
  inList,
  merge,

  // Subqueries
  subquery,
  exists,

  // Relations
  defineModel,
  createModelQuery,
  createRelationLoader,

  // Type-safe
  createTypedComposer,

  // PostgreSQL
  jsonbContains,
  fullTextSearch,
  createRecursiveCTE,
} from '../../src';

// Define schemas
const LeagueSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  status: z.enum(['active', 'inactive']),
  settings: z.record(z.unknown()),
  created_at: z.string(),
});

const PostSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  league_id: z.string(),
  status: z.enum(['draft', 'published', 'archived']),
  search_vector: z.string(),
  created_at: z.string(),
});

const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  parent_id: z.string().nullable(),
});

describe('Integration: Full Workflow', () => {
  describe('Basic Query Building', () => {
    it('builds complex query with filters, sorting, and pagination', () => {
      const qc = createQueryComposer(PostSchema, 'posts')
        .where({ status: 'published' })
        .where({ created_at__gte: '2024-01-01' })
        .orderBy('-created_at', 'title')
        .paginate({ page: 1, limit: 20 });

      const { text, values } = qc.toParam();

      expect(text).toContain('FROM posts');
      expect(text).toContain('status = $');
      expect(text).toContain('created_at >= $');
      expect(text).toContain('ORDER BY');
      expect(text).toContain('created_at DESC');
      expect(text).toContain('LIMIT');
      expect(values).toContain('published');
      expect(values).toContain('2024-01-01');
    });
  });

  describe('Dynamic Composition', () => {
    it('uses scopes for reusable query logic', () => {
      const published = scope<typeof PostSchema>((q) =>
        q.where({ status: 'published' })
      );
      const recent = scope<typeof PostSchema>((q) =>
        q.orderBy('-created_at')
      );

      const qc = createQueryComposer(PostSchema, 'posts')
        .apply(published)
        .apply(recent)
        .paginate({ limit: 10 });

      const { text, values } = qc.toParam();
      expect(values).toContain('published');
      expect(text).toContain('ORDER BY');
    });

    it('uses conditional query building', () => {
      const searchTerm = 'react';
      const minDate = '2024-01-01';
      const status: string | undefined = undefined;

      const qc = createQueryComposer(PostSchema, 'posts')
        .when(searchTerm, (q) => q.where({ title__contains: searchTerm }))
        .when(minDate, (q) => q.where({ created_at__gte: minDate }))
        .when(status, (q) => q.where({ status }))
        .orderBy('-created_at');

      const { values } = qc.toParam();
      expect(values).toContain('%react%');
      expect(values).toContain('2024-01-01');
      expect(values).not.toContain(undefined);
    });

    it('merges multiple queries', () => {
      const baseQuery = createQueryComposer(PostSchema, 'posts').where({
        status: 'published',
      });

      const dateFilter = createQueryComposer(PostSchema, 'posts').where(
        dateRange('created_at', '2024-01-01', '2024-12-31')
      );

      const merged = merge(baseQuery, dateFilter);
      const { values } = merged.toParam();

      expect(values).toContain('published');
      expect(values).toContain('2024-01-01');
      expect(values).toContain('2024-12-31');
    });
  });

  describe('Subqueries', () => {
    it('uses subquery with whereIn', () => {
      const activeLeagues = subquery(LeagueSchema, 'leagues')
        .select(['id'])
        .where({ status: 'active' });

      const qc = createQueryComposer(PostSchema, 'posts')
        .where({ status: 'published' })
        .whereIn('league_id', activeLeagues);

      const { text } = qc.toParam();
      expect(text).toContain('league_id IN (SELECT');
      expect(text).toContain('FROM leagues');
    });

    it('uses EXISTS subquery', () => {
      const CommentsSchema = z.object({
        id: z.string(),
        post_id: z.string(),
        approved: z.boolean(),
      });

      const qc = createQueryComposer(PostSchema, 'posts')
        .where({ status: 'published' })
        .where(
          exists(
            subquery(CommentsSchema, 'comments')
              .whereRaw('comments.post_id = posts.id')
              .where({ approved: true })
          )
        );

      const { text } = qc.toParam();
      expect(text).toContain('EXISTS');
      expect(text).toContain('SELECT 1 FROM comments');
    });
  });

  describe('Relations', () => {
    it('defines models with relations', () => {
      const League = defineModel({
        name: 'LeagueIntegration',
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

      const qc = createModelQuery(League)
        .where({ status: 'active' })
        .include('posts');

      const { text } = qc.toParam();
      expect(text).toContain('FROM leagues');

      const includes = qc.getIncludes();
      expect(includes).toHaveLength(1);
      expect(includes[0].relation).toBe('posts');
    });

    it('creates batch loaders for N+1 prevention', async () => {
      const League = defineModel({
        name: 'LeagueBatch',
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

      const mockResults = [
        { id: 'p1', league_id: 'l1', title: 'Post 1' },
        { id: 'p2', league_id: 'l1', title: 'Post 2' },
        { id: 'p3', league_id: 'l2', title: 'Post 3' },
      ];

      const loader = createRelationLoader(League, 'posts', async () => mockResults);

      const [posts1, posts2] = await Promise.all([
        loader.load('l1'),
        loader.load('l2'),
      ]);

      expect(posts1).toHaveLength(2);
      expect(posts2).toHaveLength(1);
    });
  });

  describe('Type-safe Queries', () => {
    it('provides type-safe where, select, orderBy', () => {
      const qc = createTypedComposer(PostSchema, 'posts')
        .where({ status: 'published' })
        .where({ created_at__gte: '2024-01-01' })
        .select(['id', 'title', 'status'])
        .orderBy('-created_at');

      const { text, values } = qc.toParam();
      expect(text).toContain('SELECT');
      expect(text).toContain('id');
      expect(text).toContain('title');
      expect(values).toContain('published');
    });
  });

  describe('PostgreSQL Features', () => {
    it('queries JSONB data', () => {
      const qc = createQueryComposer(LeagueSchema, 'leagues')
        .where({ status: 'active' })
        .where(jsonbContains('settings', { featured: true }));

      const { text } = qc.toParam();
      expect(text).toContain('settings @>');
    });

    it('performs full-text search', () => {
      const qc = createQueryComposer(PostSchema, 'posts')
        .where({ status: 'published' })
        .where(fullTextSearch('search_vector', 'react hooks'));

      const { text } = qc.toParam();
      expect(text).toContain('@@');
      expect(text).toContain('plainto_tsquery');
    });

    it('builds recursive CTE for hierarchical data', () => {
      const cte = createRecursiveCTE('category_tree', CategorySchema)
        .from('categories')
        .baseCase((q) => q.where({ parent_id__isnull: true }))
        .recursiveCase('categories', 'category_tree.id = categories.parent_id')
        .withDepth();

      const sql = cte.toSQL();
      expect(sql).toContain('WITH RECURSIVE');
      expect(sql).toContain('category_tree');
      expect(sql).toContain('depth');
    });
  });

  describe('Count Query', () => {
    it('generates count query with same filters', () => {
      const qc = createQueryComposer(PostSchema, 'posts')
        .where({ status: 'published' })
        .where({ league_id: 'league-123' });

      const { text: selectText } = qc.toParam();
      const { text: countText } = qc.toCountParam();

      expect(selectText).toContain('FROM posts');
      expect(countText).toContain('COUNT(*)');
      expect(countText).toContain('status = $');
    });
  });

  describe('Clone and Modify', () => {
    it('clones query without affecting original', () => {
      const original = createQueryComposer(PostSchema, 'posts')
        .where({ status: 'published' });

      const cloned = original.clone().where({ league_id: 'league-123' });

      const { values: origValues } = original.toParam();
      const { values: clonedValues } = cloned.toParam();

      expect(origValues).toHaveLength(1);
      expect(clonedValues).toHaveLength(2);
    });
  });
});
