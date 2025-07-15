-- Fix Alert System Triggers
-- Created: 2025-01-14
-- Purpose: Add missing columns and triggers to make all 9 alert types functional

-- 1. Add confidence_score column to collateral_documents
ALTER TABLE collateral_documents 
ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,2);

-- Add index for confidence queries
CREATE INDEX IF NOT EXISTS idx_collateral_documents_confidence 
ON collateral_documents(confidence_score) WHERE confidence_score IS NOT NULL;

-- 2. Create foreclosure status change trigger
CREATE OR REPLACE FUNCTION trigger_foreclosure_status_alert() RETURNS TRIGGER AS $$
DECLARE
    alert_rule RECORD;
    event_data JSONB;
    days_until_sale INTEGER;
    alert_id INTEGER;
BEGIN
    -- Build event data
    event_data := jsonb_build_object(
        'loan_id', NEW.loan_id,
        'old_status', COALESCE(OLD.fc_status, ''),
        'new_status', COALESCE(NEW.fc_status, ''),
        'sale_date', NEW.sale_scheduled_date,
        'sale_held_date', NEW.sale_held_date,
        'reo_date', NEW.real_estate_owned_date
    );
    
    -- Calculate days until sale if scheduled
    IF NEW.sale_scheduled_date IS NOT NULL THEN
        days_until_sale := EXTRACT(DAY FROM NEW.sale_scheduled_date - CURRENT_DATE);
        event_data := event_data || jsonb_build_object('days_until_sale', days_until_sale);
    END IF;
    
    -- Check for status changes or new sale dates
    IF (TG_OP = 'UPDATE' AND (
        OLD.fc_status IS DISTINCT FROM NEW.fc_status OR
        OLD.sale_scheduled_date IS DISTINCT FROM NEW.sale_scheduled_date OR
        OLD.sale_held_date IS DISTINCT FROM NEW.sale_held_date OR
        OLD.real_estate_owned_date IS DISTINCT FROM NEW.real_estate_owned_date
    )) OR TG_OP = 'INSERT' THEN
        
        -- Check all active foreclosure status rules
        FOR alert_rule IN 
            SELECT * FROM alert_rules 
            WHERE event_type = 'foreclosure_status_change' 
            AND is_active = true
        LOOP
            -- Evaluate if this rule should trigger
            IF evaluate_alert_condition(alert_rule.condition_json, event_data) THEN
                -- Create alert
                INSERT INTO alerts (
                    alert_rule_id,
                    loan_id,
                    severity,
                    title,
                    message,
                    metadata
                ) VALUES (
                    alert_rule.id,
                    NEW.loan_id,
                    alert_rule.severity,
                    alert_rule.name || ' - Loan ' || NEW.loan_id,
                    CASE 
                        WHEN NEW.sale_scheduled_date IS NOT NULL AND days_until_sale IS NOT NULL THEN
                            'Foreclosure sale scheduled for ' || TO_CHAR(NEW.sale_scheduled_date, 'MM/DD/YYYY') || ' (' || days_until_sale || ' days)'
                        WHEN NEW.sale_held_date IS NOT NULL THEN
                            'Foreclosure sale completed on ' || TO_CHAR(NEW.sale_held_date, 'MM/DD/YYYY')
                        WHEN NEW.real_estate_owned_date IS NOT NULL THEN
                            'Property became REO on ' || TO_CHAR(NEW.real_estate_owned_date, 'MM/DD/YYYY')
                        ELSE
                            'Foreclosure status changed to ' || COALESCE(NEW.fc_status, 'Unknown')
                    END,
                    event_data
                ) RETURNING id INTO alert_id;
                
                -- Queue for delivery
                PERFORM pg_notify('new_alert', alert_id::text);
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on foreclosure events
DROP TRIGGER IF EXISTS foreclosure_status_alert_trigger ON foreclosure_events;
CREATE TRIGGER foreclosure_status_alert_trigger
    AFTER INSERT OR UPDATE ON foreclosure_events
    FOR EACH ROW
    EXECUTE FUNCTION trigger_foreclosure_status_alert();

-- 3. Create payment received trigger
CREATE OR REPLACE FUNCTION trigger_payment_alert() RETURNS TRIGGER AS $$
DECLARE
    alert_rule RECORD;
    event_data JSONB;
    months_delinquent INTEGER;
    payment_amount NUMERIC;
    alert_id INTEGER;
BEGIN
    -- Only trigger on payment date changes
    IF TG_OP = 'UPDATE' AND OLD.last_pymt_received IS DISTINCT FROM NEW.last_pymt_received AND NEW.last_pymt_received IS NOT NULL THEN
        
        -- Calculate months delinquent
        months_delinquent := EXTRACT(MONTH FROM AGE(CURRENT_DATE, NEW.next_pymt_due));
        
        -- Try to determine payment amount from monthly columns
        payment_amount := CASE EXTRACT(MONTH FROM NEW.last_pymt_received)
            WHEN 1 THEN NEW.january_2025
            WHEN 2 THEN NEW.february_2025
            WHEN 3 THEN NEW.march_2025
            WHEN 4 THEN NEW.april_2025
            WHEN 5 THEN NEW.may_2025
            WHEN 6 THEN NEW.june_2025
            WHEN 7 THEN NEW.july_2025
            WHEN 8 THEN NEW.august_2025
            WHEN 9 THEN NEW.september_2025
            WHEN 10 THEN NEW.october_2025
            WHEN 11 THEN NEW.november_2025
            WHEN 12 THEN NEW.december_2025
            ELSE NEW.pi_pmt
        END;
        
        -- Build event data
        event_data := jsonb_build_object(
            'loan_id', NEW.loan_id,
            'payment_date', NEW.last_pymt_received,
            'payment_amount', payment_amount,
            'months_delinquent', months_delinquent,
            'legal_status', NEW.legal_status
        );
        
        -- Check payment received rules
        FOR alert_rule IN 
            SELECT * FROM alert_rules 
            WHERE event_type = 'payment_received' 
            AND is_active = true
        LOOP
            IF evaluate_alert_condition(alert_rule.condition_json, event_data) THEN
                INSERT INTO alerts (
                    alert_rule_id,
                    loan_id,
                    severity,
                    title,
                    message,
                    metadata
                ) VALUES (
                    alert_rule.id,
                    NEW.loan_id,
                    alert_rule.severity,
                    alert_rule.name || ' - Loan ' || NEW.loan_id,
                    'Payment of $' || COALESCE(payment_amount::text, 'Unknown') || ' received on ' || TO_CHAR(NEW.last_pymt_received, 'MM/DD/YYYY'),
                    event_data
                ) RETURNING id INTO alert_id;
                
                PERFORM pg_notify('new_alert', alert_id::text);
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on daily metrics
DROP TRIGGER IF EXISTS payment_alert_trigger ON daily_metrics_current;
CREATE TRIGGER payment_alert_trigger
    AFTER UPDATE ON daily_metrics_current
    FOR EACH ROW
    EXECUTE FUNCTION trigger_payment_alert();

-- 4. Create loan status change trigger
CREATE OR REPLACE FUNCTION trigger_loan_status_alert() RETURNS TRIGGER AS $$
DECLARE
    alert_rule RECORD;
    event_data JSONB;
    alert_id INTEGER;
BEGIN
    -- Check for status changes that might indicate reinstatement
    IF TG_OP = 'UPDATE' AND (
        OLD.legal_status IS DISTINCT FROM NEW.legal_status OR
        (OLD.last_pymt_received IS DISTINCT FROM NEW.last_pymt_received AND NEW.last_pymt_received > OLD.last_pymt_received)
    ) THEN
        
        -- Build event data
        event_data := jsonb_build_object(
            'loan_id', NEW.loan_id,
            'old_status', COALESCE(OLD.legal_status, ''),
            'new_status', COALESCE(NEW.legal_status, ''),
            'payment_date', NEW.last_pymt_received,
            'next_due', NEW.next_pymt_due
        );
        
        -- Detect potential reinstatement
        IF (NEW.legal_status ILIKE '%current%' OR NEW.legal_status ILIKE '%performing%' OR NEW.legal_status ILIKE '%reinstate%') 
           AND OLD.legal_status != NEW.legal_status THEN
            event_data := event_data || jsonb_build_object('new_status', 'reinstated');
        END IF;
        
        -- Check loan status change rules
        FOR alert_rule IN 
            SELECT * FROM alert_rules 
            WHERE event_type = 'loan_status_change' 
            AND is_active = true
        LOOP
            IF evaluate_alert_condition(alert_rule.condition_json, event_data) THEN
                INSERT INTO alerts (
                    alert_rule_id,
                    loan_id,
                    severity,
                    title,
                    message,
                    metadata
                ) VALUES (
                    alert_rule.id,
                    NEW.loan_id,
                    alert_rule.severity,
                    alert_rule.name || ' - Loan ' || NEW.loan_id,
                    'Loan status changed from "' || COALESCE(OLD.legal_status, 'Unknown') || '" to "' || COALESCE(NEW.legal_status, 'Unknown') || '"',
                    event_data
                ) RETURNING id INTO alert_id;
                
                PERFORM pg_notify('new_alert', alert_id::text);
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on daily metrics for status changes
DROP TRIGGER IF EXISTS loan_status_alert_trigger ON daily_metrics_current;
CREATE TRIGGER loan_status_alert_trigger
    AFTER UPDATE ON daily_metrics_current
    FOR EACH ROW
    EXECUTE FUNCTION trigger_loan_status_alert();

-- 5. Update document trigger to handle confidence scores
CREATE OR REPLACE FUNCTION trigger_document_upload_alert() RETURNS TRIGGER AS $$
DECLARE
    alert_rule RECORD;
    event_data JSONB;
    alert_id INTEGER;
BEGIN
    -- Build event data
    event_data := jsonb_build_object(
        'loan_id', NEW.loan_id,
        'document_type', NEW.document_type,
        'confidence', COALESCE(NEW.confidence_score, 100), -- Default to 100 if no confidence
        'document_id', NEW.id,
        'file_name', NEW.file_name
    );
    
    -- Check all active document upload rules
    FOR alert_rule IN 
        SELECT * FROM alert_rules 
        WHERE event_type = 'document_upload' 
        AND is_active = true
    LOOP
        -- Evaluate if this rule should trigger
        IF evaluate_alert_condition(alert_rule.condition_json, event_data) THEN
            -- Create alert
            INSERT INTO alerts (
                alert_rule_id,
                loan_id,
                document_id,
                severity,
                title,
                message,
                metadata
            ) VALUES (
                alert_rule.id,
                NEW.loan_id,
                NEW.id,
                alert_rule.severity,
                alert_rule.name || ' - Loan ' || NEW.loan_id,
                'Document "' || NEW.file_name || '" uploaded' || 
                CASE 
                    WHEN NEW.confidence_score IS NOT NULL THEN ' with ' || NEW.confidence_score || '% confidence'
                    ELSE ''
                END,
                event_data
            ) RETURNING id INTO alert_id;
            
            -- Queue for delivery
            PERFORM pg_notify('new_alert', alert_id::text);
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create scheduled job function for missing documents (enhanced)
CREATE OR REPLACE FUNCTION check_missing_documents() RETURNS void AS $$
DECLARE
    loan RECORD;
    alert_rule RECORD;
    event_data JSONB;
    days_since_added INTEGER;
    doc_exists BOOLEAN;
    required_doc_type TEXT;
BEGIN
    -- Check each active loan
    FOR loan IN 
        SELECT 
            loan_id, 
            MIN(created_at) as first_seen,
            legal_status
        FROM daily_metrics_current
        GROUP BY loan_id, legal_status
    LOOP
        days_since_added := EXTRACT(DAY FROM NOW() - loan.first_seen);
        
        -- Check document_check rules
        FOR alert_rule IN
            SELECT * FROM alert_rules
            WHERE event_type = 'document_check'
            AND is_active = true
        LOOP
            -- Extract expected document type from rule
            IF alert_rule.condition_json ? 'document_type' THEN
                required_doc_type := alert_rule.condition_json->>'document_type';
                
                -- Check if document exists (flexible matching)
                SELECT EXISTS(
                    SELECT 1 FROM collateral_documents
                    WHERE loan_id = loan.loan_id
                    AND (
                        LOWER(document_type) = LOWER(required_doc_type) OR
                        LOWER(document_type) LIKE '%' || LOWER(required_doc_type) || '%' OR
                        (required_doc_type = 'security_instrument' AND LOWER(document_type) IN ('mortgage', 'deed of trust', 'security instrument'))
                    )
                ) INTO doc_exists;
                
                IF NOT doc_exists THEN
                    event_data := jsonb_build_object(
                        'loan_id', loan.loan_id,
                        'document_type', required_doc_type,
                        'days_since_loan_added', days_since_added,
                        'legal_status', loan.legal_status
                    );
                    
                    -- Check if alert should trigger
                    IF evaluate_alert_condition(alert_rule.condition_json, event_data) THEN
                        -- Only create if no active alert exists
                        IF NOT EXISTS(
                            SELECT 1 FROM alerts
                            WHERE alert_rule_id = alert_rule.id
                            AND loan_id = loan.loan_id
                            AND status = 'active'
                        ) THEN
                            INSERT INTO alerts (
                                alert_rule_id,
                                loan_id,
                                severity,
                                title,
                                message,
                                metadata
                            ) VALUES (
                                alert_rule.id,
                                loan.loan_id,
                                alert_rule.severity,
                                'Missing ' || INITCAP(REPLACE(required_doc_type, '_', ' ')) || ' - Loan ' || loan.loan_id,
                                'Required ' || INITCAP(REPLACE(required_doc_type, '_', ' ')) || ' not uploaded after ' || days_since_added || ' days',
                                event_data
                            );
                        END IF;
                    END IF;
                END IF;
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 7. Update the evaluate_alert_condition function to handle more operators
CREATE OR REPLACE FUNCTION evaluate_alert_condition(
    condition_json JSONB,
    event_data JSONB
) RETURNS BOOLEAN AS $$
DECLARE
    condition_key TEXT;
    condition_value JSONB;
    operator TEXT;
    expected_value NUMERIC;
    actual_value NUMERIC;
    expected_array JSONB;
    actual_text TEXT;
BEGIN
    -- Iterate through each condition
    FOR condition_key, condition_value IN SELECT * FROM jsonb_each(condition_json)
    LOOP
        -- Handle operator-based conditions
        IF jsonb_typeof(condition_value) = 'object' AND condition_value ? 'operator' THEN
            operator := condition_value->>'operator';
            expected_value := (condition_value->>'value')::NUMERIC;
            
            -- Try to get numeric value from event data
            BEGIN
                actual_value := (event_data->>condition_key)::NUMERIC;
            EXCEPTION WHEN OTHERS THEN
                -- If conversion fails, condition doesn't match
                RETURN FALSE;
            END;
            
            -- Evaluate based on operator
            CASE operator
                WHEN '<' THEN
                    IF NOT (actual_value < expected_value) THEN RETURN FALSE; END IF;
                WHEN '>' THEN
                    IF NOT (actual_value > expected_value) THEN RETURN FALSE; END IF;
                WHEN '<=' THEN
                    IF NOT (actual_value <= expected_value) THEN RETURN FALSE; END IF;
                WHEN '>=' THEN
                    IF NOT (actual_value >= expected_value) THEN RETURN FALSE; END IF;
                WHEN '=' THEN
                    IF NOT (actual_value = expected_value) THEN RETURN FALSE; END IF;
                WHEN '!=' THEN
                    IF NOT (actual_value != expected_value) THEN RETURN FALSE; END IF;
            END CASE;
        -- Handle array inclusion conditions
        ELSIF jsonb_typeof(condition_value) = 'array' THEN
            actual_text := event_data->>condition_key;
            IF actual_text IS NULL OR NOT (actual_text = ANY(ARRAY(SELECT jsonb_array_elements_text(condition_value)))) THEN
                RETURN FALSE;
            END IF;
        -- Handle direct value comparison
        ELSE
            IF NOT (event_data->>condition_key = condition_value#>>'{}') THEN
                RETURN FALSE;
            END IF;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 8. Create indexes for better alert performance
CREATE INDEX IF NOT EXISTS idx_alerts_loan_status ON alerts(loan_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_foreclosure_events_dates ON foreclosure_events(sale_scheduled_date, sale_held_date, real_estate_owned_date);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_payment_dates ON daily_metrics_current(last_pymt_received, next_pymt_due);

-- 9. Insert additional alert rules for better coverage
INSERT INTO alert_rules (name, description, event_type, condition_json, severity) VALUES 
-- Stale data alert
('Stale Loan Data', 
 'Alert when loan has not been updated in over 30 days', 
 'stale_data',
 '{"days_stale": {"operator": ">", "value": 30}}',
 'medium'),

-- Document type mismatch
('Document Type Unclear', 
 'Alert when document type cannot be determined with confidence', 
 'document_upload',
 '{"document_type": "Unknown"}',
 'low')
ON CONFLICT DO NOTHING;