import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { subquery } from '../../src/subquery/builder';

const LeagueSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  country: z.string(),
});

describe('subquery()', () => {
  it('creates a subquery builder', () => {
    const sq = subquery(LeagueSchema, 'leagues')
      .select(['id'])
      .where({ status: 'active' });

    const sql = sq.toSQL();
    expect(sql).toContain('SELECT');
    expect(sql).toContain('FROM leagues');
    expect(sql).toContain('status');
  });

  it('supports field selection', () => {
    const sq = subquery(LeagueSchema, 'leagues').select(['id', 'name']);

    const sql = sq.toSQL();
    expect(sql).toContain('id');
    expect(sql).toContain('name');
  });

  it('supports filtering', () => {
    const sq = subquery(LeagueSchema, 'leagues')
      .select(['id'])
      .where({ country: 'Spain', status: 'active' });

    const { text, values } = sq.toParam();
    expect(text).toContain('country = $');
    expect(text).toContain('status = $');
    expect(values).toContain('Spain');
    expect(values).toContain('active');
  });

  it('supports operator syntax', () => {
    const sq = subquery(LeagueSchema, 'leagues')
      .select(['id'])
      .where({ name__contains: 'Liga' });

    const { text, values } = sq.toParam();
    expect(text).toContain('name ILIKE');
    expect(values).toContain('%Liga%');
  });

  it('always uses strict: false', () => {
    // Should not throw even with unknown column
    const sq = subquery(LeagueSchema, 'leagues')
      .select(['id'])
      .where({ unknown_field: 'value' });

    // Should still generate valid SQL, just without the unknown field
    const sql = sq.toSQL();
    expect(sql).toContain('SELECT');
    expect(sql).toContain('FROM leagues');
  });
});
