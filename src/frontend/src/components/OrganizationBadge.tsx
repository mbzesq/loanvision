import { Building2 } from 'lucide-react';
import { Organization } from '../types/auth';
import { OrganizationService } from '../services/organizationService';

interface OrganizationBadgeProps {
  organization: Organization;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function OrganizationBadge({ 
  organization, 
  showIcon = true, 
  size = 'md',
  className = '' 
}: OrganizationBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-2.5 py-1.5'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full font-medium ${
      OrganizationService.getOrganizationTypeColor(organization.type)
    } ${sizeClasses[size]} ${className}`}>
      {showIcon && <Building2 className={iconSizes[size]} />}
      <span className="truncate">
        {organization.name}
      </span>
      <span className="text-opacity-70 ml-1">
        ({OrganizationService.formatOrganizationType(organization.type)})
      </span>
    </div>
  );
}

interface OrganizationInfoProps {
  organization: Organization;
  detailed?: boolean;
  className?: string;
}

export function OrganizationInfo({ 
  organization, 
  detailed = false, 
  className = '' 
}: OrganizationInfoProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-slate-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 truncate">
            {organization.name}
          </p>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              OrganizationService.getOrganizationTypeColor(organization.type)
            }`}>
              {OrganizationService.formatOrganizationType(organization.type)}
            </span>
            {organization.email_domain && (
              <span className="text-xs text-slate-500">
                @{organization.email_domain}
              </span>
            )}
          </div>
        </div>
      </div>
      
      {detailed && organization.description && (
        <p className="text-sm text-slate-600">{organization.description}</p>
      )}
      
      {detailed && (organization.website || organization.phone) && (
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          {organization.website && (
            <a 
              href={organization.website} 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-slate-700 underline"
            >
              {organization.website}
            </a>
          )}
          {organization.phone && (
            <span>{organization.phone}</span>
          )}
        </div>
      )}
    </div>
  );
}