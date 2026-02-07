import { describe, it, expect } from 'vitest';
import {
  fragment,
  dateRange,
  inList,
  notInList,
  isNull,
  isNotNull,
  contains,
  startsWith,
  endsWith,
  between,
  greaterThan,
  lessThan,
} from '../../src/composition/fragment';

describe('Fragments', () => {
  describe('fragment()', () => {
    it('creates custom fragment', () => {
      const filter = fragment('age', 'gte', 18);
      expect(filter).toEqual({ age__gte: 18 });
    });

    it('creates exact match fragment', () => {
      const filter = fragment('status', 'exact', 'active');
      expect(filter).toEqual({ status__exact: 'active' });
    });
  });

  describe('dateRange()', () => {
    it('creates between filter for date field', () => {
      const filter = dateRange('created_at', '2024-01-01', '2024-12-31');
      expect(filter).toEqual({
        created_at__between: ['2024-01-01', '2024-12-31'],
      });
    });
  });

  describe('inList()', () => {
    it('creates in filter', () => {
      const filter = inList('status', ['active', 'pending']);
      expect(filter).toEqual({
        status__in: ['active', 'pending'],
      });
    });

    it('handles single value', () => {
      const filter = inList('status', ['active']);
      expect(filter).toEqual({
        status__in: ['active'],
      });
    });
  });

  describe('notInList()', () => {
    it('creates not in filter', () => {
      const filter = notInList('status', ['deleted', 'banned']);
      expect(filter).toEqual({
        status__notin: ['deleted', 'banned'],
      });
    });
  });

  describe('isNull()', () => {
    it('creates is null filter', () => {
      const filter = isNull('deleted_at');
      expect(filter).toEqual({
        deleted_at__isnull: true,
      });
    });
  });

  describe('isNotNull()', () => {
    it('creates is not null filter', () => {
      const filter = isNotNull('published_at');
      expect(filter).toEqual({
        published_at__isnotnull: true,
      });
    });
  });

  describe('contains()', () => {
    it('creates contains filter', () => {
      const filter = contains('name', 'john');
      expect(filter).toEqual({
        name__contains: 'john',
      });
    });
  });

  describe('startsWith()', () => {
    it('creates startswith filter', () => {
      const filter = startsWith('email', 'admin@');
      expect(filter).toEqual({
        email__startswith: 'admin@',
      });
    });
  });

  describe('endsWith()', () => {
    it('creates endswith filter', () => {
      const filter = endsWith('email', '@gmail.com');
      expect(filter).toEqual({
        email__endswith: '@gmail.com',
      });
    });
  });

  describe('between()', () => {
    it('creates between filter for numeric field', () => {
      const filter = between('age', 18, 65);
      expect(filter).toEqual({
        age__between: [18, 65],
      });
    });
  });

  describe('greaterThan()', () => {
    it('creates gt filter', () => {
      const filter = greaterThan('age', 18);
      expect(filter).toEqual({
        age__gt: 18,
      });
    });
  });

  describe('lessThan()', () => {
    it('creates lt filter', () => {
      const filter = lessThan('age', 65);
      expect(filter).toEqual({
        age__lt: 65,
      });
    });
  });

  describe('combining fragments', () => {
    it('can spread multiple fragments into where()', () => {
      const filters = {
        ...inList('status', ['active', 'pending']),
        ...greaterThan('age', 18),
        ...isNull('deleted_at'),
      };

      expect(filters).toEqual({
        status__in: ['active', 'pending'],
        age__gt: 18,
        deleted_at__isnull: true,
      });
    });
  });
});
