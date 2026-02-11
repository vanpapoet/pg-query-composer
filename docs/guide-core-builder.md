# Core Builder Guide

The **QueryComposer** is the foundation of pg-query-composer. It provides a fluent API for building SQL queries programmatically with validation, parameterization, and type safety.

## Creating a Composer

Initialize a QueryComposer with a Zod schema and table name:

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  age: z.number(),
  status: z.string(),
  created_at: z.string(),
});

const qc = createQueryComposer(userSchema, 'users');
console.log('Composer created');
// → Composer created
```

### Constructor Options

Pass optional configuration to customize behavior:

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  role: z.string(),
});

const qc = createQueryComposer(userSchema, 'users', {
  strict: false, // Allow non-schema columns
  separator: '__', // Field__operator syntax separator
  extraColumns: ['custom_field'], // Additional whitelisted columns
  aliases: { email_addr: 'email' }, // Column aliases
});

console.log('Composer with options created');
// → Composer with options created
```

## WHERE Conditions

Add filters using Django-style `field__operator` syntax:

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  age: z.number(),
  status: z.string(),
  created_at: z.string(),
});

const qc = createQueryComposer(userSchema, 'users');

// Exact match
qc.where({ email__exact: 'john@example.com' });
const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM users WHERE email = $1
console.log(values);
// → ['john@example.com']
```

### Comparison Operators

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  age: z.number(),
  name: z.string(),
});

const qc = createQueryComposer(userSchema, 'users');

qc.where({ age__gt: 18 })
  .where({ age__gte: 21 })
  .where({ age__lt: 65 })
  .where({ age__lte: 60 });

const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM users WHERE age > $1 AND age >= $2 AND age < $3 AND age <= $4
console.log(values);
// → [18, 21, 65, 60]
```

### Text Operators

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  name: z.string(),
  email: z.string(),
});

const qc = createQueryComposer(userSchema, 'users');

qc.where({ name__contains: 'john' })
  .where({ email__icontains: 'EXAMPLE' })
  .where({ name__startswith: 'J' })
  .where({ name__endswith: 'son' });

const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM users WHERE name LIKE $1 AND email ILIKE $2 AND name LIKE $3 AND name LIKE $4
console.log(values);
// → ['%john%', '%EXAMPLE%', 'J%', '%son']
```

### Range Operators

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  age: z.number(),
  created_at: z.string(),
});

const qc = createQueryComposer(userSchema, 'users');

qc.where({ age__between: [18, 65] })
  .where({ created_at__between: ['2024-01-01', '2024-12-31'] });

const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM users WHERE age BETWEEN $1 AND $2 AND created_at BETWEEN $3 AND $4
console.log(values);
// → [18, 65, '2024-01-01', '2024-12-31']
```

### Array Operators

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  status: z.string(),
  role: z.string(),
});

const qc = createQueryComposer(userSchema, 'users');

qc.where({ status__in: ['active', 'pending'] })
  .where({ role__notin: ['admin', 'banned'] });

const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM users WHERE status IN ($1, $2) AND role NOT IN ($3, $4)
console.log(values);
// → ['active', 'pending', 'admin', 'banned']
```

### NULL Operators

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  name: z.string(),
  bio: z.string(),
});

const qc = createQueryComposer(userSchema, 'users');

qc.where({ bio__isnull: true })
  .where({ name__isnull: false });

const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM users WHERE bio IS NULL AND name IS NOT NULL
console.log(values);
// → []
```

## Field Selection

Choose which columns to include or exclude:

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  password: z.string(),
});

const qc = createQueryComposer(userSchema, 'users');

qc.select(['id', 'email', 'name']);
const { text } = qc.toParam();
console.log(text);
// → SELECT id, email, name FROM users
```

Exclude sensitive columns:

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  password: z.string(),
});

const qc = createQueryComposer(userSchema, 'users');

qc.exclude(['password']);
const { text } = qc.toParam();
console.log(text);
// → SELECT id, email FROM users
```

## Sorting

Order results with flexible sorting:

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  created_at: z.string(),
});

const qc = createQueryComposer(userSchema, 'users');

// Ascending (default)
qc.orderBy('name');
// Descending (use minus prefix)
qc.orderBy('-created_at');

const { text } = qc.toParam();
console.log(text);
// → SELECT * FROM users ORDER BY name ASC, created_at DESC
```

Clear existing sort:

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const qc = createQueryComposer(userSchema, 'users')
  .orderBy('name')
  .orderBy('id'); // Add another sort

qc.clearSort();
const { text } = qc.toParam();
console.log(text);
// → SELECT * FROM users
```

## Pagination

Limit and offset results with metadata:

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  email: z.string(),
});

const qc = createQueryComposer(userSchema, 'users');

qc.paginate({ page: 2, limit: 10 });
const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM users LIMIT 10 OFFSET 10
console.log(values);
// → []
```

Get pagination metadata:

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
});

const qc = createQueryComposer(userSchema, 'users')
  .paginate({ page: 2, limit: 20 });

const meta = qc.getPaginationMeta(100); // 100 total records
console.log(meta);
// → {
//   page: 2,
//   limit: 20,
//   offset: 20,
//   total: 100,
//   totalPages: 5,
//   hasNext: true,
//   hasPrev: true
// }
```

## Joins

Combine data from multiple tables:

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  company_id: z.number(),
});

const qc = createQueryComposer(userSchema, 'users');

// INNER JOIN
qc.join('companies', 'users.company_id', 'companies.id');
const { text } = qc.toParam();
console.log(text);
// → SELECT * FROM users INNER JOIN companies ON users.company_id = companies.id
```

Left and right joins:

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  company_id: z.number(),
});

const qc = createQueryComposer(userSchema, 'users');

qc.leftJoin('companies', 'users.company_id', 'companies.id')
  .rightJoin('profiles', 'users.id', 'profiles.user_id');

const { text } = qc.toParam();
console.log(text);
// → SELECT * FROM users LEFT JOIN companies ON users.company_id = companies.id RIGHT JOIN profiles ON users.id = profiles.user_id
```

## Aggregation

Group results and filter groups:

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const orderSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  amount: z.number(),
});

const qc = createQueryComposer(orderSchema, 'orders');

qc.groupBy('user_id')
  .having('COUNT(*)', '>', 5);

const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM orders GROUP BY user_id HAVING COUNT(*) > $1
console.log(values);
// → [5]
```

## Conditional Building

Build queries dynamically:

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  status: z.string(),
  name: z.string(),
});

const qc = createQueryComposer(userSchema, 'users');

const isPremium = true;
qc.when(isPremium, q => q.where({ status__exact: 'premium' }))
  .unless(false, q => q.orderBy('name'));

const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM users WHERE status = $1 ORDER BY name ASC
console.log(values);
// → ['premium']
```

## State Management

Clone and reset composers:

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  status: z.string(),
});

const base = createQueryComposer(userSchema, 'users')
  .where({ status__exact: 'active' });

const copy = base.clone();
copy.paginate({ page: 1, limit: 10 });

const { text: original } = base.toParam();
const { text: copied } = copy.toParam();
console.log('Original:', original);
// → Original: SELECT * FROM users WHERE status = $1
console.log('Copied:', copied);
// → Copied: SELECT * FROM users WHERE status = $1 LIMIT 10 OFFSET 0
```

Reset to initial state:

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
});

const qc = createQueryComposer(userSchema, 'users')
  .where({ id__gt: 10 })
  .orderBy('id');

qc.reset();
const { text } = qc.toParam();
console.log(text);
// → SELECT * FROM users
```

Merge from another composer:

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  status: z.string(),
});

const base = createQueryComposer(userSchema, 'users')
  .where({ status__exact: 'active' });

const extended = createQueryComposer(userSchema, 'users')
  .mergeFrom(base)
  .orderBy('-id');

const { text, values } = extended.toParam();
console.log(text);
// → SELECT * FROM users WHERE status = $1 ORDER BY id DESC
console.log(values);
// → ['active']
```

## Output Methods

Generate SQL with parameters:

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  email: z.string(),
});

const qc = createQueryComposer(userSchema, 'users')
  .where({ email__contains: '@example.com' })
  .paginate({ page: 1, limit: 20 });

const result = qc.toParam();
console.log(result);
// → {
//   text: 'SELECT * FROM users WHERE email LIKE $1 LIMIT 20 OFFSET 0',
//   values: ['%@example.com%']
// }
```

Get count query:

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  status: z.string(),
});

const qc = createQueryComposer(userSchema, 'users')
  .where({ status__exact: 'active' });

const countQuery = qc.toCountParam();
console.log(countQuery);
// → {
//   text: 'SELECT COUNT(*) as count FROM users WHERE status = $1',
//   values: ['active']
// }
```

Get raw SQL:

```typescript
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
});

const qc = createQueryComposer(userSchema, 'users')
  .where({ id__gt: 100 });

const sql = qc.toSQL();
console.log(sql);
// → SELECT * FROM users WHERE id > 100
```
