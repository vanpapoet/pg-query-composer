import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { QueryComposer } from '../../src/core/query-composer';
import { subquery } from '../../src/subquery/builder';

const PostSchema = z.object({
  id: z.string(),
  league_id: z.string(),
  status: z.string(),
  title: z.string(),
});

const LeagueSchema = z.object({
  id: z.string(),
  country: z.string(),
  status: z.string(),
});

describe('whereIn() with subquery', () => {
  it('generates IN (SELECT ...) clause', () => {
    const qc = new QueryComposer(PostSchema, 'posts', { strict: false })
      .where({ status: 'active' })
      .whereIn(
        'league_id',
        subquery(LeagueSchema, 'leagues')
          .select(['id'])
          .where({ country: 'Spain' })
      );

    const { text } = qc.toParam();
    expect(text).toContain('league_id IN (SELECT');
    expect(text).toContain('FROM leagues');
  });

  it('works with array values', () => {
    const qc = new QueryComposer(PostSchema, 'posts', { strict: false })
      .whereIn('league_id', ['uuid1', 'uuid2', 'uuid3']);

    const { text, values } = qc.toParam();
    expect(text).toContain('league_id IN');
    expect(values).toContain('uuid1');
    expect(values).toContain('uuid2');
    expect(values).toContain('uuid3');
  });

  it('chains with other where conditions', () => {
    const qc = new QueryComposer(PostSchema, 'posts', { strict: false })
      .where({ status: 'active' })
      .whereIn(
        'league_id',
        subquery(LeagueSchema, 'leagues')
          .select(['id'])
          .where({ status: 'active' })
      )
      .orderBy('-id');

    const { text } = qc.toParam();
    expect(text).toContain('status = $');
    expect(text).toContain('league_id IN (SELECT');
    expect(text).toContain('ORDER BY');
  });
});

describe('whereNotIn() with subquery', () => {
  it('generates NOT IN (SELECT ...) clause', () => {
    const qc = new QueryComposer(PostSchema, 'posts', { strict: false })
      .whereNotIn(
        'league_id',
        subquery(LeagueSchema, 'leagues')
          .select(['id'])
          .where({ status: 'deleted' })
      );

    const { text } = qc.toParam();
    expect(text).toContain('league_id NOT IN (SELECT');
    expect(text).toContain('FROM leagues');
  });

  it('works with array values', () => {
    const qc = new QueryComposer(PostSchema, 'posts', { strict: false })
      .whereNotIn('league_id', ['uuid-deleted', 'uuid-banned']);

    const { text, values } = qc.toParam();
    expect(text).toContain('league_id NOT IN');
    expect(values).toContain('uuid-deleted');
    expect(values).toContain('uuid-banned');
  });
});
