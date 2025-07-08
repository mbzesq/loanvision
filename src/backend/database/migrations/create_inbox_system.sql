-- Inbox System Migration
-- Creates tables and types for unified inbox functionality

-- Create enum types for inbox system
CREATE TYPE inbox_item_type AS ENUM (
  'system_alert', 
  'user_message', 
  'task_assignment', 
  'loan_update', 
  'document_share', 
  'system_notification'
);

CREATE TYPE inbox_priority AS ENUM ('urgent', 'high', 'normal', 'low');

CREATE TYPE inbox_status AS ENUM ('unread', 'read', 'in_progress', 'completed', 'archived');

CREATE TYPE inbox_source AS ENUM ('system', 'user', 'api', 'automation');

-- Main inbox items table
CREATE TABLE IF NOT EXISTS inbox_items (
    id SERIAL PRIMARY KEY,
    external_id TEXT UNIQUE, -- For client-side compatibility
    type inbox_item_type NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    priority inbox_priority NOT NULL DEFAULT 'normal',
    status inbox_status NOT NULL DEFAULT 'unread',
    source inbox_source NOT NULL DEFAULT 'user',
    category TEXT, -- sol, legal, payment, document, performance, etc.
    
    -- User relationships
    created_by_user_id INTEGER REFERENCES users(id),
    assigned_to_user_id INTEGER REFERENCES users(id),
    
    -- Thread relationships
    thread_id TEXT,
    reply_to_id INTEGER REFERENCES inbox_items(id),
    
    -- Loan context
    loan_ids TEXT[], -- Array of loan IDs for multi-loan items
    
    -- Task-specific fields
    due_date TIMESTAMPTZ,
    estimated_duration INTEGER, -- Duration in minutes
    completion_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_thread_structure CHECK (
      (reply_to_id IS NULL AND thread_id IS NOT NULL) OR 
      (reply_to_id IS NOT NULL AND thread_id IS NOT NULL) OR
      (reply_to_id IS NULL AND thread_id IS NULL)
    )
);

-- Recipients table for multi-user messaging
CREATE TABLE IF NOT EXISTS inbox_recipients (
    id SERIAL PRIMARY KEY,
    inbox_item_id INTEGER NOT NULL REFERENCES inbox_items(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    recipient_type TEXT NOT NULL DEFAULT 'to', -- 'to', 'cc', 'bcc'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(inbox_item_id, user_id, recipient_type)
);

-- Attachments table for file sharing
CREATE TABLE IF NOT EXISTS inbox_attachments (
    id SERIAL PRIMARY KEY,
    inbox_item_id INTEGER NOT NULL REFERENCES inbox_items(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    s3_key TEXT, -- For future S3 integration
    upload_user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log for audit trail
CREATE TABLE IF NOT EXISTS inbox_activity_log (
    id SERIAL PRIMARY KEY,
    inbox_item_id INTEGER NOT NULL REFERENCES inbox_items(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL, -- 'created', 'status_changed', 'assigned', 'replied', etc.
    old_value TEXT,
    new_value TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update triggers
CREATE OR REPLACE FUNCTION update_inbox_items_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inbox_items_updated_at BEFORE UPDATE
    ON inbox_items FOR EACH ROW EXECUTE FUNCTION update_inbox_items_updated_at_column();

-- Function to automatically generate external_id
CREATE OR REPLACE FUNCTION generate_inbox_external_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.external_id IS NULL THEN
        NEW.external_id = NEW.id::TEXT;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER generate_inbox_external_id_trigger BEFORE INSERT
    ON inbox_items FOR EACH ROW EXECUTE FUNCTION generate_inbox_external_id();

-- Function to log activity automatically
CREATE OR REPLACE FUNCTION log_inbox_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Log status changes
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        INSERT INTO inbox_activity_log (inbox_item_id, user_id, action, old_value, new_value)
        VALUES (NEW.id, NEW.assigned_to_user_id, 'status_changed', OLD.status::TEXT, NEW.status::TEXT);
    END IF;
    
    -- Log assignment changes
    IF TG_OP = 'UPDATE' AND OLD.assigned_to_user_id != NEW.assigned_to_user_id THEN
        INSERT INTO inbox_activity_log (inbox_item_id, user_id, action, old_value, new_value)
        VALUES (NEW.id, NEW.assigned_to_user_id, 'assigned', 
                COALESCE(OLD.assigned_to_user_id::TEXT, 'unassigned'), 
                COALESCE(NEW.assigned_to_user_id::TEXT, 'unassigned'));
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER log_inbox_activity_trigger AFTER UPDATE
    ON inbox_items FOR EACH ROW EXECUTE FUNCTION log_inbox_activity();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inbox_items_status ON inbox_items(status);
CREATE INDEX IF NOT EXISTS idx_inbox_items_priority ON inbox_items(priority);
CREATE INDEX IF NOT EXISTS idx_inbox_items_assigned_to ON inbox_items(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_items_created_by ON inbox_items(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_items_thread_id ON inbox_items(thread_id);
CREATE INDEX IF NOT EXISTS idx_inbox_items_loan_ids ON inbox_items USING GIN(loan_ids);
CREATE INDEX IF NOT EXISTS idx_inbox_items_due_date ON inbox_items(due_date);
CREATE INDEX IF NOT EXISTS idx_inbox_items_created_at ON inbox_items(created_at);
CREATE INDEX IF NOT EXISTS idx_inbox_items_category ON inbox_items(category);
CREATE INDEX IF NOT EXISTS idx_inbox_recipients_user ON inbox_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_activity_log_item ON inbox_activity_log(inbox_item_id);

-- Add comments for documentation
COMMENT ON TABLE inbox_items IS 'Central table for all inbox communications, tasks, and alerts';
COMMENT ON COLUMN inbox_items.external_id IS 'Client-facing identifier for API compatibility';
COMMENT ON COLUMN inbox_items.thread_id IS 'Groups related messages into conversation threads';
COMMENT ON COLUMN inbox_items.loan_ids IS 'Array of loan IDs this item relates to';
COMMENT ON COLUMN inbox_items.estimated_duration IS 'Estimated completion time in minutes for tasks';
COMMENT ON TABLE inbox_recipients IS 'Multi-user messaging recipients (to, cc, bcc)';
COMMENT ON TABLE inbox_attachments IS 'File attachments for inbox items';
COMMENT ON TABLE inbox_activity_log IS 'Audit trail for all inbox item changes';