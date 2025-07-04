-- Migration: Create SOL (Statute of Limitations) tables
-- Version: 012
-- Description: Tables for storing jurisdiction-specific SOL rules and calculations

-- SOL jurisdictions table
CREATE TABLE IF NOT EXISTS sol_jurisdictions (
    id SERIAL PRIMARY KEY,
    state_code VARCHAR(2) UNIQUE NOT NULL,
    state_name VARCHAR(100) NOT NULL,
    foreclosure_types TEXT[] NOT NULL,
    risk_level VARCHAR(10) CHECK (risk_level IN ('HIGH', 'MEDIUM', 'LOW')),
    last_updated DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SOL periods table
CREATE TABLE IF NOT EXISTS sol_periods (
    id SERIAL PRIMARY KEY,
    jurisdiction_id INTEGER REFERENCES sol_jurisdictions(id) ON DELETE CASCADE,
    lien_years INTEGER,
    note_years INTEGER,
    foreclosure_years INTEGER,
    deficiency_years INTEGER,
    additional_periods JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SOL trigger events table
CREATE TABLE IF NOT EXISTS sol_trigger_events (
    id SERIAL PRIMARY KEY,
    jurisdiction_id INTEGER REFERENCES sol_jurisdictions(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SOL tolling provisions table
CREATE TABLE IF NOT EXISTS sol_tolling_provisions (
    id SERIAL PRIMARY KEY,
    jurisdiction_id INTEGER REFERENCES sol_jurisdictions(id) ON DELETE CASCADE,
    provision_type VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SOL revival methods table
CREATE TABLE IF NOT EXISTS sol_revival_methods (
    id SERIAL PRIMARY KEY,
    jurisdiction_id INTEGER REFERENCES sol_jurisdictions(id) ON DELETE CASCADE,
    partial_payment BOOLEAN DEFAULT FALSE,
    written_acknowledgment BOOLEAN DEFAULT FALSE,
    new_promise BOOLEAN DEFAULT FALSE,
    other_methods TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SOL effect of expiration table
CREATE TABLE IF NOT EXISTS sol_expiration_effects (
    id SERIAL PRIMARY KEY,
    jurisdiction_id INTEGER REFERENCES sol_jurisdictions(id) ON DELETE CASCADE,
    lien_extinguished BOOLEAN DEFAULT FALSE,
    foreclosure_barred BOOLEAN DEFAULT FALSE,
    deficiency_barred BOOLEAN DEFAULT FALSE,
    becomes_unsecured BOOLEAN DEFAULT FALSE,
    special_effects TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SOL special provisions table
CREATE TABLE IF NOT EXISTS sol_special_provisions (
    id SERIAL PRIMARY KEY,
    jurisdiction_id INTEGER REFERENCES sol_jurisdictions(id) ON DELETE CASCADE,
    provision TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SOL statute citations table
CREATE TABLE IF NOT EXISTS sol_statute_citations (
    id SERIAL PRIMARY KEY,
    jurisdiction_id INTEGER REFERENCES sol_jurisdictions(id) ON DELETE CASCADE,
    citation TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SOL key cases table
CREATE TABLE IF NOT EXISTS sol_key_cases (
    id SERIAL PRIMARY KEY,
    jurisdiction_id INTEGER REFERENCES sol_jurisdictions(id) ON DELETE CASCADE,
    case_citation TEXT NOT NULL,
    case_year INTEGER,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SOL notes table
CREATE TABLE IF NOT EXISTS sol_notes (
    id SERIAL PRIMARY KEY,
    jurisdiction_id INTEGER REFERENCES sol_jurisdictions(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Loan SOL calculations table (links loans to SOL analysis)
CREATE TABLE IF NOT EXISTS loan_sol_calculations (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
    jurisdiction_id INTEGER REFERENCES sol_jurisdictions(id),
    property_state VARCHAR(2) NOT NULL,
    
    -- Key dates
    origination_date DATE,
    maturity_date DATE,
    default_date DATE,
    last_payment_date DATE,
    acceleration_date DATE,
    charge_off_date DATE,
    
    -- SOL calculations
    sol_trigger_date DATE,
    sol_trigger_event VARCHAR(100),
    sol_expiration_date DATE,
    days_until_expiration INTEGER,
    is_expired BOOLEAN DEFAULT FALSE,
    
    -- Tolling events
    tolling_events JSONB,
    total_tolled_days INTEGER DEFAULT 0,
    adjusted_expiration_date DATE,
    
    -- Risk assessment
    sol_risk_score INTEGER CHECK (sol_risk_score BETWEEN 0 AND 100),
    sol_risk_level VARCHAR(10) CHECK (sol_risk_level IN ('HIGH', 'MEDIUM', 'LOW')),
    risk_factors JSONB,
    
    -- Metadata
    calculation_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_sol_jurisdictions_state_code ON sol_jurisdictions(state_code);
CREATE INDEX idx_sol_jurisdictions_risk_level ON sol_jurisdictions(risk_level);
CREATE INDEX idx_loan_sol_calculations_loan_id ON loan_sol_calculations(loan_id);
CREATE INDEX idx_loan_sol_calculations_expiration ON loan_sol_calculations(is_expired, days_until_expiration);
CREATE INDEX idx_loan_sol_calculations_risk ON loan_sol_calculations(sol_risk_level);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sol_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sol_jurisdictions_updated_at
    BEFORE UPDATE ON sol_jurisdictions
    FOR EACH ROW
    EXECUTE FUNCTION update_sol_updated_at();

CREATE TRIGGER update_loan_sol_calculations_updated_at
    BEFORE UPDATE ON loan_sol_calculations
    FOR EACH ROW
    EXECUTE FUNCTION update_sol_updated_at();

-- Create view for SOL summary by state
CREATE VIEW sol_state_summary AS
SELECT 
    sj.state_code,
    sj.state_name,
    sj.risk_level,
    sp.lien_years,
    sp.note_years,
    sp.foreclosure_years,
    see.lien_extinguished,
    see.foreclosure_barred,
    COUNT(DISTINCT lsc.loan_id) as affected_loans,
    SUM(CASE WHEN lsc.is_expired THEN 1 ELSE 0 END) as expired_loans,
    SUM(CASE WHEN lsc.days_until_expiration < 365 THEN 1 ELSE 0 END) as loans_expiring_soon
FROM sol_jurisdictions sj
LEFT JOIN sol_periods sp ON sp.jurisdiction_id = sj.id
LEFT JOIN sol_expiration_effects see ON see.jurisdiction_id = sj.id
LEFT JOIN loan_sol_calculations lsc ON lsc.jurisdiction_id = sj.id
GROUP BY sj.id, sj.state_code, sj.state_name, sj.risk_level, 
         sp.lien_years, sp.note_years, sp.foreclosure_years,
         see.lien_extinguished, see.foreclosure_barred;