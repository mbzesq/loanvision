-- Migration: Create tables for enhanced foreclosure tracking and benchmarking
-- Date: 2025-01-20

-- Drop existing tables if they exist (careful in production!)
DROP TABLE IF EXISTS foreclosure_milestone_statuses CASCADE;
DROP TABLE IF EXISTS foreclosure_events CASCADE;

-- 1. foreclosure_events (One row per loan with active foreclosure tracking)
-- This table stores loan-level foreclosure data from file uploads
CREATE TABLE foreclosure_events (
  id SERIAL PRIMARY KEY,
  loan_id TEXT NOT NULL UNIQUE,
  fc_status TEXT, -- e.g., "Hold" or "Active"
  fc_jurisdiction TEXT, -- "Judicial" or "Non-Judicial"
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
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. foreclosure_milestone_statuses (One row per milestone per loan)
-- This child table stores benchmark and actual status for each foreclosure milestone
CREATE TABLE foreclosure_milestone_statuses (
  id SERIAL PRIMARY KEY,
  loan_id TEXT NOT NULL REFERENCES foreclosure_events(loan_id) ON DELETE CASCADE,
  state TEXT NOT NULL, -- Two-letter abbreviation, e.g., "NY"
  milestone_order INTEGER NOT NULL, -- Position in timeline
  milestone_name TEXT NOT NULL, -- e.g., "Complaint Filing"
  actual_start_date DATE,
  expected_start_date DATE,
  actual_completion_date DATE,
  expected_completion_date DATE,
  expected_duration_days INTEGER, -- From benchmark
  expected_cost_usd NUMERIC(12,2), -- From benchmark
  status_flag TEXT, -- e.g., "On Track", "Delayed", "Overdue", "Ahead"
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_foreclosure_events_loan_id ON foreclosure_events(loan_id);
CREATE INDEX idx_foreclosure_events_fc_status ON foreclosure_events(fc_status);
CREATE INDEX idx_foreclosure_events_fc_jurisdiction ON foreclosure_events(fc_jurisdiction);

CREATE INDEX idx_foreclosure_milestone_statuses_loan_id ON foreclosure_milestone_statuses(loan_id);
CREATE INDEX idx_foreclosure_milestone_statuses_state ON foreclosure_milestone_statuses(state);
CREATE INDEX idx_foreclosure_milestone_statuses_milestone_name ON foreclosure_milestone_statuses(milestone_name);
CREATE INDEX idx_foreclosure_milestone_statuses_status_flag ON foreclosure_milestone_statuses(status_flag);

-- Create trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_foreclosure_events_updated_at BEFORE UPDATE
    ON foreclosure_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_foreclosure_milestone_statuses_updated_at BEFORE UPDATE
    ON foreclosure_milestone_statuses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE foreclosure_events IS 'Main table for tracking foreclosure events per loan';
COMMENT ON TABLE foreclosure_milestone_statuses IS 'Tracks individual milestone status and benchmarks for each loan';
COMMENT ON COLUMN foreclosure_milestone_statuses.expected_duration_days IS 'Expected duration from fcl_milestones_by_state.json benchmark data';
COMMENT ON COLUMN foreclosure_milestone_statuses.expected_cost_usd IS 'Expected cost from fcl_milestones_by_state.json benchmark data';
COMMENT ON COLUMN foreclosure_milestone_statuses.status_flag IS 'Calculated status: On Track, Delayed, Overdue, or Ahead';