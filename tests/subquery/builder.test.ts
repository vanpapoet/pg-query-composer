import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { subquery } from '../../src/subquery/builder';
import { InvalidColumnError } from '../../src/core/errors';

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

  it('enforces the schema whitelist (strict by default)', () => {
    // Unknown columns must be rejected, not silently dropped — the caller
    // supplies the schema, so there is no reason to weaken validation here.
    expect(() =>
      subquery(LeagueSchema, 'leagues').select(['id']).where({ unknown_field: 'value' })
    ).toThrow(InvalidColumnError);
  });
});
