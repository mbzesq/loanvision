-- Update existing 'System Organization' records to 'Shelton Partners, LLC'
-- This script handles the case where the organization has already been created

-- Update the organization name in the organizations table
UPDATE organizations 
SET name = 'Shelton Partners, LLC', 
    updated_at = NOW()
WHERE name = 'System Organization' AND slug = 'system';

-- Verify the update
SELECT id, name, slug, type, description, is_active 
FROM organizations 
WHERE slug = 'system';