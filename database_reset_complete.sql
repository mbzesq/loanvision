-- COMPLETE DATABASE RESET SCRIPT (v2 - CORRECTED)

-- Step 1: Drop all existing tables in the correct order
DROP TABLE IF EXISTS llm_queries;
DROP TABLE IF EXISTS enrichments;
DROP TABLE IF EXISTS loans;
DROP TABLE IF EXISTS upload_sessions;

-- Step 2: Re-create all tables with the latest, complete schema
CREATE TABLE upload_sessions (
    id UUID PRIMARY KEY,
    original_filename TEXT,
    file_type TEXT,
    record_count INTEGER,
    status TEXT NOT NULL DEFAULT 'processing',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE loans (
    id SERIAL PRIMARY KEY,
    upload_session_id UUID NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
    servicer_loan_id TEXT,
    borrower_name TEXT,
    co_borrower_name TEXT,
    property_address TEXT,
    property_city TEXT,
    property_state TEXT,
    property_zip TEXT,
    loan_amount NUMERIC(15, 2),
    interest_rate NUMERIC(8, 6),
    maturity_date DATE,
    original_lender TEXT,
    unpaid_principal_balance NUMERIC(15, 2),
    accrued_interest NUMERIC(15, 2),
    total_balance NUMERIC(15, 2),
    last_paid_date DATE,
    next_due_date DATE,
    remaining_term_months INTEGER,
    legal_status TEXT,
    lien_position TEXT,
    investor_name TEXT,
    source_filename TEXT,
    data_issues JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE enrichments (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    enrichment_type TEXT NOT NULL,
    provider TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE llm_queries (
    id SERIAL PRIMARY KEY,
    query_hash TEXT UNIQUE,
    query_text TEXT,
    structured_prompt TEXT,
    response_summary TEXT,
    related_loan_ids INTEGER[],
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create indexes for performance
CREATE INDEX idx_loans_upload_session_id ON loans(upload_session_id);
CREATE INDEX idx_loans_servicer_loan_id ON loans(servicer_loan_id);
CREATE INDEX idx_enrichments_loan_id ON enrichments(loan_id);