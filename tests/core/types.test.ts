import { describe, it, expect } from 'vitest';
import type {
  QueryOperator,
  PaginationOptions,
  PaginationMeta,
  QueryBuilderOptions,
} from '../../src/core/types';

describe('Core Types', () => {
  it('exports QueryOperator type', () => {
    const op: QueryOperator = 'exact';
    expect(op).toBe('exact');
  });

  it('exports PaginationOptions interface', () => {
    const opts: PaginationOptions = { page: 1, limit: 20 };
    expect(opts.page).toBe(1);
  });

  it('exports PaginationMeta interface', () => {
    const meta: PaginationMeta = { page: 1, limit: 20, offset: 0 };
    expect(meta.offset).toBe(0);
  });

  it('exports QueryBuilderOptions interface', () => {
    const opts: QueryBuilderOptions = { strict: true };
    expect(opts.strict).toBe(true);
  });
});
