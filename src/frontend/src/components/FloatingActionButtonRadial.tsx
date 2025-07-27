import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, FileText, Send, Upload, BarChart3 } from 'lucide-react';
import { PremiumModal, PremiumButton, PremiumInput } from './PremiumComponents';
import axios from 'axios';
import { useToast } from '../hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface ActionButton {
  id: string;
  icon: React.ComponentType<any>;
  label: string;
  color: string;
  action: () => void;
}

export const FloatingActionButtonRadial: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'task' | 'message' | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  
  // Message form state
  const [messageRecipient, setMessageRecipient] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [messageContent, setMessageContent] = useState('');

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
      label: 'Upload Data',
      color: 'from-purple-500 to-purple-600',
      action: () => navigate('/upload')
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
    setTaskTitle('');
    setTaskDescription('');
    setTaskPriority('medium');
    setTaskDueDate('');
    setMessageRecipient('');
    setMessageSubject('');
    setMessageContent('');
  };

  const handleTaskSubmit = async () => {
    if (!taskTitle.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter a task title',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      
      await axios.post(`${apiUrl}/api/inbox/tasks`, {
        title: taskTitle,
        description: taskDescription,
        priority: taskPriority,
        due_date: taskDueDate || null,
        source: 'Manual',
        loan_id: null
      });
      
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
      <div ref={containerRef} className="fixed bottom-6 right-6 z-50">
        {/* Secondary Action Buttons */}
        {actionButtons.map((button, index) => {
          const angle = -90 - (index * 30); // Arrange in arc above main button
          const distance = 80; // Distance from center
          const x = Math.cos(angle * Math.PI / 180) * distance;
          const y = Math.sin(angle * Math.PI / 180) * distance;
          
          return (
            <div
              key={button.id}
              className={`absolute transition-all duration-300 ${
                isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-0 pointer-events-none'
              }`}
              style={{
                transform: isOpen 
                  ? `translate(${x}px, ${y}px)` 
                  : 'translate(0, 0)',
                transitionDelay: isOpen ? `${index * 50}ms` : `${(actionButtons.length - index - 1) * 50}ms`,
                transitionTimingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' // Spring effect
              }}
            >
              <button
                onClick={() => {
                  button.action();
                  if (button.id === 'upload') {
                    setIsOpen(false);
                  }
                }}
                className="group flex flex-col items-center gap-2 p-3 min-w-[60px] transition-transform hover:scale-110"
              >
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${button.color} shadow-lg flex items-center justify-center text-white group-hover:shadow-xl transition-shadow`}>
                  <button.icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-gray-700 bg-white/90 px-2 py-1 rounded-full shadow-sm whitespace-nowrap">
                  {button.label}
                </span>
              </button>
            </div>
          );
        })}

        {/* Main FAB Button */}
        <button 
          className={`premium-fab flex items-center justify-center transition-all duration-300 ${
            isOpen ? 'rotate-45 scale-110' : 'rotate-0 scale-100'
          }`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close menu' : 'Open actions menu'}
          style={{
            transitionTimingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
          }}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>

      {/* Task Creation Modal */}
      <PremiumModal
        isOpen={selectedAction === 'task'}
        onClose={handleClose}
        title="Create New Task"
        footer={
          <div className="flex gap-3">
            <PremiumButton variant="ghost" onClick={handleClose}>
              Cancel
            </PremiumButton>
            <PremiumButton 
              variant="primary" 
              onClick={handleTaskSubmit}
              loading={loading}
              icon={FileText}
            >
              Create Task
            </PremiumButton>
          </div>
        }
      >
        <div className="space-y-6">
          <PremiumInput
            label="Task Title"
            value={taskTitle}
            onChange={setTaskTitle}
            placeholder="Enter task title"
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Add a description..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
              <input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </PremiumModal>

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
          <PremiumInput
            label="To"
            value={messageRecipient}
            onChange={setMessageRecipient}
            placeholder="Enter recipient email or name"
            required
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
    </>
  );
};