-- Create comprehensive SOL (Statute of Limitations) database schema

-- 1. SOL Jurisdictions (States/Federal)
CREATE TABLE sol_jurisdictions (
  id SERIAL PRIMARY KEY,
  state_code VARCHAR(2) NOT NULL UNIQUE,
  state_name VARCHAR(100) NOT NULL,
  lien_years INTEGER,
  note_years INTEGER,
  foreclosure_years INTEGER,
  lien_extinguished BOOLEAN DEFAULT false,
  foreclosure_barred BOOLEAN DEFAULT false,
  risk_level VARCHAR(10) CHECK (risk_level IN ('HIGH', 'MEDIUM', 'LOW')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. SOL Time Periods
CREATE TABLE sol_time_periods (
  id SERIAL PRIMARY KEY,
  jurisdiction_id INTEGER REFERENCES sol_jurisdictions(id),
  period_type VARCHAR(50) NOT NULL, -- 'lien', 'note', 'foreclosure', 'judgment'
  years INTEGER,
  months INTEGER DEFAULT 0,
  days INTEGER DEFAULT 0,
  description TEXT,
  citation VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. SOL Trigger Events
CREATE TABLE sol_trigger_events (
  id SERIAL PRIMARY KEY,
  jurisdiction_id INTEGER REFERENCES sol_jurisdictions(id),
  event_type VARCHAR(100) NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 0, -- Higher priority = preferred trigger
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. SOL Tolling Provisions
CREATE TABLE sol_tolling_provisions (
  id SERIAL PRIMARY KEY,
  jurisdiction_id INTEGER REFERENCES sol_jurisdictions(id),
  provision_name VARCHAR(200) NOT NULL,
  description TEXT,
  tolling_days INTEGER,
  conditions TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. SOL Revival Methods
CREATE TABLE sol_revival_methods (
  id SERIAL PRIMARY KEY,
  jurisdiction_id INTEGER REFERENCES sol_jurisdictions(id),
  method_name VARCHAR(200) NOT NULL,
  description TEXT,
  extends_by_years INTEGER,
  conditions TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. SOL Expiration Effects
CREATE TABLE sol_expiration_effects (
  id SERIAL PRIMARY KEY,
  jurisdiction_id INTEGER REFERENCES sol_jurisdictions(id),
  effect_type VARCHAR(100) NOT NULL, -- 'lien_extinguished', 'foreclosure_barred', 'collection_limited'
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. SOL Special Provisions
CREATE TABLE sol_special_provisions (
  id SERIAL PRIMARY KEY,
  jurisdiction_id INTEGER REFERENCES sol_jurisdictions(id),
  provision_type VARCHAR(100) NOT NULL,
  title VARCHAR(200),
  description TEXT,
  impact VARCHAR(100), -- 'extends', 'shortens', 'tolls', 'revives'
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. SOL Statute Citations
CREATE TABLE sol_statute_citations (
  id SERIAL PRIMARY KEY,
  jurisdiction_id INTEGER REFERENCES sol_jurisdictions(id),
  statute_code VARCHAR(100) NOT NULL,
  section VARCHAR(100),
  title TEXT,
  url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 9. SOL Key Cases
CREATE TABLE sol_key_cases (
  id SERIAL PRIMARY KEY,
  jurisdiction_id INTEGER REFERENCES sol_jurisdictions(id),
  case_name VARCHAR(500) NOT NULL,
  citation VARCHAR(200),
  year INTEGER,
  summary TEXT,
  impact TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 10. SOL Research Notes
CREATE TABLE sol_research_notes (
  id SERIAL PRIMARY KEY,
  jurisdiction_id INTEGER REFERENCES sol_jurisdictions(id),
  note_type VARCHAR(100), -- 'research', 'practice_tip', 'warning', 'update'
  title VARCHAR(200),
  content TEXT,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 11. Loan SOL Calculations (Main working table)
CREATE TABLE loan_sol_calculations (
  id SERIAL PRIMARY KEY,
  loan_id VARCHAR(20) NOT NULL,
  jurisdiction_id INTEGER REFERENCES sol_jurisdictions(id),
  property_state VARCHAR(2) NOT NULL,
  origination_date DATE,
  maturity_date DATE,
  default_date DATE,
  last_payment_date DATE,
  acceleration_date DATE,
  charge_off_date DATE,
  sol_trigger_event VARCHAR(100),
  sol_trigger_date DATE,
  sol_expiration_date DATE,
  days_until_expiration INTEGER,
  is_expired BOOLEAN DEFAULT false,
  tolling_events JSONB DEFAULT '[]',
  total_tolled_days INTEGER DEFAULT 0,
  adjusted_expiration_date DATE,
  sol_risk_score INTEGER CHECK (sol_risk_score BETWEEN 0 AND 100),
  sol_risk_level VARCHAR(10) CHECK (sol_risk_level IN ('HIGH', 'MEDIUM', 'LOW')),
  risk_factors JSONB DEFAULT '[]',
  calculation_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 12. SOL Audit Log
CREATE TABLE sol_audit_log (
  id SERIAL PRIMARY KEY,
  loan_id VARCHAR(20) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_date DATE,
  sol_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 13. SOL Batch Log
CREATE TABLE sol_batch_log (
  id SERIAL PRIMARY KEY,
  update_date DATE NOT NULL UNIQUE,
  loans_updated INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_loan_sol_calculations_loan_id ON loan_sol_calculations(loan_id);
CREATE INDEX idx_loan_sol_calculations_state ON loan_sol_calculations(property_state);
CREATE INDEX idx_loan_sol_calculations_expiration ON loan_sol_calculations(sol_expiration_date);
CREATE INDEX idx_loan_sol_calculations_risk ON loan_sol_calculations(sol_risk_level);
CREATE INDEX idx_loan_sol_calculations_expired ON loan_sol_calculations(is_expired);
CREATE INDEX idx_sol_audit_log_loan_id ON sol_audit_log(loan_id);
CREATE INDEX idx_sol_audit_log_event_date ON sol_audit_log(event_date);

-- Update trigger for loan_sol_calculations
CREATE OR REPLACE FUNCTION update_sol_calculations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sol_calculations_updated_at
  BEFORE UPDATE ON loan_sol_calculations
  FOR EACH ROW
  EXECUTE FUNCTION update_sol_calculations_timestamp();

-- Views for common queries
CREATE VIEW sol_state_summary AS
SELECT 
  lsc.property_state,
  sj.state_name,
  COUNT(*) as total_loans,
  SUM(CASE WHEN lsc.is_expired THEN 1 ELSE 0 END) as expired_loans,
  SUM(CASE WHEN lsc.sol_risk_level = 'HIGH' THEN 1 ELSE 0 END) as high_risk_loans,
  SUM(CASE WHEN lsc.sol_risk_level = 'MEDIUM' THEN 1 ELSE 0 END) as medium_risk_loans,
  SUM(CASE WHEN lsc.sol_risk_level = 'LOW' THEN 1 ELSE 0 END) as low_risk_loans,
  AVG(lsc.days_until_expiration) as avg_days_until_expiration
FROM loan_sol_calculations lsc
JOIN sol_jurisdictions sj ON lsc.jurisdiction_id = sj.id
GROUP BY lsc.property_state, sj.state_name;

CREATE VIEW sol_risk_summary AS
SELECT 
  sol_risk_level,
  COUNT(*) as loan_count,
  AVG(days_until_expiration) as avg_days_until_expiration,
  MIN(days_until_expiration) as min_days_until_expiration,
  MAX(days_until_expiration) as max_days_until_expiration
FROM loan_sol_calculations
WHERE NOT is_expired
GROUP BY sol_risk_level;