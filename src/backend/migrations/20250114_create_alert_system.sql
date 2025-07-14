-- Alert System Database Schema
-- Created: 2025-01-14
-- Purpose: Enable real-time monitoring and notifications for loan portfolio events

-- 1. Alert rule definitions (configurable triggers)
CREATE TABLE alert_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) NOT NULL, -- 'foreclosure_filing', 'document_upload', 'payment_received', etc.
    condition_json JSONB NOT NULL,   -- Flexible conditions: {"confidence": {"operator": "<", "value": 70}}
    severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick lookups by event type
CREATE INDEX idx_alert_rules_event_type ON alert_rules(event_type) WHERE is_active = true;

-- 2. Alert instances when rules trigger
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    alert_rule_id INTEGER REFERENCES alert_rules(id),
    loan_id VARCHAR(50),
    document_id INTEGER REFERENCES collateral_documents(id),
    severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    title VARCHAR(255) NOT NULL,
    message TEXT,
    metadata JSONB,  -- Event-specific data
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'acknowledged', 'resolved', 'dismissed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    acknowledged_by INTEGER REFERENCES users(id),
    resolved_at TIMESTAMP,
    resolved_by INTEGER REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_alerts_loan_id ON alerts(loan_id);
CREATE INDEX idx_alerts_status ON alerts(status) WHERE status = 'active';
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);

-- 3. Who gets which alerts (subscription management)
CREATE TABLE alert_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    alert_rule_id INTEGER REFERENCES alert_rules(id),
    delivery_method VARCHAR(20) DEFAULT 'in_app', -- 'in_app', 'email', 'sms'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, alert_rule_id)
);

-- 4. Track user interactions with alerts
CREATE TABLE alert_actions (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER REFERENCES alerts(id),
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(50) NOT NULL, -- 'acknowledge', 'investigate', 'escalate', 'resolve', 'dismiss'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for audit trail
CREATE INDEX idx_alert_actions_alert_id ON alert_actions(alert_id);

-- 5. Alert delivery log (for tracking delivery status)
CREATE TABLE alert_deliveries (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER REFERENCES alerts(id),
    user_id INTEGER REFERENCES users(id),
    delivery_method VARCHAR(20) NOT NULL,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create default alert rules
INSERT INTO alert_rules (name, description, event_type, condition_json, severity) VALUES 
-- Document confidence alerts
('Low Confidence Document', 
 'Alert when uploaded document has confidence score below 70%', 
 'document_upload',
 '{"confidence": {"operator": "<", "value": 70}}',
 'high'),

('Very Low Confidence Document', 
 'Critical alert when document confidence is below 50%', 
 'document_upload',
 '{"confidence": {"operator": "<", "value": 50}}',
 'critical'),

-- Foreclosure milestone alerts
('Foreclosure Sale Scheduled',
 'Alert when foreclosure sale is scheduled within 30 days',
 'foreclosure_status_change',
 '{"new_status": ["sale_scheduled"], "days_until_sale": {"operator": "<", "value": 30}}',
 'high'),

('Foreclosure Sale Imminent',
 'Critical alert when foreclosure sale is within 7 days',
 'foreclosure_status_change',
 '{"new_status": ["sale_scheduled"], "days_until_sale": {"operator": "<", "value": 7}}',
 'critical'),

('Foreclosure Completed',
 'Alert when property is sold at foreclosure',
 'foreclosure_status_change',
 '{"new_status": ["sold_at_foreclosure", "reo"]}',
 'high'),

-- Document missing alerts
('Missing Security Instrument',
 'Alert when Security Instrument not uploaded within 7 days',
 'document_check',
 '{"document_type": "security_instrument", "days_since_loan_added": {"operator": ">", "value": 7}}',
 'medium'),

('Missing Title Report',
 'Alert when Title Report not uploaded within 14 days',
 'document_check',
 '{"document_type": "title_report", "days_since_loan_added": {"operator": ">", "value": 14}}',
 'medium'),

-- Loan status changes
('Payment Received on NPL',
 'Alert when payment received on non-performing loan',
 'payment_received',
 '{"months_delinquent": {"operator": ">", "value": 6}}',
 'medium'),

('Loan Reinstated',
 'Alert when loan returns to performing status',
 'loan_status_change',
 '{"new_status": ["performing", "reinstated"]}',
 'high');

-- 7. Function to check if alert should be triggered
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
BEGIN
    -- Iterate through each condition
    FOR condition_key, condition_value IN SELECT * FROM jsonb_each(condition_json)
    LOOP
        -- Handle operator-based conditions
        IF jsonb_typeof(condition_value) = 'object' AND condition_value ? 'operator' THEN
            operator := condition_value->>'operator';
            expected_value := (condition_value->>'value')::NUMERIC;
            actual_value := (event_data->>condition_key)::NUMERIC;
            
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
            END CASE;
        -- Handle array inclusion conditions
        ELSIF jsonb_typeof(condition_value) = 'array' THEN
            IF NOT (event_data->>condition_key = ANY(ARRAY(SELECT jsonb_array_elements_text(condition_value)))) THEN
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

-- 8. Trigger function for document upload alerts
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
        'confidence', NEW.confidence_score,
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
                'Document "' || NEW.file_name || '" uploaded with ' || 
                NEW.confidence_score || '% confidence',
                event_data
            ) RETURNING id INTO alert_id;
            
            -- Queue for delivery (will be processed by alert engine)
            PERFORM pg_notify('new_alert', alert_id::text);
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Create trigger on document uploads
CREATE TRIGGER document_upload_alert_trigger
    AFTER INSERT ON collateral_documents
    FOR EACH ROW
    EXECUTE FUNCTION trigger_document_upload_alert();

-- 10. Function to check for missing documents (scheduled job)
CREATE OR REPLACE FUNCTION check_missing_documents() RETURNS void AS $$
DECLARE
    loan RECORD;
    alert_rule RECORD;
    event_data JSONB;
    days_since_added INTEGER;
    doc_exists BOOLEAN;
BEGIN
    -- Check each active loan
    FOR loan IN 
        SELECT DISTINCT loan_id, MIN(created_at) as first_seen
        FROM daily_metrics_current
        GROUP BY loan_id
    LOOP
        days_since_added := EXTRACT(DAY FROM NOW() - loan.first_seen);
        
        -- Check document_check rules
        FOR alert_rule IN
            SELECT * FROM alert_rules
            WHERE event_type = 'document_check'
            AND is_active = true
        LOOP
            -- Extract expected document type
            IF alert_rule.condition_json ? 'document_type' THEN
                -- Check if document exists
                SELECT EXISTS(
                    SELECT 1 FROM collateral_documents
                    WHERE loan_id = loan.loan_id
                    AND LOWER(document_type) = LOWER(alert_rule.condition_json->>'document_type')
                ) INTO doc_exists;
                
                IF NOT doc_exists THEN
                    event_data := jsonb_build_object(
                        'loan_id', loan.loan_id,
                        'document_type', alert_rule.condition_json->>'document_type',
                        'days_since_loan_added', days_since_added
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
                                'Missing ' || (alert_rule.condition_json->>'document_type') || ' - Loan ' || loan.loan_id,
                                'Required document not uploaded after ' || days_since_added || ' days',
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

-- 11. Create update trigger for timestamp
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_alert_rules_updated_at 
    BEFORE UPDATE ON alert_rules 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at();