import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, FileText, Send, Upload, BarChart3 } from 'lucide-react';
import { PremiumModal, PremiumButton, PremiumInput, PremiumDropdown } from './PremiumComponents';
import { CreateTaskModal } from './CreateTaskModal';
import axios from 'axios';
import { useToast } from '../hooks/use-toast';
import { useLocation } from 'react-router-dom';
import { inboxApi } from '../services/inboxApi';

interface ActionButton {
  id: string;
  icon: React.ComponentType<any>;
  label: string;
  color: string;
  action: () => void;
}

export const FloatingActionButtonRadial: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'task' | 'message' | 'upload' | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Message form state
  const [messageRecipient, setMessageRecipient] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  
  // Upload form state
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadLoanId, setUploadLoanId] = useState('');
  
  // Get current context (loan ID from URL if on loan detail page)
  const getCurrentLoanId = (): string | null => {
    const pathMatch = location.pathname.match(/\/loans\/([^\/]+)/);
    const loanId = pathMatch ? pathMatch[1] : null;
    console.log('getCurrentLoanId:', { pathname: location.pathname, loanId });
    return loanId;
  };

  // Define action buttons
  const actionButtons: ActionButton[] = [
    {
      id: 'task',
      icon: FileText,
      label: 'New Task',
      color: 'from-blue-500 to-blue-600',
      action: () => setSelectedAction('task')
    },
    {
      id: 'message',
      icon: Send,
      label: 'New Message',
      color: 'from-teal-500 to-teal-600',
      action: () => setSelectedAction('message')
    },
    {
      id: 'upload',
      icon: Upload,
      label: 'Upload Docs',
      color: 'from-purple-500 to-purple-600',
      action: () => setSelectedAction('upload')
    },
    {
      id: 'report',
      icon: BarChart3,
      label: 'Generate Report',
      color: 'from-amber-500 to-amber-600',
      action: () => {
        toast({
          title: 'Coming Soon',
          description: 'Report generation will be available soon'
        });
      }
    }
  ];

  // Load users for message recipient selection
  useEffect(() => {
    const fetchUsers = async () => {
      if (selectedAction === 'message') {
        try {
          const userList = await inboxApi.getUsers();
          setUsers(userList);
        } catch (error) {
          console.error('Error loading users:', error);
        }
      }
    };

    fetchUsers();
  }, [selectedAction]);

  // Auto-populate loan ID when on loan detail page
  useEffect(() => {
    const currentLoanId = getCurrentLoanId();
    if (currentLoanId && selectedAction === 'upload') {
      setUploadLoanId(currentLoanId);
    }
  }, [selectedAction, location.pathname]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    setSelectedAction(null);
    // Reset forms
    setMessageRecipient('');
    setMessageSubject('');
    setMessageContent('');
    setUploadFiles([]);
    setUploadLoanId('');
  };

  const handleTaskCreate = async (
    title: string,
    description?: string,
    assigned_to_user_id?: number,
    due_date?: Date,
    priority?: 'urgent' | 'high' | 'normal' | 'low',
    loanId?: string
  ) => {
    try {
      await inboxApi.createStandaloneTask(
        title,
        description,
        assigned_to_user_id,
        due_date,
        priority,
        undefined, // category
        loanId ? [loanId] : undefined
      );
      
      toast({
        title: 'Task created',
        description: 'Your task has been added to the inbox'
      });
      
      handleClose();
    } catch (error) {
      console.error('Failed to create task:', error);
      toast({
        title: 'Error',
        description: 'Failed to create task. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleFileUpload = async () => {
    if (uploadFiles.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select files to upload',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      
      uploadFiles.forEach(file => {
        formData.append('files', file);
      });
      
      if (uploadLoanId) {
        formData.append('loan_id', uploadLoanId);
      }
      
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      await axios.post(`${apiUrl}/api/upload/documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      toast({
        title: 'Files uploaded',
        description: `Successfully uploaded ${uploadFiles.length} file(s)`
      });
      
      handleClose();
    } catch (error) {
      console.error('Failed to upload files:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload files. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMessageSubmit = async () => {
    if (!messageRecipient.trim() || !messageSubject.trim() || !messageContent.trim()) {
      toast({
        title: 'All fields required',
        description: 'Please fill in all message fields',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      
      // Create message through inbox API
      await axios.post(`${apiUrl}/api/inbox`, {
        type: 'user_message',
        subject: messageSubject,
        body: messageContent,
        priority: 'normal',
        recipients: [messageRecipient],
        category: 'communication',
        metadata: {
          sent_via: 'floating_action_button'
        }
      });
      
      toast({
        title: 'Message sent',
        description: 'Your message has been delivered'
      });
      
      handleClose();
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: 'Error', 
        description: 'Failed to send message. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop with blur */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-all duration-300" />
      )}

      {/* FAB Container */}
      <div ref={containerRef} className="fixed bottom-6 left-6 z-50">
        {/* Secondary Action Buttons - Simple Vertical Stack */}
        {isOpen && (
          <div className="absolute bottom-16 left-0 flex flex-col-reverse gap-3">
            {actionButtons.map((button, index) => (
              <div
                key={button.id}
                className={`transition-all duration-300 ${
                  isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                }`}
                style={{
                  transitionDelay: `${index * 75}ms`,
                  transitionTimingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
                }}
              >
                <button
                  onClick={() => {
                    button.action();
                    if (button.id === 'upload') {
                      setIsOpen(false);
                    }
                  }}
                  className="group flex items-center gap-3 p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
                >
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${button.color} flex items-center justify-center text-white flex-shrink-0`}>
                    <button.icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 pr-2 whitespace-nowrap">
                    {button.label}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Main FAB Button */}
        <button 
          className={`premium-fab flex items-center justify-center transition-all duration-300 ${
            isOpen ? 'rotate-45 scale-110' : 'rotate-0 scale-100'
          }`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close menu' : 'Open actions menu'}
          style={{
            transitionTimingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
            position: 'relative',
            zIndex: 1
          }}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>

      {/* Task Creation Modal - Use existing CreateTaskModal */}
      <CreateTaskModal
        isOpen={selectedAction === 'task'}
        onClose={handleClose}
        onSend={handleTaskCreate}
        prefilledLoanId={getCurrentLoanId() || undefined}
      />

      {/* Message Creation Modal */}
      <PremiumModal
        isOpen={selectedAction === 'message'}
        onClose={handleClose}
        title="New Message"
        footer={
          <div className="flex gap-3">
            <PremiumButton variant="ghost" onClick={handleClose}>
              Cancel
            </PremiumButton>
            <PremiumButton 
              variant="primary" 
              onClick={handleMessageSubmit}
              loading={loading}
              icon={Send}
            >
              Send Message
            </PremiumButton>
          </div>
        }
      >
        <div className="space-y-6">
          <PremiumDropdown
            label="To"
            options={users.map(user => ({
              value: user.email,
              label: `${user.first_name} ${user.last_name}`,
              description: user.email
            }))}
            value={messageRecipient}
            onChange={setMessageRecipient}
            searchable={true}
            placeholder="Search for a user..."
          />
          
          <PremiumInput
            label="Subject"
            value={messageSubject}
            onChange={setMessageSubject}
            placeholder="Enter message subject"
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
            <textarea
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              placeholder="Write your message..."
              rows={6}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              required
            />
          </div>
        </div>
      </PremiumModal>

      {/* Upload Documents Modal */}
      <PremiumModal
        isOpen={selectedAction === 'upload'}
        onClose={handleClose}
        title="Upload Documents"
        footer={
          <div className="flex gap-3">
            <PremiumButton variant="ghost" onClick={handleClose}>
              Cancel
            </PremiumButton>
            <PremiumButton 
              variant="primary" 
              onClick={handleFileUpload}
              loading={loading}
              icon={Upload}
            >
              Upload Files
            </PremiumButton>
          </div>
        }
      >
        <div className="space-y-6">
          <PremiumInput
            label="Related Loan ID"
            value={uploadLoanId}
            onChange={setUploadLoanId}
            placeholder="Enter loan ID (optional)"
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Documents</label>
            <div 
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('border-blue-400', 'bg-blue-50');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
                const files = Array.from(e.dataTransfer.files);
                setUploadFiles(prev => [...prev, ...files]);
              }}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Drag & drop files here, or click to browse</p>
              <input
                type="file"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setUploadFiles(prev => [...prev, ...files]);
                }}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 cursor-pointer"
              >
                Browse Files
              </label>
            </div>
            
            {uploadFiles.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Selected Files:</p>
                <div className="space-y-2">
                  {uploadFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700">{file.name}</span>
                      <button
                        onClick={() => setUploadFiles(prev => prev.filter((_, i) => i !== index))}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </PremiumModal>
    </>
  );
};