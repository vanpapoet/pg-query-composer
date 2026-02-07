import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { QueryComposer } from '../../src/core/query-composer';
import { scope } from '../../src/composition/scope';

const PostSchema = z.object({
  id: z.string(),
  status: z.string(),
  pinned_hot: z.boolean(),
  pinned_wl: z.boolean(),
});

describe('Scopes', () => {
  it('creates reusable scope', () => {
    const published = scope<typeof PostSchema>((q) =>
      q.where({ status: 'active' })
    );

    const qc = new QueryComposer(PostSchema, 'posts', { strict: false });
    qc.apply(published);

    const { values } = qc.toParam();
    expect(values).toContain('active');
  });

  it('chains multiple scopes', () => {
    const published = scope<typeof PostSchema>((q) =>
      q.where({ status: 'active' })
    );
    const pinned = scope<typeof PostSchema>((q) =>
      q.or([{ pinned_hot: true }, { pinned_wl: true }])
    );

    const qc = new QueryComposer(PostSchema, 'posts', { strict: false });
    qc.apply(published).apply(pinned);

    const { text } = qc.toParam();
    expect(text).toContain('status = $');
    expect(text).toContain('OR');
  });

  it('scopes can add ordering', () => {
    const recent = scope<typeof PostSchema>((q) => q.orderBy('-id'));

    const qc = new QueryComposer(PostSchema, 'posts', { strict: false });
    qc.apply(recent);

    const { text } = qc.toParam();
    expect(text).toContain('ORDER BY');
    expect(text).toContain('id DESC');
  });

  it('scopes can add pagination', () => {
    const paginated = scope<typeof PostSchema>((q) =>
      q.paginate({ page: 1, limit: 10 })
    );

    const qc = new QueryComposer(PostSchema, 'posts', { strict: false });
    qc.apply(paginated);

    const { text } = qc.toParam();
    expect(text).toContain('LIMIT');
    expect(text).toContain('OFFSET');
  });

  it('scopes can use when() conditionally', () => {
    const conditionalScope = (isActive: boolean) =>
      scope<typeof PostSchema>((q) =>
        q.when(isActive, (qc) => qc.where({ status: 'active' }))
      );

    const qc1 = new QueryComposer(PostSchema, 'posts', { strict: false });
    qc1.apply(conditionalScope(true));
    const { values: v1 } = qc1.toParam();
    expect(v1).toContain('active');

    const qc2 = new QueryComposer(PostSchema, 'posts', { strict: false });
    qc2.apply(conditionalScope(false));
    const { values: v2 } = qc2.toParam();
    expect(v2).not.toContain('active');
  });
});
