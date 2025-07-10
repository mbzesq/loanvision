import axios from '../utils/axios';
import { Organization } from '../types/auth';

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

export interface OrganizationInvitation {
  id: number;
  email: string;
  role: string;
  invitation_token: string;
  expires_at: string;
  created_at: string;
}

export class OrganizationService {
  
  // Get current user's organization
  async getMyOrganization(): Promise<Organization | null> {
    try {
      const response = await axios.get('/api/organizations/me');
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null; // User not assigned to any organization
      }
      throw error;
    }
  }

  // Get organization by ID
  async getOrganizationById(id: number): Promise<Organization> {
    const response = await axios.get(`/api/organizations/${id}`);
    return response.data;
  }

  // Get all organizations (super_user only)
  async getAllOrganizations(): Promise<Organization[]> {
    const response = await axios.get('/api/organizations');
    return response.data;
  }

  // Create organization (super_user only)
  async createOrganization(orgData: {
    name: string;
    slug: string;
    type: Organization['type'];
    email_domain?: string;
    description?: string;
    website?: string;
    phone?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
  }): Promise<Organization> {
    const response = await axios.post('/api/organizations', orgData);
    return response.data;
  }

  // Update organization
  async updateOrganization(id: number, updates: Partial<Organization>): Promise<Organization> {
    const response = await axios.put(`/api/organizations/${id}`, updates);
    return response.data;
  }

  // Get organization users
  async getOrganizationUsers(organizationId: number): Promise<OrganizationUser[]> {
    const response = await axios.get(`/api/organizations/${organizationId}/users`);
    return response.data;
  }

  // Invite user to organization
  async inviteUser(organizationId: number, email: string, role: string): Promise<OrganizationInvitation> {
    const response = await axios.post(`/api/organizations/${organizationId}/invite`, {
      email,
      role
    });
    return response.data;
  }

  // Get pending invitations
  async getPendingInvitations(organizationId: number): Promise<OrganizationInvitation[]> {
    const response = await axios.get(`/api/organizations/${organizationId}/invitations`);
    return response.data;
  }

  // Accept invitation
  async acceptInvitation(token: string): Promise<{ message: string; organization: Organization }> {
    const response = await axios.post(`/api/organizations/accept/${token}`);
    return response.data;
  }

  // Grant loan access
  async grantLoanAccess(
    organizationId: number, 
    loanId: string, 
    accessType: 'owner' | 'servicer' | 'viewer' | 'collaborator',
    expiresAt?: string
  ): Promise<any> {
    const response = await axios.post(`/api/organizations/${organizationId}/loans/${loanId}/access`, {
      access_type: accessType,
      expires_at: expiresAt
    });
    return response.data;
  }

  // Revoke loan access
  async revokeLoanAccess(organizationId: number, loanId: string, accessType?: string): Promise<void> {
    const params = accessType ? { access_type: accessType } : {};
    await axios.delete(`/api/organizations/${organizationId}/loans/${loanId}/access`, { params });
  }

  // Get organization's accessible loans
  async getOrganizationLoans(organizationId: number, accessType?: string): Promise<string[]> {
    const params = accessType ? { access_type: accessType } : {};
    const response = await axios.get(`/api/organizations/${organizationId}/loans`, { params });
    return response.data;
  }

  // Directory and Hierarchy Methods
  
  // Get organization directory with search
  async getUsersForDirectory(organizationId: number, searchTerm?: string): Promise<OrganizationUser[]> {
    const params = searchTerm ? { search: searchTerm } : {};
    const response = await axios.get(`/api/organizations/${organizationId}/directory`, { params });
    return response.data;
  }

  // Get organization hierarchy
  async getOrganizationHierarchy(organizationId: number): Promise<any[]> {
    const response = await axios.get(`/api/organizations/${organizationId}/hierarchy`);
    return response.data;
  }

  // Get user's direct reports
  async getDirectReports(userId: number): Promise<OrganizationUser[]> {
    const response = await axios.get(`/api/organizations/users/${userId}/direct-reports`);
    return response.data;
  }

  // Update user profile (hierarchy info)
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
    await axios.put(`/api/organizations/users/${userId}/profile`, updates);
  }

  // Get organization departments
  async getOrganizationDepartments(organizationId: number): Promise<any[]> {
    const response = await axios.get(`/api/organizations/${organizationId}/departments`);
    return response.data;
  }

  // Create department
  async createDepartment(organizationId: number, departmentData: {
    name: string;
    description?: string;
    headUserId?: number;
    parentDepartmentId?: number;
  }): Promise<any> {
    const response = await axios.post(`/api/organizations/${organizationId}/departments`, departmentData);
    return response.data;
  }

  // Format organization type for display
  static formatOrganizationType(type: Organization['type']): string {
    const typeMap = {
      servicer: 'Loan Servicer',
      investor: 'Investor',
      law_firm: 'Law Firm',
      asset_manager: 'Asset Manager',
      other: 'Other'
    };
    return typeMap[type] || type;
  }

  // Get organization type color/theme
  static getOrganizationTypeColor(type: Organization['type']): string {
    const colorMap = {
      servicer: 'bg-blue-100 text-blue-800',
      investor: 'bg-green-100 text-green-800',
      law_firm: 'bg-purple-100 text-purple-800',
      asset_manager: 'bg-orange-100 text-orange-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colorMap[type] || colorMap.other;
  }
}

export default new OrganizationService();