import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { QueryComposer } from '../../src/core/query-composer';
import { subquery } from '../../src/subquery/builder';
import { exists, notExists } from '../../src/subquery/exists';

const PostSchema = z.object({
  id: z.string(),
  status: z.string(),
  title: z.string(),
});

const CommentSchema = z.object({
  id: z.string(),
  post_id: z.string(),
  approved: z.boolean(),
  content: z.string(),
});

describe('EXISTS subquery', () => {
  it('generates EXISTS clause', () => {
    const qc = new QueryComposer(PostSchema, 'posts', { strict: false }).where(
      exists(
        subquery(CommentSchema, 'comments')
          .whereRaw('comments.post_id = posts.id')
          .where({ approved: true })
      )
    );

    const { text } = qc.toParam();
    expect(text).toContain('EXISTS');
    expect(text).toContain('SELECT 1 FROM comments');
  });

  it('works with posts that have comments', () => {
    const qc = new QueryComposer(PostSchema, 'posts', { strict: false })
      .where({ status: 'active' })
      .where(
        exists(
          subquery(CommentSchema, 'comments').whereRaw(
            'comments.post_id = posts.id'
          )
        )
      );

    const { text } = qc.toParam();
    expect(text).toContain("status = $");
    expect(text).toContain('EXISTS');
    expect(text).toContain('comments.post_id = posts.id');
  });
});

describe('NOT EXISTS subquery', () => {
  it('generates NOT EXISTS clause', () => {
    const qc = new QueryComposer(PostSchema, 'posts', { strict: false }).where(
      notExists(
        subquery(CommentSchema, 'comments').whereRaw(
          'comments.post_id = posts.id'
        )
      )
    );

    const { text } = qc.toParam();
    expect(text).toContain('NOT EXISTS');
  });

  it('finds posts without comments', () => {
    const qc = new QueryComposer(PostSchema, 'posts', { strict: false })
      .where({ status: 'active' })
      .where(
        notExists(
          subquery(CommentSchema, 'comments').whereRaw(
            'comments.post_id = posts.id'
          )
        )
      );

    const { text } = qc.toParam();
    expect(text).toContain("status = $");
    expect(text).toContain('NOT EXISTS');
  });
});

describe('Correlated subqueries', () => {
  it('supports correlated subquery with EXISTS', () => {
    // Find posts with at least one approved comment
    const qc = new QueryComposer(PostSchema, 'posts', { strict: false })
      .where({ status: 'active' })
      .where(
        exists(
          subquery(CommentSchema, 'comments')
            .whereRaw('comments.post_id = posts.id')
            .where({ approved: true })
        )
      );

    const { text } = qc.toParam();
    expect(text).toContain('posts');
    expect(text).toContain('comments');
    expect(text).toContain('comments.post_id = posts.id');
    expect(text).toContain('approved');
  });
});
