-- Migration script to add servicer_loan_id column to loans table
-- Run this script manually in your PostgreSQL database

ALTER TABLE loans 
ADD COLUMN servicer_loan_id TEXT;

-- Optional: Add an index for faster lookups by servicer loan ID
CREATE INDEX idx_loans_servicer_loan_id ON loans(servicer_loan_id);