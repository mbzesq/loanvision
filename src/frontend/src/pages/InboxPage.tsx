import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Search, Archive, MessageCircle, 
  AlertTriangle, FileText, DollarSign, TrendingUp,
  Reply, Forward, MoreVertical, ChevronDown, ChevronRight,
  Users, Trash2, Plus, Eye, ArrowUpDown
} from 'lucide-react';
import { format } from 'date-fns';
import { InboxItem, InboxStats, INBOX_QUICK_FILTERS, InboxBulkAction, User as UserType, InboxFilter } from '../types/inbox';
import { inboxApi } from '../services/inboxApi';
import { ReplyModal } from '../components/ReplyModal';
import { ForwardModal } from '../components/ForwardModal';
import { CreateTaskModal } from '../components/CreateTaskModal';
import { NewMessageModal } from '../components/NewMessageModal';
import { TaskBodyRenderer } from '../components/TaskBodyRenderer';
import '../styles/premium-saas-design.css';

function InboxPage() {
  
  const location = useLocation();
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('UNREAD_MESSAGES');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [groupByThread] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [showSenderFilter, setShowSenderFilter] = useState(false);
  const [selectedSender] = useState<number | null>(null);
  const [showOverdueFilter, setShowOverdueFilter] = useState(false);
  const [showUrgentFilter, setShowUrgentFilter] = useState(false);
  const [prioritySort, setPrioritySort] = useState<'asc' | 'desc' | null>(null);
  const [inboxStats, setInboxStats] = useState<InboxStats>({
    total: 0,
    unread: 0,
    urgent: 0,
    overdue: 0,
    my_tasks: 0,
    deleted: 0,
    sent_tasks: 0,
    messages: 0,
    unread_messages: 0,
    sent_messages: 0,
    all_tasks: 0,
    by_category: {},
    by_priority: {},
    by_status: {},
    // Legacy compatibility
    myTasks: 0,
    byCategory: {},
    byPriority: {}
  });

  // Get current user from localStorage or context (simplified for demo)
  const getCurrentUser = (): UserType | null => {
    try {
      const userStr = localStorage.getItem('currentUser');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  };

  const currentUser = getCurrentUser();

  useEffect(() => {
    fetchInboxData();
  }, [activeFilter, searchQuery]);

  // Handle prefilled data from organization directory
  useEffect(() => {
    const state = location.state as any;
    if (state?.prefilledRecipient) {
      // Open new message modal with prefilled recipient
      setShowNewMessageModal(true);
    } else if (state?.createTask && state?.prefilledAssignee) {
      // Open create task modal with prefilled assignee
      setShowCreateTaskModal(true);
    }
  }, [location.state]);

  // Auto-clear success messages after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setError(null);
  };

  const showError = (message: string) => {
    setError(message);
    setSuccessMessage(null);
  };

  const handleReply = async (body: string) => {
    if (!selectedItem) return;
    
    try {
      await inboxApi.replyToItem(selectedItem.id, body);
      showSuccess('Reply sent successfully');
      // Refresh data to show the new reply
      await fetchInboxData();
    } catch (error) {
      console.error('Error sending reply:', error);
      showError(`Failed to send reply: ${(error as Error).message}`);
      throw error; // Re-throw to let modal handle it
    }
  };

  const handleForward = async (body: string, recipients: Array<{ user_id: number; recipient_type?: 'to' | 'cc' | 'bcc' }>) => {
    if (!selectedItem) return;
    
    try {
      await inboxApi.forwardItem(selectedItem.id, body, recipients);
      showSuccess('Message forwarded successfully');
      // Refresh data to show the new forward
      await fetchInboxData();
    } catch (error) {
      console.error('Error forwarding message:', error);
      showError(`Failed to forward message: ${(error as Error).message}`);
      throw error; // Re-throw to let modal handle it
    }
  };

  const handleCreateTask = async (title: string, description?: string, assigned_to_user_id?: number, due_date?: Date, priority?: 'urgent' | 'high' | 'normal' | 'low', loanId?: string) => {
    try {
      if (selectedItem) {
        // Create task from selected item (context-aware)
        await inboxApi.createTask(selectedItem.id, title, description, assigned_to_user_id, due_date, priority);
      } else {
        // Create standalone task
        const loan_ids = loanId ? [loanId] : [];
        await inboxApi.createStandaloneTask(title, description, assigned_to_user_id, due_date, priority, 'general', loan_ids);
      }
      showSuccess('Task created successfully');
      // Refresh data to show the new task
      await fetchInboxData();
    } catch (error) {
      console.error('Error creating task:', error);
      showError(`Failed to create task: ${(error as Error).message}`);
      throw error; // Re-throw to let modal handle it
    }
  };

  const handleUpdateTaskStatus = async (itemId: number, status: 'unread' | 'read' | 'in_progress' | 'completed') => {
    try {
      await inboxApi.updateTaskStatus(itemId, status);
      const statusMessages = {
        unread: 'Task reset to pending',
        read: 'Task marked as read',
        in_progress: 'Task started',
        completed: 'Task completed'
      };
      showSuccess(statusMessages[status]);
      // Refresh data to show the updated status
      await fetchInboxData();
    } catch (error) {
      console.error('Error updating task status:', error);
      showError(`Failed to update task status: ${(error as Error).message}`);
    }
  };

  const handleNewMessage = async (subject: string, body: string, recipients: Array<{ user_id: number; recipient_type?: 'to' | 'cc' | 'bcc' }>) => {
    try {
      await inboxApi.createMessage(subject, body, recipients);
      showSuccess('Message sent successfully');
      await fetchInboxData();
    } catch (error) {
      console.error('Error sending message:', error);
      showError(`Failed to send message: ${(error as Error).message}`);
      throw error;
    }
  };

  const fetchInboxData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Build filters based on active filter and search
      const filters: InboxFilter = {
        search: searchQuery || undefined,
        limit: 50,
        offset: 0
      };

      // Apply active filter
      const filterKey = activeFilter as keyof typeof INBOX_QUICK_FILTERS;
      if (filterKey in INBOX_QUICK_FILTERS) {
        const filterObj = { ...INBOX_QUICK_FILTERS[filterKey] };
        
        // Handle special 'current_user' values
        if ((filterObj as any).assignedTo?.includes('current_user')) {
          (filterObj as any).assigned_to_user_id = currentUser?.id;
          delete (filterObj as any).assignedTo;
        }
        
        if ((filterObj as any).createdBy?.includes('current_user')) {
          (filterObj as any).created_by_user_id = currentUser?.id;
          delete (filterObj as any).createdBy;
        }
        
        Object.assign(filters, filterObj);
      } else {
        // Check if activeFilter is a category name
        const categoryNames = Object.keys(inboxStats.by_category || inboxStats.byCategory || {});
        if (categoryNames.map(c => c.toUpperCase()).includes(activeFilter)) {
          // Apply category filter
          filters.category = [activeFilter.toLowerCase()];
        }
      }

      // Include deleted items when DELETED filter is active
      if (activeFilter === 'DELETED') {
        filters.include_deleted = true;
      }

      // Apply additional filters
      if (selectedSender) {
        filters.created_by_user_id = selectedSender;
      }
      if (showOverdueFilter) {
        filters.due_before = new Date().toISOString();
      }
      if (showUrgentFilter) {
        filters.priority = ['urgent'];
      }

      const [response, globalStats] = await Promise.all([
        inboxApi.getInboxItems(filters),
        inboxApi.getInboxStats() // Get global stats separately
      ]);
      
      setInboxItems(response.items);
      setInboxStats(globalStats); // Use global stats, not filtered stats
      
      // Debug logging
      console.log('Active filter:', activeFilter);
      console.log('Filtered items count:', response.items.length);
      console.log('Global stats:', globalStats);
      
      // Auto-select first item if none selected
      if (!selectedItem && response.items.length > 0) {
        setSelectedItem(response.items[0]);
      }
    } catch (error) {
      console.error('Error fetching inbox data:', error);
      setError((error as Error).message || 'Failed to fetch inbox data');
    } finally {
      setLoading(false);
    }
  };

  const handleItemSelect = (item: InboxItem) => {
    setSelectedItem(item);
    // Don't automatically mark as read - let user do it manually
  };

  const handleMarkAsRead = async (itemId: number) => {
    try {
      await inboxApi.markAsRead(itemId);
      
      // Update local state
      setInboxItems(items => 
        items.map(i => 
          i.id === itemId 
            ? { ...i, status: 'read' as const, updated_at: new Date() }
            : i
        )
      );
      
      // Update selected item if it's the one being marked as read
      if (selectedItem?.id === itemId) {
        setSelectedItem(prev => prev ? { ...prev, status: 'read' as const, updated_at: new Date() } : null);
      }
      
      // Update stats
      setInboxStats(stats => ({
        ...stats,
        unread: Math.max(0, stats.unread - 1)
      }));
      
      showSuccess('Item marked as read');
    } catch (error) {
      console.error('Error marking item as read:', error);
      showError(`Failed to mark item as read: ${(error as Error).message}`);
    }
  };

  const handleBulkSelect = (itemId: number) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const handleBulkAction = async (action: InboxBulkAction) => {
    if (selectedItems.size === 0) return;
    
    // Confirm delete operations
    if (action === 'delete') {
      const itemCount = selectedItems.size;
      const confirmMessage = `Are you sure you want to delete ${itemCount} item${itemCount > 1 ? 's' : ''}? This action cannot be undone.`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }
    
    try {
      const result = await inboxApi.performBulkAction({
        action,
        item_ids: Array.from(selectedItems)
      });
      
      if (result.errors && result.errors.length > 0) {
        showError(`${action} completed on ${result.affected_count} items, but ${result.errors.length} items failed`);
      } else {
        showSuccess(`${action} completed on ${result.affected_count} item${result.affected_count > 1 ? 's' : ''}`);
      }
      
      // Refresh data after bulk action
      await fetchInboxData();
      setSelectedItems(new Set());
    } catch (error) {
      console.error('Error performing bulk action:', error);
      showError(`Failed to ${action} items: ${(error as Error).message}`);
    }
  };

  const handleArchiveItem = async (itemId: number) => {
    try {
      await inboxApi.archiveItem(itemId);
      
      // Update local state
      setInboxItems(items => 
        items.map(i => 
          i.id === itemId 
            ? { ...i, status: 'archived' as const, updated_at: new Date() }
            : i
        )
      );
      
      // Clear selection if archived item was selected
      if (selectedItem?.id === itemId) {
        setSelectedItem(null);
      }
      
      // Refresh data to update counts
      await fetchInboxData();
      showSuccess('Item archived successfully');
    } catch (error) {
      console.error('Error archiving item:', error);
      showError(`Failed to archive item: ${(error as Error).message}`);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!window.confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      return;
    }
    
    try {
      await inboxApi.deleteItem(itemId);
      
      // Remove from local state
      setInboxItems(items => items.filter(i => i.id !== itemId));
      
      // Clear selection if deleted item was selected
      if (selectedItem?.id === itemId) {
        setSelectedItem(null);
      }
      
      // Refresh data to update counts
      await fetchInboxData();
      showSuccess('Item deleted successfully');
    } catch (error) {
      console.error('Error deleting item:', error);
      showError(`Failed to delete item: ${(error as Error).message}`);
    }
  };

  const toggleThread = (threadId: string) => {
    const newExpanded = new Set(expandedThreads);
    if (newExpanded.has(threadId)) {
      newExpanded.delete(threadId);
    } else {
      newExpanded.add(threadId);
    }
    setExpandedThreads(newExpanded);
  };

  // Group items by thread
  const groupItemsByThread = (items: InboxItem[]) => {
    if (!groupByThread) return items.map(item => ({ thread: null, items: [item] }));
    
    const threads = new Map<string, InboxItem[]>();
    const standaloneItems: InboxItem[] = [];
    
    items.forEach(item => {
      const threadId = item.thread_id || item.threadId;
      if (threadId) {
        if (!threads.has(threadId)) {
          threads.set(threadId, []);
        }
        threads.get(threadId)!.push(item);
      } else {
        standaloneItems.push(item);
      }
    });
    
    const result = [];
    
    // Add threaded conversations
    for (const [threadId, threadItems] of threads.entries()) {
      threadItems.sort((a, b) => new Date(a.created_at || a.createdAt!).getTime() - new Date(b.created_at || b.createdAt!).getTime());
      result.push({ thread: threadId, items: threadItems });
    }
    
    // Add standalone items
    standaloneItems.forEach(item => {
      result.push({ thread: null, items: [item] });
    });
    
    return result;
  };

  const getItemIcon = (item: InboxItem) => {
    switch (item.type) {
      case 'system_alert':
        return <AlertTriangle className="h-4 w-4" style={{ color: 'var(--color-danger)' }} />;
      case 'user_message':
        return <MessageCircle className="h-4 w-4" style={{ color: 'var(--color-info)' }} />;
      case 'task_assignment':
        return <FileText className="h-4 w-4" style={{ color: 'var(--color-warning)' }} />;
      case 'loan_update':
        return <DollarSign className="h-4 w-4" style={{ color: 'var(--color-success)' }} />;
      case 'system_notification':
        return <TrendingUp className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };


  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'var(--color-danger)';
      case 'high': return 'var(--color-warning)';
      case 'normal': return 'var(--color-info)';
      case 'low': return 'var(--color-text-muted)';
      default: return 'var(--color-text-muted)';
    }
  };

  const getTaskStatusBadge = (item: InboxItem) => {
    if (item.type !== 'task_assignment') return null;
    
    const isTaskCreator = item.created_by?.id === currentUser?.id;
    if (!isTaskCreator) return null; // Only show for sent tasks
    
    const badgeStyle = {
      fontSize: '9px',
      padding: '2px 6px',
      borderRadius: '10px',
      fontWeight: '600',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '2px',
      marginLeft: '6px'
    };
    
    switch (item.status) {
      case 'unread':
        return (
          <span style={{ ...badgeStyle, backgroundColor: '#fbbf24', color: '#92400e' }}>
            📤 Sent
          </span>
        );
      case 'read':
        return (
          <span style={{ ...badgeStyle, backgroundColor: '#60a5fa', color: '#1e40af' }}>
            👁 Viewed
          </span>
        );
      case 'in_progress':
        return (
          <span style={{ ...badgeStyle, backgroundColor: '#a78bfa', color: '#5b21b6' }}>
            ⏳ In Progress
          </span>
        );
      case 'completed':
        return (
          <span style={{ ...badgeStyle, backgroundColor: '#34d399', color: '#065f46' }}>
            ✅ Completed
          </span>
        );
      default:
        return null;
    }
  };

  const filteredItems = inboxItems.filter(item => {
    // Apply search query
    if (searchQuery && !item.subject.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !item.body.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Apply active filter
    const filterKey = activeFilter as keyof typeof INBOX_QUICK_FILTERS;
    if (filterKey in INBOX_QUICK_FILTERS) {
      const filterObj = INBOX_QUICK_FILTERS[filterKey];
      if ('status' in filterObj && Array.isArray(filterObj.status) && !filterObj.status.includes(item.status)) return false;
      if ('type' in filterObj && Array.isArray(filterObj.type) && !filterObj.type.includes(item.type)) return false;
      if ('assignedTo' in filterObj && Array.isArray(filterObj.assignedTo) && filterObj.assignedTo.includes('current_user') && currentUser && (item.assigned_to || item.assignedTo)?.id !== currentUser.id) return false;
      if ('createdBy' in filterObj && Array.isArray(filterObj.createdBy) && filterObj.createdBy.includes('current_user') && currentUser && item.created_by?.id !== currentUser.id) return false;
    } else {
      // Check if activeFilter is a category name
      const categoryNames = Object.keys(inboxStats.by_category || inboxStats.byCategory || {});
      if (categoryNames.map(c => c.toUpperCase()).includes(activeFilter)) {
        // Filter by category
        const categoryLower = activeFilter.toLowerCase();
        if (!item.category || item.category.toLowerCase() !== categoryLower) return false;
      }
    }
    
    return true;
  });

  // Sort items by priority if priority sort is enabled
  const sortedItems = prioritySort ? [...filteredItems].sort((a, b) => {
    const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
    const aPriority = priorityOrder[a.priority] || 0;
    const bPriority = priorityOrder[b.priority] || 0;
    return prioritySort === 'desc' ? bPriority - aPriority : aPriority - bPriority;
  }) : filteredItems;

  const groupedItems = groupItemsByThread(sortedItems);

  if (loading) {
    return (
      <div className="premium-page-container" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh'
      }}>
        <div className="premium-loading">
          <div className="premium-loading-spinner"></div>
          <p className="premium-loading-text">Loading inbox...</p>
        </div>
      </div>
    );
  }

  if (error && !inboxItems.length) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-danger)',
        fontSize: '12px',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div className="premium-error-container">
          <div className="premium-error-icon">⚠️</div>
          <p className="premium-error-text">Error loading inbox: {error}</p>
          <button 
            onClick={fetchInboxData}
            className="premium-button primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="premium-page-container">
      {/* Premium Page Header */}
      <div className="premium-page-header">
        <div className="premium-page-title-section">
          <h1 className="premium-page-title">Inbox</h1>
          <p className="premium-page-subtitle">Manage tasks, messages, and notifications</p>
        </div>
        
        {/* Premium Stats Bar */}
        <div className="premium-stats-bar">
          <div className="premium-stat-item">
            <div className="premium-stat-icon">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div className="premium-stat-content">
              <div className="premium-stat-label">Total Items</div>
              <div className="premium-stat-value">{inboxStats.total}</div>
            </div>
          </div>
          <div className="premium-stat-item">
            <div className="premium-stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
              <Eye className="w-4 h-4" />
            </div>
            <div className="premium-stat-content">
              <div className="premium-stat-label">Unread</div>
              <div className="premium-stat-value">{inboxStats.unread}</div>
            </div>
          </div>
          <div className="premium-stat-item">
            <div className="premium-stat-icon" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="premium-stat-content">
              <div className="premium-stat-label">Urgent</div>
              <div className="premium-stat-value">{inboxStats.urgent}</div>
            </div>
          </div>
          <div className="premium-stat-item">
            <div className="premium-stat-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              <FileText className="w-4 h-4" />
            </div>
            <div className="premium-stat-content">
              <div className="premium-stat-label">My Tasks</div>
              <div className="premium-stat-value">{inboxStats.my_tasks}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {(successMessage || error) && (
        <div className={`premium-notification ${successMessage ? 'success' : 'error'}`}>
          <span>{successMessage || error}</span>
          <button 
            onClick={() => {
              setSuccessMessage(null);
              setError(null);
            }}
            className="premium-notification-close"
          >
            ×
          </button>
        </div>
      )}
      
      {/* Main Content */}
      <div className="px-8 py-6">
        <div className="grid grid-cols-[320px_420px_1fr] gap-6 h-[calc(100vh-200px)]">
          {/* Left Sidebar - Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-y-auto">
            {/* Action Buttons */}
            <div className="space-y-3 mb-6">
              <button 
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                onClick={() => setShowCreateTaskModal(true)}
              >
                <Plus className="w-4 h-4" />
                New Task
              </button>
              <button 
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                onClick={() => setShowNewMessageModal(true)}
              >
                <MessageCircle className="w-4 h-4" />
                New Message
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <input
                type="text"
                placeholder="Search inbox..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2 mb-6">
              <button
                className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                  showOverdueFilter 
                    ? 'bg-red-100 text-red-700 border border-red-200' 
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}
                onClick={() => setShowOverdueFilter(!showOverdueFilter)}
              >
                OVERDUE
              </button>
              <button
                className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                  showUrgentFilter 
                    ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}
                onClick={() => setShowUrgentFilter(!showUrgentFilter)}
              >
                URGENT
              </button>
            </div>

            {/* Messages Section */}
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Messages
            </div>
        
            <div className="space-y-1 mb-6">
              {[
                { key: 'UNREAD_MESSAGES', label: 'Unread Messages', count: inboxStats.unread_messages },
                { key: 'SENT_MESSAGES', label: 'Sent Messages', count: inboxStats.sent_messages },
                { key: 'ALL_MESSAGES', label: 'All Messages', count: inboxStats.messages }
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                    activeFilter === key 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>{label}</span>
                  {count > 0 && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      activeFilter === key 
                        ? 'bg-white/20 text-white' 
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tasks Section */}
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Tasks
            </div>
            
            <div className="space-y-1 mb-6">
              {[
                { key: 'MY_TASKS', label: 'My Tasks', count: inboxStats.my_tasks },
                { key: 'SENT_TASKS', label: 'Sent Tasks', count: inboxStats.sent_tasks },
                { key: 'ALL_TASKS', label: 'All Tasks', count: inboxStats.all_tasks }
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                    activeFilter === key 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>{label}</span>
                  {count > 0 && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      activeFilter === key 
                        ? 'bg-white/20 text-white' 
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Deleted Section */}
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Deleted Items
            </div>
            
            <button
              onClick={() => setActiveFilter('DELETED')}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                activeFilter === 'DELETED' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span>Deleted Items</span>
              {inboxStats.deleted > 0 && (
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  activeFilter === 'DELETED' 
                    ? 'bg-white/20 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {inboxStats.deleted}
                </span>
              )}
            </button>
          </div>

          {/* Middle Panel - Message List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
        {/* List Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Messages
            </h2>
            <div className="text-sm text-gray-500">
              {filteredItems.length} items • {inboxStats.unread} unread
              {groupByThread && ` • ${groupedItems.length} threads`}
            </div>
          </div>
          
          <div className="flex gap-2 items-center">
            <button 
              className={`p-2 rounded-md text-sm font-medium transition-colors relative ${
                showSenderFilter 
                  ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => setShowSenderFilter(!showSenderFilter)}
              title="Filter by sender"
            >
              <Users className="w-4 h-4" />
              {showSenderFilter && (
                <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-white border border-gray-200 rounded-md text-xs whitespace-nowrap z-10 shadow-sm">
                  Sender filter (coming soon)
                </div>
              )}
            </button>
            
            <button 
              className={`p-2 rounded-md text-sm font-medium transition-colors relative ${
                prioritySort 
                  ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => setPrioritySort(prioritySort === 'desc' ? 'asc' : prioritySort === 'asc' ? null : 'desc')}
              title={`Sort by priority: ${prioritySort === 'desc' ? 'High to Low' : prioritySort === 'asc' ? 'Low to High' : 'No sort'}`}
            >
              <ArrowUpDown className="w-4 h-4" />
              {prioritySort && (
                <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-white border border-gray-200 rounded-md text-xs whitespace-nowrap z-10 shadow-sm">
                  {prioritySort === 'desc' ? 'High to Low' : 'Low to High'}
                </div>
              )}
            </button>

            {selectedItems.size > 0 && (
              <>
                <button 
                  className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                  onClick={() => handleBulkAction('mark_read')}
                >
                  Mark Read
                </button>
                <button 
                  className="p-2 text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  onClick={() => handleBulkAction('archive')}
                >
                  <Archive className="w-4 h-4" />
                </button>
                <button 
                  className="p-2 text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50 transition-colors"
                  onClick={() => handleBulkAction('delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-auto bg-gray-50">
          {groupedItems.map((group) => {
            if (group.thread) {
              // Threaded conversation
              const isExpanded = expandedThreads.has(group.thread);
              const threadMain = group.items[group.items.length - 1]; // Latest message as main
              const hasUnread = group.items.some(item => item.status === 'unread');
              
              return (
                <div key={group.thread}>
                  {/* Thread Header */}
                  <div
                    onClick={() => {
                      if (isExpanded && group.items.length > 1) {
                        toggleThread(group.thread!);
                      } else {
                        handleItemSelect(threadMain);
                        if (group.items.length > 1) {
                          toggleThread(group.thread!);
                        }
                      }
                    }}
                    className={`inbox-message-item p-4 m-3 rounded-lg cursor-pointer transition-colors border ${
                      selectedItem?.threadId === group.thread 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    } ${hasUnread ? 'font-semibold' : 'font-medium'}`}
                  >
                    <div className="flex items-start gap-3">
                      <input 
                        type="checkbox"
                        checked={group.items.every(item => selectedItems.has(item.id))}
                        onChange={() => {
                          group.items.forEach(item => handleBulkSelect(item.id));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5"
                      />
                      
                      {group.items.length > 1 && (
                        <div className="mt-0.5">
                          {isExpanded ? 
                            <ChevronDown className="w-4 h-4 text-gray-400" /> :
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          }
                        </div>
                      )}
                      
                      {getItemIcon(threadMain)}
                      
                      <div className="flex-1 min-w-0">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <div 
                            style={{ 
                              width: '6px', 
                              height: '6px', 
                              borderRadius: '50%', 
                              backgroundColor: getPriorityColor(threadMain.priority),
                              flexShrink: 0
                            }}
                          />
                          <span style={{ 
                            fontSize: '11px', 
                            color: 'var(--color-text)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1
                          }}>
                            {threadMain.subject}
                          </span>
                          {group.items.length > 1 && (
                            <span style={{ 
                              fontSize: '9px', 
                              color: 'var(--color-text-muted)',
                              backgroundColor: 'var(--color-surface-light)',
                              padding: '2px 4px',
                              borderRadius: '8px',
                              flexShrink: 0
                            }}>
                              {group.items.length}
                            </span>
                          )}
                          <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                            {format(threadMain.created_at || threadMain.createdAt, 'HH:mm')}
                          </span>
                        </div>
                        
                        <div style={{ 
                          fontSize: '10px', 
                          color: 'var(--color-text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginBottom: '4px'
                        }}>
                          {threadMain.body}
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {threadMain.from && (
                            <span style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
                              From: {threadMain.from.name || `${threadMain.from.first_name || ''} ${threadMain.from.last_name || ''}`.trim() || threadMain.from.email}
                            </span>
                          )}
                          {((threadMain.loan_ids || threadMain.loanIds) && (threadMain.loan_ids || threadMain.loanIds)!.length > 0) && (
                            <span style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
                              {(threadMain.loan_ids || threadMain.loanIds)!.length} loan{(threadMain.loan_ids || threadMain.loanIds)!.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Thread Messages (when expanded) */}
                  {isExpanded && group.items.slice(0, -1).map((item, itemIndex) => (
                    <div
                      key={item.id}
                      onClick={() => handleItemSelect(item)}
                      style={{
                        padding: '8px 12px 8px 32px',
                        borderBottom: itemIndex === group.items.length - 2 ? '1px solid var(--color-border)' : 'none',
                        borderLeft: '2px solid var(--color-border)',
                        marginLeft: '16px',
                        cursor: 'pointer',
                        backgroundColor: selectedItem?.id === item.id ? 'var(--color-surface-light)' : 'transparent',
                        fontWeight: item.status === 'unread' ? '600' : 'normal'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ 
                          fontSize: '9px', 
                          color: 'var(--color-text-muted)',
                          minWidth: '40px'
                        }}>
                          {format(item.created_at || item.createdAt!, 'HH:mm')}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontSize: '10px', 
                            color: 'var(--color-text)',
                            marginBottom: '2px'
                          }}>
                            {item.from?.name || 'System'}
                          </div>
                          <div style={{ 
                            fontSize: '10px', 
                            color: 'var(--color-text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {item.body}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            } else {
              // Standalone item
              const item = group.items[0];
              return (
                <div
                  key={item.id}
                  className="inbox-message-item"
                  onClick={() => handleItemSelect(item)}
                  style={{
                    padding: '24px',
                    margin: '12px 18px 18px 18px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: selectedItem?.id === item.id ? 'var(--inbox-selected-bg)' : 'var(--inbox-bg-tertiary)',
                    fontWeight: item.status === 'unread' ? '600' : '500',
                    border: selectedItem?.id === item.id ? '1px solid var(--inbox-selected-border)' : '1px solid var(--inbox-border)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <input 
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => handleBulkSelect(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ marginTop: '2px' }}
                    />
                    
                    {getItemIcon(item)}
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <div 
                          style={{ 
                            width: '6px', 
                            height: '6px', 
                            borderRadius: '50%', 
                            backgroundColor: getPriorityColor(item.priority),
                            flexShrink: 0
                          }}
                        />
                        <span style={{ 
                          fontSize: '11px', 
                          color: 'var(--color-text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          {item.subject}
                          {getTaskStatusBadge(item)}
                        </span>
                        <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                          {format(item.created_at || item.createdAt!, 'HH:mm')}
                        </span>
                      </div>
                      
                      <div style={{ 
                        fontSize: '10px', 
                        color: 'var(--color-text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginBottom: '4px'
                      }}>
                        {item.body}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {item.from && (
                          <span style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
                            From: {item.from.name}
                          </span>
                        )}
                        {((item.loan_ids || item.loanIds) && (item.loan_ids || item.loanIds)!.length > 0) && (
                          <span style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
                            {(item.loan_ids || item.loanIds)!.length} loan{(item.loan_ids || item.loanIds)!.length > 1 ? 's' : ''}
                          </span>
                        )}
                        {(item.due_date) && (
                          <span style={{ 
                            fontSize: '9px', 
                            color: item.due_date < new Date() ? 'var(--color-danger)' : 'var(--color-text-muted)'
                          }}>
                            Due: {format(item.due_date, 'MM/dd')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
          })}
          
          {groupedItems.length === 0 && (
            <div style={{ 
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              fontSize: '11px'
            }}>
              No items match your current filter
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Detail View */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
        {selectedItem ? (
          <>
            {/* Detail Header */}
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {selectedItem.subject}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-gray-600 justify-between">
                    {selectedItem.from && (
                      <span>From: {selectedItem.from.name}</span>
                    )}
                    <span className="ml-auto">{format(selectedItem.created_at || selectedItem.createdAt!, 'MMM d, yyyy HH:mm')}</span>
                    <span className={`status-indicator ${selectedItem.priority}`}>
                      {selectedItem.priority.toUpperCase()}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {selectedItem.status === 'unread' && (
                    <button 
                      className="p-2 text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                      onClick={() => handleMarkAsRead(selectedItem.id)}
                      title="Mark as Read"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    className="p-2 text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    onClick={() => setShowReplyModal(true)}
                  >
                    <Reply className="w-4 h-4" />
                  </button>
                  <button 
                    className="p-2 text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    onClick={() => setShowForwardModal(true)}
                  >
                    <Forward className="w-4 h-4" />
                  </button>
                  <button 
                    className="p-2 text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    onClick={() => handleArchiveItem(selectedItem.id)}
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                  <button 
                    className="p-2 text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50 transition-colors"
                    onClick={() => handleDeleteItem(selectedItem.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Context Info */}
              {((selectedItem.loan_ids || selectedItem.loanIds) || (selectedItem.assigned_to || selectedItem.assignedTo) || selectedItem.due_date) && (
                <div className="p-3 bg-gray-100 rounded-lg text-sm border border-gray-200 shadow-sm">
                  {(selectedItem.loan_ids || selectedItem.loanIds) && (
                    <div className="mb-2">
                      <strong>Related Loans:</strong> {(selectedItem.loan_ids || selectedItem.loanIds)!.join(', ')}
                    </div>
                  )}
                  {(selectedItem.assigned_to || selectedItem.assignedTo) && (
                    <div className="mb-2">
                      <strong>Assigned to:</strong> {((selectedItem.assigned_to || selectedItem.assignedTo)!.name || `${(selectedItem.assigned_to || selectedItem.assignedTo)!.first_name || ''} ${(selectedItem.assigned_to || selectedItem.assignedTo)!.last_name || ''}`.trim() || (selectedItem.assigned_to || selectedItem.assignedTo)!.email)}
                    </div>
                  )}
                  {selectedItem.due_date && (
                    <div>
                      <strong>Due Date:</strong> {format(selectedItem.due_date, 'MMM d, yyyy')}
                      {selectedItem.estimated_duration && (
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {' '}(Est. {Math.floor(selectedItem.estimated_duration / 60)}h {selectedItem.estimated_duration % 60}m)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Detail Body */}
            <div className="flex-1 p-6 overflow-auto">
              <TaskBodyRenderer body={selectedItem.body} />
              
              {/* Debug info */}
              <div className="mt-4 p-2 bg-gray-100 rounded text-xs text-gray-500">
                Type: {selectedItem.type} | Status: {selectedItem.status} | Priority: {selectedItem.priority}
              </div>
              
              {/* Quick Actions - Always show for any selected item */}
              <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
                <div className="mb-4 text-lg font-semibold text-gray-900">
                  Quick Actions
                </div>
                <div className="flex gap-3 flex-wrap">
                  <button 
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                    onClick={() => setShowCreateTaskModal(true)}
                  >
                    Create Task
                  </button>
                  {selectedItem.type === 'system_alert' && (
                    <>
                      <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                        View Loans
                      </button>
                      <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                        Acknowledge
                      </button>
                      <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                        Escalate
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Task Status Actions */}
              {selectedItem.type === 'task_assignment' && (
                <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
                  <div className="mb-4 text-lg font-semibold text-gray-900">
                    Task Status
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {selectedItem.status === 'unread' && (
                      <button 
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                        onClick={() => handleUpdateTaskStatus(selectedItem.id, 'in_progress')}
                      >
                        Start Task
                      </button>
                    )}
                    {selectedItem.status === 'in_progress' && (
                      <button 
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
                        onClick={() => handleUpdateTaskStatus(selectedItem.id, 'completed')}
                      >
                        Mark Complete
                      </button>
                    )}
                    {selectedItem.status === 'completed' && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md text-sm">
                        ✓ Task Completed
                      </div>
                    )}
                    {selectedItem.status === 'in_progress' && (
                      <button 
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                        onClick={() => handleUpdateTaskStatus(selectedItem.id, 'unread')}
                      >
                        Reset to Pending
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {selectedItem.type === 'user_message' && (
                <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
                  <div className="mb-4 text-lg font-semibold text-gray-900">
                    Reply
                  </div>
                  <textarea
                    placeholder="Type your reply..."
                    className="w-full h-20 p-3 text-sm border border-gray-300 rounded-md bg-white text-gray-900 resize-vertical focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  <div className="flex gap-3 mt-4">
                    <button 
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                      onClick={() => setShowReplyModal(true)}
                    >
                      Send Reply
                    </button>
                    <button 
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                      onClick={() => setShowForwardModal(true)}
                    >
                      Forward
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Select an item to view details
          </div>
        )}
      </div>
    </div>
    </div>
      
      {/* Reply Modal */}
      {selectedItem && (
        <ReplyModal
          isOpen={showReplyModal}
          onClose={() => setShowReplyModal(false)}
          originalItem={selectedItem}
          onSend={handleReply}
        />
      )}
      
      {/* Forward Modal */}
      {selectedItem && (
        <ForwardModal
          isOpen={showForwardModal}
          onClose={() => setShowForwardModal(false)}
          originalItem={selectedItem}
          onSend={handleForward}
        />
      )}
      
      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={showCreateTaskModal}
        onClose={() => setShowCreateTaskModal(false)}
        originalItem={selectedItem || undefined}
        onSend={handleCreateTask}
        prefilledAssignee={location.state?.prefilledAssignee}
      />
      
      {/* New Message Modal */}
      <NewMessageModal
        isOpen={showNewMessageModal}
        onClose={() => setShowNewMessageModal(false)}
        onSend={handleNewMessage}
        prefilledRecipient={location.state?.prefilledRecipient}
      />
    </div>
  );
}

export default InboxPage;