import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useAuth } from "../contexts/AuthContext";
import { UserCircle, LogOut, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import organizationService, { OrganizationService } from "../services/organizationService";
import { Organization } from "../types/auth";

export function UserProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(true);

  useEffect(() => {
    const fetchUserOrganization = async () => {
      if (!user) return;
      
      try {
        const org = await organizationService.getMyOrganization();
        setOrganization(org);
      } catch (error) {
        console.error('Failed to fetch user organization:', error);
      } finally {
        setLoadingOrg(false);
      }
    };

    fetchUserOrganization();
  }, [user]);

  if (!user) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button 
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus:outline-none"
          style={{
            color: 'var(--warm-text-primary)',
            backgroundColor: 'transparent'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--warm-card-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <UserCircle className="h-8 w-8" style={{ color: 'var(--warm-text-secondary)' }} />
          <div className="text-left">
            <p className="font-semibold" style={{ color: 'var(--warm-text-primary)' }}>{user.firstName} {user.lastName}</p>
            <p className="text-xs capitalize" style={{ color: 'var(--warm-text-secondary)' }}>{user.role?.replace('_', ' ')}</p>
            {organization && (
              <p className="text-xs truncate max-w-32" style={{ color: 'var(--warm-text-muted)' }}>{organization.name}</p>
            )}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.firstName} {user.lastName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
            <p className="text-xs leading-none text-muted-foreground capitalize">
              {user.role?.replace('_', ' ')}
            </p>
          </div>
        </DropdownMenuLabel>
        
        {/* Organization Information & Actions */}
        {organization && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => navigate('/organization')}
              className="group cursor-pointer"
            >
              <Building2 className="mr-2 h-4 w-4" />
              <div className="flex flex-col min-w-0">
                <p className="text-sm font-medium truncate">
                  {organization.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {OrganizationService.formatOrganizationType(organization.type)}
                </p>
              </div>
            </DropdownMenuItem>
          </>
        )}
        
        {loadingOrg && !organization && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" style={{ color: 'var(--warm-text-muted)' }} />
                <p className="text-xs" style={{ color: 'var(--warm-text-secondary)' }}>Loading organization...</p>
              </div>
            </div>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => {
            logout();
            navigate('/');
          }} 
          className="group text-red-600 focus:text-red-600"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}