-- Fix inbox function to use correct type enum value
-- inbox_item_type options: system_alert, user_message, task_assignment, loan_update, document_share, system_notification

CREATE OR REPLACE FUNCTION create_inbox_task_with_notification(
    task_type_param TEXT,
    title_param TEXT,
    description_param TEXT,
    loan_id_param TEXT DEFAULT NULL,
    document_id_param INTEGER DEFAULT NULL,
    priority_param TEXT DEFAULT 'normal',
    metadata_param JSONB DEFAULT '{}'::jsonb
) RETURNS INTEGER AS $$
DECLARE
    task_id INTEGER;
    assignee_id INTEGER;
    notification_message TEXT;
    mapped_priority inbox_priority;
    mapped_status inbox_status;
    mapped_type inbox_item_type;
BEGIN
    -- Get assignee
    assignee_id := get_task_assignee(task_type_param, loan_id_param);
    
    -- Map priority strings to enum values
    mapped_priority := CASE priority_param
        WHEN 'critical' THEN 'urgent'::inbox_priority
        WHEN 'high' THEN 'high'::inbox_priority
        WHEN 'medium' THEN 'normal'::inbox_priority
        WHEN 'low' THEN 'low'::inbox_priority
        ELSE 'normal'::inbox_priority
    END;
    
    -- Map status to enum
    mapped_status := 'unread'::inbox_status;
    
    -- Map type to enum (use task_assignment for our created tasks)
    mapped_type := 'task_assignment'::inbox_item_type;
    
    -- Create inbox task (using correct column names and enums)
    INSERT INTO inbox_items (
        task_type, subject, body, loan_id, document_id,
        priority, status, assigned_to_user_id, metadata, created_by_user_id,
        type, source
    ) VALUES (
        task_type_param, title_param, description_param, loan_id_param, document_id_param,
        mapped_priority, mapped_status, assignee_id, metadata_param, 1,
        mapped_type, 'system'
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