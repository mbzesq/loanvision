import { ChatUser } from '../../types/chat';
import { User } from 'lucide-react';

interface AvatarProps {
  user?: ChatUser | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showOnlineStatus?: boolean;
  className?: string;
}

export function Avatar({ user, size = 'md', showOnlineStatus = false, className = '' }: AvatarProps) {
  const sizeClasses = {
    xs: 'h-6 w-6 text-xs',
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-12 w-12 text-lg'
  };

  const getInitials = (user: ChatUser) => {
    if (!user.first_name && !user.last_name) {
      return user.email.charAt(0).toUpperCase();
    }
    return `${user.first_name?.charAt(0) || ''}${user.last_name?.charAt(0) || ''}`.toUpperCase();
  };

  const getBackgroundColor = (email: string) => {
    // Generate a consistent color based on email
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-gray-500',
    ];
    
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      case 'busy':
        return 'bg-red-500';
      case 'offline':
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'away':
        return 'Away';
      case 'busy':
        return 'Busy';
      case 'offline':
      default:
        return 'Offline';
    }
  };

  return (
    <div className={`relative ${className}`}>
      {user?.profile_image_url ? (
        <img
          src={user.profile_image_url}
          alt={`${user.first_name} ${user.last_name}`}
          className={`${sizeClasses[size]} rounded-full object-cover`}
        />
      ) : user ? (
        <div
          className={`
            ${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-medium
            ${getBackgroundColor(user.email)}
          `}
        >
          {getInitials(user)}
        </div>
      ) : (
        <div
          className={`
            ${sizeClasses[size]} rounded-full flex items-center justify-center bg-gray-300 text-gray-600
          `}
        >
          <User className="h-1/2 w-1/2" />
        </div>
      )}

      {/* Status indicator */}
      {showOnlineStatus && (
        <div
          className={`
            absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white
            ${size === 'xs' ? 'h-2 w-2' : size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'}
            ${getStatusColor(user?.presence_status)}
            transition-colors duration-200
          `}
          title={getStatusLabel(user?.presence_status)}
        />
      )}
    </div>
  );
}