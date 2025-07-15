-- Fix inbox trigger to use correct column names
-- The inbox_items table uses 'subject' and 'body' not 'title' and 'description'

-- Update the create_inbox_task_with_notification function
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
    
    -- Create inbox task (using correct column names)
    INSERT INTO inbox_items (
        task_type, subject, body, loan_id, document_id,
        priority, status, assigned_to_user_id, metadata, created_by_user_id,
        type, source
    ) VALUES (
        task_type_param, title_param, description_param, loan_id_param, document_id_param,
        priority_param, 'pending', assignee_id, metadata_param, 1,
        'task', 'system'
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

-- Also update the get_task_assignee function to handle null users better
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
    
    -- Fallback to first active user (not system user)
    IF assignee_id IS NULL THEN
        SELECT id INTO assignee_id
        FROM users
        WHERE id > 1 -- Skip system user
        ORDER BY id
        LIMIT 1;
    END IF;
    
    -- If still no user, use user 1 as fallback
    IF assignee_id IS NULL THEN
        assignee_id := 1;
    END IF;
    
    RETURN assignee_id;
END;
$$ LANGUAGE plpgsql;