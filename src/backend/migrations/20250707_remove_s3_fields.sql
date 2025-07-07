-- Migration: Remove S3 storage fields from document_analysis table
-- Date: 2025-07-07
-- Purpose: Remove S3 tracking fields since documents are now temporary and cleaned up after processing

-- Remove S3 storage columns from document_analysis table
DO $$ 
BEGIN
    -- Check if columns exist before removing
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'document_analysis' 
               AND column_name = 's3_bucket') THEN
        
        -- Drop the index first
        DROP INDEX IF EXISTS idx_document_analysis_s3_key;
        
        -- Remove S3-related columns
        ALTER TABLE document_analysis 
        DROP COLUMN IF EXISTS s3_bucket,
        DROP COLUMN IF EXISTS s3_key,
        DROP COLUMN IF EXISTS s3_url;
        
        RAISE NOTICE 'Removed S3 storage columns from document_analysis table';
    ELSE
        RAISE NOTICE 'S3 columns do not exist in document_analysis table';
    END IF;
END $$;