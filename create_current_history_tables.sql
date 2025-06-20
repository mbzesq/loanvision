-- Migration: Create current/history table structure for daily metrics and foreclosure events
-- Date: 2025-01-20

-- 1. DAILY METRICS TABLES

-- Create daily_metrics_current table (most recent entry per loan)
CREATE TABLE daily_metrics_current (
    loan_id TEXT PRIMARY KEY,
    investor TEXT,
    investor_name TEXT,
    inv_loan TEXT,
    first_name TEXT,
    last_name TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    prin_bal NUMERIC(15, 2),
    unapplied_bal NUMERIC(15, 2),
    int_rate NUMERIC(8, 6),
    pi_pmt NUMERIC(10, 2),
    remg_term INTEGER,
    origination_date DATE,
    org_term INTEGER,
    org_amount NUMERIC(15, 2),
    lien_pos TEXT,
    next_pymt_due DATE,
    last_pymt_received DATE,
    first_pymt_due DATE,
    maturity_date DATE,
    loan_type TEXT,
    legal_status TEXT,
    warning TEXT,
    pymt_method TEXT,
    draft_day TEXT,
    spoc TEXT,
    january_2025 NUMERIC(10, 2),
    february_2025 NUMERIC(10, 2),
    march_2025 NUMERIC(10, 2),
    april_2025 NUMERIC(10, 2),
    may_2025 NUMERIC(10, 2),
    june_2025 NUMERIC(10, 2),
    july_2025 NUMERIC(10, 2),
    august_2025 NUMERIC(10, 2),
    september_2025 NUMERIC(10, 2),
    october_2025 NUMERIC(10, 2),
    november_2025 NUMERIC(10, 2),
    december_2025 NUMERIC(10, 2),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create daily_metrics_history table (all historical entries)
CREATE TABLE daily_metrics_history (
    id SERIAL PRIMARY KEY,
    loan_id TEXT NOT NULL,
    report_date DATE NOT NULL,
    investor TEXT,
    investor_name TEXT,
    inv_loan TEXT,
    first_name TEXT,
    last_name TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    prin_bal NUMERIC(15, 2),
    unapplied_bal NUMERIC(15, 2),
    int_rate NUMERIC(8, 6),
    pi_pmt NUMERIC(10, 2),
    remg_term INTEGER,
    origination_date DATE,
    org_term INTEGER,
    org_amount NUMERIC(15, 2),
    lien_pos TEXT,
    next_pymt_due DATE,
    last_pymt_received DATE,
    first_pymt_due DATE,
    maturity_date DATE,
    loan_type TEXT,
    legal_status TEXT,
    warning TEXT,
    pymt_method TEXT,
    draft_day TEXT,
    spoc TEXT,
    january_2025 NUMERIC(10, 2),
    february_2025 NUMERIC(10, 2),
    march_2025 NUMERIC(10, 2),
    april_2025 NUMERIC(10, 2),
    may_2025 NUMERIC(10, 2),
    june_2025 NUMERIC(10, 2),
    july_2025 NUMERIC(10, 2),
    august_2025 NUMERIC(10, 2),
    september_2025 NUMERIC(10, 2),
    october_2025 NUMERIC(10, 2),
    november_2025 NUMERIC(10, 2),
    december_2025 NUMERIC(10, 2),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(loan_id, report_date)
);

-- 2. FORECLOSURE EVENTS HISTORY TABLE
-- (foreclosure_events table already exists as "current" table)

CREATE TABLE foreclosure_events_history (
    id SERIAL PRIMARY KEY,
    loan_id TEXT NOT NULL,
    report_date DATE NOT NULL,
    fc_status TEXT,
    fc_jurisdiction TEXT,
    fc_start_date DATE,
    current_attorney TEXT,
    referral_date DATE,
    title_ordered_date DATE,
    title_received_date DATE,
    complaint_filed_date DATE,
    service_completed_date DATE,
    judgment_date DATE,
    sale_scheduled_date DATE,
    sale_held_date DATE,
    real_estate_owned_date DATE,
    eviction_completed_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(loan_id, report_date)
);

-- Create indexes for performance
CREATE INDEX idx_daily_metrics_current_loan_id ON daily_metrics_current(loan_id);
CREATE INDEX idx_daily_metrics_current_state ON daily_metrics_current(state);

CREATE INDEX idx_daily_metrics_history_loan_id ON daily_metrics_history(loan_id);
CREATE INDEX idx_daily_metrics_history_report_date ON daily_metrics_history(report_date);
CREATE INDEX idx_daily_metrics_history_loan_report ON daily_metrics_history(loan_id, report_date);

CREATE INDEX idx_foreclosure_events_history_loan_id ON foreclosure_events_history(loan_id);
CREATE INDEX idx_foreclosure_events_history_report_date ON foreclosure_events_history(report_date);
CREATE INDEX idx_foreclosure_events_history_loan_report ON foreclosure_events_history(loan_id, report_date);

-- Create triggers to update the updated_at timestamp for current tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_daily_metrics_current_updated_at BEFORE UPDATE
    ON daily_metrics_current FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE daily_metrics_current IS 'Current daily metrics data - one row per loan (most recent)';
COMMENT ON TABLE daily_metrics_history IS 'Historical daily metrics data - all uploads with report dates';
COMMENT ON TABLE foreclosure_events_history IS 'Historical foreclosure events data - all uploads with report dates';

COMMENT ON COLUMN daily_metrics_history.report_date IS 'Date of the report/upload - used for historical tracking';
COMMENT ON COLUMN foreclosure_events_history.report_date IS 'Date of the report/upload - used for historical tracking';