import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Organization } from '../types/auth';
import organizationService, { OrganizationUser } from '../services/organizationService';
import { 
  Search, 
  Phone, 
  MapPin, 
  MessageSquare, 
  CheckSquare,
  Users,
  Building,
  Briefcase,
  User as UserIcon,
  Filter,
  Grid3X3,
  List
} from 'lucide-react';
import '../styles/financial-design-system.css';

type ViewMode = 'grid' | 'list' | 'hierarchy';

export default function OrganizationDirectoryPage() {
  const navigate = useNavigate();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<OrganizationUser[]>([]);
  const [hierarchy, setHierarchy] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, departmentFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const org = await organizationService.getMyOrganization();
      if (!org) {
        setError('You are not assigned to any organization');
        return;
      }
      
      setOrganization(org);
      
      // Fetch users and hierarchy
      const [orgUsers, orgHierarchy] = await Promise.all([
        organizationService.getUsersForDirectory(org.id, ''),
        organizationService.getOrganizationHierarchy(org.id)
      ]);
      
      setUsers(orgUsers);
      setHierarchy(orgHierarchy);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load organization directory');
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.first_name?.toLowerCase().includes(term) ||
        user.last_name?.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.job_title?.toLowerCase().includes(term) ||
        user.department?.toLowerCase().includes(term)
      );
    }
    
    if (departmentFilter) {
      filtered = filtered.filter(user => user.department === departmentFilter);
    }
    
    setFilteredUsers(filtered);
  };

  const handleMessageUser = (selectedUser: OrganizationUser) => {
    const userName = selectedUser.first_name && selectedUser.last_name 
      ? `${selectedUser.first_name} ${selectedUser.last_name}`
      : selectedUser.email;
    
    navigate('/inbox', { 
      state: { 
        prefilledRecipient: {
          id: selectedUser.id,
          name: userName,
          email: selectedUser.email
        }
      }
    });
  };

  const handleCreateTask = (selectedUser: OrganizationUser) => {
    const userName = selectedUser.first_name && selectedUser.last_name 
      ? `${selectedUser.first_name} ${selectedUser.last_name}`
      : selectedUser.email;
    
    navigate('/inbox', { 
      state: { 
        createTask: true,
        prefilledAssignee: {
          id: selectedUser.id,
          name: userName,
          email: selectedUser.email
        }
      }
    });
  };

  const formatHierarchyLevel = (level?: string) => {
    if (!level) return '';
    return level.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getHierarchyColor = (level?: string) => {
    const colors = {
      executive: 'bg-purple-100 text-purple-800',
      senior_manager: 'bg-blue-100 text-blue-800',
      manager: 'bg-green-100 text-green-800',
      team_lead: 'bg-yellow-100 text-yellow-800',
      senior: 'bg-orange-100 text-orange-800',
      intermediate: 'bg-gray-100 text-gray-800',
      junior: 'bg-slate-100 text-slate-800',
      intern: 'bg-pink-100 text-pink-800'
    };
    return colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const departments = Array.from(new Set(users.map(u => u.department).filter(Boolean)));

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
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading organization directory...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
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
            onClick={fetchData}
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
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <h1 style={{
                fontSize: '24px',
                fontWeight: '600',
                color: 'var(--color-text-primary)',
                marginBottom: '8px'
              }}>Organization Directory</h1>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                {organization?.name} • {filteredUsers.length} {filteredUsers.length === 1 ? 'member' : 'members'}
              </p>
            </div>
            
            {/* View Mode Toggle */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '4px',
              border: '1px solid var(--color-border)'
            }}>
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  padding: '8px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: viewMode === 'grid' ? 'var(--color-primary)' : 'transparent',
                  color: viewMode === 'grid' ? 'white' : 'var(--color-text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Grid3X3 style={{ width: '16px', height: '16px' }} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  padding: '8px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: viewMode === 'list' ? 'var(--color-primary)' : 'transparent',
                  color: viewMode === 'list' ? 'white' : 'var(--color-text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <List style={{ width: '16px', height: '16px' }} />
              </button>
              <button
                onClick={() => setViewMode('hierarchy')}
                style={{
                  padding: '8px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: viewMode === 'hierarchy' ? 'var(--color-primary)' : 'transparent',
                  color: viewMode === 'hierarchy' ? 'white' : 'var(--color-text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Users style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            {/* Search */}
            <div style={{ flex: 1, position: 'relative', minWidth: '250px' }}>
              <Search style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '16px',
                height: '16px',
                color: 'var(--color-text-muted)'
              }} />
              <input
                type="text"
                placeholder="Search by name, email, title, or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  paddingLeft: '40px',
                  paddingRight: '16px',
                  paddingTop: '8px',
                  paddingBottom: '8px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text-primary)',
                  fontSize: '14px'
                }}
              />
            </div>
            
            {/* Department Filter */}
            <div style={{ position: 'relative' }}>
              <Filter style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '16px',
                height: '16px',
                color: 'var(--color-text-muted)'
              }} />
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                style={{
                  paddingLeft: '40px',
                  paddingRight: '32px',
                  paddingTop: '8px',
                  paddingBottom: '8px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text-primary)',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Directory Content */}
        {viewMode === 'grid' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '24px'
          }}>
            {filteredUsers.map((member) => (
              <UserCard 
                key={member.id} 
                user={member} 
                onMessage={handleMessageUser}
                onCreateTask={handleCreateTask}
                formatHierarchyLevel={formatHierarchyLevel}
                getHierarchyColor={getHierarchyColor}
              />
            ))}
          </div>
        )}

        {viewMode === 'list' && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Team Members</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {filteredUsers.map((member) => (
                <UserListItem 
                  key={member.id} 
                  user={member} 
                  onMessage={handleMessageUser}
                  onCreateTask={handleCreateTask}
                  formatHierarchyLevel={formatHierarchyLevel}
                  getHierarchyColor={getHierarchyColor}
                />
              ))}
            </div>
          </div>
        )}

        {viewMode === 'hierarchy' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-6">Organization Chart</h3>
            <div className="space-y-4">
              {hierarchy.map((rootUser) => (
                <HierarchyNode 
                  key={rootUser.id} 
                  user={rootUser} 
                  onMessage={handleMessageUser}
                  onCreateTask={handleCreateTask}
                  formatHierarchyLevel={formatHierarchyLevel}
                  getHierarchyColor={getHierarchyColor}
                  level={0}
                />
              ))}
            </div>
          </div>
        )}

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <UserIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No members found</h3>
            <p className="text-gray-500">
              {searchTerm || departmentFilter ? 'Try adjusting your search or filter criteria.' : 'No members in this organization yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// User Card Component
function UserCard({ 
  user, 
  onMessage, 
  onCreateTask, 
  formatHierarchyLevel, 
  getHierarchyColor 
}: {
  user: OrganizationUser;
  onMessage: (user: OrganizationUser) => void;
  onCreateTask: (user: OrganizationUser) => void;
  formatHierarchyLevel: (level?: string) => string;
  getHierarchyColor: (level?: string) => string;
}) {
  const userName = user.first_name && user.last_name 
    ? `${user.first_name} ${user.last_name}`
    : user.email;

  return (
    <div style={{
      backgroundColor: 'var(--color-surface)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-border)',
      padding: '24px',
      transition: 'all 0.2s ease',
      cursor: 'default'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = 'var(--color-primary)';
      e.currentTarget.style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = 'var(--color-border)';
      e.currentTarget.style.transform = 'translateY(0)';
    }}>
      {/* Profile Section */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          backgroundColor: 'var(--color-surface-light)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span style={{
            fontSize: '18px',
            fontWeight: '500',
            color: 'var(--color-text-primary)'
          }}>
            {user.first_name?.[0] || user.email[0].toUpperCase()}
          </span>
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{
            fontWeight: '500',
            color: 'var(--color-text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>{userName}</h3>
          <p style={{
            fontSize: '14px',
            color: 'var(--color-text-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>{user.email}</p>
        </div>
      </div>

      {/* Details */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        marginBottom: '16px'
      }}>
        {user.job_title && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}>
            <Briefcase style={{ width: '16px', height: '16px', color: 'var(--color-text-muted)' }} />
            <span style={{
              color: 'var(--color-text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>{user.job_title}</span>
          </div>
        )}
        
        {user.department && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}>
            <Building style={{ width: '16px', height: '16px', color: 'var(--color-text-muted)' }} />
            <span style={{
              color: 'var(--color-text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>{user.department}</span>
          </div>
        )}
        
        {user.phone && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}>
            <Phone style={{ width: '16px', height: '16px', color: 'var(--color-text-muted)' }} />
            <span style={{
              color: 'var(--color-text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>{user.phone}</span>
          </div>
        )}
        
        {user.office_location && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}>
            <MapPin style={{ width: '16px', height: '16px', color: 'var(--color-text-muted)' }} />
            <span style={{
              color: 'var(--color-text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>{user.office_location}</span>
          </div>
        )}
      </div>

      {/* Badges */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '16px'
      }}>
        <span style={{
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '500',
          backgroundColor: 'rgba(37, 99, 235, 0.2)',
          color: 'var(--color-primary)'
        }}>
          {user.role.replace('_', ' ')}
        </span>
        {user.hierarchy_level && (
          <span style={{
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '500',
            backgroundColor: 'rgba(148, 163, 184, 0.2)',
            color: 'var(--color-text-secondary)'
          }}>
            {formatHierarchyLevel(user.hierarchy_level)}
          </span>
        )}
        {user.manager_name && (
          <span style={{
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '500',
            backgroundColor: 'var(--color-surface-light)',
            color: 'var(--color-text-secondary)',
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            Reports to {user.manager_name}
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => onMessage(user)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '8px 12px',
            fontSize: '14px',
            fontWeight: '500',
            color: 'white',
            backgroundColor: 'var(--color-primary)',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-primary)';
          }}
        >
          <MessageSquare style={{ width: '16px', height: '16px' }} />
          Message
        </button>
        <button
          onClick={() => onCreateTask(user)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '8px 12px',
            fontSize: '14px',
            fontWeight: '500',
            color: 'white',
            backgroundColor: 'var(--color-success)',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-success-dark)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-success)';
          }}
        >
          <CheckSquare style={{ width: '16px', height: '16px' }} />
          Task
        </button>
      </div>
    </div>
  );
}

// User List Item Component
function UserListItem({ 
  user, 
  onMessage, 
  onCreateTask, 
  formatHierarchyLevel, 
  getHierarchyColor 
}: {
  user: OrganizationUser;
  onMessage: (user: OrganizationUser) => void;
  onCreateTask: (user: OrganizationUser) => void;
  formatHierarchyLevel: (level?: string) => string;
  getHierarchyColor: (level?: string) => string;
}) {
  const userName = user.first_name && user.last_name 
    ? `${user.first_name} ${user.last_name}`
    : user.email;

  return (
    <div className="px-6 py-4 hover:bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="font-medium text-gray-600">
              {user.first_name?.[0] || user.email[0].toUpperCase()}
            </span>
          </div>
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-gray-900">{userName}</h4>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {user.role.replace('_', ' ')}
              </span>
              {user.hierarchy_level && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getHierarchyColor(user.hierarchy_level)}`}>
                  {formatHierarchyLevel(user.hierarchy_level)}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>{user.email}</span>
              {user.job_title && <span>{user.job_title}</span>}
              {user.department && <span>{user.department}</span>}
              {user.manager_name && <span>Reports to {user.manager_name}</span>}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => onMessage(user)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-md"
            title="Send Message"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
          <button
            onClick={() => onCreateTask(user)}
            className="p-2 text-green-600 hover:bg-green-50 rounded-md"
            title="Create Task"
          >
            <CheckSquare className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Hierarchy Node Component
function HierarchyNode({ 
  user, 
  onMessage, 
  onCreateTask, 
  formatHierarchyLevel, 
  getHierarchyColor,
  level 
}: {
  user: any;
  onMessage: (user: OrganizationUser) => void;
  onCreateTask: (user: OrganizationUser) => void;
  formatHierarchyLevel: (level?: string) => string;
  getHierarchyColor: (level?: string) => string;
  level: number;
}) {
  const userName = user.first_name && user.last_name 
    ? `${user.first_name} ${user.last_name}`
    : user.email;

  return (
    <div className={`${level > 0 ? 'ml-8 pl-4 border-l-2 border-gray-200' : ''}`}>
      <div className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600">
                {user.first_name?.[0] || user.email[0].toUpperCase()}
              </span>
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900">{userName}</h4>
                {user.hierarchy_level && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getHierarchyColor(user.hierarchy_level)}`}>
                    {formatHierarchyLevel(user.hierarchy_level)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{user.job_title || user.email}</span>
                {user.department && <span>• {user.department}</span>}
                {user.directReports?.length > 0 && (
                  <span>• {user.directReports.length} direct report{user.directReports.length !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => onMessage(user)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"
              title="Send Message"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
            <button
              onClick={() => onCreateTask(user)}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded-md"
              title="Create Task"
            >
              <CheckSquare className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Direct Reports */}
      {user.directReports && user.directReports.length > 0 && (
        <div className="mt-2">
          {user.directReports.map((report: any) => (
            <HierarchyNode
              key={report.id}
              user={report}
              onMessage={onMessage}
              onCreateTask={onCreateTask}
              formatHierarchyLevel={formatHierarchyLevel}
              getHierarchyColor={getHierarchyColor}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}