// src/backend/src/config.ts
import dotenv from 'dotenv';
import path from 'path';

// Load .env file only in development
// In production (Render), environment variables are set directly
if (process.env.NODE_ENV !== 'production') {
  // Try multiple paths to find .env file
  const possiblePaths = [
    path.resolve(__dirname, '..', '.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '.env'),
  ];
  
  for (const envPath of possiblePaths) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log(`Loaded .env from: ${envPath}`);
      break;
    }
  }
} else {
  console.log('Production environment - using Render environment variables');
}

// Debug: Log which AWS credentials are available (without exposing values)
console.log('[CONFIG] AWS Environment Variables:', {
  hasAccessKeyId: !!process.env.AWS_ACCESS_KEY_ID,
  accessKeyIdLength: process.env.AWS_ACCESS_KEY_ID?.length || 0,
  hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
  secretKeyLength: process.env.AWS_SECRET_ACCESS_KEY?.length || 0,
  region: process.env.AWS_REGION || 'not set',
  nodeEnv: process.env.NODE_ENV,
  // Check if the values are being trimmed properly
  accessKeyIdFirstChar: process.env.AWS_ACCESS_KEY_ID?.[0] || 'none',
  accessKeyIdLastChar: process.env.AWS_ACCESS_KEY_ID?.slice(-1) || 'none',
  // Check for whitespace issues
  accessKeyIdTrimmed: process.env.AWS_ACCESS_KEY_ID?.trim().length !== process.env.AWS_ACCESS_KEY_ID?.length,
  secretKeyTrimmed: process.env.AWS_SECRET_ACCESS_KEY?.trim().length !== process.env.AWS_SECRET_ACCESS_KEY?.length,
});

// Additional debug: Check all environment variables starting with AWS
console.log('[CONFIG] All AWS-related environment variables:');
Object.keys(process.env).filter(key => key.startsWith('AWS')).forEach(key => {
  console.log(`  ${key}: ${process.env[key] ? 'SET' : 'NOT_SET'} (length: ${process.env[key]?.length || 0})`);
});


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
    region: (process.env.AWS_REGION || 'us-east-1').trim(),
    accessKeyId: (process.env.AWS_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || '').trim(),
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

// Debug: Log the final config values being used (without exposing secrets)
console.log('[CONFIG] Final AWS config being used:', {
  region: config.aws.region,
  hasAccessKeyId: !!config.aws.accessKeyId,
  accessKeyIdLength: config.aws.accessKeyId.length,
  hasSecretAccessKey: !!config.aws.secretAccessKey,
  secretAccessKeyLength: config.aws.secretAccessKey.length,
  accessKeyIdStart: config.aws.accessKeyId.substring(0, 4) || 'NONE',
  accessKeyIdEnd: config.aws.accessKeyId.substring(config.aws.accessKeyId.length - 4) || 'NONE',
});