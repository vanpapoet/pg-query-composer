# Relations Guide

The relations module provides model definitions, eager loading, batch loading with DataLoader, and N+1 prevention for complex data hierarchies.

## Defining Models

Define models with schemas and relation configurations:

```typescript
import { defineModel } from 'pg-query-composer/relations';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  company_id: z.number(),
});

const companySchema = z.object({
  id: z.number(),
  name: z.string(),
});

// Define User model with relations
const User = defineModel({
  name: 'User',
  table: 'users',
  schema: userSchema,
  primaryKey: 'id',
  relations: {
    company: {
      type: 'belongsTo',
      target: 'companies',
      foreignKey: 'company_id',
      primaryKey: 'id',
    },
  },
});

console.log(User.name);
// → User
console.log(User.table);
// → users
```

### Relation Types

Define all four relation types:

```typescript
import { defineModel } from 'pg-query-composer/relations';
import { z } from 'zod';

const companySchema = z.object({
  id: z.number(),
  name: z.string(),
});

const userSchema = z.object({
  id: z.number(),
  company_id: z.number(),
});

const profileSchema = z.object({
  id: z.number(),
  user_id: z.number(),
});

const postSchema = z.object({
  id: z.number(),
  author_id: z.number(),
});

// Define Company with multiple relation types
const Company = defineModel({
  name: 'Company',
  table: 'companies',
  schema: companySchema,
  relations: {
    // One-to-many
    users: {
      type: 'hasMany',
      target: 'users',
      foreignKey: 'company_id',
      primaryKey: 'id',
    },
    // One-to-one
    ceo: {
      type: 'hasOne',
      target: 'users',
      foreignKey: 'company_id',
      primaryKey: 'id',
    },
  },
});

const User = defineModel({
  name: 'User',
  table: 'users',
  schema: userSchema,
  relations: {
    // Many-to-one
    company: {
      type: 'belongsTo',
      target: 'companies',
      foreignKey: 'company_id',
      primaryKey: 'id',
    },
    // One-to-one
    profile: {
      type: 'hasOne',
      target: 'profiles',
      foreignKey: 'user_id',
      primaryKey: 'id',
    },
    // One-to-many through
    posts: {
      type: 'hasManyThrough',
      target: 'posts',
      throughTable: 'user_posts',
      foreignKey: 'user_id',
      throughForeignKey: 'post_id',
      primaryKey: 'id',
    },
  },
});

console.log('Models defined');
// → Models defined
```

### Model Registry

Access and manage registered models:

```typescript
import { defineModel, getModel, getAllModels, clearModelRegistry } from 'pg-query-composer/relations';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
});

const User = defineModel({
  name: 'User',
  table: 'users',
  schema: userSchema,
});

// Get specific model
const retrieved = getModel('User');
console.log(retrieved?.name);
// → User

// Get all models
const all = getAllModels();
console.log(all.length);
// → 1

// Clear registry
clearModelRegistry();
const empty = getAllModels();
console.log(empty.length);
// → 0
```

## Eager Loading

Load related data efficiently with include():

```typescript
import { defineModel, createModelQuery } from 'pg-query-composer/relations';
import { z } from 'zod';

const companySchema = z.object({
  id: z.number(),
  name: z.string(),
});

const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  company_id: z.number(),
});

const Company = defineModel({
  name: 'Company',
  table: 'companies',
  schema: companySchema,
});

const User = defineModel({
  name: 'User',
  table: 'users',
  schema: userSchema,
  relations: {
    company: {
      type: 'belongsTo',
      target: 'companies',
      foreignKey: 'company_id',
      primaryKey: 'id',
    },
  },
});

// Create model query
const query = createModelQuery(User);

// Include company relation
query.include('company');

const { text, values } = query.toParam();
console.log(text);
// → SELECT * FROM users INNER JOIN companies ON users.company_id = companies.id
console.log(values);
// → []
```

### Include with Filtering

Filter related data during eager loading:

```typescript
import { defineModel, createModelQuery } from 'pg-query-composer/relations';
import { z } from 'zod';

const companySchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.string(),
});

const userSchema = z.object({
  id: z.number(),
  company_id: z.number(),
});

const Company = defineModel({
  name: 'Company',
  table: 'companies',
  schema: companySchema,
});

const User = defineModel({
  name: 'User',
  table: 'users',
  schema: userSchema,
  relations: {
    company: {
      type: 'belongsTo',
      target: 'companies',
      foreignKey: 'company_id',
      primaryKey: 'id',
    },
  },
});

const query = createModelQuery(User);

// Include takes a CALLBACK that receives the relation's own composer
query.include('company', (qc) => qc.where({ status__exact: 'active' }));

// The parent query is unchanged — includes never add a JOIN to it
console.log(query.toParam().text);
// → SELECT * FROM users

// The relation query is returned separately
console.log(query.getIncludeQueries());
// → [{ relation: 'company', type: 'belongsTo',
//      foreignKey: 'company_id', primaryKey: 'id',
//      query: { text: 'SELECT * FROM companies WHERE status = $1',
//               values: ['active'] } }]
```

Pass `targetSchema` on the relation to give that relation query its own column
whitelist; without one it falls back to a non-strict composer, because there is
no schema to validate the filters against.

The parent-key predicate is not part of `getIncludeQueries()` output — combine it
with the returned `foreignKey` / `primaryKey`, or use `loadRelation()` (below),
which builds the key restriction itself but does not apply the callback.

### Multi-level Loading

There is no nested-include syntax — depth is expressed by calling
`loadRelation()` once per level, which is also what keeps the query count at one
per level instead of one per row:

```typescript
import { defineModel, createModelQuery } from 'pg-query-composer/relations';
import { z } from 'zod';

const countrySchema = z.object({
  id: z.number(),
  name: z.string(),
});

const companySchema = z.object({
  id: z.number(),
  name: z.string(),
  country_id: z.number(),
});

const userSchema = z.object({
  id: z.number(),
  company_id: z.number(),
});

const Country = defineModel({
  name: 'Country',
  table: 'countries',
  schema: countrySchema,
});

const Company = defineModel({
  name: 'Company',
  table: 'companies',
  schema: companySchema,
  relations: {
    country: {
      type: 'belongsTo',
      target: 'countries',
      foreignKey: 'country_id',
      primaryKey: 'id',
    },
  },
});

const User = defineModel({
  name: 'User',
  table: 'users',
  schema: userSchema,
  relations: {
    company: {
      type: 'belongsTo',
      target: 'companies',
      foreignKey: 'company_id',
      primaryKey: 'id',
    },
  },
});

const execute = async ({ text, values }) => (await pool.query(text, values)).rows;

// Level 0: the users
const users = await execute(createModelQuery(User).toParam());
// → SELECT * FROM users

// Level 1: their companies (one query for all users)
const withCompany = await loadRelation(users, User, 'company', execute);
// → SELECT * FROM companies WHERE id = ANY($1)

// Level 2: the companies' countries (one query for all companies)
const companies = withCompany.map((u) => u.company).filter(Boolean);
await loadRelation(companies, Company, 'country', execute);
// → SELECT * FROM countries WHERE id = ANY($1)
```

## Batch Loading

Prevent N+1 queries using DataLoader:

```typescript
import { defineModel, createRelationLoader } from 'pg-query-composer/relations';
import { z } from 'zod';

const postSchema = z.object({
  id: z.number(),
  author_id: z.number(),
  title: z.string(),
});

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const User = defineModel({
  name: 'User',
  table: 'users',
  schema: userSchema,
});

const Post = defineModel({
  name: 'Post',
  table: 'posts',
  schema: postSchema,
  relations: {
    author: {
      type: 'belongsTo',
      target: 'users',
      foreignKey: 'author_id',
      primaryKey: 'id',
    },
  },
});

// Create batch loader (simplified executor)
const authorLoader = createRelationLoader(
  Post,
  'author',
  async (query) => {
    console.log('Executing batch query:', query.text);
    return [];
  }
);

// Load multiple authors (batches into single query)
authorLoader.load('1');
authorLoader.load('2');
authorLoader.load('3');

console.log('Loader created');
// → Loader created
```

### Batch Load Utilities

```typescript
import { groupByKey, batchLoadBelongsTo } from 'pg-query-composer/relations';
import { z } from 'zod';

const posts = [
  { id: 1, author_id: 1, title: 'Post 1' },
  { id: 2, author_id: 1, title: 'Post 2' },
  { id: 3, author_id: 2, title: 'Post 3' },
];

// Group posts by author_id
const byAuthor = groupByKey(posts, 'author_id');
console.log(byAuthor.get(1)?.length);
// → 2
console.log(byAuthor.get(2)?.length);
// → 1
```

### Load Relations on Existing Data

```typescript
import { defineModel, loadRelation } from 'pg-query-composer/relations';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const postSchema = z.object({
  id: z.number(),
  author_id: z.number(),
  title: z.string(),
});

const User = defineModel({
  name: 'User',
  table: 'users',
  schema: userSchema,
});

const Post = defineModel({
  name: 'Post',
  table: 'posts',
  schema: postSchema,
  relations: {
    author: {
      type: 'belongsTo',
      target: 'users',
      foreignKey: 'author_id',
      primaryKey: 'id',
    },
  },
});

// Existing post rows — loadRelation takes an ARRAY, the model, the relation
// name and an executor (a function that runs { text, values } and returns rows)
const posts = [{ id: 1, author_id: 42, title: 'Query Guide' }];

const execute = async ({ text, values }) => (await pool.query(text, values)).rows;

const enriched = await loadRelation(posts, Post, 'author', execute);
// SELECT * FROM users WHERE id = ANY($1)   |   [[42]]
// → [{ id: 1, author_id: 42, title: 'Query Guide', author: { id: 42, ... } }]
```

`belongsTo` / `hasOne` set the relation to a single record (or `null`);
`hasMany` / `hasManyThrough` set it to an array.

## Real-world Pattern: Blog App with Eager Loading

Multi-level eager loading with filtering:

```typescript
import { defineModel, createModelQuery } from 'pg-query-composer/relations';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  status: z.string(),
});

const postSchema = z.object({
  id: z.number(),
  author_id: z.number(),
  title: z.string(),
  status: z.string(),
});

const commentSchema = z.object({
  id: z.number(),
  post_id: z.number(),
  author_id: z.number(),
  content: z.string(),
});

const User = defineModel({
  name: 'User',
  table: 'users',
  schema: userSchema,
});

const Post = defineModel({
  name: 'Post',
  table: 'posts',
  schema: postSchema,
  relations: {
    author: {
      type: 'belongsTo',
      target: 'users',
      foreignKey: 'author_id',
      primaryKey: 'id',
    },
    comments: {
      type: 'hasMany',
      target: 'comments',
      foreignKey: 'post_id',
      primaryKey: 'id',
    },
  },
});

const Comment = defineModel({
  name: 'Comment',
  table: 'comments',
  schema: commentSchema,
  relations: {
    author: {
      type: 'belongsTo',
      target: 'users',
      foreignKey: 'author_id',
      primaryKey: 'id',
    },
    post: {
      type: 'belongsTo',
      target: 'posts',
      foreignKey: 'post_id',
      primaryKey: 'id',
    },
  },
});

// Query: published posts, page 1 — then their authors and comments
const query = createModelQuery(Post)
  .where({ status__exact: 'published' })
  .orderBy('-created_at')
  .paginate({ page: 1, limit: 10 });

const { text, values } = query.toParam();
console.log(text);
// → SELECT * FROM posts WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3
console.log(values);
// → ['published', 10, 0]

const execute = async (q) => (await pool.query(q.text, q.values)).rows;

const posts = await execute({ text, values });

// 2 more queries total — not 2 per post
const withAuthors = await loadRelation(posts, Post, 'author', execute);
const withComments = await loadRelation(withAuthors, Post, 'comments', execute);

// Third level: each comment's author (1 query for every comment on the page)
const comments = withComments.flatMap((p) => p.comments);
await loadRelation(comments, Comment, 'author', execute);
```

Four queries for a page of posts + authors + comments + comment authors,
regardless of how many rows come back.
