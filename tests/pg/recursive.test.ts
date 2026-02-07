import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { createRecursiveCTE, RecursiveCTEBuilder } from '../../src/pg/recursive';

const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  parent_id: z.string().nullable(),
});

describe('Recursive CTEs', () => {
  describe('createRecursiveCTE()', () => {
    it('creates a recursive CTE builder', () => {
      const cte = createRecursiveCTE('category_tree', CategorySchema);
      expect(cte).toBeInstanceOf(RecursiveCTEBuilder);
    });

    it('generates WITH RECURSIVE syntax', () => {
      const cte = createRecursiveCTE('category_tree', CategorySchema)
        .baseCase(q => q.where({ parent_id__isnull: true }))
        .recursiveCase(
          'categories',
          'category_tree.id = categories.parent_id'
        )
        .from('categories');

      const sql = cte.toSQL();
      expect(sql).toContain('WITH RECURSIVE');
      expect(sql).toContain('category_tree');
    });

    it('supports ancestor traversal', () => {
      const cte = createRecursiveCTE('ancestors', CategorySchema)
        .baseCase(q => q.where({ id: 'leaf-id' }))
        .recursiveCase(
          'categories',
          'ancestors.parent_id = categories.id'
        )
        .from('categories');

      const sql = cte.toSQL();
      expect(sql).toContain('WITH RECURSIVE');
      expect(sql).toContain('ancestors');
    });

    it('supports descendant traversal', () => {
      const cte = createRecursiveCTE('descendants', CategorySchema)
        .baseCase(q => q.where({ id: 'root-id' }))
        .recursiveCase(
          'categories',
          'descendants.id = categories.parent_id'
        )
        .from('categories');

      const sql = cte.toSQL();
      expect(sql).toContain('WITH RECURSIVE');
      expect(sql).toContain('descendants');
    });
  });

  describe('depth tracking', () => {
    it('can add depth column', () => {
      const cte = createRecursiveCTE('tree', CategorySchema)
        .withDepth()
        .baseCase(q => q.where({ parent_id__isnull: true }))
        .recursiveCase('categories', 'tree.id = categories.parent_id')
        .from('categories');

      const sql = cte.toSQL();
      expect(sql).toContain('depth');
    });
  });
});
