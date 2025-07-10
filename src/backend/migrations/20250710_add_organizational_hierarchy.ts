import { Pool } from 'pg';

export const up = async (pool: Pool): Promise<void> => {
  await pool.query(`
    -- Add manager relationship to users table
    ALTER TABLE users ADD COLUMN manager_id INTEGER REFERENCES users(id);
    
    -- Add job title and department for better org structure
    ALTER TABLE users ADD COLUMN job_title TEXT;
    ALTER TABLE users ADD COLUMN department TEXT;
    ALTER TABLE users ADD COLUMN hire_date DATE;
    ALTER TABLE users ADD COLUMN phone TEXT;
    ALTER TABLE users ADD COLUMN office_location TEXT;
    ALTER TABLE users ADD COLUMN bio TEXT;
    ALTER TABLE users ADD COLUMN profile_image_url TEXT;
    
    -- Add organizational hierarchy levels
    CREATE TYPE hierarchy_level AS ENUM ('executive', 'senior_manager', 'manager', 'team_lead', 'senior', 'intermediate', 'junior', 'intern');
    ALTER TABLE users ADD COLUMN hierarchy_level hierarchy_level;
    
    -- Create organization departments table for better structure
    CREATE TABLE organization_departments (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      description TEXT,
      head_user_id INTEGER REFERENCES users(id),
      parent_department_id INTEGER REFERENCES organization_departments(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(organization_id, name)
    );
    
    -- Add indexes for performance
    CREATE INDEX idx_users_manager_id ON users(manager_id);
    CREATE INDEX idx_users_organization_hierarchy ON users(organization_id, hierarchy_level);
    CREATE INDEX idx_users_department ON users(department);
    CREATE INDEX idx_organization_departments_org_id ON organization_departments(organization_id);
    CREATE INDEX idx_organization_departments_head ON organization_departments(head_user_id);
    CREATE INDEX idx_organization_departments_parent ON organization_departments(parent_department_id);
    
    -- Add trigger for department updates
    CREATE TRIGGER update_organization_departments_updated_at BEFORE UPDATE
        ON organization_departments FOR EACH ROW EXECUTE FUNCTION update_organizations_updated_at_column();
    
    -- Add comments
    COMMENT ON COLUMN users.manager_id IS 'Reference to the user who is this users direct manager';
    COMMENT ON COLUMN users.hierarchy_level IS 'Organizational hierarchy level for reporting structure';
    COMMENT ON TABLE organization_departments IS 'Departments within organizations for better structure';
    COMMENT ON COLUMN organization_departments.head_user_id IS 'User who heads this department';
    COMMENT ON COLUMN organization_departments.parent_department_id IS 'Parent department for nested structure';
  `);
};

export const down = async (pool: Pool): Promise<void> => {
  await pool.query(`
    -- Drop trigger
    DROP TRIGGER IF EXISTS update_organization_departments_updated_at ON organization_departments;
    
    -- Drop indexes
    DROP INDEX IF EXISTS idx_users_manager_id;
    DROP INDEX IF EXISTS idx_users_organization_hierarchy;
    DROP INDEX IF EXISTS idx_users_department;
    DROP INDEX IF EXISTS idx_organization_departments_org_id;
    DROP INDEX IF EXISTS idx_organization_departments_head;
    DROP INDEX IF EXISTS idx_organization_departments_parent;
    
    -- Drop table
    DROP TABLE IF EXISTS organization_departments CASCADE;
    
    -- Remove columns from users
    ALTER TABLE users DROP COLUMN IF EXISTS manager_id;
    ALTER TABLE users DROP COLUMN IF EXISTS job_title;
    ALTER TABLE users DROP COLUMN IF EXISTS department;
    ALTER TABLE users DROP COLUMN IF EXISTS hire_date;
    ALTER TABLE users DROP COLUMN IF EXISTS phone;
    ALTER TABLE users DROP COLUMN IF EXISTS office_location;
    ALTER TABLE users DROP COLUMN IF EXISTS bio;
    ALTER TABLE users DROP COLUMN IF EXISTS profile_image_url;
    ALTER TABLE users DROP COLUMN IF EXISTS hierarchy_level;
    
    -- Drop type
    DROP TYPE IF EXISTS hierarchy_level CASCADE;
  `);
};