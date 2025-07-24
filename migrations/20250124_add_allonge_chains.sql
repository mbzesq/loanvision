-- Migration to add allonge chain tracking for notes
-- Date: 2025-01-24

-- Create table for allonge endorsement chains
CREATE TABLE IF NOT EXISTS note_allonge_chains (
    id SERIAL PRIMARY KEY,
    document_analysis_id INTEGER REFERENCES document_analysis(id) ON DELETE CASCADE,
    loan_id VARCHAR(255) NOT NULL,
    sequence_number INTEGER NOT NULL,
    endorser VARCHAR(255), -- The party endorsing (may be NULL for first endorsement)
    endorsee VARCHAR(255), -- The party being endorsed to ("BLANK" for blank endorsements)
    endorsement_type VARCHAR(20) NOT NULL CHECK (endorsement_type IN ('specific', 'blank')),
    endorsement_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(document_analysis_id, sequence_number),
    INDEX idx_allonge_loan_id (loan_id),
    INDEX idx_allonge_document_id (document_analysis_id),
    INDEX idx_allonge_sequence (document_analysis_id, sequence_number)
);

-- Add allonge-related fields to document_analysis table
ALTER TABLE document_analysis ADD COLUMN IF NOT EXISTS has_embedded_allonges BOOLEAN DEFAULT FALSE;
ALTER TABLE document_analysis ADD COLUMN IF NOT EXISTS allonge_count INTEGER DEFAULT 0;

-- Create view for current note ownership based on allonge chains
CREATE OR REPLACE VIEW note_current_ownership AS
SELECT 
    da.loan_id,
    da.id as document_analysis_id,
    da.file_name,
    da.borrower_name,
    CASE 
        WHEN nac_last.endorsement_type = 'blank' THEN 'HOLDER_IN_DUE_COURSE'
        WHEN nac_last.endorsee IS NOT NULL THEN nac_last.endorsee
        ELSE da.lender_name
    END as current_owner,
    CASE 
        WHEN nac_last.endorsement_type = 'blank' THEN TRUE
        ELSE FALSE
    END as is_blank_endorsed,
    COALESCE(da.allonge_count, 0) as total_endorsements,
    da.created_at as note_analysis_date
FROM document_analysis da
LEFT JOIN LATERAL (
    SELECT endorsee, endorsement_type, sequence_number
    FROM note_allonge_chains nac 
    WHERE nac.document_analysis_id = da.id 
    ORDER BY sequence_number DESC 
    LIMIT 1
) nac_last ON true
WHERE da.document_type = 'Note' 
   OR (da.document_type = 'Other' AND da.has_embedded_allonges = true);

-- Create view for complete allonge chain analysis
CREATE OR REPLACE VIEW allonge_chain_analysis AS
SELECT 
    nac.loan_id,
    nac.document_analysis_id,
    da.file_name,
    json_agg(
        json_build_object(
            'sequence', nac.sequence_number,
            'endorser', nac.endorser,
            'endorsee', nac.endorsee,
            'type', nac.endorsement_type,
            'text', nac.endorsement_text
        ) ORDER BY nac.sequence_number
    ) as endorsement_chain,
    COUNT(*) as chain_length,
    BOOL_OR(nac.endorsement_type = 'blank') as has_blank_endorsement,
    MAX(CASE WHEN nac.endorsement_type = 'blank' THEN nac.sequence_number END) as blank_endorsement_position
FROM note_allonge_chains nac
JOIN document_analysis da ON nac.document_analysis_id = da.id
GROUP BY nac.loan_id, nac.document_analysis_id, da.file_name;

-- Update loan_collateral_status to include note ownership tracking
ALTER TABLE loan_collateral_status ADD COLUMN IF NOT EXISTS note_current_owner VARCHAR(255);
ALTER TABLE loan_collateral_status ADD COLUMN IF NOT EXISTS note_is_blank_endorsed BOOLEAN DEFAULT FALSE;
ALTER TABLE loan_collateral_status ADD COLUMN IF NOT EXISTS note_endorsement_complete BOOLEAN DEFAULT TRUE;

-- Create trigger to update collateral status when allonge chains are modified
CREATE OR REPLACE FUNCTION update_note_ownership_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the loan_collateral_status with current note ownership
    INSERT INTO loan_collateral_status (loan_id, note_current_owner, note_is_blank_endorsed, note_endorsement_complete)
    SELECT 
        nco.loan_id,
        nco.current_owner,
        nco.is_blank_endorsed,
        TRUE -- For now, assume endorsement chain is complete if we can parse it
    FROM note_current_ownership nco
    WHERE nco.loan_id = COALESCE(NEW.loan_id, OLD.loan_id)
    ON CONFLICT (loan_id) DO UPDATE SET
        note_current_owner = EXCLUDED.note_current_owner,
        note_is_blank_endorsed = EXCLUDED.note_is_blank_endorsed,
        note_endorsement_complete = EXCLUDED.note_endorsement_complete,
        last_updated = NOW();
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on note_allonge_chains
DROP TRIGGER IF EXISTS trigger_update_note_ownership ON note_allonge_chains;
CREATE TRIGGER trigger_update_note_ownership
    AFTER INSERT OR UPDATE OR DELETE ON note_allonge_chains
    FOR EACH ROW
    EXECUTE FUNCTION update_note_ownership_status();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_analysis_note_allonges ON document_analysis(document_type, has_embedded_allonges) WHERE document_type = 'Note';
CREATE INDEX IF NOT EXISTS idx_loan_collateral_note_owner ON loan_collateral_status(loan_id, note_current_owner);

COMMENT ON TABLE note_allonge_chains IS 'Tracks allonge endorsement chains for notes, including blank endorsements';
COMMENT ON VIEW note_current_ownership IS 'Shows current ownership of notes based on allonge endorsement chains';
COMMENT ON VIEW allonge_chain_analysis IS 'Complete analysis of allonge chains with detailed endorsement information';