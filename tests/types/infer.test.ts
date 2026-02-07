import { describe, it, expect, expectTypeOf } from 'vitest';
import * as z from 'zod';
import {
  InferColumns,
  InferZodType,
  TypedWhere,
  createTypedComposer,
  TypedQueryComposer,
} from '../../src/types/infer';

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  age: z.number(),
  status: z.enum(['active', 'inactive', 'pending']),
  created_at: z.string(),
});

type UserType = z.infer<typeof UserSchema>;

describe('InferColumns', () => {
  it('extracts column names from Zod schema', () => {
    type Columns = InferColumns<typeof UserSchema>;

    // Type-level test: these should compile
    const validColumns: Columns[] = [
      'id',
      'name',
      'email',
      'age',
      'status',
      'created_at',
    ];

    expect(validColumns).toHaveLength(6);
  });
});

describe('InferZodType', () => {
  it('infers the type from Zod schema', () => {
    type User = InferZodType<typeof UserSchema>;

    // Type-level test
    const user: User = {
      id: '1',
      name: 'John',
      email: 'john@example.com',
      age: 30,
      status: 'active',
      created_at: '2024-01-01',
    };

    expect(user.id).toBe('1');
  });
});

describe('TypedWhere', () => {
  it('generates typed filter interface', () => {
    type Filter = TypedWhere<typeof UserSchema>;

    // These should compile
    const filter1: Filter = { name: 'John' };
    const filter2: Filter = { name__contains: 'john' };
    const filter3: Filter = { age__gte: 18 };
    const filter4: Filter = { status: 'active' };

    expect(filter1.name).toBe('John');
    expect(filter2['name__contains']).toBe('john');
    expect(filter3['age__gte']).toBe(18);
    expect(filter4.status).toBe('active');
  });
});

describe('createTypedComposer()', () => {
  it('creates a type-safe query composer', () => {
    const qc = createTypedComposer(UserSchema, 'users');
    expect(qc).toBeInstanceOf(TypedQueryComposer);
  });

  it('has type-safe where()', () => {
    const qc = createTypedComposer(UserSchema, 'users');

    // This should compile with type safety
    qc.where({ status: 'active' });
    qc.where({ age__gte: 18 });
    qc.where({ name__contains: 'john' });

    const { values } = qc.toParam();
    expect(values).toContain('active');
    expect(values).toContain(18);
    expect(values).toContain('%john%');
  });

  it('has type-safe select()', () => {
    const qc = createTypedComposer(UserSchema, 'users');

    // This should compile with type safety
    qc.select(['id', 'name', 'email']);

    const { text } = qc.toParam();
    expect(text).toContain('id');
    expect(text).toContain('name');
    expect(text).toContain('email');
  });

  it('has type-safe orderBy()', () => {
    const qc = createTypedComposer(UserSchema, 'users');

    // This should compile with type safety
    qc.orderBy('name', '-created_at');

    const { text } = qc.toParam();
    expect(text).toContain('name ASC');
    expect(text).toContain('created_at DESC');
  });

  it('chains methods fluently', () => {
    const qc = createTypedComposer(UserSchema, 'users')
      .where({ status: 'active' })
      .where({ age__gte: 18 })
      .select(['id', 'name'])
      .orderBy('-created_at')
      .paginate({ page: 1, limit: 10 });

    const { text, values } = qc.toParam();
    expect(text).toContain('WHERE');
    expect(text).toContain('ORDER BY');
    expect(text).toContain('LIMIT');
    expect(values).toContain('active');
  });
});

describe('Type inference at runtime', () => {
  it('validates columns at runtime when strict', () => {
    const qc = createTypedComposer(UserSchema, 'users', { strict: true });

    // Should throw for invalid column
    expect(() => {
      qc.where({ invalid_column: 'value' } as any);
    }).toThrow();
  });

  it('ignores invalid columns when not strict', () => {
    const qc = createTypedComposer(UserSchema, 'users', { strict: false });

    // Should not throw
    qc.where({ invalid_column: 'value' } as any);

    const { values } = qc.toParam();
    // Invalid column should be skipped
    expect(values).not.toContain('value');
  });
});
