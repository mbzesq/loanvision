-- Fix confidence score display in task messages
-- The confidence score is stored as a decimal (0.53) but should be displayed as percentage (53%)

CREATE OR REPLACE FUNCTION trigger_document_upload_task() RETURNS TRIGGER AS $$
DECLARE
    task_type_val TEXT;
    title_val TEXT;
    description_val TEXT;
    priority_val TEXT;
    confidence_val NUMERIC;
    confidence_percent NUMERIC;
BEGIN
    confidence_val := COALESCE(NEW.confidence_score, 100);
    
    -- Convert decimal to percentage for display
    confidence_percent := ROUND(confidence_val * 100, 2);
    
    -- Determine task type and priority based on confidence
    IF confidence_val < 0.50 THEN
        task_type_val := 'document_review_critical_confidence';
        title_val := 'Critical: Review Very Low Confidence Document';
        description_val := 'Document "' || NEW.file_name || '" uploaded with only ' || confidence_percent || '% confidence. Immediate review required.';
        priority_val := 'critical';
    ELSIF confidence_val < 0.70 THEN
        task_type_val := 'document_review_low_confidence';
        title_val := 'Review Low Confidence Document';
        description_val := 'Document "' || NEW.file_name || '" uploaded with ' || confidence_percent || '% confidence. Manual validation recommended.';
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
            'confidence_score', confidence_percent,
            'document_type', NEW.document_type,
            'file_name', NEW.file_name
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;