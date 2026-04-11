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
for (let i = 0; i < 200; i++) {
  createQueryComposer(userSchema, 'users')
    .where({ status__exact: 'active', age__gte: 18, email__contains: 'x' })
    .orderBy('-created_at')
    .paginate({ page: 1, limit: 20 })
    .toParam();
}

// Now measure each phase
const composers: any[] = [];

// Phase 1: constructor
let t = performance.now();
for (let i = 0; i < N; i++) composers.push(createQueryComposer(userSchema, 'users'));
const ctorTime = performance.now() - t;

// Phase 2: where (multi-condition)
t = performance.now();
for (let i = 0; i < N; i++) {
  composers[i].where({ status__exact: 'active', age__gte: 18, email__contains: 'x' });
}
const whereTime = performance.now() - t;

// Phase 3: orderBy + paginate
t = performance.now();
for (let i = 0; i < N; i++) {
  composers[i].orderBy('-created_at').paginate({ page: 1, limit: 20 });
}
const orderPagTime = performance.now() - t;

// Phase 4: toParam
t = performance.now();
for (let i = 0; i < N; i++) composers[i].toParam();
const toParamTime = performance.now() - t;

console.log(`constructor: ${ctorTime.toFixed(2)}ms`);
console.log(`where(3cond): ${whereTime.toFixed(2)}ms`);
console.log(`orderBy+paginate: ${orderPagTime.toFixed(2)}ms`);
console.log(`toParam: ${toParamTime.toFixed(2)}ms`);
console.log(`total: ${(ctorTime + whereTime + orderPagTime + toParamTime).toFixed(2)}ms`);
