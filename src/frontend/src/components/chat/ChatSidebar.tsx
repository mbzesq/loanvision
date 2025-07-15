import { useState } from 'react';
import { X, MessageCircle, Building2, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { InternalChatContainer } from './InternalChatContainer';
import { ChatSystemType } from '../../types/chat';

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export function ChatSidebar({ isOpen, onToggle, className = '' }: ChatSidebarProps) {
  const [activeTab, setActiveTab] = useState<ChatSystemType>('internal');

  // Future feature flag - set to false for now
  const isIndustryFeatureEnabled = false;

  return (
    <>
      {/* Chat Toggle Button - Always visible */}
      <div className="fixed bottom-6 right-6 z-40 lg:hidden">
        <Button
          onClick={onToggle}
          size="lg"
          className="rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white"
        >
          <MessageCircle className="h-5 w-5" />
        </Button>
      </div>

      {/* Desktop Chat Sidebar */}
      <div
        className={`
          hidden lg:flex lg:flex-col fixed top-0 right-0 h-full bg-white border-l border-gray-200 shadow-xl z-30 transition-all duration-300 ease-in-out
          ${isOpen ? 'w-80' : 'w-12'}
          ${className}
        `}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
          {isOpen ? (
            <>
              <div className="flex items-center space-x-2">
                <MessageCircle className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Chat</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggle}
                className="text-gray-500 hover:text-gray-700"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="w-full text-gray-500 hover:text-gray-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Chat Tabs - Only show when open */}
        {isOpen && (
          <div className="flex border-b border-gray-200">
            {/* Internal Chat Tab */}
            <button
              onClick={() => setActiveTab('internal')}
              className={`
                flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium transition-colors
                ${activeTab === 'internal'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              <Building2 className="h-4 w-4 mr-2" />
              Internal
              {/* Unread badge placeholder */}
              <Badge 
                variant="secondary" 
                className="ml-2 bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5"
              >
                3
              </Badge>
            </button>

            {/* Industry Chat Tab - Future feature */}
            {isIndustryFeatureEnabled && (
              <button
                onClick={() => setActiveTab('industry')}
                className={`
                  flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium transition-colors
                  ${activeTab === 'industry'
                    ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <Globe className="h-4 w-4 mr-2" />
                Industry
                <Badge 
                  variant="secondary" 
                  className="ml-2 bg-green-100 text-green-800 text-xs px-1.5 py-0.5"
                >
                  1
                </Badge>
              </button>
            )}
          </div>
        )}

        {/* Chat Content */}
        {isOpen && (
          <div className="flex-1 overflow-hidden">
            {activeTab === 'internal' && (
              <div className="h-full border-l-4 border-blue-500">
                <InternalChatContainer />
              </div>
            )}
            
            {activeTab === 'industry' && isIndustryFeatureEnabled && (
              <div className="h-full border-l-4 border-green-500">
                {/* Future: IndustryChatContainer */}
                <div className="p-4 text-center text-gray-500">
                  <Globe className="h-12 w-12 mx-auto mb-3 text-green-500" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Industry Chat</h3>
                  <p className="text-sm">
                    Connect with professionals across organizations to discuss market trends, 
                    asset opportunities, and industry insights.
                  </p>
                  <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs text-green-700">
                      🔒 <strong>Note:</strong> Industry conversations are visible to multiple organizations. 
                      Do not share confidential or PII information.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Collapsed State - Show minimal info */}
        {!isOpen && (
          <div className="flex-1 flex flex-col items-center py-4 space-y-4">
            {/* Internal chat indicator */}
            <div className="relative">
              <Building2 className="h-6 w-6 text-blue-600" />
              <Badge 
                variant="secondary" 
                className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-blue-600 text-white text-xs"
              >
                3
              </Badge>
            </div>
            
            {/* Industry chat indicator - Future */}
            {isIndustryFeatureEnabled && (
              <div className="relative">
                <Globe className="h-6 w-6 text-green-600" />
                <Badge 
                  variant="secondary" 
                  className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-green-600 text-white text-xs"
                >
                  1
                </Badge>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Chat Overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50" onClick={onToggle}>
          <div 
            className="absolute inset-y-0 right-0 w-full max-w-sm bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <MessageCircle className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Chat</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggle}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Mobile Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('internal')}
                className={`
                  flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium
                  ${activeTab === 'internal'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700'
                  }
                `}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Internal
              </button>
              
              {isIndustryFeatureEnabled && (
                <button
                  onClick={() => setActiveTab('industry')}
                  className={`
                    flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium
                    ${activeTab === 'industry'
                      ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                      : 'text-gray-500 hover:text-gray-700'
                    }
                  `}
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Industry
                </button>
              )}
            </div>

            {/* Mobile Content */}
            <div className="flex-1 overflow-hidden h-[calc(100vh-120px)]">
              {activeTab === 'internal' && <InternalChatContainer />}
              {activeTab === 'industry' && isIndustryFeatureEnabled && (
                <div className="p-4 text-center text-gray-500">
                  <Globe className="h-12 w-12 mx-auto mb-3 text-green-500" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Industry Chat</h3>
                  <p className="text-sm">Coming soon...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}