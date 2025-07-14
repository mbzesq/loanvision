-- Migration: Fix loan_collateral_status trigger v2
-- Date: 2025-07-13
-- Purpose: Fix trigger to properly handle all document types and ensure collateral status updates

-- Drop existing trigger to recreate it
DROP TRIGGER IF EXISTS update_collateral_status_trigger ON document_analysis;

-- Create improved function to update loan_collateral_status when documents are added
CREATE OR REPLACE FUNCTION update_loan_collateral_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Add logging for debugging
    RAISE NOTICE 'Trigger fired: Document type: %, Loan ID: %, Confidence: %', 
        NEW.document_type, NEW.loan_id, NEW.confidence_score;
    
    -- Insert or update the loan_collateral_status record (ensuring it exists)
    INSERT INTO loan_collateral_status (loan_id, last_document_added)
    VALUES (NEW.loan_id, NOW())
    ON CONFLICT (loan_id) DO UPDATE
    SET last_document_added = NOW(),
        last_updated = NOW();
    
    -- Update document counts and flags with improved document type matching
    WITH doc_counts AS (
        SELECT 
            loan_id,
            -- Note counting (case insensitive)
            COUNT(*) FILTER (WHERE LOWER(document_type) IN ('note', 'promissory note')) as note_count,
            
            -- Security instrument counting (handle all variations)
            COUNT(*) FILTER (WHERE LOWER(document_type) IN (
                'security instrument', 
                'mortgage', 
                'deed of trust',
                'deed_of_trust'
            )) as mortgage_count,
            
            -- Assignment counting (case insensitive)
            COUNT(*) FILTER (WHERE LOWER(document_type) IN (
                'assignment',
                'assignment of mortgage',
                'assignment of deed of trust'
            )) as assignment_count,
            
            -- Allonge counting (case insensitive)
            COUNT(*) FILTER (WHERE LOWER(document_type) IN ('allonge', 'endorsement')) as allonge_count,
            
            -- Other document counting
            COUNT(*) FILTER (WHERE LOWER(document_type) NOT IN (
                'note', 'promissory note',
                'security instrument', 'mortgage', 'deed of trust', 'deed_of_trust',
                'assignment', 'assignment of mortgage', 'assignment of deed of trust',
                'allonge', 'endorsement'
            )) as other_count,
            
            COUNT(*) as total_count
        FROM document_analysis
        WHERE loan_id = NEW.loan_id
        GROUP BY loan_id
    )
    UPDATE loan_collateral_status
    SET 
        note_count = COALESCE(doc_counts.note_count, 0),
        mortgage_count = COALESCE(doc_counts.mortgage_count, 0),
        assignment_count = COALESCE(doc_counts.assignment_count, 0),
        allonge_count = COALESCE(doc_counts.allonge_count, 0),
        other_document_count = COALESCE(doc_counts.other_count, 0),
        total_document_count = COALESCE(doc_counts.total_count, 0),
        has_note = COALESCE(doc_counts.note_count, 0) > 0,
        has_mortgage = COALESCE(doc_counts.mortgage_count, 0) > 0,
        has_all_assignments = COALESCE(doc_counts.assignment_count, 0) > 0,
        has_allonges = COALESCE(doc_counts.allonge_count, 0) > 0,
        
        -- Calculate completeness score
        completeness_score = CASE
            WHEN COALESCE(doc_counts.note_count, 0) > 0 AND 
                 COALESCE(doc_counts.mortgage_count, 0) > 0 AND 
                 COALESCE(doc_counts.assignment_count, 0) > 0 THEN 100
            WHEN COALESCE(doc_counts.note_count, 0) > 0 AND 
                 COALESCE(doc_counts.mortgage_count, 0) > 0 THEN 66
            WHEN COALESCE(doc_counts.note_count, 0) > 0 OR 
                 COALESCE(doc_counts.mortgage_count, 0) > 0 THEN 33
            ELSE 0
        END,
        
        -- Update missing documents array
        missing_documents = ARRAY_REMOVE(ARRAY[
            CASE WHEN COALESCE(doc_counts.note_count, 0) = 0 THEN 'Note' END,
            CASE WHEN COALESCE(doc_counts.mortgage_count, 0) = 0 THEN 'Security Instrument' END,
            CASE WHEN COALESCE(doc_counts.assignment_count, 0) = 0 THEN 'Assignment' END
        ], NULL),
        
        last_updated = NOW()
    FROM doc_counts
    WHERE loan_collateral_status.loan_id = NEW.loan_id;
    
    -- Add additional logging to confirm update
    RAISE NOTICE 'Updated collateral status for loan %', NEW.loan_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER update_collateral_status_trigger
AFTER INSERT OR UPDATE ON document_analysis
FOR EACH ROW
EXECUTE FUNCTION update_loan_collateral_status();

-- Force update of collateral status for all loans by updating their confidence scores
-- This will trigger the function for all existing documents
DO $$
BEGIN
    -- Update confidence scores by 0.0001 to trigger the update without materially changing the values
    UPDATE document_analysis 
    SET confidence_score = confidence_score + 0.0001
    WHERE confidence_score < 0.9999;
    
    -- For documents at max confidence, slightly reduce
    UPDATE document_analysis 
    SET confidence_score = confidence_score - 0.0001
    WHERE confidence_score >= 0.9999;
    
    RAISE NOTICE '✅ Trigger fixed and existing collateral status updated';
END $$;

-- Verify the fix for loan 0000667254 specifically
DO $$
DECLARE
    loan_status RECORD;
    doc_count INTEGER;
BEGIN
    -- Check what documents exist for this loan
    SELECT COUNT(*) INTO doc_count
    FROM document_analysis 
    WHERE loan_id = '0000667254';
    
    RAISE NOTICE 'Found % documents for loan 0000667254', doc_count;
    
    -- Show document details
    FOR loan_status IN 
        SELECT document_type, confidence_score, created_at
        FROM document_analysis 
        WHERE loan_id = '0000667254'
        ORDER BY created_at DESC
    LOOP
        RAISE NOTICE '  - % (confidence: %)', loan_status.document_type, loan_status.confidence_score;
    END LOOP;
    
    -- Check collateral status
    SELECT * INTO loan_status 
    FROM loan_collateral_status 
    WHERE loan_id = '0000667254';
    
    IF FOUND THEN
        RAISE NOTICE '';
        RAISE NOTICE 'Collateral status for loan 0000667254:';
        RAISE NOTICE '  has_mortgage: %', loan_status.has_mortgage;
        RAISE NOTICE '  mortgage_count: %', loan_status.mortgage_count;
        RAISE NOTICE '  completeness_score: %', loan_status.completeness_score;
        RAISE NOTICE '  missing_documents: %', loan_status.missing_documents;
    ELSE
        RAISE NOTICE 'No collateral status found for loan 0000667254';
    END IF;
END $$;