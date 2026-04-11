import { z } from 'zod';
import { QueryComposer } from '../src/core/query-composer';

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
  new QueryComposer(userSchema, 'users').where({ status__exact: 'active' }).toParam();
}

// Pre-build composers
const composers: QueryComposer[] = [];
for (let i = 0; i < N; i++) {
  composers.push(
    new QueryComposer(userSchema, 'users')
      .where({ status__exact: 'active', age__gte: 18, email__contains: 'x' })
      .orderBy('-created_at')
      .paginate({ page: 1, limit: 20 })
  );
}

// Measure toSelect() vs toParam()
let t = performance.now();
const builders = [];
for (let i = 0; i < N; i++) {
  builders.push(composers[i].toSelect());
}
const toSelectTime = performance.now() - t;

t = performance.now();
for (let i = 0; i < N; i++) {
  builders[i].toParam();
}
const builderToParamTime = performance.now() - t;

console.log(`toSelect() (build SelectBuilder): ${toSelectTime.toFixed(2)}ms`);
console.log(`SelectBuilder.toParam() (serialize): ${builderToParamTime.toFixed(2)}ms`);
console.log(`ratio: ${(toSelectTime / (toSelectTime + builderToParamTime) * 100).toFixed(1)}% / ${(builderToParamTime / (toSelectTime + builderToParamTime) * 100).toFixed(1)}%`);
