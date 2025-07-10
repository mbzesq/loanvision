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

  async getOrganizationUsers(organizationId: number): Promise<Array<{id: number, email: string, first_name?: string, last_name?: string, role: string}>> {
    const query = `
      SELECT id, email, first_name, last_name, role 
      FROM users 
      WHERE organization_id = $1
      ORDER BY first_name, last_name, email
    `;
    const result = await pool.query(query, [organizationId]);
    return result.rows;
  }

  async assignUserToOrganization(userId: number, organizationId: number): Promise<void> {
    const query = 'UPDATE users SET organization_id = $1 WHERE id = $2';
    await pool.query(query, [organizationId, userId]);
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