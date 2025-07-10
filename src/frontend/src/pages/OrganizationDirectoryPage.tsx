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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading organization directory...</p>
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
            onClick={fetchData}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Organization Directory</h1>
              <p className="text-gray-600">
                {organization?.name} • {filteredUsers.length} {filteredUsers.length === 1 ? 'member' : 'members'}
              </p>
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-white rounded-lg p-1 shadow-sm">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('hierarchy')}
                className={`p-2 rounded-md ${viewMode === 'hierarchy' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Users className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, title, or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {/* Department Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
    <div className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow p-6">
      {/* Profile Section */}
      <div className="flex items-center gap-3 mb-4">
        <div className="h-12 w-12 bg-gray-200 rounded-full flex items-center justify-center">
          <span className="text-lg font-medium text-gray-600">
            {user.first_name?.[0] || user.email[0].toUpperCase()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-gray-900 truncate">{userName}</h3>
          <p className="text-sm text-gray-500 truncate">{user.email}</p>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2 mb-4">
        {user.job_title && (
          <div className="flex items-center gap-2 text-sm">
            <Briefcase className="h-4 w-4 text-gray-400" />
            <span className="text-gray-700 truncate">{user.job_title}</span>
          </div>
        )}
        
        {user.department && (
          <div className="flex items-center gap-2 text-sm">
            <Building className="h-4 w-4 text-gray-400" />
            <span className="text-gray-700 truncate">{user.department}</span>
          </div>
        )}
        
        {user.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-gray-400" />
            <span className="text-gray-700 truncate">{user.phone}</span>
          </div>
        )}
        
        {user.office_location && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-gray-400" />
            <span className="text-gray-700 truncate">{user.office_location}</span>
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {user.role.replace('_', ' ')}
        </span>
        {user.hierarchy_level && (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getHierarchyColor(user.hierarchy_level)}`}>
            {formatHierarchyLevel(user.hierarchy_level)}
          </span>
        )}
        {user.manager_name && (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            Reports to {user.manager_name}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onMessage(user)}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
        >
          <MessageSquare className="h-4 w-4" />
          Message
        </button>
        <button
          onClick={() => onCreateTask(user)}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100"
        >
          <CheckSquare className="h-4 w-4" />
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