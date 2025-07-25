-- Add chain analysis columns to document_analysis table
ALTER TABLE document_analysis 
ADD COLUMN IF NOT EXISTS has_endorsements BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS endorsement_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS endorsement_chain JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ends_with_current_investor BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ends_in_blank BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_assignment_chain BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS assignment_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS assignment_chain JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS assignment_ends_with_current_investor BOOLEAN DEFAULT FALSE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_document_analysis_loan_endorsements 
ON document_analysis(loan_id, has_endorsements) 
WHERE document_type = 'Note';

CREATE INDEX IF NOT EXISTS idx_document_analysis_loan_assignments 
ON document_analysis(loan_id, has_assignment_chain) 
WHERE document_type = 'Assignment';

-- Create note_current_ownership table
CREATE TABLE IF NOT EXISTS note_current_ownership (
    id SERIAL PRIMARY KEY,
    loan_id VARCHAR(50) NOT NULL,
    document_analysis_id INTEGER NOT NULL,
    current_owner VARCHAR(255),
    is_blank_endorsed BOOLEAN DEFAULT FALSE,
    total_endorsements INTEGER DEFAULT 0,
    note_analysis_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    borrower_name VARCHAR(255),
    file_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_document_analysis FOREIGN KEY (document_analysis_id) 
        REFERENCES document_analysis(id) ON DELETE CASCADE
);

-- Create indexes for note_current_ownership
CREATE INDEX IF NOT EXISTS idx_note_current_ownership_loan_id 
ON note_current_ownership(loan_id);

CREATE INDEX IF NOT EXISTS idx_note_current_ownership_analysis_date 
ON note_current_ownership(note_analysis_date DESC);

-- Create allonge_chain_analysis table
CREATE TABLE IF NOT EXISTS allonge_chain_analysis (
    id SERIAL PRIMARY KEY,
    loan_id VARCHAR(50) NOT NULL,
    document_analysis_id INTEGER NOT NULL,
    endorsement_chain JSONB NOT NULL DEFAULT '[]'::jsonb,
    chain_length INTEGER DEFAULT 0,
    has_blank_endorsement BOOLEAN DEFAULT FALSE,
    blank_endorsement_position INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_document_analysis_allonge FOREIGN KEY (document_analysis_id) 
        REFERENCES document_analysis(id) ON DELETE CASCADE
);

-- Create index for allonge_chain_analysis
CREATE INDEX IF NOT EXISTS idx_allonge_chain_analysis_loan_id 
ON allonge_chain_analysis(loan_id);

-- Create note_allonge_chains table (for detailed endorsement storage)
CREATE TABLE IF NOT EXISTS note_allonge_chains (
    id SERIAL PRIMARY KEY,
    document_analysis_id INTEGER NOT NULL,
    loan_id VARCHAR(50) NOT NULL,
    sequence_number INTEGER NOT NULL,
    endorser VARCHAR(255),
    endorsee VARCHAR(255),
    endorsement_type VARCHAR(50) CHECK (endorsement_type IN ('specific', 'blank')),
    endorsement_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_document_analysis_chains FOREIGN KEY (document_analysis_id) 
        REFERENCES document_analysis(id) ON DELETE CASCADE
);

-- Create indexes for note_allonge_chains
CREATE INDEX IF NOT EXISTS idx_note_allonge_chains_document_id 
ON note_allonge_chains(document_analysis_id);

CREATE INDEX IF NOT EXISTS idx_note_allonge_chains_loan_id 
ON note_allonge_chains(loan_id);