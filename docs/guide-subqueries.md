# Subqueries Guide

The subquery module provides tools for building nested queries, EXISTS checks, correlated references, and LATERAL joins.

## Basic Subqueries

Create subqueries for WHERE IN clauses:

```typescript
import { subquery } from 'pg-query-composer/subquery';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const leagueSchema = z.object({
  id: z.number(),
  status: z.string(),
});

const postSchema = z.object({
  id: z.number(),
  league_id: z.number(),
});

// Create subquery
const activeLeagues = subquery(leagueSchema, 'leagues')
  .select(['id'])
  .where({ status__exact: 'active' });

// Use in main query
const qc = createQueryComposer(postSchema, 'posts')
  .whereIn('league_id', activeLeagues);

const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM posts WHERE league_id IN (SELECT id FROM leagues WHERE status = $1)
console.log(values);
// → ['active']
```

### Subqueries with Alias

```typescript
import { subqueryAs } from 'pg-query-composer/subquery';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const companySchema = z.object({
  id: z.number(),
  country: z.string(),
});

const userSchema = z.object({
  id: z.number(),
  company_id: z.number(),
});

// Create subquery with alias
const { query: sq, alias } = subqueryAs(companySchema, 'companies', 'c');
sq.select(['id']).where({ country__exact: 'USA' });

// Use with alias in main query
const qc = createQueryComposer(userSchema, 'users')
  .where({ company_id__in: sq });

const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM users WHERE company_id IN (SELECT id FROM companies AS c WHERE c.country = $1)
console.log(values);
// → ['USA']
```

### Raw Subqueries

Use raw SQL for complex subqueries:

```typescript
import { rawSubquery } from 'pg-query-composer/subquery';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const postSchema = z.object({
  id: z.number(),
  author_id: z.number(),
});

// Complex subquery with parameterized SQL
const raw = rawSubquery(
  'SELECT id FROM authors WHERE created_at > $1 AND status = $2'
);

const qc = createQueryComposer(postSchema, 'posts')
  .where({ author_id__in: raw });

const { text } = qc.toParam();
console.log(text);
// → SELECT * FROM posts WHERE author_id IN (SELECT id FROM authors WHERE created_at > $1 AND status = $2)
```

## EXISTS Checks

Test for existence of related records:

```typescript
import { exists } from 'pg-query-composer/subquery';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const postSchema = z.object({
  id: z.number(),
  author_id: z.number(),
  status: z.string(),
});

// Check if user has published posts
const existsFilter = exists(
  subquery => subquery
    .from('posts')
    .select(['1'])
    .where({ author_id__exact: 'users.id', status__exact: 'published' })
);

const qc = createQueryComposer(userSchema, 'users');
qc.where(existsFilter);

const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM users WHERE EXISTS (SELECT 1 FROM posts WHERE author_id = users.id AND status = $1)
console.log(values);
// → ['published']
```

### NOT EXISTS

```typescript
import { notExists, subquery } from 'pg-query-composer/subquery';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
});

// Find users with no posts
const noPostsFilter = notExists(
  sq => sq
    .from('posts')
    .select(['1'])
    .where({ author_id__exact: 'users.id' })
);

const qc = createQueryComposer(userSchema, 'users');
qc.where(noPostsFilter);

const { text } = qc.toParam();
console.log(text);
// → SELECT * FROM users WHERE NOT EXISTS (SELECT 1 FROM posts WHERE author_id = users.id)
```

## Correlated References

Use correlated subqueries with references to outer query:

```typescript
import { ref, exists, subquery } from 'pg-query-composer/subquery';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
});

const orderSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  amount: z.number(),
});

// Find users whose total orders exceed $1000
const largeOrderFilter = exists(
  sq => sq
    .from('orders')
    .select(['1'])
    .where({ user_id__exact: ref('users.id') })
    .where({ amount__gt: 1000 })
);

const qc = createQueryComposer(userSchema, 'users');
qc.where(largeOrderFilter);

const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM users WHERE EXISTS (SELECT 1 FROM orders WHERE user_id = users.id AND amount > $1)
console.log(values);
// → [1000]
```

### Raw Correlated References

```typescript
import { raw } from 'pg-query-composer/subquery';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const productSchema = z.object({
  id: z.number(),
  name: z.string(),
});

// Use raw SQL for direct reference
const qc = createQueryComposer(productSchema, 'products')
  .where({ id__in: raw('p.id') });

const { text } = qc.toParam();
console.log(text);
// → SELECT * FROM products WHERE id IN (p.id)
```

## LATERAL Joins

Use LATERAL for correlated subqueries as join sources:

```typescript
import { lateral } from 'pg-query-composer/subquery';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const postSchema = z.object({
  id: z.number(),
  author_id: z.number(),
  created_at: z.string(),
});

// Create LATERAL subquery for most recent posts per user
const latestPosts = lateral(
  sq => sq
    .from('posts')
    .select(['id', 'title'])
    .where({ author_id__exact: ref('users.id') })
    .orderBy('-created_at')
    .paginate({ page: 1, limit: 3 })
);

const qc = createQueryComposer(userSchema, 'users')
  .leftJoin(latestPosts, 'true', 'true'); // LATERAL join condition

const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM users LEFT JOIN LATERAL (SELECT id, title FROM posts WHERE author_id = users.id ORDER BY created_at DESC LIMIT 3 OFFSET 0) ON true
```

## Real-world Pattern: Find Users with Minimum Published Posts

Combine EXISTS and correlated subqueries:

```typescript
import { exists, subquery, ref } from 'pg-query-composer/subquery';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  status: z.string(),
});

const postSchema = z.object({
  id: z.number(),
  author_id: z.number(),
  status: z.string(),
});

// Check if user has at least 3 published posts
const hasEnoughPosts = exists(
  sq => sq
    .from('posts')
    .select(['1'])
    .where({ author_id__exact: ref('users.id') })
    .where({ status__exact: 'published' })
    .having('COUNT(*)', '>=', 3)
    .groupBy('author_id')
);

// Get active users with enough published posts
const qc = createQueryComposer(userSchema, 'users')
  .where({ status__exact: 'active' })
  .where(hasEnoughPosts)
  .orderBy('-email')
  .paginate({ page: 1, limit: 20 });

const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM users WHERE status = $1 AND EXISTS (SELECT 1 FROM posts WHERE author_id = users.id AND status = $2 GROUP BY author_id HAVING COUNT(*) >= $3) ORDER BY email DESC LIMIT 20 OFFSET 0
console.log(values);
// → ['active', 'published', 3]
```

Alternative with WHERE IN subquery:

```typescript
import { subquery } from 'pg-query-composer/subquery';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  status: z.string(),
});

const postSchema = z.object({
  id: z.number(),
  author_id: z.number(),
  status: z.string(),
});

// Subquery to find authors with at least 3 published posts
const prolificAuthors = subquery(postSchema, 'posts')
  .select(['author_id'])
  .where({ status__exact: 'published' })
  .groupBy('author_id')
  .having('COUNT(*)', '>=', 3);

// Get active users in prolific authors
const qc = createQueryComposer(userSchema, 'users')
  .where({ status__exact: 'active' })
  .whereIn('id', prolificAuthors)
  .orderBy('email')
  .paginate({ page: 1, limit: 20 });

const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM users WHERE status = $1 AND id IN (SELECT author_id FROM posts WHERE status = $2 GROUP BY author_id HAVING COUNT(*) >= $3) ORDER BY email ASC LIMIT 20 OFFSET 0
console.log(values);
// → ['active', 'published', 3]
```
