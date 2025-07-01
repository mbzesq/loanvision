import { Pool } from 'pg';

export const up = async (pool: Pool): Promise<void> => {
  await pool.query(`
    -- Main table for analyzed documents
    CREATE TABLE document_analysis (
      id SERIAL PRIMARY KEY,
      loan_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      document_type TEXT NOT NULL,
      confidence_score NUMERIC(5,4) NOT NULL, -- 0.0000 to 1.0000
      
      -- Common fields
      property_street TEXT,
      property_city TEXT,
      property_state TEXT,
      property_zip TEXT,
      
      -- Note/Mortgage specific fields
      borrower_name TEXT,
      co_borrower_name TEXT,
      loan_amount NUMERIC(15,2),
      origination_date DATE,
      lender_name TEXT,
      
      -- Assignment specific fields
      assignor TEXT,
      assignee TEXT,
      assignment_date DATE,
      recording_date DATE,
      instrument_number TEXT,
      
      -- Metadata
      ocr_text_blob TEXT, -- Full extracted text for debugging
      extraction_metadata JSONB, -- Confidence scores per field
      processing_time_ms INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      
      -- Foreign key
      CONSTRAINT fk_loan
        FOREIGN KEY(loan_id)
        REFERENCES daily_metrics_current(loan_id)
        ON DELETE CASCADE
    );

    -- Indexes for performance
    CREATE INDEX idx_document_analysis_loan_id ON document_analysis(loan_id);
    CREATE INDEX idx_document_analysis_document_type ON document_analysis(document_type);
    CREATE INDEX idx_document_analysis_created_at ON document_analysis(created_at);
    CREATE INDEX idx_document_analysis_confidence ON document_analysis(confidence_score);

    -- Table for tracking low-confidence extractions for QA
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
      
      CONSTRAINT fk_document_analysis
        FOREIGN KEY(document_analysis_id)
        REFERENCES document_analysis(id)
        ON DELETE CASCADE
    );

    -- Table for ML model training feedback
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
  `);
};

export const down = async (pool: Pool): Promise<void> => {
  await pool.query(`
    DROP TABLE IF EXISTS document_classification_feedback CASCADE;
    DROP TABLE IF EXISTS document_analysis_qa_flags CASCADE;
    DROP TABLE IF EXISTS document_analysis CASCADE;
  `);
};