-- Migration: Create AI Assistant tables
-- Date: 2025-01-17
-- Purpose: Add tables for AI assistant functionality with PII anonymization

-- Create PII anonymization mappings table
CREATE TABLE IF NOT EXISTS ai_pii_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_value_hash TEXT NOT NULL,
    anonymized_value TEXT NOT NULL UNIQUE,
    field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('name', 'address', 'ssn', 'phone', 'email', 'other')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(original_value_hash, field_type)
);

-- Create AI conversation history table
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    conversation_title TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_archived BOOLEAN NOT NULL DEFAULT false
);

-- Create AI messages table
CREATE TABLE IF NOT EXISTS ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    anonymized_content TEXT, -- Content sent to LLM (anonymized)
    token_count INTEGER DEFAULT 0,
    model_used VARCHAR(50),
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    pii_mappings_used JSONB -- Array of mapping IDs used for this message
);

-- Create AI rate limiting table
CREATE TABLE IF NOT EXISTS ai_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    queries_used INTEGER NOT NULL DEFAULT 0,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    last_query_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- Create AI audit log table
CREATE TABLE IF NOT EXISTS ai_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
    message_id UUID REFERENCES ai_messages(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'query', 'response', 'error', 'rate_limit_hit'
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_pii_mappings_hash ON ai_pii_mappings(original_value_hash);
CREATE INDEX IF NOT EXISTS idx_ai_pii_mappings_expires_at ON ai_pii_mappings(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_pii_mappings_anonymized_value ON ai_pii_mappings(anonymized_value);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_organization_id ON ai_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at ON ai_conversations(created_at);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON ai_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_messages_message_type ON ai_messages(message_type);

CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_user_id_date ON ai_rate_limits(user_id, date);
CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_date ON ai_rate_limits(date);

CREATE INDEX IF NOT EXISTS idx_ai_audit_log_user_id ON ai_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_log_created_at ON ai_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_audit_log_action ON ai_audit_log(action);

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_ai_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ai_conversations_updated_at
    BEFORE UPDATE ON ai_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_conversations_updated_at();

CREATE OR REPLACE FUNCTION update_ai_rate_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ai_rate_limits_updated_at
    BEFORE UPDATE ON ai_rate_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_rate_limits_updated_at();

-- Add comments explaining the purpose of each table
COMMENT ON TABLE ai_pii_mappings IS 'Stores anonymization mappings for PII fields to ensure LLM never sees sensitive data';
COMMENT ON COLUMN ai_pii_mappings.original_value_hash IS 'SHA-256 hash of original PII value for lookup without storing plaintext';
COMMENT ON COLUMN ai_pii_mappings.anonymized_value IS 'Anonymized placeholder value sent to LLM (e.g., PERSON_A1B2)';
COMMENT ON COLUMN ai_pii_mappings.expires_at IS 'Mapping expiration time (24 hours default)';

COMMENT ON TABLE ai_conversations IS 'AI assistant conversation sessions';
COMMENT ON TABLE ai_messages IS 'Individual messages in AI conversations with anonymization tracking';
COMMENT ON TABLE ai_rate_limits IS 'Daily rate limiting for AI queries per user';
COMMENT ON TABLE ai_audit_log IS 'Audit trail for all AI assistant interactions';

-- Grant permissions to application user (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nplvision_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON ai_pii_mappings TO nplvision_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ai_conversations TO nplvision_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ai_messages TO nplvision_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ai_rate_limits TO nplvision_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ai_audit_log TO nplvision_app;
    END IF;
END $$;

-- Create cleanup function for expired PII mappings
CREATE OR REPLACE FUNCTION cleanup_expired_pii_mappings()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM ai_pii_mappings WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_pii_mappings() IS 'Cleanup function for expired PII mappings - run periodically via scheduler';