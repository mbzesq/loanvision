import { Pool } from 'pg';

export const up = async (pool: Pool): Promise<void> => {
  await pool.query(`
    -- Join table to link users to the specific loans they manage
    CREATE TABLE IF NOT EXISTS user_loan_assignments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        loan_id TEXT NOT NULL REFERENCES daily_metrics_current(loan_id) ON DELETE CASCADE,
        assigned_by_id INTEGER REFERENCES users(id), -- Manager who assigned the loan
        assigned_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, loan_id) -- Prevent duplicate assignments
    );

    -- Table to log significant user actions for audit purposes
    CREATE TABLE IF NOT EXISTS audit_trail (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id), -- Who performed the action
        action_type TEXT NOT NULL, -- e.g., 'LOGIN', 'LOAN_ASSIGNMENT', 'UPLOAD_FILE'
        target_type TEXT, -- e.g., 'loan', 'user'
        target_id TEXT, -- The ID of the affected entity
        details JSONB, -- Rich context about the event
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create indexes for performance
    CREATE INDEX idx_user_loan_assignments_user_id ON user_loan_assignments(user_id);
    CREATE INDEX idx_user_loan_assignments_loan_id ON user_loan_assignments(loan_id);
    CREATE INDEX idx_audit_trail_user_id ON audit_trail(user_id);
    CREATE INDEX idx_audit_trail_action_type ON audit_trail(action_type);
    CREATE INDEX idx_audit_trail_created_at ON audit_trail(created_at);

    -- Add comments for documentation
    COMMENT ON TABLE user_loan_assignments IS 'Maps which loans are assigned to which users.';
    COMMENT ON TABLE audit_trail IS 'Logs significant actions performed by users for security and tracking.';
  `);
};

export const down = async (pool: Pool): Promise<void> => {
  await pool.query(`
    -- Drop tables in reverse order to respect foreign key constraints
    DROP TABLE IF EXISTS audit_trail CASCADE;
    DROP TABLE IF EXISTS user_loan_assignments CASCADE;
  `);
};