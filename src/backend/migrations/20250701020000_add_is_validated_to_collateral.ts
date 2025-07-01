import { Pool } from 'pg';

export const up = async (pool: Pool): Promise<void> => {
  await pool.query(`
    ALTER TABLE collateral_documents
    ADD COLUMN is_validated BOOLEAN DEFAULT FALSE;
  `);
};

export const down = async (pool: Pool): Promise<void> => {
  await pool.query(`
    ALTER TABLE collateral_documents
    DROP COLUMN IF EXISTS is_validated;
  `);
};