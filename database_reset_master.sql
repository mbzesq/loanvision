-- NPLVision Master Database Reset Script
-- This script drops all existing tables and re-creates the complete schema from scratch.
-- It is the single source of truth for the database structure.

-- Step 1: Drop all tables in an order that respects dependencies, using CASCADE for safety.
DROP TABLE IF EXISTS property_data_history CASCADE;
DROP TABLE IF EXISTS property_data_current CASCADE;
DROP TABLE IF EXISTS foreclosure_milestone_statuses CASCADE;
DROP TABLE IF EXISTS foreclosure_events_history CASCADE;
DROP TABLE IF EXISTS foreclosure_events CASCADE;
DROP TABLE IF EXISTS daily_metrics_history CASCADE;
DROP TABLE IF EXISTS daily_metrics_current CASCADE;
DROP TABLE IF EXISTS upload_sessions CASCADE;
DROP TABLE IF EXISTS loans CASCADE; -- Legacy table
DROP TABLE IF EXISTS enrichments CASCADE; -- Legacy table
DROP TABLE IF EXISTS llm_queries CASCADE; -- Legacy table

-- Step 2: Create the table for tracking upload sessions.
CREATE TABLE upload_sessions (
    id UUID PRIMARY KEY,
    original_filename TEXT,
    file_type TEXT,
    record_count INTEGER,
    status TEXT NOT NULL DEFAULT 'processing',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create the primary 'current state' table for daily metrics.
CREATE TABLE daily_metrics_current (
    loan_id TEXT PRIMARY KEY,
    investor_name TEXT,
    first_name TEXT,
    last_name TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    prin_bal NUMERIC(15, 2),
    int_rate NUMERIC(8, 6),
    next_pymt_due DATE,
    last_pymt_received DATE,
    loan_type TEXT, -- Also known as Asset Status
    legal_status TEXT,
    lien_pos TEXT,
    maturity_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 4: Create the history table for daily metrics.
CREATE TABLE daily_metrics_history (
    id SERIAL PRIMARY KEY,
    loan_id TEXT NOT NULL,
    report_date DATE NOT NULL,
    investor_name TEXT,
    first_name TEXT,
    last_name TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    prin_bal NUMERIC(15, 2),
    int_rate NUMERIC(8, 6),
    next_pymt_due DATE,
    last_pymt_received DATE,
    loan_type TEXT,
    legal_status TEXT,
    lien_pos TEXT,
    maturity_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(loan_id, report_date)
);

-- Step 5: Create the 'current state' table for foreclosure events.
CREATE TABLE foreclosure_events (
    id SERIAL PRIMARY KEY,
    loan_id TEXT NOT NULL UNIQUE,
    fc_status TEXT,
    fc_jurisdiction TEXT,
    fc_start_date DATE,
    -- Actual Milestone Dates
    referral_date DATE,
    title_ordered_date DATE,
    title_received_date DATE,
    complaint_filed_date DATE,
    service_completed_date DATE,
    judgment_date DATE,
    sale_scheduled_date DATE,
    sale_held_date DATE,
    -- Expected Milestone Dates (Calculated on Ingest)
    referral_expected_completion_date DATE,
    title_ordered_expected_completion_date DATE,
    title_received_expected_completion_date DATE,
    complaint_filed_expected_completion_date DATE,
    service_completed_expected_completion_date DATE,
    judgment_expected_completion_date DATE,
    sale_scheduled_expected_completion_date DATE,
    sale_held_expected_completion_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 6: Create the history table for foreclosure events.
CREATE TABLE foreclosure_events_history (
    id SERIAL PRIMARY KEY,
    loan_id TEXT NOT NULL,
    report_date DATE NOT NULL,
    fc_status TEXT,
    fc_jurisdiction TEXT,
    fc_start_date DATE,
    referral_date DATE,
    title_ordered_date DATE,
    title_received_date DATE,
    complaint_filed_date DATE,
    service_completed_date DATE,
    judgment_date DATE,
    sale_scheduled_date DATE,
    sale_held_date DATE,
    referral_expected_completion_date DATE,
    title_ordered_expected_completion_date DATE,
    title_received_expected_completion_date DATE,
    complaint_filed_expected_completion_date DATE,
    service_completed_expected_completion_date DATE,
    judgment_expected_completion_date DATE,
    sale_scheduled_expected_completion_date DATE,
    sale_held_expected_completion_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(loan_id, report_date)
);

-- Step 7: Create helper function and triggers for updated_at timestamps.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_daily_metrics_current_updated_at BEFORE UPDATE
    ON daily_metrics_current FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_foreclosure_events_updated_at BEFORE UPDATE
    ON foreclosure_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Create property data tables.
CREATE TABLE property_data_current (
    loan_id TEXT PRIMARY KEY,
    source TEXT,
    property_data JSONB,
    last_updated TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_loan
        FOREIGN KEY(loan_id)
        REFERENCES daily_metrics_current(loan_id)
        ON DELETE CASCADE
);

CREATE TABLE property_data_history (
    id SERIAL PRIMARY KEY,
    loan_id TEXT NOT NULL,
    source TEXT,
    property_data JSONB,
    enrichment_date TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_loan
        FOREIGN KEY(loan_id)
        REFERENCES daily_metrics_current(loan_id)
        ON DELETE CASCADE
);

-- Step 9: Create indexes for performance.
CREATE INDEX idx_daily_metrics_current_loan_id ON daily_metrics_current(loan_id);
CREATE INDEX idx_daily_metrics_current_state ON daily_metrics_current(state);
CREATE INDEX idx_daily_metrics_current_loan_type ON daily_metrics_current(loan_type);
CREATE INDEX idx_daily_metrics_history_loan_id ON daily_metrics_history(loan_id);
CREATE INDEX idx_foreclosure_events_loan_id ON foreclosure_events(loan_id);
CREATE INDEX idx_foreclosure_events_history_loan_id ON foreclosure_events_history(loan_id);
CREATE INDEX idx_property_data_current_loan_id ON property_data_current(loan_id);
CREATE INDEX idx_property_data_current_source ON property_data_current(source);
CREATE INDEX idx_property_data_history_loan_id ON property_data_history(loan_id);
CREATE INDEX idx_property_data_history_enrichment_date ON property_data_history(enrichment_date);
CREATE INDEX idx_property_data_history_source ON property_data_history(source);

-- Comments for documentation
COMMENT ON TABLE property_data_current IS 'Current property enrichment data - one row per loan (most recent)';
COMMENT ON TABLE property_data_history IS 'Historical property enrichment data - all enrichment events';
COMMENT ON COLUMN property_data_current.source IS 'Source of the property data (e.g., PropertyData/HomeHarvest)';
COMMENT ON COLUMN property_data_current.property_data IS 'JSON data containing property details from enrichment source';
COMMENT ON COLUMN property_data_history.enrichment_date IS 'Timestamp when the enrichment was performed';