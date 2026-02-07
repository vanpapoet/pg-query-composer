import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { QueryComposer } from '../../src/core/query-composer';
import { merge } from '../../src/composition/merge';

const TestSchema = z.object({
  id: z.string(),
  status: z.string(),
  age: z.number(),
  name: z.string(),
});

describe('merge()', () => {
  it('combines conditions from two queries', () => {
    const qc1 = new QueryComposer(TestSchema, 'users', { strict: false }).where(
      { status: 'active' }
    );

    const qc2 = new QueryComposer(TestSchema, 'users', { strict: false }).where(
      { age__gte: 18 }
    );

    const merged = merge(qc1, qc2);
    const { values } = merged.toParam();

    expect(values).toContain('active');
    expect(values).toContain(18);
  });

  it('preserves OR groups', () => {
    const qc1 = new QueryComposer(TestSchema, 'users', {
      strict: false,
    }).or([{ status: 'active' }, { status: 'pending' }]);

    const qc2 = new QueryComposer(TestSchema, 'users', { strict: false }).where(
      { age__gte: 18 }
    );

    const merged = merge(qc1, qc2);
    const { text, values } = merged.toParam();

    expect(text).toContain('OR');
    expect(values).toContain('active');
    expect(values).toContain('pending');
    expect(values).toContain(18);
  });

  it('preserves NOT conditions', () => {
    const qc1 = new QueryComposer(TestSchema, 'users', { strict: false }).not({
      status: 'deleted',
    });

    const qc2 = new QueryComposer(TestSchema, 'users', { strict: false }).where(
      { age__gte: 18 }
    );

    const merged = merge(qc1, qc2);
    const { text, values } = merged.toParam();

    expect(text).toContain('NOT');
    expect(values).toContain('deleted');
    expect(values).toContain(18);
  });

  it('does not modify original queries', () => {
    const qc1 = new QueryComposer(TestSchema, 'users', { strict: false }).where(
      { status: 'active' }
    );

    const qc2 = new QueryComposer(TestSchema, 'users', { strict: false }).where(
      { age__gte: 18 }
    );

    merge(qc1, qc2);

    const { values: v1 } = qc1.toParam();
    const { values: v2 } = qc2.toParam();

    expect(v1).toHaveLength(1);
    expect(v1).toContain('active');
    expect(v2).toHaveLength(1);
    expect(v2).toContain(18);
  });

  it('merges multiple queries', () => {
    const qc1 = new QueryComposer(TestSchema, 'users', { strict: false }).where(
      { status: 'active' }
    );
    const qc2 = new QueryComposer(TestSchema, 'users', { strict: false }).where(
      { age__gte: 18 }
    );
    const qc3 = new QueryComposer(TestSchema, 'users', {
      strict: false,
    }).where({ name__contains: 'john' });

    const merged = merge(merge(qc1, qc2), qc3);
    const { values } = merged.toParam();

    expect(values).toContain('active');
    expect(values).toContain(18);
    expect(values).toContain('%john%');
  });
});

describe('QueryComposer.mergeFrom()', () => {
  it('merges conditions from another query in-place', () => {
    const qc1 = new QueryComposer(TestSchema, 'users', { strict: false }).where(
      { status: 'active' }
    );

    const qc2 = new QueryComposer(TestSchema, 'users', { strict: false }).where(
      { age__gte: 18 }
    );

    qc1.mergeFrom(qc2);
    const { values } = qc1.toParam();

    expect(values).toContain('active');
    expect(values).toContain(18);
  });
});
