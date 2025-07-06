-- Migration to fix SOL tables issues
-- This migration is safe and won't break existing code

-- 1. Fix loan_id type mismatch
-- First, we need to drop any views that depend on loan_id
DROP VIEW IF EXISTS sol_state_summary CASCADE;

-- Drop the foreign key constraint
ALTER TABLE loan_sol_calculations 
DROP CONSTRAINT IF EXISTS loan_sol_calculations_loan_id_fkey;

-- Change loan_id to VARCHAR to match your actual loan IDs
ALTER TABLE loan_sol_calculations 
ALTER COLUMN loan_id TYPE VARCHAR(20) USING loan_id::text;

-- Recreate the view with the updated column type
CREATE OR REPLACE VIEW sol_state_summary AS
SELECT sj.state_code,
    sj.state_name,
    sj.risk_level,
    sp.lien_years,
    sp.note_years,
    sp.foreclosure_years,
    see.lien_extinguished,
    see.foreclosure_barred,
    count(DISTINCT lsc.loan_id) AS affected_loans,
    sum(
        CASE
            WHEN lsc.is_expired THEN 1
            ELSE 0
        END) AS expired_loans,
    sum(
        CASE
            WHEN lsc.days_until_expiration < 365 THEN 1
            ELSE 0
        END) AS loans_expiring_soon
FROM sol_jurisdictions sj
    LEFT JOIN sol_periods sp ON sp.jurisdiction_id = sj.id
    LEFT JOIN sol_expiration_effects see ON see.jurisdiction_id = sj.id
    LEFT JOIN loan_sol_calculations lsc ON lsc.jurisdiction_id = sj.id
GROUP BY sj.id, sj.state_code, sj.state_name, sj.risk_level, sp.lien_years, sp.note_years, sp.foreclosure_years, see.lien_extinguished, see.foreclosure_barred;

-- Note: We're NOT adding a foreign key to daily_metrics_current because:
-- - It would prevent historical loan calculations
-- - daily_metrics_current is a view of current state only

-- 2. Add missing sol_category to jurisdictions
ALTER TABLE sol_jurisdictions 
ADD COLUMN IF NOT EXISTS sol_category VARCHAR(10);

-- 3. Create missing audit tables
CREATE TABLE IF NOT EXISTS sol_audit_log (
    id SERIAL PRIMARY KEY,
    loan_id VARCHAR(20) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    sol_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sol_batch_log (
    id SERIAL PRIMARY KEY,
    update_date DATE NOT NULL UNIQUE,
    loans_updated INTEGER NOT NULL DEFAULT 0,
    errors INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create the missing trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_sol_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sol_audit_log_loan_id ON sol_audit_log(loan_id);
CREATE INDEX IF NOT EXISTS idx_sol_audit_log_created_at ON sol_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_sol_batch_log_update_date ON sol_batch_log(update_date);

-- Verify the changes
DO $$
BEGIN
    RAISE NOTICE 'SOL tables have been fixed successfully';
    RAISE NOTICE 'loan_sol_calculations.loan_id is now VARCHAR(20)';
    RAISE NOTICE 'Audit tables created';
    RAISE NOTICE 'Trigger function created';
END $$;