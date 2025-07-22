// src/backend/src/db.ts
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', (client) => {
  // Only log on initial pool creation, not every connection
  // console.log('[Database] New connection established');
});

// Log pool creation once
console.log('[Database] Connection pool initialized');

export default pool;