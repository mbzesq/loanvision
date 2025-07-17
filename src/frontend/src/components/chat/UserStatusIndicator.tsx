import { ChatUserStatus } from '../../types/chat';

interface UserStatusIndicatorProps {
  status?: ChatUserStatus;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function UserStatusIndicator({ 
  status = 'offline', 
  size = 'sm', 
  showLabel = false, 
  className = '' 
}: UserStatusIndicatorProps) {
  const getStatusColor = (status: ChatUserStatus) => {
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

  const getStatusLabel = (status: ChatUserStatus) => {
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

  const getSizeClasses = () => {
    switch (size) {
      case 'xs':
        return 'h-1.5 w-1.5';
      case 'sm':
        return 'h-2 w-2';
      case 'md':
        return 'h-2.5 w-2.5';
      case 'lg':
        return 'h-3 w-3';
      default:
        return 'h-2 w-2';
    }
  };

  const getTextSize = () => {
    switch (size) {
      case 'xs':
        return 'text-xs';
      case 'sm':
        return 'text-xs';
      case 'md':
        return 'text-sm';
      case 'lg':
        return 'text-base';
      default:
        return 'text-xs';
    }
  };

  if (showLabel) {
    return (
      <div className={`flex items-center space-x-1.5 ${className}`}>
        <div
          className={`
            ${getSizeClasses()} rounded-full 
            ${getStatusColor(status)}
            transition-colors duration-200
          `}
          title={getStatusLabel(status)}
        />
        <span className={`${getTextSize()} text-gray-600 font-medium`}>
          {getStatusLabel(status)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`
        ${getSizeClasses()} rounded-full 
        ${getStatusColor(status)}
        transition-colors duration-200
        ${className}
      `}
      title={getStatusLabel(status)}
    />
  );
}