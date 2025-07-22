"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
const up = async (pool) => {
    await pool.query(`
    -- Create organization type enum
    CREATE TYPE organization_type AS ENUM ('servicer', 'investor', 'law_firm', 'asset_manager', 'other');
    
    -- Create access type enum for loan access
    CREATE TYPE access_type AS ENUM ('owner', 'servicer', 'viewer', 'collaborator');

    -- Create organizations table
    CREATE TABLE organizations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL, -- URL-friendly identifier (e.g., 'acme-capital')
      type organization_type NOT NULL DEFAULT 'other',
      email_domain TEXT, -- Auto-assign users based on email domain (e.g., 'acmecapital.com')
      description TEXT,
      website TEXT,
      phone TEXT,
      address_line1 TEXT,
      address_line2 TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Add organization reference to users table
    ALTER TABLE users ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
    
    -- Create organization loan access table (determines which orgs can see which loans)
    CREATE TABLE organization_loan_access (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER NOT NULL REFERENCES organizations(id),
      loan_id TEXT NOT NULL, -- References daily_metrics_current(loan_id)
      access_type access_type NOT NULL DEFAULT 'viewer',
      granted_by_user_id INTEGER REFERENCES users(id),
      granted_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ, -- Optional expiration
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      
      -- Prevent duplicate access grants
      UNIQUE(organization_id, loan_id, access_type)
    );

    -- Create organization user invitations table
    CREATE TABLE organization_invitations (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER NOT NULL REFERENCES organizations(id),
      email TEXT NOT NULL,
      role user_role NOT NULL DEFAULT 'user',
      invited_by_user_id INTEGER NOT NULL REFERENCES users(id),
      invitation_token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
      accepted_at TIMESTAMPTZ,
      accepted_by_user_id INTEGER REFERENCES users(id),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Add indexes for performance
    CREATE INDEX idx_users_organization_id ON users(organization_id);
    CREATE INDEX idx_organization_loan_access_org_id ON organization_loan_access(organization_id);
    CREATE INDEX idx_organization_loan_access_loan_id ON organization_loan_access(loan_id);
    CREATE INDEX idx_organization_loan_access_active ON organization_loan_access(is_active, organization_id);
    CREATE INDEX idx_organization_invitations_token ON organization_invitations(invitation_token);
    CREATE INDEX idx_organization_invitations_email ON organization_invitations(email, is_active);
    CREATE INDEX idx_organizations_slug ON organizations(slug);
    CREATE INDEX idx_organizations_email_domain ON organizations(email_domain) WHERE email_domain IS NOT NULL;

    -- Add update triggers
    CREATE OR REPLACE FUNCTION update_organizations_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE
        ON organizations FOR EACH ROW EXECUTE FUNCTION update_organizations_updated_at_column();

    CREATE TRIGGER update_organization_loan_access_updated_at BEFORE UPDATE
        ON organization_loan_access FOR EACH ROW EXECUTE FUNCTION update_organizations_updated_at_column();

    -- Add table comments
    COMMENT ON TABLE organizations IS 'Organizations that users belong to (servicers, investors, law firms, etc.)';
    COMMENT ON TABLE organization_loan_access IS 'Defines which organizations can access which loans and with what permissions';
    COMMENT ON TABLE organization_invitations IS 'Tracks pending invitations to join organizations';
    
    COMMENT ON COLUMN organizations.slug IS 'URL-friendly identifier for the organization';
    COMMENT ON COLUMN organizations.email_domain IS 'Auto-assign users to this org if their email matches this domain';
    COMMENT ON COLUMN organization_loan_access.access_type IS 'owner=full control, servicer=can manage, viewer=read-only, collaborator=can comment';
    COMMENT ON COLUMN organization_invitations.invitation_token IS 'Secure token for accepting invitations';

    -- Create default "System" organization for existing users
    INSERT INTO organizations (name, slug, type, description, is_active) 
    VALUES ('Shelton Partners, LLC', 'system', 'other', 'Default organization for existing users', true);

    -- Assign all existing users to the system organization
    UPDATE users SET organization_id = (SELECT id FROM organizations WHERE slug = 'system');
  `);
};
exports.up = up;
const down = async (pool) => {
    await pool.query(`
    -- Drop triggers
    DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
    DROP TRIGGER IF EXISTS update_organization_loan_access_updated_at ON organization_loan_access;
    DROP FUNCTION IF EXISTS update_organizations_updated_at_column();
    
    -- Drop indexes
    DROP INDEX IF EXISTS idx_users_organization_id;
    DROP INDEX IF EXISTS idx_organization_loan_access_org_id;
    DROP INDEX IF EXISTS idx_organization_loan_access_loan_id;
    DROP INDEX IF EXISTS idx_organization_loan_access_active;
    DROP INDEX IF EXISTS idx_organization_invitations_token;
    DROP INDEX IF EXISTS idx_organization_invitations_email;
    DROP INDEX IF EXISTS idx_organizations_slug;
    DROP INDEX IF EXISTS idx_organizations_email_domain;
    
    -- Remove organization_id from users
    ALTER TABLE users DROP COLUMN IF EXISTS organization_id;
    
    -- Drop tables in reverse order
    DROP TABLE IF EXISTS organization_invitations CASCADE;
    DROP TABLE IF EXISTS organization_loan_access CASCADE;
    DROP TABLE IF EXISTS organizations CASCADE;
    
    -- Drop types
    DROP TYPE IF EXISTS access_type CASCADE;
    DROP TYPE IF EXISTS organization_type CASCADE;
  `);
};
exports.down = down;
//# sourceMappingURL=20250710_create_organizations.js.map