-- Disable automatic document upload task creation
-- This temporarily disables document_upload_required and title_report_upload_required tasks

CREATE OR REPLACE FUNCTION check_missing_documents_tasks() RETURNS void AS $$
DECLARE
    loan RECORD;
    days_since_added INTEGER;
    doc_exists BOOLEAN;
    task_type_val TEXT;
    title_val TEXT;
    description_val TEXT;
BEGIN
    -- TEMPORARILY DISABLED: Document upload task creation
    -- This function was creating 1800+ tasks for all loans
    -- Business logic needs refinement before re-enabling
    
    RAISE NOTICE 'Document upload task creation is temporarily disabled';
    
    -- Future: Add refined business logic here that only creates tasks for:
    -- - Active loans (not paid off, not REO)
    -- - Loans in specific legal statuses
    -- - Loans with specific criteria beyond just age
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Also create a table to track business rule configurations
CREATE TABLE IF NOT EXISTS business_rule_config (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config_json JSONB,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert configuration for document upload rules (disabled)
INSERT INTO business_rule_config (rule_name, enabled, config_json, description) 
VALUES 
(
    'document_upload_tasks',
    false,  -- DISABLED
    '{
        "security_instrument_days": 7,
        "title_report_days": 14,
        "enabled_loan_statuses": ["active", "delinquent"],
        "excluded_legal_statuses": ["REO", "paid_off", "settled"]
    }'::jsonb,
    'Creates tasks for missing document uploads after specified days'
),
(
    'foreclosure_tasks', 
    true,  -- ENABLED
    '{
        "urgent_days": 7,
        "scheduled_days": 30,
        "enabled": true
    }'::jsonb,
    'Creates foreclosure action tasks based on sale dates'
),
(
    'document_review_tasks',
    true,  -- ENABLED  
    '{
        "critical_confidence_threshold": 50,
        "low_confidence_threshold": 70,
        "enabled": true
    }'::jsonb,
    'Creates document review tasks based on confidence scores'
);