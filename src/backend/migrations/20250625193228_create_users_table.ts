import { Pool } from 'pg';

export const up = async (pool: Pool): Promise<void> => {
  await pool.query(`
    -- Create users table with future-proof schema
    CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'pending',
        is_active BOOLEAN DEFAULT false,
        is_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        last_login_at TIMESTAMPTZ,
        -- Future fields (nullable for now)
        phone TEXT,
        company TEXT,
        department TEXT,
        two_factor_secret TEXT,
        two_factor_enabled BOOLEAN DEFAULT false,
        password_reset_token TEXT,
        password_reset_expires TIMESTAMPTZ,
        verification_token TEXT,
        verification_expires TIMESTAMPTZ,
        -- Metadata for tracking
        registration_ip TEXT,
        last_login_ip TEXT,
        failed_login_attempts INT DEFAULT 0,
        locked_until TIMESTAMPTZ,
        -- Preferences and settings
        preferences JSONB DEFAULT '{}',
        -- Audit fields
        created_by INT,
        updated_by INT,
        CONSTRAINT fk_created_by FOREIGN KEY(created_by) REFERENCES users(id),
        CONSTRAINT fk_updated_by FOREIGN KEY(updated_by) REFERENCES users(id)
    );

    -- Create role enum for future expansion
    COMMENT ON COLUMN users.role IS 'User role: pending, user, admin, super_admin';
    
    -- Create indexes for performance
    CREATE INDEX idx_users_email ON users(email);
    CREATE INDEX idx_users_role ON users(role);
    CREATE INDEX idx_users_is_active ON users(is_active);
    CREATE INDEX idx_users_created_at ON users(created_at);
    CREATE INDEX idx_users_company ON users(company);
    
    -- Add table comments for documentation
    COMMENT ON TABLE users IS 'User accounts with authentication and authorization data';
    COMMENT ON COLUMN users.email IS 'Primary email address used for login';
    COMMENT ON COLUMN users.role IS 'User role for authorization (pending, user, admin, super_admin)';
    COMMENT ON COLUMN users.is_active IS 'Whether the user account is active and can login';
    COMMENT ON COLUMN users.is_verified IS 'Whether the user has verified their email address';
    COMMENT ON COLUMN users.two_factor_secret IS 'Secret key for TOTP-based 2FA';
    COMMENT ON COLUMN users.password_reset_token IS 'Token for password reset flow';
    COMMENT ON COLUMN users.verification_token IS 'Token for email verification';
    COMMENT ON COLUMN users.failed_login_attempts IS 'Counter for failed login attempts';
    COMMENT ON COLUMN users.locked_until IS 'Account locked until this timestamp due to failed attempts';
    COMMENT ON COLUMN users.preferences IS 'User preferences and settings as JSON';

    -- Create session table for JWT/session management
    CREATE TABLE user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        last_accessed_at TIMESTAMPTZ DEFAULT now(),
        revoked BOOLEAN DEFAULT false,
        revoked_at TIMESTAMPTZ,
        CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Create indexes for session table
    CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
    CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);
    CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
    CREATE INDEX idx_user_sessions_revoked ON user_sessions(revoked);

    -- Add comments for session table
    COMMENT ON TABLE user_sessions IS 'Active user sessions for authentication';
    COMMENT ON COLUMN user_sessions.token_hash IS 'Hashed session token for security';
    COMMENT ON COLUMN user_sessions.expires_at IS 'Session expiration timestamp';
    COMMENT ON COLUMN user_sessions.revoked IS 'Whether the session has been manually revoked';

    -- Create activity log table for audit trail
    CREATE TABLE user_activity_log (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        action TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Create indexes for activity log
    CREATE INDEX idx_user_activity_log_user_id ON user_activity_log(user_id);
    CREATE INDEX idx_user_activity_log_action ON user_activity_log(action);
    CREATE INDEX idx_user_activity_log_created_at ON user_activity_log(created_at);

    -- Add comments for activity log
    COMMENT ON TABLE user_activity_log IS 'Audit trail of user actions';
    COMMENT ON COLUMN user_activity_log.action IS 'Action performed (login, logout, password_change, etc.)';
    COMMENT ON COLUMN user_activity_log.metadata IS 'Additional context about the action';

    -- Create trigger to update updated_at timestamp
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);
};

export const down = async (pool: Pool): Promise<void> => {
  await pool.query(`
    -- Drop trigger and function
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    DROP FUNCTION IF EXISTS update_updated_at_column();

    -- Drop tables in reverse order to respect foreign key constraints
    DROP TABLE IF EXISTS user_activity_log CASCADE;
    DROP TABLE IF EXISTS user_sessions CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
  `);
};