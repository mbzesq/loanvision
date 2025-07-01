// src/backend/src/config.ts
import dotenv from 'dotenv';
import path from 'path';

// Correctly resolve the path to the .env file in the backend root
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export const config = {
  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'loanvision',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },
  
  // API Keys
  rentcastApiKey: process.env.RENTCAST_API_KEY,
  collateralAnalysisApiUrl: process.env.COLLATERAL_ANALYSIS_API_URL,
  
  // Server configuration
  port: parseInt(process.env.PORT || '3001'),
  
  // JWT configuration
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
};