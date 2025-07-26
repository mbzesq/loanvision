import React, { useState } from 'react';
import { Plus, Send, FileText } from 'lucide-react';
import { PremiumModal, PremiumButton, PremiumInput } from './PremiumComponents';
import axios from 'axios';
import { useToast } from '../hooks/use-toast';

type ActionType = 'task' | 'message' | null;

export const FloatingActionButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionType>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  
  // Message form state
  const [messageRecipient, setMessageRecipient] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [messageContent, setMessageContent] = useState('');

  const handleActionSelect = (action: ActionType) => {
    setSelectedAction(action);
  };

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
        recipients: [messageRecipient], // The API expects recipients array
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
      {/* Floating Action Button */}
      <button 
        className="premium-fab flex items-center justify-center"
        onClick={() => setIsOpen(true)}
        aria-label="Create new task or message"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Action Selection Modal */}
      <PremiumModal
        isOpen={isOpen && !selectedAction}
        onClose={handleClose}
        title="What would you like to create?"
        size="sm"
      >
        <div className="space-y-4">
          <button
            onClick={() => handleActionSelect('task')}
            className="w-full p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">New Task</h3>
                <p className="text-sm text-gray-600">Create a task for yourself or others</p>
              </div>
            </div>
          </button>
          
          <button
            onClick={() => handleActionSelect('message')}
            className="w-full p-6 border-2 border-gray-200 rounded-xl hover:border-teal-500 hover:bg-teal-50 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center group-hover:bg-teal-200 transition-colors">
                <Send className="w-6 h-6 text-teal-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">New Message</h3>
                <p className="text-sm text-gray-600">Send a message to a team member</p>
              </div>
            </div>
          </button>
        </div>
      </PremiumModal>

      {/* Task Creation Modal */}
      <PremiumModal
        isOpen={isOpen && selectedAction === 'task'}
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
        isOpen={isOpen && selectedAction === 'message'}
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