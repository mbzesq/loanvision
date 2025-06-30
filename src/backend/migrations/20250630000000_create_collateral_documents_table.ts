import { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE collateral_documents (
      id SERIAL PRIMARY KEY,
      loan_id VARCHAR(255) NOT NULL,
      filename VARCHAR(500) NOT NULL,
      document_type VARCHAR(100) NOT NULL,
      page_count INTEGER DEFAULT 1,
      upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      file_size INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add indexes for better query performance
  await pool.query(`
    CREATE INDEX idx_collateral_documents_loan_id ON collateral_documents(loan_id);
  `);
  
  await pool.query(`
    CREATE INDEX idx_collateral_documents_document_type ON collateral_documents(document_type);
  `);
  
  await pool.query(`
    CREATE INDEX idx_collateral_documents_upload_date ON collateral_documents(upload_date);
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS collateral_documents;');
}