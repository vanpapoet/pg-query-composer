/**
 * Realistic PostgreSQL Execution Benchmark
 * Connects to Docker PostgreSQL, creates schema with data,
 * runs queries built by pg-query-composer, measures total execution time.
 * Output: single number (ms) on last line — lower is better.
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

// --- Setup ---
async function setupSchema(pool: Pool) {
  await pool.query(`
    DROP TABLE IF EXISTS orders, products, users CASCADE;

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

    CREATE INDEX idx_users_status ON users(status);
    CREATE INDEX idx_users_age ON users(age);
    CREATE INDEX idx_users_email ON users(email);
    CREATE INDEX idx_orders_status ON orders(status);
    CREATE INDEX idx_orders_user_id ON orders(user_id);
    CREATE INDEX idx_products_category ON products(category);
    CREATE INDEX idx_products_stock ON products(stock);
    CREATE INDEX idx_products_price ON products(price);
  `);
}

async function seedData(pool: Pool) {
  const statuses = ['active', 'inactive', 'banned', 'premium'];
  const categories = ['electronics', 'clothing', 'books', 'food', 'toys'];
  const orderStatuses = ['pending', 'completed', 'cancelled', 'refunded'];

  // Seed 10k users
  const userValues: string[] = [];
  for (let i = 1; i <= 10000; i++) {
    const status = statuses[i % statuses.length];
    const age = 18 + (i % 50);
    userValues.push(
      `('user${i}@example.com', 'User ${i}', '${status}', ${age}, NOW() - INTERVAL '${i} hours')`
    );
  }
  // Insert in batches of 2000
  for (let i = 0; i < userValues.length; i += 2000) {
    const batch = userValues.slice(i, i + 2000);
    await pool.query(
      `INSERT INTO users (email, name, status, age, created_at) VALUES ${batch.join(',')}`
    );
  }

  // Seed 50k orders
  const orderValues: string[] = [];
  for (let i = 1; i <= 50000; i++) {
    const userId = (i % 10000) + 1;
    const status = orderStatuses[i % orderStatuses.length];
    const total = (10 + (i % 990)).toFixed(2);
    orderValues.push(
      `(${userId}, ${total}, '${status}', NOW() - INTERVAL '${i} minutes', 'Order note ${i}')`
    );
  }
  for (let i = 0; i < orderValues.length; i += 2000) {
    const batch = orderValues.slice(i, i + 2000);
    await pool.query(
      `INSERT INTO orders (user_id, total, status, created_at, notes) VALUES ${batch.join(',')}`
    );
  }

  // Seed 5k products
  const productValues: string[] = [];
  for (let i = 1; i <= 5000; i++) {
    const category = categories[i % categories.length];
    const price = (5 + (i % 495)).toFixed(2);
    const stock = i % 200;
    productValues.push(
      `('Product ${i}', ${price}, '${category}', ${stock}, 'Description for product ${i}')`
    );
  }
  for (let i = 0; i < productValues.length; i += 2000) {
    const batch = productValues.slice(i, i + 2000);
    await pool.query(
      `INSERT INTO products (name, price, category, stock, description) VALUES ${batch.join(',')}`
    );
  }

  // Analyze for query planner
  await pool.query('ANALYZE users; ANALYZE orders; ANALYZE products;');
}

// --- Benchmark queries ---
type BenchCase = {
  name: string;
  build: () => { text: string; values: unknown[] };
};

const benchCases: BenchCase[] = [
  {
    name: 'simple-where',
    build: () =>
      createQueryComposer(userSchema, 'users')
        .where({ status__exact: 'active' })
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
        .toParam(),
  },
  {
    name: 'or-conditions',
    build: () =>
      createQueryComposer(userSchema, 'users')
        .where({ status__exact: 'active' })
        .or([{ age__gte: 21 }, { status__exact: 'premium' }])
        .toParam(),
  },
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
    name: 'sorting',
    build: () =>
      createQueryComposer(productSchema, 'products')
        .where({ stock__gt: 0 })
        .orderBy('-price')
        .orderBy('name')
        .toParam(),
  },
  {
    name: 'select-fields',
    build: () =>
      createQueryComposer(userSchema, 'users')
        .select(['id', 'name', 'email'])
        .where({ status__exact: 'active' })
        .toParam(),
  },
  {
    name: 'not-conditions',
    build: () =>
      createQueryComposer(userSchema, 'users')
        .not({ status__exact: 'banned', age__lt: 13 })
        .toParam(),
  },
  {
    name: 'join-query',
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
    name: 'group-by-having',
    build: () =>
      createQueryComposer(orderSchema, 'orders')
        .select(['user_id'])
        .groupBy('user_id')
        .having('SUM(total) > ?', [1000])
        .toParam(),
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
];

const ITERATIONS = 100; // queries per case (actual DB round-trips)
const RUNS = 11; // total benchmark runs (odd for clean median)
const WARMUP_PASSES = 5; // warmup passes before measuring (PG plan caching needs 5+)
const TRIM = 2; // discard top/bottom N runs before averaging (trimmed mean)

async function runBenchmark(client: import('pg').PoolClient): Promise<number> {
  let totalMs = 0;

  // Measure: build + execute
  for (const bc of benchCases) {
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      const q = bc.build();
      await client.query(q.text, q.values);
    }
    const elapsed = performance.now() - start;
    totalMs += elapsed;
  }

  return totalMs;
}

async function main() {
  const pool = new Pool({ ...CONNECTION, max: 1 }); // single connection for consistent plan caching

  try {
    // Test connection + get dedicated client
    const client = await pool.connect();

    // Setup
    await client.query('SELECT 1');
    await setupSchema(pool);
    await seedData(pool);

    // Warmup: run multiple passes so PG caches query plans
    for (let w = 0; w < WARMUP_PASSES; w++) {
      for (const bc of benchCases) {
        const q = bc.build();
        await client.query(q.text, q.values);
      }
    }

    // Run benchmark RUNS times
    const results: number[] = [];
    for (let run = 0; run < RUNS; run++) {
      const ms = await runBenchmark(client);
      results.push(ms);
    }
    client.release();

    // Trimmed mean: discard top/bottom TRIM, average the rest
    results.sort((a, b) => a - b);
    const trimmed = results.slice(TRIM, results.length - TRIM);
    const mean = trimmed.reduce((sum, v) => sum + v, 0) / trimmed.length;

    // Output single number: trimmed mean ms rounded to 2 decimals
    console.log(Math.round(mean * 100) / 100);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Benchmark failed:', err.message);
  process.exit(1);
});
