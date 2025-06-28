// src/backend/migrations/20250628120000_add_index_to_loan_type.ts
import { Pool } from 'pg';

export const up = async (pool: Pool): Promise<void> => {
  await pool.query(`
    -- Add an index to the loan_type column for faster grouping/filtering
    CREATE INDEX idx_daily_metrics_current_loan_type ON daily_metrics_current(loan_type);
  `);
};

export const down = async (pool: Pool): Promise<void> => {
  await pool.query(`
    -- Drop the index if we need to revert the migration
    DROP INDEX IF EXISTS idx_daily_metrics_current_loan_type;
  `);
};