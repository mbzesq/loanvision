import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { UserStatusIndicator } from './UserStatusIndicator';
import { ChatUserStatus } from '../../types/chat';
import { chatApi } from '../../services/chatApi';

interface UserStatusSelectorProps {
  currentStatus?: ChatUserStatus;
  onStatusChange?: (status: ChatUserStatus) => void;
  className?: string;
}

const statusOptions: { value: ChatUserStatus; label: string; description: string }[] = [
  { value: 'online', label: 'Online', description: 'Available for chat' },
  { value: 'away', label: 'Away', description: 'Temporarily away' },
  { value: 'busy', label: 'Busy', description: 'Do not disturb' },
  { value: 'offline', label: 'Offline', description: 'Appear offline' },
];

export function UserStatusSelector({ 
  currentStatus = 'online', 
  onStatusChange,
  className = '' 
}: UserStatusSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const currentOption = statusOptions.find(option => option.value === currentStatus) || statusOptions[0];

  const handleStatusChange = async (newStatus: ChatUserStatus) => {
    if (newStatus === currentStatus) {
      setIsOpen(false);
      return;
    }

    setIsUpdating(true);
    try {
      await chatApi.updatePresence(newStatus);
      onStatusChange?.(newStatus);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to update presence status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        className="w-full justify-between px-2 py-1 h-auto text-xs"
      >
        <div className="flex items-center space-x-2">
          <UserStatusIndicator status={currentStatus} size="xs" />
          <span className="truncate">{currentOption.label}</span>
        </div>
        <ChevronDown className="h-3 w-3 ml-1 flex-shrink-0" />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-gray-200 rounded-md shadow-lg py-1">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusChange(option.value)}
                disabled={isUpdating}
                className={`
                  w-full px-3 py-2 text-left text-xs hover:bg-gray-50 transition-colors
                  flex items-center justify-between
                  ${option.value === currentStatus ? 'bg-blue-50' : ''}
                  ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <div className="flex items-center space-x-2">
                  <UserStatusIndicator status={option.value} size="xs" />
                  <div>
                    <div className="font-medium text-gray-900">{option.label}</div>
                    <div className="text-gray-500">{option.description}</div>
                  </div>
                </div>
                {option.value === currentStatus && (
                  <Check className="h-3 w-3 text-blue-600" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}