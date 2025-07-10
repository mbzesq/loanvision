import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Organization } from '../types/auth';
import organizationService, { OrganizationUser, OrganizationInvitation } from '../services/organizationService';
import { OrganizationInfo } from '../components/OrganizationBadge';
import { Users, Mail, Plus, Trash2, Clock } from 'lucide-react';

export default function OrganizationPage() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'user' });
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchOrganizationData();
  }, []);

  const fetchOrganizationData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const org = await organizationService.getMyOrganization();
      if (!org) {
        setError('You are not assigned to any organization');
        return;
      }
      
      setOrganization(org);
      
      // Only fetch users and invitations if user is admin or higher
      if (user && ['admin', 'super_user'].includes(user.role)) {
        const [orgUsers, orgInvitations] = await Promise.all([
          organizationService.getOrganizationUsers(org.id),
          organizationService.getPendingInvitations(org.id)
        ]);
        setUsers(orgUsers);
        setInvitations(orgInvitations);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load organization data');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !inviteForm.email.trim()) return;

    try {
      setInviting(true);
      await organizationService.inviteUser(organization.id, inviteForm.email, inviteForm.role);
      setInviteForm({ email: '', role: 'user' });
      setShowInviteForm(false);
      // Refresh invitations
      const newInvitations = await organizationService.getPendingInvitations(organization.id);
      setInvitations(newInvitations);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleBadgeColor = (role: string) => {
    const colors = {
      super_user: 'bg-red-100 text-red-800',
      admin: 'bg-blue-100 text-blue-800',
      manager: 'bg-green-100 text-green-800',
      user: 'bg-gray-100 text-gray-800'
    };
    return colors[role as keyof typeof colors] || colors.user;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading organization...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={fetchOrganizationData}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No organization assigned</p>
        </div>
      </div>
    );
  }

  const canManageUsers = user && ['admin', 'super_user'].includes(user.role);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Organization</h1>
          <p className="text-gray-600">View and manage your organization details</p>
        </div>

        {/* Organization Info */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Organization Details</h2>
          <OrganizationInfo organization={organization} detailed={true} />
        </div>

        {/* Users Section - Only for admins */}
        {canManageUsers && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-medium text-gray-900">Organization Members</h2>
                <span className="bg-gray-100 text-gray-800 text-sm px-2 py-1 rounded-full">
                  {users.length}
                </span>
              </div>
              <button
                onClick={() => setShowInviteForm(!showInviteForm)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Invite User
              </button>
            </div>

            {/* Invite Form */}
            {showInviteForm && (
              <div className="border rounded-md p-4 mb-4 bg-gray-50">
                <form onSubmit={handleInviteUser} className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="user@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <select
                      value={inviteForm.role}
                      onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                      className="border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="user">User</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    {inviting ? 'Sending...' : 'Send Invite'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInviteForm(false)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </form>
              </div>
            )}

            {/* Users List */}
            <div className="space-y-3">
              {users.map((orgUser) => (
                <div key={orgUser.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">
                        {orgUser.first_name?.[0] || orgUser.email[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {orgUser.first_name && orgUser.last_name 
                          ? `${orgUser.first_name} ${orgUser.last_name}`
                          : orgUser.email
                        }
                      </p>
                      <p className="text-sm text-gray-500">{orgUser.email}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(orgUser.role)}`}>
                    {orgUser.role.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Invitations - Only for admins */}
        {canManageUsers && invitations.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-medium text-gray-900">Pending Invitations</h2>
              <span className="bg-yellow-100 text-yellow-800 text-sm px-2 py-1 rounded-full">
                {invitations.length}
              </span>
            </div>
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-md bg-yellow-50">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-yellow-600" />
                    <div>
                      <p className="font-medium text-gray-900">{invitation.email}</p>
                      <p className="text-sm text-gray-500">
                        Invited {formatDate(invitation.created_at)} • Expires {formatDate(invitation.expires_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(invitation.role)}`}>
                      {invitation.role.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}