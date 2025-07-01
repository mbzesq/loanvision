import { Pool } from 'pg';

export const up = async (pool: Pool): Promise<void> => {
  await pool.query(`
    -- file_size is stored in bytes
    ALTER TABLE collateral_documents
    ADD COLUMN file_size INTEGER;
  `);
};

export const down = async (pool: Pool): Promise<void> => {
  await pool.query(`
    ALTER TABLE collateral_documents
    DROP COLUMN IF EXISTS file_size;
  `);
};