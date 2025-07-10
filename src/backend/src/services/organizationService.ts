import { Pool } from 'pg';
import pool from '../db';

export interface Organization {
  id: number;
  name: string;
  slug: string;
  type: 'servicer' | 'investor' | 'law_firm' | 'asset_manager' | 'other';
  email_domain?: string;
  description?: string;
  website?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface OrganizationLoanAccess {
  id: number;
  organization_id: number;
  loan_id: string;
  access_type: 'owner' | 'servicer' | 'viewer' | 'collaborator';
  granted_by_user_id?: number;
  granted_at: Date;
  expires_at?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface OrganizationUser {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  manager_id?: number;
  job_title?: string;
  department?: string;
  hierarchy_level?: string;
  hire_date?: string;
  phone?: string;
  office_location?: string;
  bio?: string;
  profile_image_url?: string;
  manager_name?: string;
  direct_reports_count?: number;
}

export interface OrganizationDepartment {
  id: number;
  organization_id: number;
  name: string;
  description?: string;
  head_user_id?: number;
  parent_department_id?: number;
  head_user_name?: string;
  created_at: Date;
  updated_at: Date;
}

export interface OrganizationInvitation {
  id: number;
  organization_id: number;
  email: string;
  role: 'super_user' | 'admin' | 'manager' | 'user';
  invited_by_user_id: number;
  invitation_token: string;
  expires_at: Date;
  accepted_at?: Date;
  accepted_by_user_id?: number;
  is_active: boolean;
  created_at: Date;
}

export class OrganizationService {
  
  // Organization CRUD operations
  async createOrganization(orgData: Omit<Organization, 'id' | 'created_at' | 'updated_at'>): Promise<Organization> {
    const query = `
      INSERT INTO organizations (name, slug, type, email_domain, description, website, phone, 
                               address_line1, address_line2, city, state, zip, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const values = [
      orgData.name, orgData.slug, orgData.type, orgData.email_domain,
      orgData.description, orgData.website, orgData.phone,
      orgData.address_line1, orgData.address_line2, orgData.city,
      orgData.state, orgData.zip, orgData.is_active
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async getOrganizationById(id: number): Promise<Organization | null> {
    const query = 'SELECT * FROM organizations WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    const query = 'SELECT * FROM organizations WHERE slug = $1 AND is_active = true';
    const result = await pool.query(query, [slug]);
    return result.rows[0] || null;
  }

  async getAllOrganizations(activeOnly = true): Promise<Organization[]> {
    const query = activeOnly 
      ? 'SELECT * FROM organizations WHERE is_active = true ORDER BY name'
      : 'SELECT * FROM organizations ORDER BY name';
    const result = await pool.query(query);
    return result.rows;
  }

  async updateOrganization(id: number, updates: Partial<Organization>): Promise<Organization | null> {
    const setClause = Object.keys(updates)
      .filter(key => key !== 'id' && key !== 'created_at' && key !== 'updated_at')
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    if (!setClause) return null;
    
    const values = Object.keys(updates)
      .filter(key => key !== 'id' && key !== 'created_at' && key !== 'updated_at')
      .map(key => updates[key as keyof Organization]);
    
    const query = `UPDATE organizations SET ${setClause} WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [id, ...values]);
    return result.rows[0] || null;
  }

  // Loan access management
  async grantLoanAccess(
    organizationId: number, 
    loanId: string, 
    accessType: OrganizationLoanAccess['access_type'],
    grantedByUserId?: number,
    expiresAt?: Date
  ): Promise<OrganizationLoanAccess> {
    const query = `
      INSERT INTO organization_loan_access (organization_id, loan_id, access_type, granted_by_user_id, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (organization_id, loan_id, access_type) 
      DO UPDATE SET 
        granted_by_user_id = EXCLUDED.granted_by_user_id,
        expires_at = EXCLUDED.expires_at,
        is_active = true,
        updated_at = NOW()
      RETURNING *
    `;
    
    const result = await pool.query(query, [organizationId, loanId, accessType, grantedByUserId, expiresAt]);
    return result.rows[0];
  }

  async revokeLoanAccess(organizationId: number, loanId: string, accessType?: string): Promise<void> {
    const query = accessType
      ? 'UPDATE organization_loan_access SET is_active = false WHERE organization_id = $1 AND loan_id = $2 AND access_type = $3'
      : 'UPDATE organization_loan_access SET is_active = false WHERE organization_id = $1 AND loan_id = $2';
    
    const values = accessType ? [organizationId, loanId, accessType] : [organizationId, loanId];
    await pool.query(query, values);
  }

  async getOrganizationLoans(organizationId: number, accessType?: string): Promise<string[]> {
    const query = accessType
      ? `SELECT DISTINCT loan_id FROM organization_loan_access 
         WHERE organization_id = $1 AND access_type = $2 AND is_active = true 
         AND (expires_at IS NULL OR expires_at > NOW())`
      : `SELECT DISTINCT loan_id FROM organization_loan_access 
         WHERE organization_id = $1 AND is_active = true 
         AND (expires_at IS NULL OR expires_at > NOW())`;
    
    const values = accessType ? [organizationId, accessType] : [organizationId];
    const result = await pool.query(query, values);
    return result.rows.map(row => row.loan_id);
  }

  async getLoanOrganizations(loanId: string): Promise<Array<{organization: Organization, access_type: string}>> {
    const query = `
      SELECT o.*, ola.access_type 
      FROM organizations o
      JOIN organization_loan_access ola ON o.id = ola.organization_id
      WHERE ola.loan_id = $1 AND ola.is_active = true 
      AND (ola.expires_at IS NULL OR ola.expires_at > NOW())
      AND o.is_active = true
    `;
    
    const result = await pool.query(query, [loanId]);
    return result.rows.map(row => ({
      organization: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        type: row.type,
        email_domain: row.email_domain,
        description: row.description,
        website: row.website,
        phone: row.phone,
        address_line1: row.address_line1,
        address_line2: row.address_line2,
        city: row.city,
        state: row.state,
        zip: row.zip,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at
      },
      access_type: row.access_type
    }));
  }

  // User organization management
  async getUserOrganization(userId: number): Promise<Organization | null> {
    const query = `
      SELECT o.* FROM organizations o
      JOIN users u ON u.organization_id = o.id
      WHERE u.id = $1 AND o.is_active = true
    `;
    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  }

  async getOrganizationUsers(organizationId: number, includeHierarchy = true): Promise<OrganizationUser[]> {
    const query = `
      SELECT 
        u.id, 
        u.email, 
        u.first_name, 
        u.last_name, 
        u.role,
        u.manager_id,
        u.job_title,
        u.department,
        u.hierarchy_level,
        u.hire_date,
        u.phone,
        u.office_location,
        u.bio,
        u.profile_image_url,
        ${includeHierarchy ? `
        CONCAT(m.first_name, ' ', m.last_name) as manager_name,
        (SELECT COUNT(*) FROM users dr WHERE dr.manager_id = u.id) as direct_reports_count
        ` : 'NULL as manager_name, 0 as direct_reports_count'}
      FROM users u 
      ${includeHierarchy ? 'LEFT JOIN users m ON u.manager_id = m.id' : ''}
      WHERE u.organization_id = $1
      ORDER BY 
        CASE u.hierarchy_level 
          WHEN 'executive' THEN 1
          WHEN 'senior_manager' THEN 2
          WHEN 'manager' THEN 3
          WHEN 'team_lead' THEN 4
          WHEN 'senior' THEN 5
          WHEN 'intermediate' THEN 6
          WHEN 'junior' THEN 7
          WHEN 'intern' THEN 8
          ELSE 9
        END,
        u.first_name, u.last_name, u.email
    `;
    const result = await pool.query(query, [organizationId]);
    return result.rows;
  }

  async assignUserToOrganization(userId: number, organizationId: number): Promise<void> {
    const query = 'UPDATE users SET organization_id = $1 WHERE id = $2';
    await pool.query(query, [organizationId, userId]);
  }

  // Hierarchy management methods
  async updateUserProfile(userId: number, updates: {
    managerId?: number;
    jobTitle?: string;
    department?: string;
    hierarchyLevel?: string;
    phone?: string;
    officeLocation?: string;
    bio?: string;
    profileImageUrl?: string;
  }): Promise<void> {
    const setClause = Object.keys(updates)
      .filter(key => updates[key as keyof typeof updates] !== undefined)
      .map((key, index) => {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        return `${dbKey} = $${index + 2}`;
      })
      .join(', ');
    
    if (!setClause) return;
    
    const values = Object.keys(updates)
      .filter(key => updates[key as keyof typeof updates] !== undefined)
      .map(key => updates[key as keyof typeof updates]);
    
    const query = `UPDATE users SET ${setClause} WHERE id = $1`;
    await pool.query(query, [userId, ...values]);
  }

  async getDirectReports(managerId: number): Promise<OrganizationUser[]> {
    const query = `
      SELECT 
        u.id, 
        u.email, 
        u.first_name, 
        u.last_name, 
        u.role,
        u.job_title,
        u.department,
        u.hierarchy_level,
        u.hire_date,
        u.phone,
        u.office_location,
        0 as direct_reports_count
      FROM users u 
      WHERE u.manager_id = $1
      ORDER BY u.first_name, u.last_name
    `;
    const result = await pool.query(query, [managerId]);
    return result.rows;
  }

  async getOrganizationHierarchy(organizationId: number): Promise<any> {
    // Get all users with their hierarchy info
    const users = await this.getOrganizationUsers(organizationId, true);
    
    // Build hierarchy tree
    const userMap = new Map();
    const rootUsers: any[] = [];
    
    // First pass: create user map
    users.forEach(user => {
      userMap.set(user.id, {
        ...user,
        directReports: []
      });
    });
    
    // Second pass: build hierarchy
    users.forEach(user => {
      if (user.manager_id && userMap.has(user.manager_id)) {
        userMap.get(user.manager_id).directReports.push(userMap.get(user.id));
      } else {
        rootUsers.push(userMap.get(user.id));
      }
    });
    
    return rootUsers;
  }

  async getUsersForDirectory(organizationId: number, searchTerm?: string): Promise<OrganizationUser[]> {
    let query = `
      SELECT 
        u.id, 
        u.email, 
        u.first_name, 
        u.last_name, 
        u.role,
        u.manager_id,
        u.job_title,
        u.department,
        u.hierarchy_level,
        u.hire_date,
        u.phone,
        u.office_location,
        u.bio,
        u.profile_image_url,
        CONCAT(m.first_name, ' ', m.last_name) as manager_name,
        (SELECT COUNT(*) FROM users dr WHERE dr.manager_id = u.id) as direct_reports_count
      FROM users u 
      LEFT JOIN users m ON u.manager_id = m.id
      WHERE u.organization_id = $1
    `;
    
    const params: any[] = [organizationId];
    
    if (searchTerm) {
      const paramIndex = params.length + 1;
      query += ` AND (
        LOWER(u.first_name) LIKE $${paramIndex} OR 
        LOWER(u.last_name) LIKE $${paramIndex} OR 
        LOWER(u.email) LIKE $${paramIndex} OR 
        LOWER(u.job_title) LIKE $${paramIndex} OR 
        LOWER(u.department) LIKE $${paramIndex}
      )`;
      params.push(`%${searchTerm.toLowerCase()}%`);
    }
    
    query += ` ORDER BY u.first_name, u.last_name`;
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  // Department management
  async createDepartment(orgData: {
    organizationId: number;
    name: string;
    description?: string;
    headUserId?: number;
    parentDepartmentId?: number;
  }): Promise<OrganizationDepartment> {
    const query = `
      INSERT INTO organization_departments (organization_id, name, description, head_user_id, parent_department_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      orgData.organizationId,
      orgData.name,
      orgData.description,
      orgData.headUserId,
      orgData.parentDepartmentId
    ]);
    return result.rows[0];
  }

  async getOrganizationDepartments(organizationId: number): Promise<OrganizationDepartment[]> {
    const query = `
      SELECT 
        od.*,
        CONCAT(u.first_name, ' ', u.last_name) as head_user_name
      FROM organization_departments od
      LEFT JOIN users u ON od.head_user_id = u.id
      WHERE od.organization_id = $1
      ORDER BY od.name
    `;
    const result = await pool.query(query, [organizationId]);
    return result.rows;
  }

  // Invitation management
  async createInvitation(
    organizationId: number,
    email: string,
    role: OrganizationInvitation['role'],
    invitedByUserId: number,
    invitationToken: string
  ): Promise<OrganizationInvitation> {
    const query = `
      INSERT INTO organization_invitations (organization_id, email, role, invited_by_user_id, invitation_token)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await pool.query(query, [organizationId, email, role, invitedByUserId, invitationToken]);
    return result.rows[0];
  }

  async getInvitationByToken(token: string): Promise<OrganizationInvitation | null> {
    const query = `
      SELECT * FROM organization_invitations 
      WHERE invitation_token = $1 AND is_active = true AND expires_at > NOW()
    `;
    const result = await pool.query(query, [token]);
    return result.rows[0] || null;
  }

  async acceptInvitation(token: string, userId: number): Promise<void> {
    await pool.query('BEGIN');
    
    try {
      // Get invitation details
      const invitation = await this.getInvitationByToken(token);
      if (!invitation) throw new Error('Invalid or expired invitation');

      // Update user's organization
      await this.assignUserToOrganization(userId, invitation.organization_id);

      // Mark invitation as accepted
      const updateQuery = `
        UPDATE organization_invitations 
        SET accepted_at = NOW(), accepted_by_user_id = $1, is_active = false
        WHERE invitation_token = $2
      `;
      await pool.query(updateQuery, [userId, token]);

      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  }

  async getPendingInvitations(organizationId: number): Promise<OrganizationInvitation[]> {
    const query = `
      SELECT * FROM organization_invitations 
      WHERE organization_id = $1 AND is_active = true AND expires_at > NOW()
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [organizationId]);
    return result.rows;
  }
}

export default new OrganizationService();