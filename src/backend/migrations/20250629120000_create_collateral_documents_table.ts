import { Pool } from 'pg';

export const up = async (pool: Pool): Promise<void> => {
  await pool.query(`
    CREATE TABLE collateral_documents (
        id SERIAL PRIMARY KEY,
        loan_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        document_type TEXT,
        page_count INTEGER,
        uploaded_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT fk_loan
            FOREIGN KEY(loan_id)
            REFERENCES daily_metrics_current(loan_id)
            ON DELETE CASCADE
    );

    CREATE INDEX idx_collateral_documents_loan_id ON collateral_documents(loan_id);
    CREATE INDEX idx_collateral_documents_document_type ON collateral_documents(document_type);
    CREATE INDEX idx_collateral_documents_uploaded_at ON collateral_documents(uploaded_at);

    -- Add comments for documentation
    COMMENT ON TABLE collateral_documents IS 'Uploaded loan collateral documents with AI classification';
    COMMENT ON COLUMN collateral_documents.document_type IS 'Document type classified by AI (Note, Mortgage, etc.)';
    COMMENT ON COLUMN collateral_documents.storage_path IS 'File path in cloud storage or local filesystem';
  `);
};

export const down = async (pool: Pool): Promise<void> => {
  await pool.query(`
    DROP TABLE IF EXISTS collateral_documents CASCADE;
  `);
};