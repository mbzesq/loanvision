-- Add 'deleted' to the inbox_status enum type
ALTER TYPE inbox_status ADD VALUE 'deleted' AFTER 'archived';

-- Update any existing check constraints that might reference the status column
-- This ensures the new status value is recognized in any constraints