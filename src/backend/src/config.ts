// src/backend/src/config.ts
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(__dirname, '../../../.env.local');
console.log(`[DEBUG] Attempting to load env file from: ${envPath}`);

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('[DEBUG] dotenv error:', result.error);
} else {
  console.log('[DEBUG] dotenv loaded successfully');
  console.log(`[DEBUG] DATABASE_URL in process.env: ${process.env.DATABASE_URL}`);
}


