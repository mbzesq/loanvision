-- Migration: Add AI Assistant enabled flag to organizations
-- Date: 2025-01-17
-- Purpose: Add column to control AI assistant access per organization

-- Add ai_assistant_enabled column to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS ai_assistant_enabled BOOLEAN NOT NULL DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN organizations.ai_assistant_enabled IS 'Controls whether AI assistant is enabled for this organization';

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_organizations_ai_assistant_enabled 
ON organizations(ai_assistant_enabled);

-- Grant permissions to application user (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nplvision_app') THEN
        GRANT SELECT, UPDATE ON organizations TO nplvision_app;
    END IF;
END $$;