/**
 * Standardized Query Performance Benchmark Suite
 * TPC-style benchmark for pg-query-composer query building performance.
 * Measures total time (ms) to build a fixed set of representative queries.
 * Output: single number (ms) on last line — lower is better.
 */

import { z } from 'zod';
import { createQueryComposer } from '../src/core/query-composer';

// --- Schemas ---

const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  status: z.string(),
  age: z.number(),
  created_at: z.string(),
  metadata: z.any(),
});

const orderSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  total: z.number(),
  status: z.string(),
  created_at: z.string(),
  notes: z.string(),
});

const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  price: z.number(),
  category: z.string(),
  stock: z.number(),
  tags: z.any(),
  description: z.string(),
});

// --- Benchmark cases ---

function benchSimpleWhere(n: number) {
  for (let i = 0; i < n; i++) {
    createQueryComposer(userSchema, 'users')
      .where({ status__exact: 'active' })
      .toParam();
  }
}

function benchMultiConditions(n: number) {
  for (let i = 0; i < n; i++) {
    createQueryComposer(userSchema, 'users')
      .where({
        status__exact: 'active',
        age__gte: 18,
        email__contains: 'example.com',
        name__startswith: 'J',
      })
      .toParam();
  }
}

function benchOrConditions(n: number) {
  for (let i = 0; i < n; i++) {
    createQueryComposer(userSchema, 'users')
      .where({ status__exact: 'active' })
      .or([
        { age__gte: 21 },
        { status__exact: 'premium' },
      ])
      .toParam();
  }
}

function benchPagination(n: number) {
  for (let i = 0; i < n; i++) {
    createQueryComposer(orderSchema, 'orders')
      .where({ status__exact: 'completed' })
      .orderBy('-created_at')
      .paginate({ page: 3, limit: 25 })
      .toParam();
  }
}

function benchSorting(n: number) {
  for (let i = 0; i < n; i++) {
    createQueryComposer(productSchema, 'products')
      .where({ stock__gt: 0 })
      .orderBy('-price')
      .orderBy('name')
      .toParam();
  }
}

function benchSelectFields(n: number) {
  for (let i = 0; i < n; i++) {
    createQueryComposer(userSchema, 'users')
      .select(['id', 'name', 'email'])
      .where({ status__exact: 'active' })
      .toParam();
  }
}

function benchNotConditions(n: number) {
  for (let i = 0; i < n; i++) {
    createQueryComposer(userSchema, 'users')
      .not({ status__exact: 'banned', age__lt: 13 })
      .toParam();
  }
}

function benchJoin(n: number) {
  for (let i = 0; i < n; i++) {
    createQueryComposer(orderSchema, 'orders')
      .join('users', 'orders.user_id = users.id')
      .where({ status__exact: 'completed' })
      .toParam();
  }
}

function benchGroupByHaving(n: number) {
  for (let i = 0; i < n; i++) {
    createQueryComposer(orderSchema, 'orders')
      .select(['user_id'])
      .groupBy('user_id')
      .having('SUM(total) > ?', [1000])
      .toParam();
  }
}

function benchComplexComposite(n: number) {
  for (let i = 0; i < n; i++) {
    createQueryComposer(userSchema, 'users')
      .select(['id', 'name', 'email', 'age'])
      .where({
        status__exact: 'active',
        age__between: [18, 65],
        email__contains: '@company.com',
      })
      .not({ name__isnull: true })
      .or([
        { age__gte: 21 },
        { status__exact: 'premium' },
      ])
      .orderBy('-created_at')
      .orderBy('name')
      .paginate({ page: 1, limit: 50 })
      .toParam();
  }
}

// --- Runner ---

const ITERATIONS = 500;

const benchmarks = [
  { name: 'simple-where', fn: benchSimpleWhere },
  { name: 'multi-conditions', fn: benchMultiConditions },
  { name: 'or-conditions', fn: benchOrConditions },
  { name: 'pagination', fn: benchPagination },
  { name: 'sorting', fn: benchSorting },
  { name: 'select-fields', fn: benchSelectFields },
  { name: 'not-conditions', fn: benchNotConditions },
  { name: 'join', fn: benchJoin },
  { name: 'group-by-having', fn: benchGroupByHaving },
  { name: 'complex-composite', fn: benchComplexComposite },
];

// Warmup
for (const b of benchmarks) b.fn(10);

// Run
let totalMs = 0;
for (const b of benchmarks) {
  const start = performance.now();
  b.fn(ITERATIONS);
  const elapsed = performance.now() - start;
  totalMs += elapsed;
}

// Output single number: total ms rounded to 2 decimals
console.log(Math.round(totalMs * 100) / 100);
