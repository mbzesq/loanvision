-- Migration: Add organization_investors mapping table
-- This replaces manual loan assignments with automatic investor name mapping

-- Create the organization_investors mapping table
CREATE TABLE IF NOT EXISTS organization_investors (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id),
  investor_name TEXT NOT NULL,
  investor_type TEXT DEFAULT 'entity',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, investor_name)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_organization_investors_name ON organization_investors(investor_name);
CREATE INDEX IF NOT EXISTS idx_organization_investors_org_active ON organization_investors(organization_id, is_active);

-- Insert all investor names for System Organization (assuming organization_id = 1)
-- If System Organization has a different ID, update accordingly
INSERT INTO organization_investors (organization_id, investor_name, investor_type) VALUES
(1, 'ATC2021 Trust', 'trust'),
(1, 'ATC2021 Trust - Tracking', 'trust'),
(1, 'Babylon Capital, LLC', 'llc'),
(1, 'Babylon Capital, LLC  -Tracking', 'llc'),
(1, 'BCMB1 Trust', 'trust'),
(1, 'BCMB1 Trust - Tracking', 'trust'),
(1, 'Dukes River, LLC - Tracking', 'llc'),
(1, 'Eastern SAT Trust', 'trust'),
(1, 'Eastern SAT Trust - Tracking', 'trust'),
(1, 'FC201, LLC', 'llc'),
(1, 'FC201, LLC  - Tracking', 'llc'),
(1, 'Fifth Delta, LLC  - Tracking', 'llc'),
(1, 'First Age, LLC', 'llc'),
(1, 'First Spring, LLC', 'llc'),
(1, 'First Spring, LLC - Tracking', 'llc'),
(1, 'Green MBA, LLC', 'llc'),
(1, 'NP154', 'entity'),
(1, 'NP162', 'entity'),
(1, 'NP191, LLC', 'llc'),
(1, 'NP201, LLC', 'llc'),
(1, 'NP202', 'entity'),
(1, 'NP202 - Tracking', 'entity'),
(1, 'NS192, LLC', 'llc'),
(1, 'NS193, LLC', 'llc'),
(1, 'NS193, LLC - Tracking', 'llc'),
(1, 'NS194', 'entity'),
(1, 'NS201, LLC', 'llc'),
(1, 'RECOVERY - SHELVING ROCK', 'entity'),
(1, 'Second Start, LLC', 'llc'),
(1, 'Southern MBA Trust', 'trust'),
(1, 'SRP 2012-4', 'entity'),
(1, 'SRP 2012-4 - Tracking', 'entity'),
(1, 'SRP 2013-10', 'entity'),
(1, 'SRP 2013-9', 'entity'),
(1, 'SRP 2013-9 - Tracking', 'entity'),
(1, 'SRP 2014-2 Funding Trust', 'trust'),
(1, 'SRP 2014-2 Funding Trust -Tracking', 'trust'),
(1, 'Star 212, LLC', 'llc'),
(1, 'Star 212, LLC - Tracking', 'llc'),
(1, 'Star 213, LLC', 'llc'),
(1, 'Star 214, LLC', 'llc'),
(1, 'Star201, LLC', 'llc'),
(1, 'Star202, LLC', 'llc'),
(1, 'Star211, LLC', 'llc'),
(1, 'Star221, LLC', 'llc'),
(1, 'Star221, LLC - Tracking', 'llc'),
(1, 'Star222, LLC', 'llc'),
(1, 'Third Birch, LLC', 'llc'),
(1, 'Third Birch, LLC - Tracking', 'llc')
ON CONFLICT (organization_id, investor_name) DO NOTHING;

-- Verify the mapping was created
SELECT 
  o.name as organization_name,
  COUNT(oi.id) as investor_count,
  STRING_AGG(oi.investor_name, ', ' ORDER BY oi.investor_name) as sample_investors
FROM organizations o
JOIN organization_investors oi ON o.id = oi.organization_id
WHERE oi.is_active = true
GROUP BY o.id, o.name;