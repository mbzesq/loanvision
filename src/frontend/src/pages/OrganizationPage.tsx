import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Organization } from '../types/auth';
import organizationService, { OrganizationUser, OrganizationInvitation } from '../services/organizationService';
import { OrganizationInfo } from '../components/OrganizationBadge';
import { Users, Mail, Plus, Clock, ArrowRight, BookOpen } from 'lucide-react';
import '../styles/financial-design-system.css';

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

  const getRoleBadgeStyle = (role: string) => {
    const styles = {
      super_user: { backgroundColor: 'rgba(197, 48, 48, 0.2)', color: 'var(--color-danger)' },
      admin: { backgroundColor: 'rgba(37, 99, 235, 0.2)', color: 'var(--color-primary)' },
      manager: { backgroundColor: 'rgba(47, 133, 90, 0.2)', color: 'var(--color-success)' },
      user: { backgroundColor: 'rgba(148, 163, 184, 0.2)', color: 'var(--color-text-secondary)' }
    };
    return styles[role as keyof typeof styles] || styles.user;
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-background)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '2px solid var(--color-primary)',
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading organization...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-background)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--color-danger)', marginBottom: '16px' }}>{error}</p>
          <button 
            onClick={fetchOrganizationData}
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-background)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>No organization assigned</p>
        </div>
      </div>
    );
  }

  const canManageUsers = user && ['admin', 'super_user'].includes(user.role);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--color-background)',
      color: 'var(--color-text-primary)'
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '24px 16px'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: 'var(--color-text-primary)',
            marginBottom: '8px'
          }}>Organization</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>View and manage your organization details</p>
        </div>

        {/* Quick Actions */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
          marginBottom: '24px'
        }}>
          <div style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '500',
                  color: 'var(--color-text-primary)',
                  marginBottom: '8px'
                }}>Organization Directory</h3>
                <p style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: '14px'
                }}>View all team members, contact info, and org chart</p>
              </div>
              <BookOpen style={{ width: '32px', height: '32px', color: 'var(--color-primary)' }} />
            </div>
            <button
              onClick={() => navigate('/organization/directory')}
              style={{
                marginTop: '16px',
                width: '100%',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              View Directory
              <ArrowRight style={{ width: '16px', height: '16px' }} />
            </button>
          </div>
          
          <div style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '500',
                  color: 'var(--color-text-primary)',
                  marginBottom: '8px'
                }}>Team Overview</h3>
                <p style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: '14px'
                }}>{users.length} team members</p>
              </div>
              <Users style={{ width: '32px', height: '32px', color: 'var(--color-success)' }} />
            </div>
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px'
              }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Active Members</span>
                <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{users.length}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px'
              }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Pending Invites</span>
                <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{invitations.length}</span>
              </div>
            </div>
          </div>
          
          {canManageUsers && (
            <div style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '500',
                    color: 'var(--color-text-primary)',
                    marginBottom: '8px'
                  }}>Quick Actions</h3>
                  <p style={{
                    color: 'var(--color-text-secondary)',
                    fontSize: '14px'
                  }}>Manage your organization</p>
                </div>
                <Mail style={{ width: '32px', height: '32px', color: 'var(--color-chart-4)' }} />
              </div>
              <button
                onClick={() => setShowInviteForm(!showInviteForm)}
                style={{
                  marginTop: '16px',
                  width: '100%',
                  backgroundColor: 'var(--color-chart-4)',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Plus style={{ width: '16px', height: '16px' }} />
                Invite Member
              </button>
            </div>
          )}
        </div>

        {/* Organization Info */}
        <div style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '500',
            color: 'var(--color-text-primary)',
            marginBottom: '16px'
          }}>Organization Details</h2>
          <OrganizationInfo organization={organization} detailed={true} />
        </div>

        {/* Users Section */}
        {users.length > 0 && (
          <div style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users style={{ width: '20px', height: '20px', color: 'var(--color-text-secondary)' }} />
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: '500',
                  color: 'var(--color-text-primary)'
                }}>Organization Members</h2>
                <span style={{
                  backgroundColor: 'var(--color-surface-light)',
                  color: 'var(--color-text-primary)',
                  fontSize: '14px',
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  {users.length}
                </span>
              </div>
              {canManageUsers && (
                <button
                  onClick={() => setShowInviteForm(!showInviteForm)}
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Plus style={{ width: '16px', height: '16px' }} />
                  Invite User
                </button>
              )}
            </div>

            {/* Invite Form */}
            {canManageUsers && showInviteForm && (
              <div style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                marginBottom: '16px',
                backgroundColor: 'var(--color-background)'
              }}>
                <form onSubmit={handleInviteUser} style={{
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'end'
                }}>
                  <div style={{ flex: 1 }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: 'var(--color-text-primary)',
                      marginBottom: '4px'
                    }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      style={{
                        width: '100%',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '8px 12px',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text-primary)'
                      }}
                      placeholder="user@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: 'var(--color-text-primary)',
                      marginBottom: '4px'
                    }}>
                      Role
                    </label>
                    <select
                      value={inviteForm.role}
                      onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                      style={{
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '8px 12px',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text-primary)'
                      }}
                    >
                      <option value="user">User</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={inviting}
                    style={{
                      backgroundColor: 'var(--color-success)',
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      cursor: 'pointer',
                      opacity: inviting ? 0.5 : 1
                    }}
                  >
                    {inviting ? 'Sending...' : 'Send Invite'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInviteForm(false)}
                    style={{
                      backgroundColor: 'var(--color-surface-light)',
                      color: 'var(--color-text-primary)',
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </form>
              </div>
            )}

            {/* Users List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {users.map((orgUser) => (
                <div key={orgUser.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-background)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      backgroundColor: 'var(--color-surface-light)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: 'var(--color-text-primary)'
                      }}>
                        {orgUser.first_name?.[0] || orgUser.email[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p style={{
                        fontWeight: '500',
                        color: 'var(--color-text-primary)'
                      }}>
                        {orgUser.first_name && orgUser.last_name 
                          ? `${orgUser.first_name} ${orgUser.last_name}`
                          : orgUser.email
                        }
                      </p>
                      <p style={{
                        fontSize: '14px',
                        color: 'var(--color-text-muted)'
                      }}>{orgUser.email}</p>
                    </div>
                  </div>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '500',
                    ...getRoleBadgeStyle(orgUser.role)
                  }}>
                    {orgUser.role.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Invitations - Only for admins */}
        {canManageUsers && invitations.length > 0 && (
          <div style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <Mail style={{ width: '20px', height: '20px', color: 'var(--color-text-secondary)' }} />
              <h2 style={{
                fontSize: '18px',
                fontWeight: '500',
                color: 'var(--color-text-primary)'
              }}>Pending Invitations</h2>
              <span style={{
                backgroundColor: 'var(--color-warning-bg)',
                color: 'var(--color-warning)',
                fontSize: '14px',
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                {invitations.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {invitations.map((invitation) => (
                <div key={invitation.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-warning-bg)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Clock style={{ width: '20px', height: '20px', color: 'var(--color-warning)' }} />
                    <div>
                      <p style={{
                        fontWeight: '500',
                        color: 'var(--color-text-primary)'
                      }}>{invitation.email}</p>
                      <p style={{
                        fontSize: '14px',
                        color: 'var(--color-text-muted)'
                      }}>
                        Invited {formatDate(invitation.created_at)} • Expires {formatDate(invitation.expires_at)}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      ...getRoleBadgeStyle(invitation.role)
                    }}>
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