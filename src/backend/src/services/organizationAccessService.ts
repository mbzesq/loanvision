import { Pool } from 'pg';
import pool from '../db';

export class OrganizationAccessService {
  
  /**
   * Get SQL WHERE clause to filter loans by organization access using investor name mapping
   * @param organizationId - The organization ID to filter by
   * @param userRole - The user's role (super_user can see all loans)
   * @param accessTypes - Optional array of access types to filter by (for backwards compatibility)
   * @returns SQL WHERE clause string and parameters
   */
  getOrganizationLoanFilter(
    organizationId: number | undefined, 
    userRole: string,
    accessTypes?: string[]
  ): { whereClause: string; params: any[] } {
    // Super users can see all loans
    if (userRole === 'super_user') {
      return { whereClause: '', params: [] };
    }
    
    // Users without organization can't see any loans
    if (!organizationId) {
      return { whereClause: 'AND 1 = 0', params: [] }; // Always false condition
    }
    
    // Use investor name mapping for organization access control
    const whereClause = `
      AND EXISTS (
        SELECT 1 FROM organization_investors oi 
        WHERE oi.investor_name = investor_name_column
        AND oi.organization_id = $1
        AND oi.is_active = true
      )
    `;
    
    const params: any[] = [organizationId];
    
    return { whereClause, params };
  }
  
  /**
   * Check if a user has access to a specific loan
   * @param userId - The user ID
   * @param loanId - The loan ID to check access for
   * @param requiredAccessType - Optional specific access type required
   * @returns Promise<boolean> - Whether the user has access
   */
  async hasLoanAccess(
    userId: number, 
    loanId: string, 
    requiredAccessType?: string
  ): Promise<boolean> {
    try {
      // Get user's role and organization
      const userQuery = await pool.query(
        'SELECT role, organization_id FROM users WHERE id = $1',
        [userId]
      );
      
      if (userQuery.rows.length === 0) return false;
      
      const { role, organization_id } = userQuery.rows[0];
      
      // Super users have access to everything
      if (role === 'super_user') return true;
      
      // Users without organization have no access
      if (!organization_id) return false;
      
      // Check organization loan access using investor name mapping
      const accessQuery = `
        SELECT 1 
        FROM daily_metrics_current dmc
        JOIN organization_investors oi ON dmc.investor_name = oi.investor_name
        WHERE oi.organization_id = $1 
        AND dmc.loan_id = $2 
        AND oi.is_active = true
      `;
      
      const params = [organization_id, loanId];
      
      const result = await pool.query(accessQuery, params);
      return result.rows.length > 0;
    } catch (error) {
      console.error('[OrganizationAccess] Error checking loan access:', error);
      return false;
    }
  }
  
  /**
   * Get accessible loan IDs for a user
   * @param userId - The user ID
   * @param accessType - Optional specific access type
   * @param limit - Optional limit on results
   * @returns Promise<string[]> - Array of accessible loan IDs
   */
  async getAccessibleLoanIds(
    userId: number, 
    accessType?: string, 
    limit?: number
  ): Promise<string[]> {
    try {
      // Get user's role and organization
      const userQuery = await pool.query(
        'SELECT role, organization_id FROM users WHERE id = $1',
        [userId]
      );
      
      if (userQuery.rows.length === 0) return [];
      
      const { role, organization_id } = userQuery.rows[0];
      
      // Super users - get all loans (this might be a lot, so we still apply a limit)
      if (role === 'super_user') {
        let query = 'SELECT DISTINCT loan_id FROM daily_metrics_current';
        const params: any[] = [];
        
        if (limit) {
          query += ' LIMIT $1';
          params.push(limit);
        }
        
        const result = await pool.query(query, params);
        return result.rows.map(row => row.loan_id);
      }
      
      // Users without organization have no access
      if (!organization_id) return [];
      
      // Get accessible loans for the organization using investor name mapping
      let query = `
        SELECT DISTINCT dmc.loan_id 
        FROM daily_metrics_current dmc
        JOIN organization_investors oi ON dmc.investor_name = oi.investor_name
        WHERE oi.organization_id = $1 
        AND oi.is_active = true
      `;
      
      const params = [organization_id];
      
      if (limit) {
        query += ` LIMIT $${params.length + 1}`;
        params.push(limit);
      }
      
      const result = await pool.query(query, params);
      return result.rows.map(row => row.loan_id);
    } catch (error) {
      console.error('[OrganizationAccess] Error getting accessible loan IDs:', error);
      return [];
    }
  }
  
  /**
   * Apply organization-based filtering to a loan query
   * @param baseQuery - The base SQL query (should use {LOAN_FILTER} placeholder)
   * @param userId - The user ID requesting the data
   * @param additionalParams - Any additional parameters for the base query
   * @returns Modified query with organization filtering applied
   */
  async applyLoanFilter(
    baseQuery: string,
    userId: number,
    additionalParams: any[] = []
  ): Promise<{ query: string; params: any[] }> {
    try {
      // Get user's role and organization
      const userQuery = await pool.query(
        'SELECT role, organization_id FROM users WHERE id = $1',
        [userId]
      );
      
      if (userQuery.rows.length === 0) {
        // No user found - return query that returns no results
        const query = baseQuery.replace('{LOAN_FILTER}', 'AND 1 = 0');
        return { query, params: additionalParams };
      }
      
      const { role, organization_id } = userQuery.rows[0];
      
      // Apply the organization filter
      const { whereClause, params: filterParams } = this.getOrganizationLoanFilter(organization_id, role);
      
      // Replace placeholder in the base query
      // Handle both loan_id and investor_name column references
      let finalWhereClause = whereClause;
      if (whereClause.includes('investor_name_column')) {
        finalWhereClause = whereClause.replace('investor_name_column', 'investor_name');
      } else {
        finalWhereClause = whereClause.replace('loan_id_column', 'loan_id');
      }
      const modifiedQuery = baseQuery.replace('{LOAN_FILTER}', finalWhereClause);
      
      return { 
        query: modifiedQuery, 
        params: [...additionalParams, ...filterParams] 
      };
    } catch (error) {
      console.error('[OrganizationAccess] Error applying loan filter:', error);
      // Return query that returns no results on error
      const query = baseQuery.replace('{LOAN_FILTER}', 'AND 1 = 0');
      return { query, params: additionalParams };
    }
  }
  
  /**
   * Middleware function to check loan access before proceeding
   * Use this in routes that need to verify access to specific loans
   */
  createLoanAccessMiddleware(requiredAccessType?: string) {
    return async (req: any, res: any, next: any) => {
      try {
        const loanId = req.params.loanId || req.params.loan_id || req.body.loanId || req.body.loan_id;
        
        if (!loanId) {
          return res.status(400).json({ error: 'Loan ID is required' });
        }
        
        if (!req.user || !req.user.id) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        
        const hasAccess = await this.hasLoanAccess(req.user.id, loanId, requiredAccessType);
        
        if (!hasAccess) {
          return res.status(403).json({ error: 'Access denied to this loan' });
        }
        
        next();
      } catch (error) {
        console.error('[OrganizationAccess] Middleware error:', error);
        res.status(500).json({ error: 'Error checking loan access' });
      }
    };
  }
}

export default new OrganizationAccessService();