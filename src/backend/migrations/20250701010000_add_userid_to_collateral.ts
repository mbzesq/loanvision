import { Pool } from 'pg';

export const up = async (pool: Pool): Promise<void> => {
  await pool.query(`
    ALTER TABLE collateral_documents
    ADD COLUMN user_id INTEGER;

    ALTER TABLE collateral_documents
    ADD CONSTRAINT fk_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL;
  `);
};

export const down = async (pool: Pool): Promise<void> => {
  await pool.query(`
    ALTER TABLE collateral_documents
    DROP CONSTRAINT IF EXISTS fk_user;

    ALTER TABLE collateral_documents
    DROP COLUMN IF EXISTS user_id;
  `);
};