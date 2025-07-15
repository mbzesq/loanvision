import { useState } from 'react';
import { X, MessageCircle, Building2, Globe, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { InternalChatContainer } from './InternalChatContainer';
import { ChatSystemType } from '../../types/chat';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatModal({ isOpen, onClose }: ChatModalProps) {
  const [activeTab, setActiveTab] = useState<ChatSystemType>('internal');
  const [isMinimized, setIsMinimized] = useState(false);

  // Future feature flag - set to false for now
  const isIndustryFeatureEnabled = false;

  const toggleMinimized = () => {
    setIsMinimized(!isMinimized);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center lg:items-start lg:justify-end lg:p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity lg:bg-transparent"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div 
        className={`
          relative z-50 bg-white rounded-lg shadow-xl transition-all duration-300 ease-in-out
          w-full max-w-4xl mx-4 
          lg:w-[800px] lg:mx-0 lg:mt-16 lg:mr-4
          ${isMinimized ? 'h-16' : 'h-[600px] max-h-[90vh]'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <div className="flex items-center space-x-3">
            <MessageCircle className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {isMinimized ? 'Chat' : 'Team Communication'}
            </h2>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMinimized}
              className="text-gray-500 hover:text-gray-700"
            >
              {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Modal Content - Only show when not minimized */}
        {!isMinimized && (
          <>
            {/* Chat Tabs */}
            <div className="flex border-b border-gray-200 bg-white">
              {/* Internal Chat Tab */}
              <button
                onClick={() => setActiveTab('internal')}
                className={`
                  flex-1 flex items-center justify-center px-4 py-3 text-sm font-medium transition-colors
                  ${activeTab === 'internal'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Internal Communications
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
                    flex-1 flex items-center justify-center px-4 py-3 text-sm font-medium transition-colors
                    ${activeTab === 'industry'
                      ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Industry Network
                  <Badge 
                    variant="secondary" 
                    className="ml-2 bg-green-100 text-green-800 text-xs px-1.5 py-0.5"
                  >
                    1
                  </Badge>
                </button>
              )}
            </div>

            {/* Chat Content */}
            <div className="flex-1 overflow-hidden bg-white rounded-b-lg" style={{ height: 'calc(100% - 120px)' }}>
              {activeTab === 'internal' && (
                <div className="h-full border-l-4 border-blue-500">
                  <InternalChatContainer />
                </div>
              )}
              
              {activeTab === 'industry' && isIndustryFeatureEnabled && (
                <div className="h-full border-l-4 border-green-500 p-6">
                  <div className="text-center text-gray-500">
                    <Globe className="h-16 w-16 mx-auto mb-4 text-green-500" />
                    <h3 className="text-xl font-medium text-gray-900 mb-3">Industry Network</h3>
                    <p className="text-sm mb-4">
                      Connect with professionals across organizations to discuss market trends, 
                      asset opportunities, and industry insights.
                    </p>
                    <div className="max-w-md mx-auto p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-xs text-green-700">
                        🔒 <strong>Note:</strong> Industry conversations are visible to multiple organizations. 
                        Do not share confidential or PII information.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}