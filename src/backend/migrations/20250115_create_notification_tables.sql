-- Create essential tables for notification system in loanvision_dev
-- This creates the minimum required schema for the notification system to work

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create collateral_documents table
CREATE TABLE IF NOT EXISTS collateral_documents (
    id SERIAL PRIMARY KEY,
    loan_id VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    document_type VARCHAR(100),
    confidence_score NUMERIC(5,4),
    user_id INTEGER REFERENCES users(id),
    file_size INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create enums for inbox system
CREATE TYPE inbox_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE inbox_status AS ENUM ('unread', 'read', 'in_progress', 'completed', 'archived', 'deleted');
CREATE TYPE inbox_item_type AS ENUM ('system_alert', 'user_message', 'task_assignment', 'loan_update', 'document_share', 'system_notification');

-- Create inbox_items table
CREATE TABLE IF NOT EXISTS inbox_items (
    id SERIAL PRIMARY KEY,
    task_type VARCHAR(100) NOT NULL,
    type inbox_item_type DEFAULT 'task_assignment',
    subject VARCHAR(255) NOT NULL,
    body TEXT,
    loan_id VARCHAR(50),
    document_id INTEGER REFERENCES collateral_documents(id),
    priority inbox_priority DEFAULT 'normal',
    status inbox_status DEFAULT 'unread',
    assigned_to_user_id INTEGER REFERENCES users(id),
    created_by_user_id INTEGER REFERENCES users(id),
    metadata JSONB DEFAULT '{}',
    notes TEXT,
    source VARCHAR(50) DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    inbox_item_id INTEGER REFERENCES inbox_items(id),
    message TEXT NOT NULL,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_collateral_documents_loan_id ON collateral_documents(loan_id);
CREATE INDEX IF NOT EXISTS idx_inbox_items_assigned_to ON inbox_items(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_items_status ON inbox_items(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);

-- Insert default user if none exists
INSERT INTO users (email, first_name, last_name, password_hash, role)
SELECT 'admin@loanvision.com', 'System', 'Administrator', '$2b$10$example.hash', 'super_user'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@loanvision.com');