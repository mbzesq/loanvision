-- Migration: Add S3 storage fields to document_analysis table
-- Date: 2025-07-07
-- Purpose: Track S3 location for uploaded documents

-- Add S3 storage columns to document_analysis table
DO $$ 
BEGIN
    -- Check if columns already exist before adding
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'document_analysis' 
                   AND column_name = 's3_bucket') THEN
        
        ALTER TABLE document_analysis 
        ADD COLUMN s3_bucket VARCHAR(255),
        ADD COLUMN s3_key VARCHAR(500),
        ADD COLUMN s3_url TEXT,
        ADD COLUMN file_size_bytes INTEGER;
        
        -- Add index for S3 key lookups
        CREATE INDEX idx_document_analysis_s3_key ON document_analysis(s3_key);
        
        RAISE NOTICE 'Added S3 storage columns to document_analysis table';
    ELSE
        RAISE NOTICE 'S3 columns already exist in document_analysis table';
    END IF;
END $$;