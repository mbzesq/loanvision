-- Migration: Create user_sessions table for login/logout tracking
-- Date: 2025-07-10
-- Purpose: Track user login sessions, logout times, and session duration

-- Create user_sessions table (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_sessions') THEN
        
        CREATE TABLE user_sessions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            
            -- Session tracking
            session_token VARCHAR(255), -- JWT token ID or session identifier
            login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            logout_time TIMESTAMPTZ,
            last_activity TIMESTAMPTZ DEFAULT NOW(),
            
            -- Session metadata
            ip_address INET,
            user_agent TEXT,
            device_type VARCHAR(50), -- 'desktop', 'mobile', 'tablet'
            browser VARCHAR(100),
            os VARCHAR(100),
            
            -- Session status
            session_status VARCHAR(20) DEFAULT 'active', -- 'active', 'logged_out', 'expired', 'terminated'
            logout_type VARCHAR(20), -- 'manual', 'timeout', 'admin_forced', 'token_expired'
            
            -- Duration tracking
            session_duration_minutes INTEGER, -- Calculated on logout
            
            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            
            CONSTRAINT fk_user_sessions_user_id
                FOREIGN KEY(user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        );

        -- Performance indexes
        CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
        CREATE INDEX idx_user_sessions_login_time ON user_sessions(login_time);
        CREATE INDEX idx_user_sessions_session_status ON user_sessions(session_status);
        CREATE INDEX idx_user_sessions_session_token ON user_sessions(session_token);
        CREATE INDEX idx_user_sessions_last_activity ON user_sessions(last_activity);

        RAISE NOTICE 'Created user_sessions table successfully';
        
    ELSE
        RAISE NOTICE 'Table user_sessions already exists, skipping creation';
    END IF;
END $$;

-- Create function to update last_activity automatically
CREATE OR REPLACE FUNCTION update_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.last_activity = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic last_activity updates
DROP TRIGGER IF EXISTS update_user_sessions_activity ON user_sessions;
CREATE TRIGGER update_user_sessions_activity
    BEFORE UPDATE ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_last_activity();

-- Create function to calculate session duration on logout
CREATE OR REPLACE FUNCTION calculate_session_duration()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate duration when logout_time is set
    IF NEW.logout_time IS NOT NULL AND OLD.logout_time IS NULL THEN
        NEW.session_duration_minutes = EXTRACT(EPOCH FROM (NEW.logout_time - NEW.login_time)) / 60;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for session duration calculation
DROP TRIGGER IF EXISTS calculate_duration_trigger ON user_sessions;
CREATE TRIGGER calculate_duration_trigger
    BEFORE UPDATE ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION calculate_session_duration();

-- Verify table creation
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_sessions') THEN
        RAISE NOTICE '✅ user_sessions table created successfully';
        
        -- Test query to verify structure
        PERFORM * FROM user_sessions LIMIT 0;
        RAISE NOTICE '✅ user_sessions table structure verified';
        
    ELSE
        RAISE EXCEPTION '❌ Failed to create user_sessions table';
    END IF;
END $$;