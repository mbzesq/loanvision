-- Fix NotificationEngine issues with enum values and column names

-- 1. Fix the missing documents function to use correct enum values
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
                -- Only create if no active task exists (using correct enum values)
                IF NOT EXISTS(
                    SELECT 1 FROM inbox_items
                    WHERE task_type = 'document_upload_required'
                    AND loan_id = loan.loan_id
                    AND status IN ('unread'::inbox_status, 'in_progress'::inbox_status)
                ) THEN
                    PERFORM create_inbox_task_with_notification(
                        'document_upload_required',
                        'Upload Missing Security Instrument',
                        'Security instrument (mortgage, deed of trust) has not been uploaded for this loan after ' || days_since_added || ' days.',
                        loan.loan_id,
                        NULL,
                        'normal',
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
                -- Only create if no active task exists (using correct enum values)
                IF NOT EXISTS(
                    SELECT 1 FROM inbox_items
                    WHERE task_type = 'title_report_upload_required'
                    AND loan_id = loan.loan_id
                    AND status IN ('unread'::inbox_status, 'in_progress'::inbox_status)
                ) THEN
                    PERFORM create_inbox_task_with_notification(
                        'title_report_upload_required',
                        'Upload Missing Title Report',
                        'Title report has not been uploaded for this loan after ' || days_since_added || ' days.',
                        loan.loan_id,
                        NULL,
                        'normal',
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