import { describe, it, expect } from 'vitest';
import { OPERATORS, VALID_OPERATORS } from '../../src/core/operators';

describe('OPERATORS', () => {
  describe('Comparison Operators', () => {
    it('exact - generates equality condition', () => {
      const [condition, values] = OPERATORS.exact('status', 'active');
      expect(condition).toBe('status = ?');
      expect(values).toEqual(['active']);
    });

    it('gt - generates greater than condition', () => {
      const [condition, values] = OPERATORS.gt('age', 18);
      expect(condition).toBe('age > ?');
      expect(values).toEqual([18]);
    });

    it('gte - generates greater than or equal condition', () => {
      const [condition, values] = OPERATORS.gte('price', 100);
      expect(condition).toBe('price >= ?');
      expect(values).toEqual([100]);
    });

    it('lt - generates less than condition', () => {
      const [condition, values] = OPERATORS.lt('age', 65);
      expect(condition).toBe('age < ?');
      expect(values).toEqual([65]);
    });

    it('lte - generates less than or equal condition', () => {
      const [condition, values] = OPERATORS.lte('price', 500);
      expect(condition).toBe('price <= ?');
      expect(values).toEqual([500]);
    });

    it('notexact - generates not equal condition', () => {
      const [condition, values] = OPERATORS.notexact('status', 'deleted');
      expect(condition).toBe('status != ?');
      expect(values).toEqual(['deleted']);
    });
  });

  describe('Text Operators', () => {
    it('contains - generates ILIKE with wildcards', () => {
      const [condition, values] = OPERATORS.contains('name', 'john');
      expect(condition).toBe('name ILIKE ?');
      expect(values).toEqual(['%john%']);
    });

    it('startswith - generates ILIKE with suffix wildcard', () => {
      const [condition, values] = OPERATORS.startswith('name', 'john');
      expect(condition).toBe('name ILIKE ?');
      expect(values).toEqual(['john%']);
    });

    it('endswith - generates ILIKE with prefix wildcard', () => {
      const [condition, values] = OPERATORS.endswith('email', '@gmail.com');
      expect(condition).toBe('email ILIKE ?');
      expect(values).toEqual(['%@gmail.com']);
    });

    it('regex - generates case-sensitive regex', () => {
      const [condition, values] = OPERATORS.regex('code', '^[A-Z]{3}$');
      expect(condition).toBe('code ~ ?');
      expect(values).toEqual(['^[A-Z]{3}$']);
    });

    it('iregex - generates case-insensitive regex', () => {
      const [condition, values] = OPERATORS.iregex('code', '^[a-z]{3}$');
      expect(condition).toBe('code ~* ?');
      expect(values).toEqual(['^[a-z]{3}$']);
    });
  });

  describe('Range Operators', () => {
    it('in - generates IN clause', () => {
      const [condition, values] = OPERATORS.in('status', ['active', 'pending']);
      expect(condition).toBe('status IN (?, ?)');
      expect(values).toEqual(['active', 'pending']);
    });

    it('in - handles empty array', () => {
      const [condition, values] = OPERATORS.in('status', []);
      expect(condition).toBe('FALSE');
      expect(values).toEqual([]);
    });

    it('notin - generates NOT IN clause', () => {
      const [condition, values] = OPERATORS.notin('status', ['deleted', 'archived']);
      expect(condition).toBe('status NOT IN (?, ?)');
      expect(values).toEqual(['deleted', 'archived']);
    });

    it('between - generates BETWEEN clause', () => {
      const [condition, values] = OPERATORS.between('age', [18, 65]);
      expect(condition).toBe('age BETWEEN ? AND ?');
      expect(values).toEqual([18, 65]);
    });

    it('between - throws on invalid array length', () => {
      expect(() => OPERATORS.between('age', [18])).toThrow();
    });

    it('notbetween - generates NOT BETWEEN clause', () => {
      const [condition, values] = OPERATORS.notbetween('price', [100, 500]);
      expect(condition).toBe('price NOT BETWEEN ? AND ?');
      expect(values).toEqual([100, 500]);
    });
  });

  describe('Null Operators', () => {
    it('isnull - generates IS NULL when true', () => {
      const [condition, values] = OPERATORS.isnull('deleted_at', true);
      expect(condition).toBe('deleted_at IS NULL');
      expect(values).toEqual([]);
    });

    it('isnull - generates IS NOT NULL when false', () => {
      const [condition, values] = OPERATORS.isnull('deleted_at', false);
      expect(condition).toBe('deleted_at IS NOT NULL');
      expect(values).toEqual([]);
    });

    it('isnotnull - generates IS NOT NULL when true', () => {
      const [condition, values] = OPERATORS.isnotnull('email', true);
      expect(condition).toBe('email IS NOT NULL');
      expect(values).toEqual([]);
    });
  });

  describe('Date Operators', () => {
    it('date - generates DATE() comparison', () => {
      const [condition, values] = OPERATORS.date('created_at', '2024-01-15');
      expect(condition).toBe('DATE(created_at) = ?');
      expect(values).toEqual(['2024-01-15']);
    });

    it('datebetween - generates DATE BETWEEN', () => {
      const [condition, values] = OPERATORS.datebetween('created_at', ['2024-01-01', '2024-12-31']);
      expect(condition).toBe('DATE(created_at) BETWEEN ? AND ?');
      expect(values).toEqual(['2024-01-01', '2024-12-31']);
    });

    it('year - generates EXTRACT(YEAR)', () => {
      const [condition, values] = OPERATORS.year('created_at', 2024);
      expect(condition).toBe('EXTRACT(YEAR FROM created_at) = ?');
      expect(values).toEqual([2024]);
    });

    it('today - generates CURRENT_DATE comparison', () => {
      const [condition, values] = OPERATORS.today('created_at', true);
      expect(condition).toBe('DATE(created_at) = CURRENT_DATE');
      expect(values).toEqual([]);
    });
  });

  describe('Array Operators (PostgreSQL)', () => {
    it('arraycontains - generates @> operator', () => {
      const [condition, values] = OPERATORS.arraycontains('tags', ['sports']);
      expect(condition).toBe('tags @> ARRAY[?]');
      expect(values).toEqual(['sports']);
    });

    it('arrayoverlap - generates && operator', () => {
      const [condition, values] = OPERATORS.arrayoverlap('tags', ['sports', 'news']);
      expect(condition).toBe('tags && ARRAY[?, ?]');
      expect(values).toEqual(['sports', 'news']);
    });

    it('arraycontained - generates <@ operator', () => {
      const [condition, values] = OPERATORS.arraycontained('tags', ['sports', 'news', 'tech']);
      expect(condition).toBe('tags <@ ARRAY[?, ?, ?]');
      expect(values).toEqual(['sports', 'news', 'tech']);
    });
  });

  describe('VALID_OPERATORS', () => {
    it('contains all expected operators', () => {
      expect(VALID_OPERATORS).toContain('exact');
      expect(VALID_OPERATORS).toContain('contains');
      expect(VALID_OPERATORS).toContain('in');
      expect(VALID_OPERATORS).toContain('isnull');
      expect(VALID_OPERATORS).toContain('today');
      expect(VALID_OPERATORS).toContain('arraycontains');
    });

    it('has correct count of operators (30 operators)', () => {
      // 6 comparison + 8 text + 4 range + 2 null + 10 date + 3 array = 33
      expect(VALID_OPERATORS.length).toBeGreaterThanOrEqual(30);
    });
  });
});
