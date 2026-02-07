import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { QueryComposer } from '../../src/core/query-composer';

const TestSchema = z.object({
  id: z.string(),
  status: z.string(),
  age: z.number(),
  name: z.string(),
});

describe('Conditional Composition', () => {
  describe('when()', () => {
    it('applies callback when condition is truthy', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.when(true, q => q.where({ status: 'active' }));
      const { values } = qc.toParam();
      expect(values).toContain('active');
    });

    it('skips callback when condition is falsy', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.when(false, q => q.where({ status: 'active' }));
      const { values } = qc.toParam();
      expect(values).not.toContain('active');
    });

    it('works with truthy non-boolean values', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.when('truthy' as unknown as boolean, q => q.where({ status: 'active' }));
      const { values } = qc.toParam();
      expect(values).toContain('active');
    });

    it('works with falsy non-boolean values', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.when(0 as unknown as boolean, q => q.where({ status: 'active' }));
      const { values } = qc.toParam();
      expect(values).not.toContain('active');
    });

    it('works with null as falsy', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.when(null as unknown as boolean, q => q.where({ status: 'active' }));
      const { values } = qc.toParam();
      expect(values).not.toContain('active');
    });

    it('evaluates function conditions', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.when(() => true, q => q.where({ status: 'active' }));
      const { values } = qc.toParam();
      expect(values).toContain('active');
    });

    it('evaluates function returning false', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.when(() => false, q => q.where({ status: 'active' }));
      const { values } = qc.toParam();
      expect(values).not.toContain('active');
    });

    it('chains with other methods', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      const hasSearch = true;
      const searchTerm = 'john';

      qc.where({ status: 'active' })
        .when(hasSearch, q => q.where({ 'name__contains': searchTerm }))
        .orderBy('-id');

      const { text, values } = qc.toParam();
      expect(values).toContain('active');
      expect(values).toContain('%john%');
      expect(text).toContain('ORDER BY');
    });

    it('supports multiple when calls', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.when(true, q => q.where({ status: 'active' }))
        .when(true, q => q.where({ 'age__gte': 18 }))
        .when(false, q => q.where({ name: 'skip' }));

      const { values } = qc.toParam();
      expect(values).toContain('active');
      expect(values).toContain(18);
      expect(values).not.toContain('skip');
    });
  });

  describe('unless()', () => {
    it('applies callback when condition is falsy', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.unless(false, q => q.where({ status: 'active' }));
      const { values } = qc.toParam();
      expect(values).toContain('active');
    });

    it('skips callback when condition is truthy', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.unless(true, q => q.where({ status: 'active' }));
      const { values } = qc.toParam();
      expect(values).not.toContain('active');
    });

    it('works with null/undefined as falsy (applies callback)', () => {
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.unless(null as unknown as boolean, q => q.where({ status: 'active' }));
      const { values } = qc.toParam();
      expect(values).toContain('active');
    });

    it('evaluates function conditions', () => {
      const isAdmin = false;
      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.unless(() => isAdmin, q => q.where({ 'status__notexact': 'deleted' }));
      const { values } = qc.toParam();
      expect(values).toContain('deleted');
    });

    it('chains with when', () => {
      const isAdmin = false;
      const hasSearch = true;

      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.when(hasSearch, q => q.where({ 'name__contains': 'test' }))
        .unless(isAdmin, q => q.where({ 'status__notexact': 'deleted' }));

      const { values } = qc.toParam();
      expect(values).toContain('%test%');
      expect(values).toContain('deleted');
    });
  });

  describe('Real-world scenarios', () => {
    it('builds dynamic filter query', () => {
      // Simulating API request with optional filters
      const filters = {
        search: 'john',
        minAge: 18,
        maxAge: undefined,
        status: 'active',
      };

      const qc = new QueryComposer(TestSchema, 'users', { strict: false });
      qc.when(filters.search, q => q.where({ 'name__contains': filters.search }))
        .when(filters.minAge, q => q.where({ 'age__gte': filters.minAge }))
        .when(filters.maxAge, q => q.where({ 'age__lte': filters.maxAge }))
        .when(filters.status, q => q.where({ status: filters.status }));

      const { values } = qc.toParam();
      expect(values).toContain('%john%');
      expect(values).toContain(18);
      expect(values).toContain('active');
      expect(values.length).toBe(3); // maxAge was undefined, not applied
    });
  });
});
