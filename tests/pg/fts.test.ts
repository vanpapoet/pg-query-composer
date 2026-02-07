import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { QueryComposer } from '../../src/core/query-composer';
import {
  fullTextSearch,
  fullTextRank,
  toTsVector,
  toTsQuery,
  plainto_tsquery,
  websearch_to_tsquery,
} from '../../src/pg/fts';

const ArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  search_vector: z.string(),
});

describe('Full-Text Search', () => {
  describe('fullTextSearch()', () => {
    it('generates @@ operator for tsquery', () => {
      const filter = fullTextSearch('search_vector', 'react hooks');
      expect(filter.__raw).toContain('@@');
    });

    it('can be used with where()', () => {
      const qc = new QueryComposer(ArticleSchema, 'articles', { strict: false });
      qc.where(fullTextSearch('search_vector', 'typescript'));

      const { text } = qc.toParam();
      expect(text).toContain('@@');
    });
  });

  describe('fullTextRank()', () => {
    it('generates ts_rank expression', () => {
      const expr = fullTextRank('search_vector', 'react');
      expect(expr).toContain('ts_rank');
    });
  });

  describe('toTsVector()', () => {
    it('generates to_tsvector expression', () => {
      const expr = toTsVector('english', 'title');
      expect(expr).toContain('to_tsvector');
      expect(expr).toContain('english');
    });
  });

  describe('toTsQuery()', () => {
    it('generates to_tsquery expression', () => {
      const expr = toTsQuery('english', 'react & hooks');
      expect(expr).toContain('to_tsquery');
    });
  });

  describe('plainto_tsquery()', () => {
    it('generates plainto_tsquery expression', () => {
      const expr = plainto_tsquery('english', 'react hooks');
      expect(expr).toContain('plainto_tsquery');
    });
  });

  describe('websearch_to_tsquery()', () => {
    it('generates websearch_to_tsquery expression', () => {
      const expr = websearch_to_tsquery('english', '"react hooks" -angular');
      expect(expr).toContain('websearch_to_tsquery');
    });
  });

  describe('Combined FTS query', () => {
    it('can combine search and rank', () => {
      const qc = new QueryComposer(ArticleSchema, 'articles', { strict: false });

      // Search with ranking
      qc.where(fullTextSearch('search_vector', 'typescript'));

      const { text } = qc.toParam();
      expect(text).toContain('@@');
    });
  });
});
