// src/backend/src/config.ts
import dotenv from 'dotenv';
import path from 'path';

// Correctly resolve the path to the .env file in the backend root
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });