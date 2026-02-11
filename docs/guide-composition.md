# Composition Guide

The composition module provides factory functions for reusable query fragments, scopes, and merge utilities to build complex queries in a DRY manner.

## Filter Fragments

Create reusable filter objects for any query:

```typescript
import { fragment } from 'pg-query-composer/composition';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  age: z.number(),
});

// Create fragment with any operator
const adultFilter = fragment('age', 'gte', 18);
console.log(adultFilter);
// → { age__gte: 18 }

const qc = createQueryComposer(userSchema, 'users');
qc.where(adultFilter);
const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM users WHERE age >= $1
console.log(values);
// → [18]
```

### Exact Match

```typescript
import { exact } from 'pg-query-composer/composition';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  status: z.string(),
});

const activeFilter = exact('status', 'active');
console.log(activeFilter);
// → { status__exact: 'active' }

const qc = createQueryComposer(userSchema, 'users');
qc.where(activeFilter);
const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM users WHERE status = $1
console.log(values);
// → ['active']
```

### Comparison Fragments

```typescript
import { greaterThan, lessThanOrEqual, between } from 'pg-query-composer/composition';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const priceSchema = z.object({
  price: z.number(),
});

const filters = {
  gt: greaterThan('price', 100),
  lte: lessThanOrEqual('price', 500),
  between: between('price', [50, 200]),
};

console.log(filters);
// → {
//   gt: { price__gt: 100 },
//   lte: { price__lte: 500 },
//   between: { price__between: [50, 200] }
// }

const qc = createQueryComposer(priceSchema, 'products');
qc.where(filters.gt).where(filters.lte);
const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM products WHERE price > $1 AND price <= $2
console.log(values);
// → [100, 500]
```

### Text Search Fragments

```typescript
import { startsWith, endsWith, contains } from 'pg-query-composer/composition';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const pageSchema = z.object({
  title: z.string(),
  slug: z.string(),
});

const titleFilter = startsWith('title', 'Getting');
const slugFilter = endsWith('slug', '-guide');
const contentFilter = contains('title', 'query');

const qc = createQueryComposer(pageSchema, 'pages');
qc.where(titleFilter)
  .where(slugFilter)
  .where(contentFilter);

const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM pages WHERE title LIKE $1 AND slug LIKE $2 AND title LIKE $3
console.log(values);
// → ['Getting%', '%guide', '%query%']
```

### NULL Fragments

```typescript
import { isNull, isNotNull } from 'pg-query-composer/composition';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  deleted_at: z.string(),
  bio: z.string(),
});

const deletedFilter = isNull('deleted_at');
const hasProfileFilter = isNotNull('bio');

console.log(deletedFilter);
// → { deleted_at__isnull: true }
console.log(hasProfileFilter);
// → { bio__isnull: false }

const qc = createQueryComposer(userSchema, 'users');
qc.where(deletedFilter).where(hasProfileFilter);
const { text } = qc.toParam();
console.log(text);
// → SELECT * FROM users WHERE deleted_at IS NULL AND bio IS NOT NULL
```

### List Fragments

```typescript
import { inList, notInList } from 'pg-query-composer/composition';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const orderSchema = z.object({
  status: z.string(),
});

const activeStatuses = inList('status', ['pending', 'processing', 'shipped']);
const ignoredStatuses = notInList('status', ['cancelled', 'returned']);

const qc = createQueryComposer(orderSchema, 'orders');
qc.where(activeStatuses);
const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM orders WHERE status IN ($1, $2, $3)
console.log(values);
// → ['pending', 'processing', 'shipped']
```

### Date Range Fragment

```typescript
import { dateRange } from 'pg-query-composer/composition';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const eventSchema = z.object({
  created_at: z.string(),
});

const q1Filter = dateRange('created_at', '2024-01-01', '2024-03-31');
console.log(q1Filter);
// → { created_at__between: ['2024-01-01', '2024-03-31'] }

const qc = createQueryComposer(eventSchema, 'events');
qc.where(q1Filter);
const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM events WHERE created_at BETWEEN $1 AND $2
console.log(values);
// → ['2024-01-01', '2024-03-31']
```

## Scopes

Create reusable query patterns:

```typescript
import { scope } from 'pg-query-composer/composition';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const postSchema = z.object({
  status: z.string(),
  created_at: z.string(),
});

// Define scopes
const publishedScope = scope(q =>
  q.where({ status__exact: 'published' })
);

const recentScope = scope(q =>
  q.orderBy('-created_at').paginate({ page: 1, limit: 10 })
);

// Apply to query
const qc = createQueryComposer(postSchema, 'posts');
qc.apply(publishedScope)
  .apply(recentScope);

const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM posts WHERE status = $1 ORDER BY created_at DESC LIMIT 10 OFFSET 0
console.log(values);
// → ['published']
```

### Parameterized Scopes

```typescript
import { parameterizedScope } from 'pg-query-composer/composition';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const postSchema = z.object({
  status: z.string(),
});

// Create scope factory with parameters
const byStatusScope = (status: string) =>
  parameterizedScope(
    (s: string) => q => q.where({ status__exact: s })
  )(status);

// Use with different values
const qc1 = createQueryComposer(postSchema, 'posts');
qc1.apply(byStatusScope('draft'));

const qc2 = createQueryComposer(postSchema, 'posts');
qc2.apply(byStatusScope('published'));

const { text: text1, values: values1 } = qc1.toParam();
const { text: text2, values: values2 } = qc2.toParam();
console.log('Draft:', text1, values1);
// → Draft: SELECT * FROM posts WHERE status = $1 ['draft']
console.log('Published:', text2, values2);
// → Published: SELECT * FROM posts WHERE status = $1 ['published']
```

## Merge

Combine multiple composers without mutation:

```typescript
import { merge } from 'pg-query-composer/composition';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const postSchema = z.object({
  status: z.string(),
  author_id: z.number(),
});

// Create base composers
const filterComposer = createQueryComposer(postSchema, 'posts')
  .where({ status__exact: 'published' });

const sortComposer = createQueryComposer(postSchema, 'posts')
  .orderBy('-created_at');

// Merge without mutation
const merged = merge(filterComposer, sortComposer);
const { text, values } = merged.toParam();
console.log(text);
// → SELECT * FROM posts WHERE status = $1 ORDER BY created_at DESC
console.log(values);
// → ['published']
```

### Merge All

Combine multiple composers:

```typescript
import { mergeAll } from 'pg-query-composer/composition';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const postSchema = z.object({
  status: z.string(),
  author_id: z.number(),
  tag: z.string(),
});

// Create multiple composers
const published = createQueryComposer(postSchema, 'posts')
  .where({ status__exact: 'published' });

const byAuthor = createQueryComposer(postSchema, 'posts')
  .where({ author_id__exact: 42 });

const tagged = createQueryComposer(postSchema, 'posts')
  .where({ tag__contains: 'typescript' });

const paginated = createQueryComposer(postSchema, 'posts')
  .paginate({ page: 1, limit: 20 });

// Merge all at once
const result = mergeAll([published, byAuthor, tagged, paginated]);
const { text, values } = result.toParam();
console.log(text);
// → SELECT * FROM posts WHERE status = $1 AND author_id = $2 AND tag LIKE $3 LIMIT 20 OFFSET 0
console.log(values);
// → ['published', 42, '%typescript%']
```

## Real-world Pattern: Blog Query Builder

Combine fragments, scopes, and merge for complex queries:

```typescript
import { scope, inList, dateRange, mergeAll } from 'pg-query-composer/composition';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const postSchema = z.object({
  id: z.number(),
  status: z.string(),
  category: z.string(),
  created_at: z.string(),
});

// Define reusable scopes
const publishedScope = scope(q =>
  q.where({ status__exact: 'published' })
);

const featuredScope = scope(q =>
  q.orderBy('-created_at').select(['id', 'title', 'category'])
);

// Create modular composers
const categoryFilter = createQueryComposer(postSchema, 'posts')
  .where(inList('category', ['tech', 'design', 'business']));

const recentFilter = createQueryComposer(postSchema, 'posts')
  .where(dateRange('created_at', '2024-01-01', '2024-12-31'));

const pagination = createQueryComposer(postSchema, 'posts')
  .paginate({ page: 1, limit: 10 });

// Combine everything
const result = mergeAll([categoryFilter, recentFilter, pagination])
  .apply(publishedScope)
  .apply(featuredScope);

const { text, values } = result.toParam();
console.log(text);
// → SELECT id, title, category FROM posts WHERE category IN ($1, $2, $3) AND created_at BETWEEN $4 AND $5 LIMIT 10 OFFSET 0
console.log(values);
// → ['tech', 'design', 'business', '2024-01-01', '2024-12-31']
```
