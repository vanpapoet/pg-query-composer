/**
 * Enhanced Benchmark Runner with Snapshot Comparison
 * Measures JS build time, per-case breakdown, and memory footprint.
 * Saves/compares snapshots in benchmarks/snapshots/ directory.
 *
 * Usage:
 *   npx tsx benchmarks/benchmark-runner.ts              # run + compare to last snapshot
 *   npx tsx benchmarks/benchmark-runner.ts --save       # run + save snapshot
 *   npx tsx benchmarks/benchmark-runner.ts --baseline   # run + save as baseline
 */

import { z } from 'zod';
import { createQueryComposer } from '../src/core/query-composer';
import * as fs from 'fs';
import * as path from 'path';

// --- Config ---
const ITERATIONS = 500;
const RUNS = 5;
const TRIM = 1; // discard top/bottom N runs

const SNAPSHOT_DIR = path.join(__dirname, 'snapshots');

// --- Schemas ---
const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  status: z.string(),
  age: z.number(),
  created_at: z.string(),
  metadata: z.any(),
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
  tags: z.any(),
  description: z.string(),
});

// --- Benchmark Cases ---
type BenchCase = { name: string; fn: (n: number) => void };

const benchCases: BenchCase[] = [
  {
    name: 'simple-where',
    fn: (n) => {
      for (let i = 0; i < n; i++) {
        createQueryComposer(userSchema, 'users')
          .where({ status__exact: 'active' })
          .toParam();
      }
    },
  },
  {
    name: 'multi-conditions',
    fn: (n) => {
      for (let i = 0; i < n; i++) {
        createQueryComposer(userSchema, 'users')
          .where({
            status__exact: 'active',
            age__gte: 18,
            email__contains: 'example.com',
            name__startswith: 'J',
          })
          .toParam();
      }
    },
  },
  {
    name: 'or-conditions',
    fn: (n) => {
      for (let i = 0; i < n; i++) {
        createQueryComposer(userSchema, 'users')
          .where({ status__exact: 'active' })
          .or([{ age__gte: 21 }, { status__exact: 'premium' }])
          .toParam();
      }
    },
  },
  {
    name: 'pagination',
    fn: (n) => {
      for (let i = 0; i < n; i++) {
        createQueryComposer(orderSchema, 'orders')
          .where({ status__exact: 'completed' })
          .orderBy('-created_at')
          .paginate({ page: 3, limit: 25 })
          .toParam();
      }
    },
  },
  {
    name: 'sorting',
    fn: (n) => {
      for (let i = 0; i < n; i++) {
        createQueryComposer(productSchema, 'products')
          .where({ stock__gt: 0 })
          .orderBy('-price')
          .orderBy('name')
          .toParam();
      }
    },
  },
  {
    name: 'select-fields',
    fn: (n) => {
      for (let i = 0; i < n; i++) {
        createQueryComposer(userSchema, 'users')
          .select(['id', 'name', 'email'])
          .where({ status__exact: 'active' })
          .toParam();
      }
    },
  },
  {
    name: 'not-conditions',
    fn: (n) => {
      for (let i = 0; i < n; i++) {
        createQueryComposer(userSchema, 'users')
          .not({ status__exact: 'banned', age__lt: 13 })
          .toParam();
      }
    },
  },
  {
    name: 'join',
    fn: (n) => {
      for (let i = 0; i < n; i++) {
        createQueryComposer(orderSchema, 'orders')
          .join('users', 'orders.user_id = users.id')
          .where({ status__exact: 'completed' })
          .toParam();
      }
    },
  },
  {
    name: 'group-by-having',
    fn: (n) => {
      for (let i = 0; i < n; i++) {
        createQueryComposer(orderSchema, 'orders')
          .select(['user_id'])
          .groupBy('user_id')
          .having('SUM(total) > ?', [1000])
          .toParam();
      }
    },
  },
  {
    name: 'complex-composite',
    fn: (n) => {
      for (let i = 0; i < n; i++) {
        createQueryComposer(userSchema, 'users')
          .select(['id', 'name', 'email', 'age'])
          .where({
            status__exact: 'active',
            age__between: [18, 65],
            email__contains: '@company.com',
          })
          .not({ name__isnull: true })
          .or([{ age__gte: 21 }, { status__exact: 'premium' }])
          .orderBy('-created_at')
          .orderBy('name')
          .paginate({ page: 1, limit: 50 })
          .toParam();
      }
    },
  },
  {
    name: 'in-list-large',
    fn: (n) => {
      const ids = Array.from({ length: 50 }, (_, i) => i + 1);
      for (let i = 0; i < n; i++) {
        createQueryComposer(userSchema, 'users')
          .where({ id__in: ids })
          .toParam();
      }
    },
  },
  {
    name: 'deep-chain',
    fn: (n) => {
      for (let i = 0; i < n; i++) {
        createQueryComposer(userSchema, 'users')
          .where({ status__exact: 'active' })
          .where({ age__gte: 18 })
          .where({ age__lte: 65 })
          .where({ email__contains: '@example.com' })
          .where({ name__startswith: 'A' })
          .orderBy('-created_at', 'name', 'email')
          .paginate({ page: 2, limit: 20 })
          .toParam();
      }
    },
  },
];

// --- Runner ---
interface CaseResult {
  name: string;
  ms: number; // trimmed mean ms for ITERATIONS calls
  opsPerSec: number;
}

interface Snapshot {
  timestamp: string;
  totalMs: number;
  iterations: number;
  runs: number;
  heapUsedMB: number;
  cases: CaseResult[];
}

function runBenchmarks(): Snapshot {
  // Warmup
  for (const bc of benchCases) bc.fn(10);

  // Force GC if available
  if (global.gc) global.gc();
  const heapBefore = process.memoryUsage().heapUsed;

  // Run each case RUNS times, take trimmed mean
  const caseResults: CaseResult[] = [];
  let totalMs = 0;

  for (const bc of benchCases) {
    const times: number[] = [];
    for (let r = 0; r < RUNS; r++) {
      const start = performance.now();
      bc.fn(ITERATIONS);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const trimmed = times.slice(TRIM, times.length - TRIM);
    const mean = trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
    const opsPerSec = Math.round((ITERATIONS / mean) * 1000);
    caseResults.push({ name: bc.name, ms: Math.round(mean * 100) / 100, opsPerSec });
    totalMs += mean;
  }

  const heapAfter = process.memoryUsage().heapUsed;
  const heapUsedMB = Math.round(((heapAfter - heapBefore) / 1024 / 1024) * 100) / 100;

  return {
    timestamp: new Date().toISOString(),
    totalMs: Math.round(totalMs * 100) / 100,
    iterations: ITERATIONS,
    runs: RUNS,
    heapUsedMB,
    cases: caseResults,
  };
}

function saveSnapshot(snap: Snapshot, name: string) {
  if (!fs.existsSync(SNAPSHOT_DIR)) fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const filePath = path.join(SNAPSHOT_DIR, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(snap, null, 2));
  console.log(`Snapshot saved: ${filePath}`);
}

function loadSnapshot(name: string): Snapshot | null {
  const filePath = path.join(SNAPSHOT_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function compareSnapshots(current: Snapshot, baseline: Snapshot) {
  const pctChange = ((current.totalMs - baseline.totalMs) / baseline.totalMs) * 100;
  const sign = pctChange > 0 ? '+' : '';
  const emoji = pctChange < -2 ? 'FASTER' : pctChange > 2 ? 'SLOWER' : 'SAME';

  console.log('\n--- Comparison vs Baseline ---');
  console.log(`Baseline: ${baseline.totalMs}ms | Current: ${current.totalMs}ms | Delta: ${sign}${pctChange.toFixed(1)}% [${emoji}]`);
  console.log(`Heap: baseline ${baseline.heapUsedMB}MB | current ${current.heapUsedMB}MB`);
  console.log('');
  console.log('Case                    Baseline    Current     Delta');
  console.log('─'.repeat(60));

  for (const cc of current.cases) {
    const bc = baseline.cases.find((b) => b.name === cc.name);
    if (!bc) {
      console.log(`${cc.name.padEnd(24)} ${'N/A'.padStart(8)}    ${cc.ms.toFixed(2).padStart(8)}ms  NEW`);
      continue;
    }
    const delta = ((cc.ms - bc.ms) / bc.ms) * 100;
    const deltaStr = `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
    console.log(
      `${cc.name.padEnd(24)} ${bc.ms.toFixed(2).padStart(8)}ms  ${cc.ms.toFixed(2).padStart(8)}ms  ${deltaStr.padStart(8)}`
    );
  }
}

function printResults(snap: Snapshot) {
  console.log(`\n--- Benchmark Results (${ITERATIONS} iter × ${RUNS} runs, trimmed ±${TRIM}) ---`);
  console.log(`Total: ${snap.totalMs}ms | Heap delta: ${snap.heapUsedMB}MB`);
  console.log('');
  console.log('Case                        Time      Ops/sec');
  console.log('─'.repeat(50));
  for (const c of snap.cases) {
    console.log(`${c.name.padEnd(24)} ${c.ms.toFixed(2).padStart(8)}ms  ${c.opsPerSec.toLocaleString().padStart(10)}`);
  }
  console.log('');
  // Output single number for CI compatibility
  console.log(snap.totalMs);
}

// --- Main ---
const args = process.argv.slice(2);
const shouldSave = args.includes('--save');
const isBaseline = args.includes('--baseline');

const snapshot = runBenchmarks();
printResults(snapshot);

if (isBaseline) {
  saveSnapshot(snapshot, 'baseline');
} else if (shouldSave) {
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  saveSnapshot(snapshot, `snap-${dateStr}`);
  // Also save as "latest"
  saveSnapshot(snapshot, 'latest');
}

// Compare to baseline if exists
const baseline = loadSnapshot('baseline');
if (baseline && !isBaseline) {
  compareSnapshots(snapshot, baseline);
}
