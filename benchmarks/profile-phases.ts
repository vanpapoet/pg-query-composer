import { z } from 'zod';
import { createQueryComposer } from '../src/core/query-composer';

const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  status: z.string(),
  age: z.number(),
  created_at: z.string(),
  metadata: z.any(),
});

const N = 5000;

// Warmup
for (let i = 0; i < 100; i++) {
  createQueryComposer(userSchema, 'users').where({ status__exact: 'active' }).toParam();
}

// Time constructor
let t = performance.now();
const composers: any[] = [];
for (let i = 0; i < N; i++) {
  composers.push(createQueryComposer(userSchema, 'users'));
}
console.log('constructor:', (performance.now() - t).toFixed(2), 'ms');

// Time where
t = performance.now();
for (let i = 0; i < N; i++) {
  composers[i].where({ status__exact: 'active' });
}
console.log('where:', (performance.now() - t).toFixed(2), 'ms');

// Time toParam
t = performance.now();
for (let i = 0; i < N; i++) {
  composers[i].toParam();
}
console.log('toParam:', (performance.now() - t).toFixed(2), 'ms');

// Time all-in-one
t = performance.now();
for (let i = 0; i < N; i++) {
  createQueryComposer(userSchema, 'users')
    .where({ status__exact: 'active' })
    .toParam();
}
console.log('all-in-one:', (performance.now() - t).toFixed(2), 'ms');
