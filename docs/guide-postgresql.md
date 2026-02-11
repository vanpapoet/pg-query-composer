# PostgreSQL Features Guide

The PostgreSQL module provides native support for JSONB operations, Full-Text Search, and Recursive CTEs.

## JSONB Operations

Work with JSONB columns safely and expressively:

### Containment Operators

```typescript
import { jsonbContains, jsonbContainedBy } from 'pg-query-composer/pg';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const productSchema = z.object({
  id: z.number(),
  attributes: z.record(z.unknown()),
});

const qc = createQueryComposer(productSchema, 'products');

// Check if attributes contain specific values
qc.where(jsonbContains('attributes', { color: 'red', size: 'L' }));
const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM products WHERE attributes @> '{"color":"red","size":"L"}'::jsonb
console.log(values);
// → []
```

### Key Checking

```typescript
import { jsonbHasKey, jsonbHasAllKeys, jsonbHasAnyKey } from 'pg-query-composer/pg';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const configSchema = z.object({
  id: z.number(),
  settings: z.record(z.unknown()),
});

const qc = createQueryComposer(configSchema, 'configs');

// Check for single key
qc.where(jsonbHasKey('settings', 'theme'));

// Check for all keys
qc.where(jsonbHasAllKeys('settings', ['theme', 'language', 'timezone']));

// Check for any key
qc.where(jsonbHasAnyKey('settings', ['darkMode', 'lightMode', 'autoMode']));

const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM configs WHERE settings ? 'theme' AND settings ?& ARRAY['theme','language','timezone'] AND settings ?| ARRAY['darkMode','lightMode','autoMode']
console.log(values);
// → []
```

### Path Extraction

```typescript
import { jsonbPath, jsonbPathText, jsonbExtract, jsonbExtractText } from 'pg-query-composer/pg';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const eventSchema = z.object({
  id: z.number(),
  data: z.record(z.unknown()),
});

const qc = createQueryComposer(eventSchema, 'events');

// Extract value at path
qc.select(['id', jsonbPath('data', ['user', 'name'])]);

// Extract as text
qc.select(['id', jsonbPathText('data', ['user', 'email'])]);

const { text } = qc.toParam();
console.log(text);
// → SELECT id, data #> '["user","name"]', data #>> '["user","email"]' FROM events
```

### Mutation Operations

```typescript
import { jsonbSet } from 'pg-query-composer/pg';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  profile: z.record(z.unknown()),
});

const qc = createQueryComposer(userSchema, 'users');

// Update nested value in JSONB
qc.where(jsonbSet('profile', ['verified'], true));

const { text } = qc.toParam();
console.log(text);
// → SELECT * FROM users WHERE jsonb_set(profile, '["verified"]', 'true')
```

### Iteration Functions

```typescript
import { jsonbArrayElements, jsonbObjectKeys } from 'pg-query-composer/pg';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const inventorySchema = z.object({
  id: z.number(),
  items: z.array(z.unknown()),
  metadata: z.record(z.unknown()),
});

const qc = createQueryComposer(inventorySchema, 'inventory');

// Expand JSONB array to rows
qc.select(['id', jsonbArrayElements('items')]);

// Extract all keys
qc.select(['id', jsonbObjectKeys('metadata')]);

const { text } = qc.toParam();
console.log(text);
// → SELECT id, jsonb_array_elements(items), jsonb_object_keys(metadata) FROM inventory
```

## Full-Text Search

Powerful text search with ranking and highlighting:

### Basic Search

```typescript
import { fullTextSearch, fullTextWebSearch, fullTextRawSearch } from 'pg-query-composer/pg';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const articleSchema = z.object({
  id: z.number(),
  title: z.string(),
  search_vector: z.string(),
});

const qc = createQueryComposer(articleSchema, 'articles');

// Simple search
qc.where(fullTextSearch('search_vector', 'typescript react hooks'));

const { text, values } = qc.toParam();
console.log(text);
// → SELECT * FROM articles WHERE search_vector @@ plainto_tsquery('english', 'typescript react hooks')
console.log(values);
// → []
```

### Web Search Syntax

```typescript
import { fullTextWebSearch } from 'pg-query-composer/pg';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const docSchema = z.object({
  id: z.number(),
  content_vector: z.string(),
});

const qc = createQueryComposer(docSchema, 'documents');

// Google-style search with quotes and exclusion
qc.where(fullTextWebSearch('content_vector', '"query builder" -mongodb'));

const { text } = qc.toParam();
console.log(text);
// → SELECT * FROM documents WHERE content_vector @@ websearch_to_tsquery('english', '"query builder" -mongodb')
```

### Raw TSQuery

```typescript
import { fullTextRawSearch } from 'pg-query-composer/pg';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const pageSchema = z.object({
  id: z.number(),
  search_vec: z.string(),
});

const qc = createQueryComposer(pageSchema, 'pages');

// Advanced tsquery operators: & (AND), | (OR), ! (NOT)
qc.where(fullTextRawSearch('search_vec', 'typescript & (react | vue) & !angular'));

const { text } = qc.toParam();
console.log(text);
// → SELECT * FROM pages WHERE search_vec @@ to_tsquery('english', 'typescript & (react | vue) & !angular')
```

### Ranking Results

```typescript
import { fullTextRank, fullTextRankCd } from 'pg-query-composer/pg';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const blogSchema = z.object({
  id: z.number(),
  content_vector: z.string(),
});

const qc = createQueryComposer(blogSchema, 'blog_posts');

qc.where(fullTextSearch('content_vector', 'postgresql query'))
  .select(['id', fullTextRank('content_vector', 'postgresql query')])
  .orderBy('-rank');

const { text } = qc.toParam();
console.log(text);
// → SELECT id, ts_rank(content_vector, plainto_tsquery('english', 'postgresql query')) FROM blog_posts WHERE content_vector @@ plainto_tsquery('english', 'postgresql query') ORDER BY rank DESC
```

### Vector and Query Builders

```typescript
import { toTsVector, toTsQuery, plainto_tsquery, websearch_to_tsquery } from 'pg-query-composer/pg';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const contentSchema = z.object({
  id: z.number(),
  title: z.string(),
  body: z.string(),
});

const qc = createQueryComposer(contentSchema, 'content');

// Build search vector from multiple columns
qc.select(['id', toTsVector('english', 'title'), toTsVector('english', 'body')]);

// Query conversion
qc.where(plainto_tsquery('english', 'search term'));

const { text } = qc.toParam();
console.log(text);
// → SELECT id, to_tsvector('english', title), to_tsvector('english', body) FROM content WHERE to_tsquery('english', 'search term')
```

## Recursive CTEs

Build hierarchical queries for trees and graphs:

### Basic Recursive CTE

```typescript
import { createRecursiveCTE } from 'pg-query-composer/pg';
import { z } from 'zod';

const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  parent_id: z.number(),
});

// Create recursive CTE for category hierarchy
const cte = createRecursiveCTE('tree', categorySchema);

cte
  .from('categories')
  .baseCase(q => q.where({ parent_id__isnull: true }))
  .recursiveCase('categories', 'tree.id = categories.parent_id')
  .withDepth();

const { text } = cte.build();
console.log(text);
// → WITH RECURSIVE tree AS (SELECT * FROM categories WHERE parent_id IS NULL UNION ALL SELECT * FROM categories INNER JOIN tree ON tree.id = categories.parent_id) SELECT * FROM tree
```

### Depth Limiting

```typescript
import { createRecursiveCTE } from 'pg-query-composer/pg';
import { z } from 'zod';

const orgSchema = z.object({
  id: z.number(),
  name: z.string(),
  manager_id: z.number(),
});

// Limit recursion depth
const cte = createRecursiveCTE('hierarchy', orgSchema);

cte
  .from('employees')
  .baseCase(q => q.where({ manager_id__isnull: true }))
  .recursiveCase('employees', 'hierarchy.id = employees.manager_id')
  .withMaxDepth(5) // Max 5 levels
  .withDepth();

console.log('CTE created with max depth 5');
// → CTE created with max depth 5
```

### Ancestors CTE Helper

```typescript
import { ancestorsCTE } from 'pg-query-composer/pg';
import { z } from 'zod';

const commentSchema = z.object({
  id: z.number(),
  parent_id: z.number(),
  content: z.string(),
});

// Find all ancestors of comment #42
const ancestors = ancestorsCTE('comment_tree', commentSchema, 'comments', 'parent_id');

console.log('Query:', ancestors);
// → WITH RECURSIVE comment_tree AS (
//     SELECT * FROM comments WHERE id = $1
//     UNION ALL
//     SELECT c.* FROM comments c INNER JOIN comment_tree ON c.id = comment_tree.parent_id
//   ) SELECT * FROM comment_tree
```

### Descendants CTE Helper

```typescript
import { descendantsCTE } from 'pg-query-composer/pg';
import { z } from 'zod';

const menuSchema = z.object({
  id: z.number(),
  parent_id: z.number(),
  label: z.string(),
});

// Find all descendants of menu item #10
const descendants = descendantsCTE('menu_tree', menuSchema, 'menus', 'parent_id');

console.log('Query created for descendants');
// → Recursive CTE for finding all descendant items
```

## Real-world Pattern: Product Catalog

JSONB attributes with full-text search and hierarchy:

```typescript
import {
  jsonbContains,
  jsonbPath,
  fullTextSearch,
  ancestorsCTE
} from 'pg-query-composer/pg';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  parent_id: z.number(),
});

const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  category_id: z.number(),
  attributes: z.record(z.unknown()),
  description: z.string(),
  search_vector: z.string(),
});

// Search red size-L products in any subcategory
const qc = createQueryComposer(productSchema, 'products');

qc
  // Filter by JSONB attributes
  .where(jsonbContains('attributes', { color: 'red', size: 'L' }))
  // Full-text search
  .where(fullTextSearch('search_vector', 'organic cotton'))
  // Select fields and extract attribute
  .select(['id', 'name', jsonbPath('attributes', ['price'])])
  // Sort by search relevance
  .orderBy('-_rank')
  .paginate({ page: 1, limit: 20 });

const { text, values } = qc.toParam();
console.log(text);
// → SELECT id, name, attributes #> '["price"]' FROM products
//   WHERE attributes @> '{"color":"red","size":"L"}'::jsonb
//   AND search_vector @@ plainto_tsquery('english', 'organic cotton')
//   ORDER BY _rank DESC LIMIT 20 OFFSET 0
console.log(values);
// → []
```

Alternative with category hierarchy:

```typescript
import { jsonbContains, fullTextSearch, createRecursiveCTE } from 'pg-query-composer/pg';
import { createQueryComposer } from 'pg-query-composer';
import { z } from 'zod';

const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  parent_id: z.number(),
});

const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  category_id: z.number(),
  attributes: z.record(z.unknown()),
  search_vector: z.string(),
});

// Get products in "Electronics > Phones" category and all subcategories
const catCTE = createRecursiveCTE('cat_tree', categorySchema);
catCTE
  .from('categories')
  .baseCase(q => q.where({ name__exact: 'Phones' }))
  .recursiveCase('categories', 'cat_tree.id = categories.parent_id');

// Query products with attributes, FTS, and category hierarchy
const qc = createQueryComposer(productSchema, 'products');

qc
  .join('(WITH RECURSIVE cat_tree AS (...) SELECT id FROM cat_tree)',
        'products.category_id',
        'cat_tree.id')
  .where(jsonbContains('attributes', { in_stock: true }))
  .where(fullTextSearch('search_vector', 'flagship'))
  .orderBy('-id')
  .paginate({ page: 1, limit: 50 });

console.log('Product search with hierarchy complete');
// → Product search with hierarchy complete
```
