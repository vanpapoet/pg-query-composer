import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { QueryComposer } from '../../src/core/query-composer';

const TestSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  age: z.number(),
  created_at: z.string(),
});

describe('QueryComposer', () => {
  describe('Constructor', () => {
    it('creates instance with schema and table', () => {
      const qc = new QueryComposer(TestSchema, 'users');
      expect(qc).toBeInstanceOf(QueryComposer);
    });

    it('accepts options', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      expect(qc).toBeInstanceOf(QueryComposer);
    });
  });

  describe('where()', () => {
    it('adds single filter', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.where({ status: 'active' });
      const { text, values } = qc.toParam();
      expect(text).toContain('status = $1');
      expect(values).toContain('active');
    });

    it('adds multiple filters (AND)', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.where({ status: 'active', name: 'John' });
      const { text, values } = qc.toParam();
      expect(text).toContain('status = $');
      expect(text).toContain('name = $');
      expect(values).toContain('active');
      expect(values).toContain('John');
    });

    it('supports operator syntax', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.where({ 'name__contains': 'john' });
      const { text, values } = qc.toParam();
      expect(text).toContain('name ILIKE $1');
      expect(values).toEqual(['%john%']);
    });

    it('supports multiple operators', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.where({ 'age__gte': 18, 'age__lte': 65 });
      const { text, values } = qc.toParam();
      expect(text).toContain('age >= $');
      expect(text).toContain('age <= $');
      expect(values).toContain(18);
      expect(values).toContain(65);
    });

    it('chains multiple where calls', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.where({ status: 'active' }).where({ 'age__gte': 18 });
      const { values } = qc.toParam();
      expect(values).toContain('active');
      expect(values).toContain(18);
    });

    it('ignores undefined values', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.where({ status: 'active', name: undefined });
      const { values } = qc.toParam();
      expect(values.length).toBe(1);
      expect(values).toContain('active');
    });
  });

  describe('whereRaw()', () => {
    it('adds raw SQL condition', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.whereRaw('LOWER(name) = LOWER($1)', ['John']);
      const { text } = qc.toParam();
      expect(text).toContain('LOWER(name) = LOWER($1)');
    });
  });

  describe('or()', () => {
    it('adds OR conditions', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.or([{ status: 'active' }, { status: 'pending' }]);
      const { text } = qc.toParam();
      expect(text).toContain('OR');
    });

    it('groups OR conditions together', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.where({ 'age__gte': 18 }).or([{ status: 'active' }, { status: 'pending' }]);
      const { text, values } = qc.toParam();
      expect(text).toContain('age >= $');
      expect(text).toContain('(');
      expect(text).toContain('OR');
      expect(values.length).toBe(3);
    });
  });

  describe('not()', () => {
    it('adds NOT conditions', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.not({ status: 'deleted' });
      const { text } = qc.toParam();
      expect(text).toContain('NOT');
    });
  });

  describe('select()', () => {
    it('selects specific fields', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.select(['id', 'name']);
      const { text } = qc.toParam();
      expect(text).toContain('id');
      expect(text).toContain('name');
    });
  });

  describe('orderBy()', () => {
    it('adds ascending sort', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.orderBy('name');
      const { text } = qc.toParam();
      expect(text).toContain('ORDER BY');
      expect(text).toContain('name ASC');
    });

    it('adds descending sort with - prefix', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.orderBy('-created_at');
      const { text } = qc.toParam();
      expect(text).toContain('ORDER BY');
      expect(text).toContain('created_at DESC');
    });

    it('supports multiple sort fields', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.orderBy('-created_at', 'name');
      const { text } = qc.toParam();
      expect(text).toContain('created_at DESC');
      expect(text).toContain('name ASC');
    });
  });

  describe('paginate()', () => {
    it('adds LIMIT and OFFSET', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.paginate({ page: 2, limit: 20 });
      const { text } = qc.toParam();
      expect(text).toContain('LIMIT');
      expect(text).toContain('OFFSET');
    });

    it('defaults to page 1', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.paginate({ limit: 10 });
      const meta = qc.getPaginationMeta();
      expect(meta.page).toBe(1);
      expect(meta.offset).toBe(0);
    });

    it('calculates correct offset', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.paginate({ page: 3, limit: 10 });
      const meta = qc.getPaginationMeta();
      expect(meta.offset).toBe(20);
    });

    it('respects maxLimit', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.paginate({ page: 1, limit: 1000, maxLimit: 100 });
      const meta = qc.getPaginationMeta();
      expect(meta.limit).toBe(100);
    });
  });

  describe('join()', () => {
    it('adds INNER JOIN', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.join('profiles', 'users.id = profiles.user_id');
      const { text } = qc.toParam();
      expect(text).toContain('JOIN');
      expect(text).toContain('profiles');
    });
  });

  describe('leftJoin()', () => {
    it('adds LEFT JOIN', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.leftJoin('profiles', 'users.id = profiles.user_id');
      const { text } = qc.toParam();
      expect(text).toContain('LEFT JOIN');
    });
  });

  describe('groupBy()', () => {
    it('adds GROUP BY', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.groupBy('status');
      const { text } = qc.toParam();
      expect(text).toContain('GROUP BY');
      expect(text).toContain('status');
    });
  });

  describe('having()', () => {
    it('adds HAVING clause', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.groupBy('status').having('COUNT(*) > $1', [5]);
      const { text } = qc.toParam();
      expect(text).toContain('HAVING');
    });
  });

  describe('clone()', () => {
    it('creates independent copy', () => {
      const qc1 = new QueryComposer(TestSchema, 'users', { strict: false });
      qc1.where({ status: 'active' });
      const qc2 = qc1.clone();
      qc2.where({ 'age__gte': 18 });

      const { values: v1 } = qc1.toParam();
      const { values: v2 } = qc2.toParam();
      expect(v1.length).toBe(1);
      expect(v2.length).toBe(2);
    });

    it('preserves all state', () => {
      const qc1 = new QueryComposer(TestSchema, 'users', { strict: false });
      qc1.where({ status: 'active' }).orderBy('-created_at').paginate({ page: 2, limit: 10 });
      const qc2 = qc1.clone();

      const { text: t1 } = qc1.toParam();
      const { text: t2 } = qc2.toParam();
      expect(t1).toBe(t2);
    });
  });

  describe('reset()', () => {
    it('clears all conditions', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.where({ status: 'active' }).orderBy('-created_at');
      qc.reset();
      const { text, values } = qc.toParam();
      expect(values.length).toBe(0);
      expect(text).not.toContain('WHERE');
      expect(text).not.toContain('ORDER BY');
    });
  });

  describe('toCount()', () => {
    it('generates COUNT query', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.where({ status: 'active' });
      const { text } = qc.toCountParam();
      expect(text).toContain('COUNT(*)');
      expect(text).toContain('status = $');
    });
  });

  describe('toSQL()', () => {
    it('returns SQL string', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.where({ status: 'active' });
      const sql = qc.toSQL();
      expect(typeof sql).toBe('string');
      expect(sql).toContain('SELECT');
      expect(sql).toContain('FROM users');
    });
  });
});
