import { Pool, PoolClient } from 'pg';

import { DATABASE_URL, DATABASE_USE_SSL } from '../utils/secrets';

export const pool = new Pool({
  application_name: 'ixo-feegrant-nest',
  connectionString: DATABASE_URL,
  max: 10,
  min: 1,
  // connectionTimeoutMillis: 4000,
  ...(DATABASE_USE_SSL && { ssl: { rejectUnauthorized: false } }),
});

export const withTransaction = async <T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await fn(client);
    await client.query('COMMIT');
    return res;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const withQuery = async <T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
};
