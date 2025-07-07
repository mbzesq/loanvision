-- Migration: Add back file_size_bytes column
-- Date: 2025-07-07
-- Purpose: Re-add file_size_bytes column that was accidentally removed

-- Add file_size_bytes column if it doesn't exist
DO $$ 
BEGIN
    -- Check if column exists before adding
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'document_analysis' 
                   AND column_name = 'file_size_bytes') THEN
        
        ALTER TABLE document_analysis 
        ADD COLUMN file_size_bytes INTEGER;
        
        RAISE NOTICE 'Added file_size_bytes column to document_analysis table';
    ELSE
        RAISE NOTICE 'file_size_bytes column already exists in document_analysis table';
    END IF;
END $$;