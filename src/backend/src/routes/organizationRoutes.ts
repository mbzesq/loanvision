import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import organizationService, { OrganizationService } from '../services/organizationService';
import crypto from 'crypto';

const router = express.Router();

// Middleware to check if user is admin or super_user
const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user || !['admin', 'super_user'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin privileges required' });
  }
  next();
};

// Get current user's organization
router.get('/me', authenticateToken, async (req: any, res) => {
  try {
    const organization = await organizationService.getUserOrganization(req.user.id);
    if (!organization) {
      return res.status(404).json({ error: 'User not assigned to any organization' });
    }
    res.json(organization);
  } catch (error) {
    console.error('[OrganizationRoutes] Error getting user organization:', error);
    res.status(500).json({ error: 'Failed to get organization' });
  }
});

// Get organization details by ID
router.get('/:id', authenticateToken, async (req: any, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const userOrg = await organizationService.getUserOrganization(req.user.id);
    
    // Users can only see their own organization unless they're super_user
    if (req.user.role !== 'super_user' && userOrg?.id !== organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const organization = await organizationService.getOrganizationById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    res.json(organization);
  } catch (error) {
    console.error('[OrganizationRoutes] Error getting organization:', error);
    res.status(500).json({ error: 'Failed to get organization' });
  }
});

// Get all organizations (super_user only)
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'super_user') {
      return res.status(403).json({ error: 'Super user privileges required' });
    }
    
    const organizations = await organizationService.getAllOrganizations();
    res.json(organizations);
  } catch (error) {
    console.error('[OrganizationRoutes] Error getting organizations:', error);
    res.status(500).json({ error: 'Failed to get organizations' });
  }
});

// Create new organization (super_user only)
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'super_user') {
      return res.status(403).json({ error: 'Super user privileges required' });
    }
    
    const { name, slug, type, email_domain, description, website, phone, address } = req.body;
    
    if (!name || !slug || !type) {
      return res.status(400).json({ error: 'Name, slug, and type are required' });
    }
    
    const orgData = {
      name,
      slug,
      type,
      email_domain,
      description,
      website,
      phone,
      address_line1: address?.line1,
      address_line2: address?.line2,
      city: address?.city,
      state: address?.state,
      zip: address?.zip,
      is_active: true
    };
    
    const organization = await organizationService.createOrganization(orgData);
    res.status(201).json(organization);
  } catch (error) {
    console.error('[OrganizationRoutes] Error creating organization:', error);
    if ((error as any).code === '23505') { // Unique constraint violation
      res.status(409).json({ error: 'Organization slug already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create organization' });
    }
  }
});

// Update organization
router.put('/:id', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const userOrg = await organizationService.getUserOrganization(req.user.id);
    
    // Users can only update their own organization unless they're super_user
    if (req.user.role !== 'super_user' && userOrg?.id !== organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { name, type, email_domain, description, website, phone, address, is_active } = req.body;
    
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (email_domain !== undefined) updates.email_domain = email_domain;
    if (description !== undefined) updates.description = description;
    if (website !== undefined) updates.website = website;
    if (phone !== undefined) updates.phone = phone;
    if (address?.line1 !== undefined) updates.address_line1 = address.line1;
    if (address?.line2 !== undefined) updates.address_line2 = address.line2;
    if (address?.city !== undefined) updates.city = address.city;
    if (address?.state !== undefined) updates.state = address.state;
    if (address?.zip !== undefined) updates.zip = address.zip;
    if (is_active !== undefined && req.user.role === 'super_user') updates.is_active = is_active;
    
    const organization = await organizationService.updateOrganization(organizationId, updates);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    res.json(organization);
  } catch (error) {
    console.error('[OrganizationRoutes] Error updating organization:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// Get organization users
router.get('/:id/users', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const userOrg = await organizationService.getUserOrganization(req.user.id);
    
    // Users can only see users from their own organization unless they're super_user
    if (req.user.role !== 'super_user' && userOrg?.id !== organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const users = await organizationService.getOrganizationUsers(organizationId);
    res.json(users);
  } catch (error) {
    console.error('[OrganizationRoutes] Error getting organization users:', error);
    res.status(500).json({ error: 'Failed to get organization users' });
  }
});

// Invite user to organization
router.post('/:id/invite', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const userOrg = await organizationService.getUserOrganization(req.user.id);
    
    // Users can only invite to their own organization unless they're super_user
    if (req.user.role !== 'super_user' && userOrg?.id !== organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { email, role } = req.body;
    
    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }
    
    if (!['user', 'manager', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    // Generate secure invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    
    const invitation = await organizationService.createInvitation(
      organizationId,
      email,
      role,
      req.user.id,
      invitationToken
    );
    
    res.status(201).json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      invitation_token: invitation.invitation_token,
      expires_at: invitation.expires_at
    });
  } catch (error) {
    console.error('[OrganizationRoutes] Error creating invitation:', error);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

// Get pending invitations
router.get('/:id/invitations', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const userOrg = await organizationService.getUserOrganization(req.user.id);
    
    // Users can only see invitations for their own organization unless they're super_user
    if (req.user.role !== 'super_user' && userOrg?.id !== organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const invitations = await organizationService.getPendingInvitations(organizationId);
    res.json(invitations);
  } catch (error) {
    console.error('[OrganizationRoutes] Error getting invitations:', error);
    res.status(500).json({ error: 'Failed to get invitations' });
  }
});

// Accept invitation
router.post('/accept/:token', authenticateToken, async (req: any, res) => {
  try {
    const { token } = req.params;
    
    const invitation = await organizationService.getInvitationByToken(token);
    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }
    
    await organizationService.acceptInvitation(token, req.user.id);
    
    const organization = await organizationService.getOrganizationById(invitation.organization_id);
    res.json({ 
      message: 'Invitation accepted successfully',
      organization 
    });
  } catch (error) {
    console.error('[OrganizationRoutes] Error accepting invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Loan access management routes

// Grant loan access to organization
router.post('/:id/loans/:loanId/access', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const loanId = req.params.loanId;
    const { access_type, expires_at } = req.body;
    
    if (!access_type || !['owner', 'servicer', 'viewer', 'collaborator'].includes(access_type)) {
      return res.status(400).json({ error: 'Valid access_type is required' });
    }
    
    // Only super_user can grant access, or users can grant access to their own organization's loans
    const userOrg = await organizationService.getUserOrganization(req.user.id);
    if (req.user.role !== 'super_user' && userOrg?.id !== organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const expiresAtDate = expires_at ? new Date(expires_at) : undefined;
    
    const access = await organizationService.grantLoanAccess(
      organizationId,
      loanId,
      access_type,
      req.user.id,
      expiresAtDate
    );
    
    res.status(201).json(access);
  } catch (error) {
    console.error('[OrganizationRoutes] Error granting loan access:', error);
    res.status(500).json({ error: 'Failed to grant loan access' });
  }
});

// Revoke loan access
router.delete('/:id/loans/:loanId/access', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const loanId = req.params.loanId;
    const { access_type } = req.query;
    
    const userOrg = await organizationService.getUserOrganization(req.user.id);
    if (req.user.role !== 'super_user' && userOrg?.id !== organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await organizationService.revokeLoanAccess(organizationId, loanId, access_type as string);
    res.json({ message: 'Loan access revoked successfully' });
  } catch (error) {
    console.error('[OrganizationRoutes] Error revoking loan access:', error);
    res.status(500).json({ error: 'Failed to revoke loan access' });
  }
});

// Get organization's accessible loans
router.get('/:id/loans', authenticateToken, async (req: any, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const userOrg = await organizationService.getUserOrganization(req.user.id);
    
    // Users can only see loans for their own organization unless they're super_user
    if (req.user.role !== 'super_user' && userOrg?.id !== organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { access_type } = req.query;
    const loans = await organizationService.getOrganizationLoans(organizationId, access_type as string);
    res.json(loans);
  } catch (error) {
    console.error('[OrganizationRoutes] Error getting organization loans:', error);
    res.status(500).json({ error: 'Failed to get organization loans' });
  }
});

// Directory and Hierarchy Routes

// Get organization directory with search
router.get('/:id/directory', authenticateToken, async (req: any, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const userOrg = await organizationService.getUserOrganization(req.user.id);
    
    // Users can only see directory for their own organization unless they're super_user
    if (req.user.role !== 'super_user' && userOrg?.id !== organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { search } = req.query;
    const users = await organizationService.getUsersForDirectory(organizationId, search as string);
    res.json(users);
  } catch (error) {
    console.error('[OrganizationRoutes] Error getting organization directory:', error);
    res.status(500).json({ error: 'Failed to get organization directory' });
  }
});

// Get organization hierarchy
router.get('/:id/hierarchy', authenticateToken, async (req: any, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const userOrg = await organizationService.getUserOrganization(req.user.id);
    
    // Users can only see hierarchy for their own organization unless they're super_user
    if (req.user.role !== 'super_user' && userOrg?.id !== organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const hierarchy = await organizationService.getOrganizationHierarchy(organizationId);
    res.json(hierarchy);
  } catch (error) {
    console.error('[OrganizationRoutes] Error getting organization hierarchy:', error);
    res.status(500).json({ error: 'Failed to get organization hierarchy' });
  }
});

// Get user's direct reports
router.get('/users/:userId/direct-reports', authenticateToken, async (req: any, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Users can only see their own direct reports unless they're admin/super_user
    if (req.user.role !== 'super_user' && req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const directReports = await organizationService.getDirectReports(userId);
    res.json(directReports);
  } catch (error) {
    console.error('[OrganizationRoutes] Error getting direct reports:', error);
    res.status(500).json({ error: 'Failed to get direct reports' });
  }
});

// Update user profile (hierarchy info)
router.put('/users/:userId/profile', authenticateToken, async (req: any, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Users can only update their own profile or admins can update others
    if (req.user.role !== 'super_user' && req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const {
      managerId,
      jobTitle,
      department,
      hierarchyLevel,
      phone,
      officeLocation,
      bio,
      profileImageUrl
    } = req.body;
    
    await organizationService.updateUserProfile(userId, {
      managerId,
      jobTitle,
      department,
      hierarchyLevel,
      phone,
      officeLocation,
      bio,
      profileImageUrl
    });
    
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('[OrganizationRoutes] Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// Department management routes
router.get('/:id/departments', authenticateToken, async (req: any, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const userOrg = await organizationService.getUserOrganization(req.user.id);
    
    if (req.user.role !== 'super_user' && userOrg?.id !== organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const departments = await organizationService.getOrganizationDepartments(organizationId);
    res.json(departments);
  } catch (error) {
    console.error('[OrganizationRoutes] Error getting departments:', error);
    res.status(500).json({ error: 'Failed to get departments' });
  }
});

router.post('/:id/departments', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const userOrg = await organizationService.getUserOrganization(req.user.id);
    
    if (req.user.role !== 'super_user' && userOrg?.id !== organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { name, description, headUserId, parentDepartmentId } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Department name is required' });
    }
    
    const department = await organizationService.createDepartment({
      organizationId,
      name,
      description,
      headUserId,
      parentDepartmentId
    });
    
    res.status(201).json(department);
  } catch (error) {
    console.error('[OrganizationRoutes] Error creating department:', error);
    if ((error as any).code === '23505') {
      res.status(409).json({ error: 'Department name already exists in this organization' });
    } else {
      res.status(500).json({ error: 'Failed to create department' });
    }
  }
});

export default router;