import { Pool, PoolConfig } from 'pg';

// Connection pool configuration
// We use the same DATABASE_URL but query the ponder schema
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create singleton pool
let pool: Pool | null = null;

export function getPonderPool(): Pool {
  if (!pool) {
    pool = new Pool(poolConfig);

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle Ponder client', err);
    });
  }

  return pool;
}

// Helper function to execute queries in ponder schema
export async function queryPonder<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const pool = getPonderPool();

  // Set search_path to query ponder schema
  await pool.query('SET search_path TO ponder, public');

  const result = await pool.query(text, params);
  return result.rows;
}

// Alternative: Explicitly prefix table names with schema
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const pool = getPonderPool();
  const result = await pool.query(text, params);
  return result.rows;
}

// Close pool (for graceful shutdown)
export async function closePonderPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
