/**
 * Realistic PostgreSQL Execution Benchmark
 * Connects to Docker PostgreSQL, creates schema with realistic data,
 * runs queries built by pg-query-composer, measures total execution time.
 * Output: per-case breakdown + single total number (ms) on last line.
 *
 * Schema: users (50K), orders (100K), products (10K), tags (500),
 *         product_tags (40K) — covers 1-n, n-n relationships
 *
 * Requires: docker-compose up -d
 * Connection: postgresql://bench:bench@localhost:5499/bench
 */

import { Pool } from 'pg';
import { z } from 'zod';
import { createQueryComposer } from '../src/core/query-composer';

const CONNECTION = {
  host: 'localhost',
  port: 5499,
  user: 'bench',
  password: 'bench',
  database: 'bench',
};

// --- Schemas ---
const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  status: z.string(),
  age: z.number(),
  created_at: z.string(),
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
  description: z.string(),
});

const tagSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
});

// --- Setup ---
async function setupSchema(pool: Pool) {
  await pool.query(`
    DROP TABLE IF EXISTS product_tags, orders, products, tags, users CASCADE;

    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL,
      age INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      deleted_at TIMESTAMP
    );

    CREATE TABLE orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      total NUMERIC(10,2) NOT NULL,
      status VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      deleted_at TIMESTAMP,
      notes TEXT DEFAULT ''
    );

    CREATE TABLE products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      category VARCHAR(100) NOT NULL,
      stock INTEGER NOT NULL,
      description TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      deleted_at TIMESTAMP
    );

    CREATE TABLE tags (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE product_tags (
      product_id INTEGER REFERENCES products(id),
      tag_id INTEGER REFERENCES tags(id),
      PRIMARY KEY (product_id, tag_id)
    );

    -- Single-column indexes
    CREATE INDEX idx_users_status ON users(status);
    CREATE INDEX idx_users_age ON users(age);
    CREATE INDEX idx_users_email ON users(email);
    CREATE INDEX idx_orders_status ON orders(status);
    CREATE INDEX idx_orders_user_id ON orders(user_id);
    CREATE INDEX idx_products_category ON products(category);
    CREATE INDEX idx_products_stock ON products(stock);
    CREATE INDEX idx_products_price ON products(price);

    -- Composite indexes for common query patterns
    CREATE INDEX idx_users_status_age ON users(status, age);
    CREATE INDEX idx_orders_user_status ON orders(user_id, status);
    CREATE INDEX idx_orders_status_created ON orders(status, created_at DESC);
    CREATE INDEX idx_products_cat_price ON products(category, price);
  `);
}

async function seedData(pool: Pool) {
  const statuses = ['active', 'inactive', 'banned', 'premium'];
  const categories = ['electronics', 'clothing', 'books', 'food', 'toys', 'sports', 'beauty', 'home'];
  const orderStatuses = ['pending', 'completed', 'cancelled', 'refunded'];

  // Seed 50K users
  for (let batch = 0; batch < 25; batch++) {
    const values: string[] = [];
    for (let i = 0; i < 2000; i++) {
      const n = batch * 2000 + i + 1;
      const status = statuses[n % statuses.length];
      const age = 18 + (n % 50);
      values.push(
        `('user${n}@example.com', 'User ${n}', '${status}', ${age}, NOW() - INTERVAL '${n} hours')`
      );
    }
    await pool.query(
      `INSERT INTO users (email, name, status, age, created_at) VALUES ${values.join(',')}`
    );
  }

  // Seed 100K orders
  for (let batch = 0; batch < 50; batch++) {
    const values: string[] = [];
    for (let i = 0; i < 2000; i++) {
      const n = batch * 2000 + i + 1;
      const userId = (n % 50000) + 1;
      const status = orderStatuses[n % orderStatuses.length];
      const total = (10 + (n % 990)).toFixed(2);
      values.push(
        `(${userId}, ${total}, '${status}', NOW() - INTERVAL '${n} minutes', 'Note ${n}')`
      );
    }
    await pool.query(
      `INSERT INTO orders (user_id, total, status, created_at, notes) VALUES ${values.join(',')}`
    );
  }

  // Seed 10K products
  for (let batch = 0; batch < 5; batch++) {
    const values: string[] = [];
    for (let i = 0; i < 2000; i++) {
      const n = batch * 2000 + i + 1;
      const category = categories[n % categories.length];
      const price = (5 + (n % 495)).toFixed(2);
      const stock = n % 200;
      values.push(
        `('Product ${n}', ${price}, '${category}', ${stock}, 'Desc ${n}')`
      );
    }
    await pool.query(
      `INSERT INTO products (name, price, category, stock, description) VALUES ${values.join(',')}`
    );
  }

  // Seed 500 tags
  const tagValues: string[] = [];
  for (let i = 1; i <= 500; i++) {
    tagValues.push(`('Tag ${i}', 'tag-${i}')`);
  }
  await pool.query(`INSERT INTO tags (name, slug) VALUES ${tagValues.join(',')}`);

  // Seed 40K product_tags (n-n)
  for (let batch = 0; batch < 20; batch++) {
    const values: string[] = [];
    for (let i = 0; i < 2000; i++) {
      const n = batch * 2000 + i;
      const productId = (n % 10000) + 1;
      const tagId = (n % 500) + 1;
      values.push(`(${productId}, ${tagId})`);
    }
    await pool.query(
      `INSERT INTO product_tags (product_id, tag_id) VALUES ${values.join(',')} ON CONFLICT DO NOTHING`
    );
  }

  // Analyze all tables for query planner
  await pool.query('ANALYZE users; ANALYZE orders; ANALYZE products; ANALYZE tags; ANALYZE product_tags;');
}

// --- Benchmark queries ---
type BenchCase = {
  name: string;
  build: () => { text: string; values: unknown[] };
};

const benchCases: BenchCase[] = [
  // --- Simple queries (all paginated to bound result size) ---
  {
    name: 'simple-where',
    build: () =>
      createQueryComposer(userSchema, 'users')
        .where({ status__exact: 'active' })
        .paginate({ page: 1, limit: 50 })
        .toParam(),
  },
  {
    name: 'multi-conditions',
    build: () =>
      createQueryComposer(userSchema, 'users')
        .where({
          status__exact: 'active',
          age__gte: 18,
          email__contains: 'example.com',
          name__startswith: 'User 1',
        })
        .paginate({ page: 1, limit: 50 })
        .toParam(),
  },
  {
    name: 'or-conditions',
    build: () =>
      createQueryComposer(userSchema, 'users')
        .where({ status__exact: 'active' })
        .or([{ age__gte: 21 }, { status__exact: 'premium' }])
        .paginate({ page: 1, limit: 50 })
        .toParam(),
  },

  // --- Pagination & sorting ---
  {
    name: 'pagination',
    build: () =>
      createQueryComposer(orderSchema, 'orders')
        .where({ status__exact: 'completed' })
        .orderBy('-created_at')
        .paginate({ page: 3, limit: 25 })
        .toParam(),
  },
  {
    name: 'high-offset-pagination',
    build: () =>
      createQueryComposer(orderSchema, 'orders')
        .where({ status__exact: 'completed' })
        .orderBy('-created_at')
        .paginate({ page: 100, limit: 25 })
        .toParam(),
  },

  // --- Joins ---
  {
    name: 'inner-join',
    build: () =>
      createQueryComposer(orderSchema, 'orders', { extraColumns: ['orders.id', 'orders.status', 'orders.created_at'] })
        .select(['orders.id', 'user_id', 'total', 'orders.status'])
        .join('users', 'orders.user_id = users.id')
        .where({ 'orders.status__exact': 'completed' })
        .orderBy('-orders.created_at')
        .paginate({ page: 1, limit: 50 })
        .toParam(),
  },
  {
    name: 'left-join',
    build: () =>
      createQueryComposer(userSchema, 'users', { extraColumns: ['users.id', 'users.name', 'users.status'] })
        .select(['users.id', 'users.name'])
        .leftJoin('orders', 'orders.user_id = users.id')
        .where({ 'users.status__exact': 'premium' })
        .paginate({ page: 1, limit: 50 })
        .toParam(),
  },
  {
    name: 'multi-join',
    build: () =>
      createQueryComposer(productSchema, 'products', {
        extraColumns: ['products.id', 'products.name', 'products.price'],
      })
        .select(['products.id', 'products.name', 'products.price'])
        .join('product_tags pt', 'pt.product_id = products.id')
        .join('tags t', 't.id = pt.tag_id')
        .where({ category__exact: 'electronics' })
        .paginate({ page: 1, limit: 20 })
        .toParam(),
  },

  // --- Aggregation ---
  {
    name: 'count-aggregate',
    build: () =>
      createQueryComposer(orderSchema, 'orders')
        .select(['status'])
        .groupBy('status')
        .paginate({ page: 1, limit: 10 })
        .toParam(),
  },
  {
    name: 'sum-having',
    build: () =>
      createQueryComposer(orderSchema, 'orders')
        .select(['user_id'])
        .groupBy('user_id')
        .having('SUM(total) > ?', [5000])
        .paginate({ page: 1, limit: 50 })
        .toParam(),
  },
  {
    name: 'avg-group-by',
    build: () =>
      createQueryComposer(productSchema, 'products')
        .select(['category'])
        .groupBy('category')
        .having('AVG(price) > ?', [100])
        .orderBy('category')
        .paginate({ page: 1, limit: 20 })
        .toParam(),
  },

  // --- Complex / mixed ---
  {
    name: 'nested-and-or',
    build: () =>
      createQueryComposer(userSchema, 'users')
        .where({ status__exact: 'active', age__gte: 18 })
        .or([
          { age__between: [25, 35] },
          { email__contains: 'premium' },
        ])
        .not({ name__isnull: true })
        .paginate({ page: 1, limit: 50 })
        .toParam(),
  },
  {
    name: 'large-in-list',
    build: () => {
      const ids = Array.from({ length: 100 }, (_, i) => i + 1);
      return createQueryComposer(userSchema, 'users')
        .where({ id__in: ids })
        .paginate({ page: 1, limit: 50 })
        .toParam();
    },
  },
  {
    name: 'complex-composite',
    build: () =>
      createQueryComposer(userSchema, 'users')
        .select(['id', 'name', 'email', 'age'])
        .where({
          status__exact: 'active',
          age__between: [18, 65],
          email__contains: '@example.com',
        })
        .not({ name__isnull: true })
        .or([{ age__gte: 21 }, { status__exact: 'premium' }])
        .orderBy('-created_at')
        .orderBy('name')
        .paginate({ page: 1, limit: 50 })
        .toParam(),
  },
  {
    name: 'not-conditions',
    build: () =>
      createQueryComposer(userSchema, 'users')
        .not({ status__exact: 'banned', age__lt: 13 })
        .paginate({ page: 1, limit: 50 })
        .toParam(),
  },
];

const ITERATIONS = 20;  // queries per case (actual DB round-trips)
const RUNS = 5;         // total benchmark runs (odd for clean median)
const WARMUP_PASSES = 3; // warmup passes for PG plan caching
const TRIM = 1;         // discard top/bottom N runs

async function runBenchmark(client: import('pg').PoolClient): Promise<{ total: number; cases: { name: string; ms: number }[] }> {
  let totalMs = 0;
  const cases: { name: string; ms: number }[] = [];

  for (const bc of benchCases) {
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      const q = bc.build();
      await client.query(q.text, q.values);
    }
    const elapsed = performance.now() - start;
    totalMs += elapsed;
    cases.push({ name: bc.name, ms: elapsed });
  }

  return { total: totalMs, cases };
}

async function main() {
  // Setup phase: use separate pool for DDL + seeding
  const setupPool = new Pool({ ...CONNECTION, max: 2 });
  console.log('Setting up schema...');
  await setupSchema(setupPool);
  console.log('Seeding data (50K users, 100K orders, 10K products, 500 tags, 40K product_tags)...');
  await seedData(setupPool);
  await setupPool.end();
  console.log('Seed complete. Running warmup...');

  // Benchmark phase: single connection for consistent plan caching
  const pool = new Pool({ ...CONNECTION, max: 1 });

  try {
    const client = await pool.connect();

    // Warmup
    for (let w = 0; w < WARMUP_PASSES; w++) {
      for (const bc of benchCases) {
        const q = bc.build();
        await client.query(q.text, q.values);
      }
      console.log(`  warmup pass ${w + 1}/${WARMUP_PASSES} done`);
    }

    // Run benchmark
    const allResults: number[] = [];
    const caseAccum = new Map<string, number[]>();

    console.log(`Running ${RUNS} benchmark passes...`);
    for (let run = 0; run < RUNS; run++) {
      const result = await runBenchmark(client);
      allResults.push(result.total);
      console.log(`  run ${run + 1}/${RUNS}: ${result.total.toFixed(0)}ms`);
      for (const c of result.cases) {
        if (!caseAccum.has(c.name)) caseAccum.set(c.name, []);
        caseAccum.get(c.name)!.push(c.ms);
      }
    }
    client.release();

    // Trimmed mean for total
    allResults.sort((a, b) => a - b);
    const trimmedTotal = allResults.slice(TRIM, allResults.length - TRIM);
    const meanTotal = trimmedTotal.reduce((s, v) => s + v, 0) / trimmedTotal.length;

    // Per-case trimmed mean
    console.log(`\n--- PG Execution Benchmark (${ITERATIONS} iter × ${RUNS} runs, trim ±${TRIM}) ---`);
    console.log(`Data: 50K users, 100K orders, 10K products, 40K product_tags`);
    console.log('');
    console.log('Case                         Time (ms)    Per-query (ms)');
    console.log('─'.repeat(58));

    for (const bc of benchCases) {
      const times = caseAccum.get(bc.name)!;
      times.sort((a, b) => a - b);
      const trimmed = times.slice(TRIM, times.length - TRIM);
      const mean = trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
      const perQuery = mean / ITERATIONS;
      console.log(
        `${bc.name.padEnd(28)} ${mean.toFixed(1).padStart(8)}      ${perQuery.toFixed(3).padStart(8)}`
      );
    }

    console.log('');
    console.log(`Total: ${Math.round(meanTotal * 100) / 100}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Benchmark failed:', err.message);
  process.exit(1);
});
