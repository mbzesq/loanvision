-- Refactor Alert System to Create Inbox Tasks
-- Created: 2025-01-14
-- Purpose: Convert alert triggers to create inbox tasks with notifications

-- 1. Create notifications table for real-time alerts about new inbox tasks
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    inbox_item_id INTEGER REFERENCES inbox_items(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;

-- 2. Add task type definitions for inbox items
ALTER TABLE inbox_items 
ADD COLUMN IF NOT EXISTS task_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS loan_id TEXT REFERENCES daily_metrics_current(loan_id),
ADD COLUMN IF NOT EXISTS document_id INTEGER REFERENCES collateral_documents(id);

-- Index for loan-based task queries
CREATE INDEX IF NOT EXISTS idx_inbox_items_loan_id ON inbox_items(loan_id) WHERE loan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inbox_items_task_type ON inbox_items(task_type);

-- 3. Function to assign tasks to appropriate users (simple for now, role-based later)
CREATE OR REPLACE FUNCTION get_task_assignee(
    task_type_param TEXT,
    loan_id_param TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    assignee_id INTEGER;
BEGIN
    -- For now, assign to any active user (we'll make this role-based later)
    -- Priority: 1) Loan assigned user, 2) First active user
    
    IF loan_id_param IS NOT NULL THEN
        -- Check if loan has assigned user
        SELECT u.id INTO assignee_id
        FROM user_loan_assignments ula
        JOIN users u ON ula.user_id = u.id
        WHERE ula.loan_id = loan_id_param
        LIMIT 1;
    END IF;
    
    -- Fallback to first active user
    IF assignee_id IS NULL THEN
        SELECT id INTO assignee_id
        FROM users
        WHERE id > 1 -- Skip system user
        ORDER BY id
        LIMIT 1;
    END IF;
    
    RETURN assignee_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Function to create inbox task and send notification
CREATE OR REPLACE FUNCTION create_inbox_task_with_notification(
    task_type_param TEXT,
    title_param TEXT,
    description_param TEXT,
    loan_id_param TEXT DEFAULT NULL,
    document_id_param INTEGER DEFAULT NULL,
    priority_param TEXT DEFAULT 'medium',
    metadata_param JSONB DEFAULT '{}'::jsonb
) RETURNS INTEGER AS $$
DECLARE
    task_id INTEGER;
    assignee_id INTEGER;
    notification_message TEXT;
BEGIN
    -- Get assignee
    assignee_id := get_task_assignee(task_type_param, loan_id_param);
    
    -- Create inbox task
    INSERT INTO inbox_items (
        task_type, title, description, loan_id, document_id,
        priority, status, assigned_to, metadata, created_by
    ) VALUES (
        task_type_param, title_param, description_param, loan_id_param, document_id_param,
        priority_param, 'pending', assignee_id, metadata_param, 'system'
    ) RETURNING id INTO task_id;
    
    -- Create notification message based on task type
    notification_message := CASE task_type_param
        WHEN 'document_review_low_confidence' THEN 'New Document Review task in your inbox'
        WHEN 'document_review_critical_confidence' THEN 'New Critical Document Review task in your inbox'
        WHEN 'foreclosure_action_scheduled' THEN 'New Foreclosure Action task in your inbox'
        WHEN 'foreclosure_action_urgent' THEN 'New Urgent Foreclosure Action task in your inbox'
        WHEN 'foreclosure_completion_review' THEN 'New Foreclosure Completion task in your inbox'
        WHEN 'document_upload_required' THEN 'New Document Upload task in your inbox'
        WHEN 'title_report_upload_required' THEN 'New Title Report Upload task in your inbox'
        WHEN 'payment_investigation' THEN 'New Payment Investigation task in your inbox'
        WHEN 'loan_reinstatement_review' THEN 'New Loan Reinstatement Review task in your inbox'
        ELSE 'New task in your inbox'
    END;
    
    -- Create notification
    IF assignee_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, inbox_item_id, message)
        VALUES (assignee_id, task_id, notification_message);
        
        -- Send real-time notification
        PERFORM pg_notify('new_inbox_task', json_build_object(
            'task_id', task_id,
            'user_id', assignee_id,
            'message', notification_message,
            'task_type', task_type_param
        )::text);
    END IF;
    
    RETURN task_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Replace document upload alert trigger with inbox task creation
CREATE OR REPLACE FUNCTION trigger_document_upload_task() RETURNS TRIGGER AS $$
DECLARE
    task_type_val TEXT;
    title_val TEXT;
    description_val TEXT;
    priority_val TEXT;
    confidence_val NUMERIC;
BEGIN
    confidence_val := COALESCE(NEW.confidence_score, 100);
    
    -- Determine task type and priority based on confidence
    IF confidence_val < 50 THEN
        task_type_val := 'document_review_critical_confidence';
        title_val := 'Critical: Review Very Low Confidence Document';
        description_val := 'Document "' || NEW.file_name || '" uploaded with only ' || confidence_val || '% confidence. Immediate review required.';
        priority_val := 'critical';
    ELSIF confidence_val < 70 THEN
        task_type_val := 'document_review_low_confidence';
        title_val := 'Review Low Confidence Document';
        description_val := 'Document "' || NEW.file_name || '" uploaded with ' || confidence_val || '% confidence. Manual validation recommended.';
        priority_val := 'high';
    ELSE
        -- Don't create task for high confidence documents
        RETURN NEW;
    END IF;
    
    -- Create inbox task
    PERFORM create_inbox_task_with_notification(
        task_type_val,
        title_val,
        description_val,
        NEW.loan_id,
        NEW.id,
        priority_val,
        jsonb_build_object(
            'confidence_score', confidence_val,
            'document_type', NEW.document_type,
            'file_name', NEW.file_name
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace the trigger
DROP TRIGGER IF EXISTS document_upload_alert_trigger ON collateral_documents;
CREATE TRIGGER document_upload_task_trigger
    AFTER INSERT ON collateral_documents
    FOR EACH ROW
    EXECUTE FUNCTION trigger_document_upload_task();

-- 6. Replace foreclosure alert trigger with inbox task creation
CREATE OR REPLACE FUNCTION trigger_foreclosure_status_task() RETURNS TRIGGER AS $$
DECLARE
    task_type_val TEXT;
    title_val TEXT;
    description_val TEXT;
    priority_val TEXT;
    days_until_sale INTEGER;
BEGIN
    -- Calculate days until sale if scheduled
    IF NEW.sale_scheduled_date IS NOT NULL THEN
        days_until_sale := EXTRACT(DAY FROM NEW.sale_scheduled_date - CURRENT_DATE);
    END IF;
    
    -- Check for status changes or new sale dates
    IF (TG_OP = 'UPDATE' AND (
        OLD.fc_status IS DISTINCT FROM NEW.fc_status OR
        OLD.sale_scheduled_date IS DISTINCT FROM NEW.sale_scheduled_date OR
        OLD.sale_held_date IS DISTINCT FROM NEW.sale_held_date OR
        OLD.real_estate_owned_date IS DISTINCT FROM NEW.real_estate_owned_date
    )) OR TG_OP = 'INSERT' THEN
        
        -- Determine task type based on foreclosure status
        IF NEW.sale_scheduled_date IS NOT NULL AND NEW.sale_held_date IS NULL THEN
            IF days_until_sale <= 7 THEN
                task_type_val := 'foreclosure_action_urgent';
                title_val := 'URGENT: Foreclosure Sale in ' || days_until_sale || ' Days';
                description_val := 'Foreclosure sale scheduled for ' || TO_CHAR(NEW.sale_scheduled_date, 'MM/DD/YYYY') || '. Immediate action may be required.';
                priority_val := 'critical';
            ELSIF days_until_sale <= 30 THEN
                task_type_val := 'foreclosure_action_scheduled';
                title_val := 'Foreclosure Sale Scheduled';
                description_val := 'Foreclosure sale scheduled for ' || TO_CHAR(NEW.sale_scheduled_date, 'MM/DD/YYYY') || ' (' || days_until_sale || ' days). Review and prepare.';
                priority_val := 'high';
            ELSE
                -- Don't create task for sales > 30 days out
                RETURN NEW;
            END IF;
        ELSIF NEW.sale_held_date IS NOT NULL OR NEW.real_estate_owned_date IS NOT NULL THEN
            task_type_val := 'foreclosure_completion_review';
            title_val := 'Review Foreclosure Completion';
            description_val := 'Foreclosure process completed. Review outcome and update loan status.';
            priority_val := 'medium';
        ELSE
            -- No task needed for other status changes
            RETURN NEW;
        END IF;
        
        -- Create inbox task
        PERFORM create_inbox_task_with_notification(
            task_type_val,
            title_val,
            description_val,
            NEW.loan_id,
            NULL,
            priority_val,
            jsonb_build_object(
                'sale_date', NEW.sale_scheduled_date,
                'sale_held_date', NEW.sale_held_date,
                'reo_date', NEW.real_estate_owned_date,
                'fc_status', NEW.fc_status,
                'days_until_sale', days_until_sale
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace the trigger
DROP TRIGGER IF EXISTS foreclosure_status_alert_trigger ON foreclosure_events;
CREATE TRIGGER foreclosure_status_task_trigger
    AFTER INSERT OR UPDATE ON foreclosure_events
    FOR EACH ROW
    EXECUTE FUNCTION trigger_foreclosure_status_task();

-- 7. Replace payment alert trigger with inbox task creation
CREATE OR REPLACE FUNCTION trigger_payment_task() RETURNS TRIGGER AS $$
DECLARE
    months_delinquent INTEGER;
    payment_amount NUMERIC;
BEGIN
    -- Only trigger on payment date changes
    IF TG_OP = 'UPDATE' AND OLD.last_pymt_received IS DISTINCT FROM NEW.last_pymt_received AND NEW.last_pymt_received IS NOT NULL THEN
        
        -- Calculate months delinquent
        months_delinquent := EXTRACT(MONTH FROM AGE(CURRENT_DATE, NEW.next_pymt_due));
        
        -- Only create task if loan was significantly delinquent
        IF months_delinquent > 6 THEN
            -- Try to determine payment amount
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
            
            -- Create inbox task
            PERFORM create_inbox_task_with_notification(
                'payment_investigation',
                'Investigate Payment on Delinquent Loan',
                'Payment of $' || COALESCE(payment_amount::text, 'Unknown') || ' received on ' || TO_CHAR(NEW.last_pymt_received, 'MM/DD/YYYY') || ' for loan that was ' || months_delinquent || ' months delinquent.',
                NEW.loan_id,
                NULL,
                'medium',
                jsonb_build_object(
                    'payment_date', NEW.last_pymt_received,
                    'payment_amount', payment_amount,
                    'months_delinquent', months_delinquent
                )
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace the trigger
DROP TRIGGER IF EXISTS payment_alert_trigger ON daily_metrics_current;
CREATE TRIGGER payment_task_trigger
    AFTER UPDATE ON daily_metrics_current
    FOR EACH ROW
    EXECUTE FUNCTION trigger_payment_task();

-- 8. Update missing documents function to create inbox tasks
CREATE OR REPLACE FUNCTION check_missing_documents_tasks() RETURNS void AS $$
DECLARE
    loan RECORD;
    days_since_added INTEGER;
    doc_exists BOOLEAN;
    task_type_val TEXT;
    title_val TEXT;
    description_val TEXT;
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
        
        -- Check for missing security instrument after 7 days
        IF days_since_added > 7 THEN
            SELECT EXISTS(
                SELECT 1 FROM collateral_documents
                WHERE loan_id = loan.loan_id
                AND (
                    LOWER(document_type) LIKE '%security%' OR
                    LOWER(document_type) LIKE '%mortgage%' OR
                    LOWER(document_type) LIKE '%deed%'
                )
            ) INTO doc_exists;
            
            IF NOT doc_exists THEN
                -- Only create if no active task exists
                IF NOT EXISTS(
                    SELECT 1 FROM inbox_items
                    WHERE task_type = 'document_upload_required'
                    AND loan_id = loan.loan_id
                    AND status IN ('unread', 'in_progress')
                ) THEN
                    PERFORM create_inbox_task_with_notification(
                        'document_upload_required',
                        'Upload Missing Security Instrument',
                        'Security instrument (mortgage, deed of trust) has not been uploaded for this loan after ' || days_since_added || ' days.',
                        loan.loan_id,
                        NULL,
                        'medium',
                        jsonb_build_object(
                            'required_document_type', 'security_instrument',
                            'days_since_loan_added', days_since_added
                        )
                    );
                END IF;
            END IF;
        END IF;
        
        -- Check for missing title report after 14 days
        IF days_since_added > 14 THEN
            SELECT EXISTS(
                SELECT 1 FROM collateral_documents
                WHERE loan_id = loan.loan_id
                AND LOWER(document_type) LIKE '%title%'
            ) INTO doc_exists;
            
            IF NOT doc_exists THEN
                -- Only create if no active task exists
                IF NOT EXISTS(
                    SELECT 1 FROM inbox_items
                    WHERE task_type = 'title_report_upload_required'
                    AND loan_id = loan.loan_id
                    AND status IN ('unread', 'in_progress')
                ) THEN
                    PERFORM create_inbox_task_with_notification(
                        'title_report_upload_required',
                        'Upload Missing Title Report',
                        'Title report has not been uploaded for this loan after ' || days_since_added || ' days.',
                        loan.loan_id,
                        NULL,
                        'medium',
                        jsonb_build_object(
                            'required_document_type', 'title_report',
                            'days_since_loan_added', days_since_added
                        )
                    );
                END IF;
            END IF;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 9. Add loan status change trigger for reinstatements
CREATE OR REPLACE FUNCTION trigger_loan_status_task() RETURNS TRIGGER AS $$
BEGIN
    -- Check for status changes that might indicate reinstatement
    IF TG_OP = 'UPDATE' AND OLD.legal_status IS DISTINCT FROM NEW.legal_status THEN
        
        -- Detect potential reinstatement
        IF (NEW.legal_status ILIKE '%current%' OR NEW.legal_status ILIKE '%performing%' OR NEW.legal_status ILIKE '%reinstate%') 
           AND (OLD.legal_status ILIKE '%delinquent%' OR OLD.legal_status ILIKE '%default%') THEN
            
            -- Create inbox task for reinstatement review
            PERFORM create_inbox_task_with_notification(
                'loan_reinstatement_review',
                'Review Loan Reinstatement',
                'Loan status changed from "' || COALESCE(OLD.legal_status, 'Unknown') || '" to "' || COALESCE(NEW.legal_status, 'Unknown') || '". Verify reinstatement and update records.',
                NEW.loan_id,
                NULL,
                'high',
                jsonb_build_object(
                    'old_status', OLD.legal_status,
                    'new_status', NEW.legal_status,
                    'status_change_date', CURRENT_TIMESTAMP
                )
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS loan_status_alert_trigger ON daily_metrics_current;
CREATE TRIGGER loan_status_task_trigger
    AFTER UPDATE ON daily_metrics_current
    FOR EACH ROW
    EXECUTE FUNCTION trigger_loan_status_task();

-- 10. Clean up old alert tables (keep for now, remove later after testing)
-- DROP TABLE IF EXISTS alert_deliveries;
-- DROP TABLE IF EXISTS alert_actions;
-- DROP TABLE IF EXISTS alert_subscriptions;
-- DROP TABLE IF EXISTS alerts;
-- DROP TABLE IF EXISTS alert_rules;