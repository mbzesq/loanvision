-- Migration: Create loan_collateral_status table
-- Date: 2025-07-07
-- Purpose: Track collateral document completeness and chain of title for each loan

-- Create loan_collateral_status table (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loan_collateral_status') THEN
        
        CREATE TABLE loan_collateral_status (
            loan_id VARCHAR(50) PRIMARY KEY,
            
            -- Document presence flags
            has_note BOOLEAN DEFAULT FALSE,
            has_mortgage BOOLEAN DEFAULT FALSE,
            has_all_assignments BOOLEAN DEFAULT FALSE,
            has_allonges BOOLEAN DEFAULT FALSE,
            
            -- Chain of title tracking
            assignment_chain_complete BOOLEAN DEFAULT FALSE,
            chain_originator VARCHAR(255),
            chain_current_holder VARCHAR(255),
            chain_gap_details TEXT,
            
            -- Document counts
            note_count INTEGER DEFAULT 0,
            mortgage_count INTEGER DEFAULT 0,
            assignment_count INTEGER DEFAULT 0,
            allonge_count INTEGER DEFAULT 0,
            other_document_count INTEGER DEFAULT 0,
            total_document_count INTEGER DEFAULT 0,
            
            -- Missing document tracking
            missing_documents TEXT[],
            
            -- Calculated completeness score (0-100)
            completeness_score INTEGER DEFAULT 0,
            
            -- QA and validation
            requires_qa_review BOOLEAN DEFAULT FALSE,
            qa_notes TEXT,
            
            -- Timestamps
            last_document_added TIMESTAMPTZ,
            last_updated TIMESTAMPTZ DEFAULT NOW(),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Performance indexes
        CREATE INDEX idx_loan_collateral_status_completeness ON loan_collateral_status(completeness_score);
        CREATE INDEX idx_loan_collateral_status_qa_review ON loan_collateral_status(requires_qa_review);
        CREATE INDEX idx_loan_collateral_status_chain_complete ON loan_collateral_status(assignment_chain_complete);
        CREATE INDEX idx_loan_collateral_status_updated ON loan_collateral_status(last_updated);

        RAISE NOTICE 'Created loan_collateral_status table successfully';
        
    ELSE
        RAISE NOTICE 'Table loan_collateral_status already exists, skipping creation';
    END IF;
END $$;

-- Create chain_of_title table for tracking assignment history
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chain_of_title') THEN
        
        CREATE TABLE chain_of_title (
            id SERIAL PRIMARY KEY,
            loan_id VARCHAR(50) NOT NULL,
            document_analysis_id INTEGER NOT NULL,
            
            -- Transfer details
            transferor VARCHAR(255),
            transferee VARCHAR(255),
            transfer_date DATE,
            recording_date DATE,
            
            -- Document details
            document_type VARCHAR(50), -- 'assignment' or 'allonge'
            instrument_number VARCHAR(100),
            
            -- Chain position
            sequence_number INTEGER, -- Order in the chain
            is_gap BOOLEAN DEFAULT FALSE,
            gap_reason TEXT,
            
            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT NOW(),
            
            CONSTRAINT fk_document_analysis_chain
                FOREIGN KEY(document_analysis_id)
                REFERENCES document_analysis(id)
                ON DELETE CASCADE
        );

        -- Performance indexes
        CREATE INDEX idx_chain_of_title_loan_id ON chain_of_title(loan_id);
        CREATE INDEX idx_chain_of_title_sequence ON chain_of_title(loan_id, sequence_number);
        CREATE INDEX idx_chain_of_title_document_id ON chain_of_title(document_analysis_id);

        RAISE NOTICE 'Created chain_of_title table successfully';
        
    ELSE
        RAISE NOTICE 'Table chain_of_title already exists, skipping creation';
    END IF;
END $$;

-- Create function to update loan_collateral_status when documents are added
CREATE OR REPLACE FUNCTION update_loan_collateral_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update the loan_collateral_status record
    INSERT INTO loan_collateral_status (loan_id, last_document_added)
    VALUES (NEW.loan_id, NOW())
    ON CONFLICT (loan_id) DO UPDATE
    SET last_document_added = NOW(),
        last_updated = NOW();
    
    -- Update document counts and flags
    WITH doc_counts AS (
        SELECT 
            loan_id,
            COUNT(*) FILTER (WHERE document_type = 'Note') as note_count,
            COUNT(*) FILTER (WHERE document_type = 'Security Instrument') as mortgage_count,
            COUNT(*) FILTER (WHERE document_type = 'Assignment') as assignment_count,
            COUNT(*) FILTER (WHERE document_type = 'Allonge') as allonge_count,
            COUNT(*) FILTER (WHERE document_type NOT IN ('Note', 'Security Instrument', 'Assignment', 'Allonge')) as other_count,
            COUNT(*) as total_count
        FROM document_analysis
        WHERE loan_id = NEW.loan_id
        GROUP BY loan_id
    )
    UPDATE loan_collateral_status
    SET 
        note_count = doc_counts.note_count,
        mortgage_count = doc_counts.mortgage_count,
        assignment_count = doc_counts.assignment_count,
        allonge_count = doc_counts.allonge_count,
        other_document_count = doc_counts.other_count,
        total_document_count = doc_counts.total_count,
        has_note = doc_counts.note_count > 0,
        has_mortgage = doc_counts.mortgage_count > 0,
        has_all_assignments = doc_counts.assignment_count > 0,
        has_allonges = doc_counts.allonge_count > 0,
        -- Calculate completeness score (simplified for now)
        completeness_score = CASE
            WHEN doc_counts.note_count > 0 AND doc_counts.mortgage_count > 0 AND doc_counts.assignment_count > 0 THEN 100
            WHEN doc_counts.note_count > 0 AND doc_counts.mortgage_count > 0 THEN 66
            WHEN doc_counts.note_count > 0 OR doc_counts.mortgage_count > 0 THEN 33
            ELSE 0
        END,
        -- Update missing documents array
        missing_documents = ARRAY_REMOVE(ARRAY[
            CASE WHEN doc_counts.note_count = 0 THEN 'Note' END,
            CASE WHEN doc_counts.mortgage_count = 0 THEN 'Mortgage/Deed of Trust' END,
            CASE WHEN doc_counts.assignment_count = 0 THEN 'Assignment' END
        ], NULL)
    FROM doc_counts
    WHERE loan_collateral_status.loan_id = NEW.loan_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for document_analysis inserts
DROP TRIGGER IF EXISTS update_collateral_status_trigger ON document_analysis;
CREATE TRIGGER update_collateral_status_trigger
AFTER INSERT ON document_analysis
FOR EACH ROW
EXECUTE FUNCTION update_loan_collateral_status();

-- Verify table creation
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loan_collateral_status') AND
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chain_of_title') THEN
        
        RAISE NOTICE '✅ All collateral tracking tables created successfully';
        
        -- Initialize loan_collateral_status for existing loans with documents
        INSERT INTO loan_collateral_status (loan_id)
        SELECT DISTINCT loan_id 
        FROM document_analysis
        ON CONFLICT (loan_id) DO NOTHING;
        
        -- Trigger the update function for all existing records
        UPDATE loan_collateral_status
        SET last_updated = NOW()
        WHERE loan_id IN (SELECT DISTINCT loan_id FROM document_analysis);
        
        RAISE NOTICE '✅ Initialized collateral status for existing loans';
        
    ELSE
        RAISE EXCEPTION '❌ Failed to create collateral tracking tables';
    END IF;
END $$;