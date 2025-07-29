import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Organization } from '../types/auth';
import organizationService, { OrganizationUser, OrganizationInvitation } from '../services/organizationService';
import { Users, Mail, Plus, Clock, ArrowRight, BookOpen, Shield, Building } from 'lucide-react';

export default function OrganizationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
      
      // Fetch user directory for count (available to all organization members)
      const directoryUsers = await organizationService.getUsersForDirectory(org.id);
      setUsers(directoryUsers);
      
      // Only fetch invitations if user is admin or higher
      if (user && ['admin', 'super_user'].includes(user.role)) {
        const orgInvitations = await organizationService.getPendingInvitations(org.id);
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

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      super_user: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Super Admin' },
      admin: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Admin' },
      manager: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Manager' },
      user: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', label: 'User' }
    };
    
    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.user;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
        {config.label}
      </span>
    );
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <Building className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{organization.name}</h1>
                <p className="text-gray-600">Manage your organization and team members</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-8">
        
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Organization Directory Card */}
          <div className="premium-card hover:shadow-lg transition-all duration-200">
            <div className="premium-card-content">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Organization Directory</h3>
                  <p className="text-sm text-gray-600 mt-1">View all team members and org chart</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <button
                onClick={() => navigate('/organization/directory')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Directory
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Team Overview Card */}
          <div className="premium-card">
            <div className="premium-card-content">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Team Overview</h3>
                  <p className="text-sm text-gray-600 mt-1">{users.length} team members</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Active Members</span>
                  <span className="font-medium text-gray-900">{users.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Pending Invites</span>
                  <span className="font-medium text-gray-900">{invitations.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          {canManageUsers && (
            <div className="premium-card">
              <div className="premium-card-content">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
                    <p className="text-sm text-gray-600 mt-1">Manage your organization</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-amber-600" />
                  </div>
                </div>
                <button
                  onClick={() => setShowInviteForm(!showInviteForm)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Invite Member
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Invite Form */}
        {canManageUsers && showInviteForm && (
          <div className="premium-card mb-8">
            <div className="premium-card-header">
              <h2 className="premium-card-title">Send Invitation</h2>
              <p className="premium-card-subtitle">Invite a new member to your organization</p>
            </div>
            <div className="premium-card-content">
              <form onSubmit={handleInviteUser} className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="user">User</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="submit"
                    disabled={inviting}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {inviting ? 'Sending...' : 'Send Invite'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInviteForm(false)}
                    className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Pending Invitations */}
        {canManageUsers && invitations.length > 0 && (
          <div className="premium-card">
            <div className="premium-card-header">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-gray-500" />
                <h2 className="premium-card-title">Pending Invitations</h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  {invitations.length}
                </span>
              </div>
              <p className="premium-card-subtitle">Invitations waiting for acceptance</p>
            </div>
            <div className="premium-card-content">
              <div className="space-y-3">
                {invitations.map((invitation) => (
                  <div key={invitation.id} className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-amber-600" />
                      <div>
                        <p className="font-medium text-gray-900">{invitation.email}</p>
                        <p className="text-sm text-gray-600">
                          Invited {formatDate(invitation.created_at)} • Expires {formatDate(invitation.expires_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getRoleBadge(invitation.role)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}