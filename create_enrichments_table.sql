-- Migration script to create enrichments table
-- Run this script manually in your PostgreSQL database

CREATE TABLE IF NOT EXISTS enrichments (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL,
    enrichment_type TEXT NOT NULL,
    provider TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_enrichments_loan_id ON enrichments(loan_id);
CREATE INDEX IF NOT EXISTS idx_enrichments_type ON enrichments(enrichment_type);
CREATE INDEX IF NOT EXISTS idx_enrichments_created_at ON enrichments(created_at);