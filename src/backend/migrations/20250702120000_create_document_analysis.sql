-- Migration: Create document_analysis table and related tables for OCR metadata storage
-- Date: 2025-07-02
-- Purpose: Store AWS Textract OCR results, document classification, and extracted metadata

-- Check if table already exists and skip if it does (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_analysis') THEN
        
        -- Main table for analyzed documents
        CREATE TABLE document_analysis (
            id SERIAL PRIMARY KEY,
            loan_id TEXT NOT NULL,
            file_name TEXT NOT NULL,
            document_type TEXT NOT NULL,
            confidence_score NUMERIC(5,4) NOT NULL, -- 0.0000 to 1.0000
            
            -- Property information
            property_street TEXT,
            property_city TEXT,
            property_state TEXT,
            property_zip TEXT,
            
            -- Borrower information
            borrower_name TEXT,
            co_borrower_name TEXT,
            
            -- Loan details
            loan_amount NUMERIC(15,2),
            origination_date DATE,
            lender_name TEXT,
            
            -- Assignment/transfer fields
            assignor TEXT,
            assignee TEXT,
            assignment_date DATE,
            recording_date DATE,
            instrument_number TEXT,
            
            -- OCR and processing metadata
            ocr_text_blob TEXT, -- Full extracted text for debugging
            extraction_metadata JSONB, -- Confidence scores per field
            processing_time_ms INTEGER,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Performance indexes
        CREATE INDEX idx_document_analysis_loan_id ON document_analysis(loan_id);
        CREATE INDEX idx_document_analysis_document_type ON document_analysis(document_type);
        CREATE INDEX idx_document_analysis_created_at ON document_analysis(created_at);
        CREATE INDEX idx_document_analysis_confidence ON document_analysis(confidence_score);

        RAISE NOTICE 'Created document_analysis table successfully';
        
    ELSE
        RAISE NOTICE 'Table document_analysis already exists, skipping creation';
    END IF;
END $$;

-- Create QA flags table for low-confidence extractions (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_analysis_qa_flags') THEN
        
        CREATE TABLE document_analysis_qa_flags (
            id SERIAL PRIMARY KEY,
            document_analysis_id INTEGER NOT NULL,
            field_name TEXT NOT NULL,
            field_value TEXT,
            confidence_score NUMERIC(5,4) NOT NULL,
            flag_reason TEXT,
            reviewed BOOLEAN DEFAULT FALSE,
            reviewed_at TIMESTAMPTZ,
            reviewed_by TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            
            CONSTRAINT fk_document_analysis_qa
                FOREIGN KEY(document_analysis_id)
                REFERENCES document_analysis(id)
                ON DELETE CASCADE
        );

        CREATE INDEX idx_qa_flags_document_id ON document_analysis_qa_flags(document_analysis_id);
        CREATE INDEX idx_qa_flags_reviewed ON document_analysis_qa_flags(reviewed);

        RAISE NOTICE 'Created document_analysis_qa_flags table successfully';
        
    ELSE
        RAISE NOTICE 'Table document_analysis_qa_flags already exists, skipping creation';
    END IF;
END $$;

-- Create feedback table for ML model training (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_classification_feedback') THEN
        
        CREATE TABLE document_classification_feedback (
            id SERIAL PRIMARY KEY,
            document_analysis_id INTEGER NOT NULL,
            predicted_type TEXT NOT NULL,
            correct_type TEXT,
            feedback_date TIMESTAMPTZ DEFAULT NOW(),
            
            CONSTRAINT fk_document_analysis_feedback
                FOREIGN KEY(document_analysis_id)
                REFERENCES document_analysis(id)
                ON DELETE CASCADE
        );

        CREATE INDEX idx_feedback_document_id ON document_classification_feedback(document_analysis_id);

        RAISE NOTICE 'Created document_classification_feedback table successfully';
        
    ELSE
        RAISE NOTICE 'Table document_classification_feedback already exists, skipping creation';
    END IF;
END $$;

-- Verify table creation
DO $$
BEGIN
    -- Check if all tables were created
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_analysis') AND
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_analysis_qa_flags') AND
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_classification_feedback') THEN
        
        RAISE NOTICE '✅ All document analysis tables created successfully';
        
        -- Test query to verify structure
        PERFORM * FROM document_analysis LIMIT 0;
        RAISE NOTICE '✅ document_analysis table structure verified';
        
    ELSE
        RAISE EXCEPTION '❌ Failed to create one or more document analysis tables';
    END IF;
END $$;