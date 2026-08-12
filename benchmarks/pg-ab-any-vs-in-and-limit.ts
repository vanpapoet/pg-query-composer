/**
 * PostgreSQL A/B benchmark for two contested query-shape decisions.
 *
 * A) `IN ($1, $2, ... $N)` vs `= ANY($1)`
 *    The `IN` form emits a different SQL text per list length, so every distinct
 *    cardinality is a separate parse + plan (and a separate entry in node-pg's
 *    and PgBouncer's statement caches). `= ANY` keeps one text for all lengths.
 *    Measured on the realistic pattern: list length varies between calls.
 *
 * B) `LIMIT $n OFFSET $m` vs `LIMIT 25 OFFSET 50`
 *    Parameterized LIMIT hides the row count from the planner, which can drop a
 *    cheap ordered index scan in favour of a full sort. Literal LIMIT lets the
 *    planner cost the early stop — at the price of a distinct plan per page.
 *
 * Assumes the schema/data created by pg-execution-benchmark.ts already exists.
 * Requires: docker compose up -d
 */

import { Pool } from 'pg';

const CONNECTION = {
  host: 'localhost',
  port: 5499,
  user: 'bench',
  password: 'bench',
  database: 'bench',
};

const ITERATIONS = 200;
const RUNS = 5;
const WARMUP = 2;
const TRIM = 1;

type Variant = {
  name: string;
  /** Build the (text, values) pair for call number `i` */
  build: (i: number) => { text: string; values: unknown[] };
};

// ---------------------------------------------------------------------------
// A) IN vs = ANY — list length varies per call, as it does in real batch loads
// ---------------------------------------------------------------------------

// Cardinalities a batch loader realistically cycles through
const LENGTHS = [5, 17, 33, 64, 100, 128, 200, 250];

function idsOfLength(n: number): number[] {
  const ids: number[] = new Array(n);
  for (let i = 0; i < n; i++) ids[i] = i + 1;
  return ids;
}

function placeholderList(n: number): string {
  let s = '$1';
  for (let i = 2; i <= n; i++) s += ', $' + i;
  return s;
}

const inVariants: Variant[] = [
  {
    name: 'IN ($1..$N) — varying length',
    build: (i) => {
      const ids = idsOfLength(LENGTHS[i % LENGTHS.length]);
      return {
        text: `SELECT id, email, status FROM users WHERE id IN (${placeholderList(ids.length)})`,
        values: ids,
      };
    },
  },
  {
    name: '= ANY($1) — varying length',
    build: (i) => {
      const ids = idsOfLength(LENGTHS[i % LENGTHS.length]);
      return {
        text: 'SELECT id, email, status FROM users WHERE id = ANY($1)',
        values: [ids],
      };
    },
  },
  {
    name: 'IN ($1..$N) — fixed length 100',
    build: () => {
      const ids = idsOfLength(100);
      return {
        text: `SELECT id, email, status FROM users WHERE id IN (${placeholderList(100)})`,
        values: ids,
      };
    },
  },
  {
    name: '= ANY($1) — fixed length 100',
    build: () => ({
      text: 'SELECT id, email, status FROM users WHERE id = ANY($1)',
      values: [idsOfLength(100)],
    }),
  },
];

// ---------------------------------------------------------------------------
// B) LIMIT parameterized vs literal
// ---------------------------------------------------------------------------

const PAGES = [1, 3, 7, 12, 40, 100];
const PAGE_SIZE = 25;

const limitVariants: Variant[] = [
  {
    name: 'LIMIT $n OFFSET $m — param',
    build: (i) => {
      const page = PAGES[i % PAGES.length];
      return {
        text:
          'SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        values: ['completed', PAGE_SIZE, (page - 1) * PAGE_SIZE],
      };
    },
  },
  {
    name: 'LIMIT 25 OFFSET n — literal',
    build: (i) => {
      const page = PAGES[i % PAGES.length];
      return {
        text: `SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
        values: ['completed'],
      };
    },
  },
  {
    name: 'LIMIT $n — param, page 1 only',
    build: () => ({
      text: 'SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      values: ['completed', PAGE_SIZE, 0],
    }),
  },
  {
    name: 'LIMIT 25 — literal, page 1 only',
    build: () => ({
      text: `SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC LIMIT ${PAGE_SIZE} OFFSET 0`,
      values: ['completed'],
    }),
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function timeVariant(
  client: import('pg').PoolClient,
  variant: Variant
): Promise<number> {
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const q = variant.build(i);
    await client.query(q.text, q.values);
  }
  return performance.now() - start;
}

function trimmedMean(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const kept = sorted.slice(TRIM, sorted.length - TRIM);
  return kept.reduce((s, v) => s + v, 0) / kept.length;
}

async function runGroup(
  client: import('pg').PoolClient,
  title: string,
  variants: Variant[]
): Promise<{ name: string; mean: number }[]> {
  console.log(`\n=== ${title} ===`);

  for (let w = 0; w < WARMUP; w++) {
    for (const v of variants) await timeVariant(client, v);
  }

  const accum = new Map<string, number[]>(variants.map((v) => [v.name, []]));
  for (let run = 0; run < RUNS; run++) {
    for (const v of variants) {
      accum.get(v.name)!.push(await timeVariant(client, v));
    }
  }

  const results = variants.map((v) => ({
    name: v.name,
    mean: trimmedMean(accum.get(v.name)!),
  }));

  console.log('Variant                             Total (ms)   Per-query (ms)');
  console.log('─'.repeat(66));
  for (const r of results) {
    console.log(
      `${r.name.padEnd(35)} ${r.mean.toFixed(1).padStart(9)}      ${(r.mean / ITERATIONS).toFixed(4).padStart(9)}`
    );
  }

  return results;
}

function reportDelta(
  label: string,
  results: { name: string; mean: number }[],
  baseIdx: number,
  candIdx: number
) {
  const base = results[baseIdx];
  const cand = results[candIdx];
  const delta = ((cand.mean - base.mean) / base.mean) * 100;
  const verdict = delta < 0 ? 'FASTER' : 'SLOWER';
  console.log(
    `${label}: ${cand.name} is ${Math.abs(delta).toFixed(1)}% ${verdict} than ${base.name}`
  );
}

async function explain(client: import('pg').PoolClient, sql: string, values: unknown[]) {
  const res = await client.query(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`, values);
  return res.rows.map((r: Record<string, string>) => r['QUERY PLAN']).join('\n');
}

async function main() {
  const pool = new Pool({ ...CONNECTION, max: 1 });

  try {
    const client = await pool.connect();

    const check = await client.query('SELECT COUNT(*)::int AS n FROM users');
    if (check.rows[0].n === 0) {
      throw new Error('No data — run `npx tsx benchmarks/pg-execution-benchmark.ts` first');
    }
    console.log(`Dataset: ${check.rows[0].n} users, ${ITERATIONS} iter × ${RUNS} runs, trim ±${TRIM}`);

    const inResults = await runGroup(client, 'A) IN ($1..$N) vs = ANY($1)', inVariants);
    console.log('');
    reportDelta('  varying length', inResults, 0, 1);
    reportDelta('  fixed length  ', inResults, 2, 3);

    const limitResults = await runGroup(client, 'B) LIMIT param vs literal', limitVariants);
    console.log('');
    reportDelta('  varying page  ', limitResults, 0, 1);
    reportDelta('  page 1 only   ', limitResults, 2, 3);

    // Plans — the reason the LIMIT numbers come out the way they do
    console.log('\n=== EXPLAIN: LIMIT param ===');
    console.log(
      await explain(
        client,
        'SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        ['completed', PAGE_SIZE, 0]
      )
    );

    console.log('\n=== EXPLAIN: LIMIT literal ===');
    console.log(
      await explain(
        client,
        `SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC LIMIT ${PAGE_SIZE} OFFSET 0`,
        ['completed']
      )
    );

    client.release();
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('A/B benchmark failed:', err.message);
  process.exit(1);
});
