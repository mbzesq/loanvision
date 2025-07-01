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
  
  // AWS Configuration
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  
  // Security
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  
  // Feature Flags
  features: {
    enablePdfStorage: process.env.ENABLE_PDF_STORAGE === 'true',
    enableQaReview: process.env.ENABLE_QA_REVIEW !== 'false',
    lowConfidenceThreshold: parseFloat(process.env.LOW_CONFIDENCE_THRESHOLD || '0.7'),
  },
  
  // Server configuration
  port: parseInt(process.env.PORT || '3001'),
  
  // JWT configuration
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
};