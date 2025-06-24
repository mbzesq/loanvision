// src/backend/src/db.ts
import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables directly within this module
dotenv.config({ path: require('path').resolve(__dirname, './.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', () => {
  console.log('[Database] Connected to the database pool.');
});

pool.on('error', (err) => {
  console.error('[Database] Idle client error', err.message, err.stack);
});

export default pool;