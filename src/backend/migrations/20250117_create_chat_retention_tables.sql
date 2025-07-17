-- Migration: Create chat retention and cleanup logging tables
-- Date: 2025-01-17
-- Purpose: Add data retention policy support for chat messages

-- Create chat cleanup log table to track retention activities
CREATE TABLE IF NOT EXISTS chat_cleanup_log (
    id SERIAL PRIMARY KEY,
    cleanup_date DATE NOT NULL UNIQUE,
    messages_deleted INTEGER NOT NULL DEFAULT 0,
    reactions_deleted INTEGER NOT NULL DEFAULT 0,
    retention_hours INTEGER NOT NULL DEFAULT 24,
    error_message TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient querying of cleanup history
CREATE INDEX IF NOT EXISTS idx_chat_cleanup_log_cleanup_date ON chat_cleanup_log(cleanup_date);
CREATE INDEX IF NOT EXISTS idx_chat_cleanup_log_created_at ON chat_cleanup_log(created_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_cleanup_log_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_chat_cleanup_log_updated_at
    BEFORE UPDATE ON chat_cleanup_log
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_cleanup_log_updated_at();

-- Add comment explaining the purpose
COMMENT ON TABLE chat_cleanup_log IS 'Tracks chat message retention policy cleanup activities and statistics';
COMMENT ON COLUMN chat_cleanup_log.cleanup_date IS 'Date when cleanup was performed (unique per day)';
COMMENT ON COLUMN chat_cleanup_log.messages_deleted IS 'Number of messages deleted on this date';
COMMENT ON COLUMN chat_cleanup_log.reactions_deleted IS 'Number of message reactions deleted on this date';
COMMENT ON COLUMN chat_cleanup_log.retention_hours IS 'Retention policy in hours that was applied';
COMMENT ON COLUMN chat_cleanup_log.error_message IS 'Error message if cleanup failed (NULL if successful)';

-- Grant permissions to application user (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nplvision_app') THEN
        GRANT SELECT, INSERT, UPDATE ON chat_cleanup_log TO nplvision_app;
        GRANT USAGE ON SEQUENCE chat_cleanup_log_id_seq TO nplvision_app;
    END IF;
END $$;