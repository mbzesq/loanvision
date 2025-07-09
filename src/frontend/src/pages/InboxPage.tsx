import { useState, useEffect } from 'react';
import { 
  Search, Archive, MessageCircle, 
  AlertTriangle, FileText, DollarSign, Scale, TrendingUp,
  Reply, Forward, MoreVertical, Filter, ChevronDown, ChevronRight,
  Users, Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { InboxItem, InboxStats, INBOX_QUICK_FILTERS, InboxBulkAction, User as UserType, InboxFilter } from '../types/inbox';
import { inboxApi } from '../services/inboxApi';
import { ReplyModal } from '../components/ReplyModal';
import { ForwardModal } from '../components/ForwardModal';
import { CreateTaskModal } from '../components/CreateTaskModal';
import '../styles/design-system.css';

function InboxPage() {
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('UNREAD');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [groupByThread, setGroupByThread] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [inboxStats, setInboxStats] = useState<InboxStats>({
    total: 0,
    unread: 0,
    urgent: 0,
    overdue: 0,
    my_tasks: 0,
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

  const handleCreateTask = async (title: string, description?: string, assigned_to_user_id?: number, due_date?: Date, priority?: 'urgent' | 'high' | 'normal' | 'low') => {
    if (!selectedItem) return;
    
    try {
      await inboxApi.createTask(selectedItem.id, title, description, assigned_to_user_id, due_date, priority);
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
        const filterObj = INBOX_QUICK_FILTERS[filterKey];
        Object.assign(filters, filterObj);
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

  const handleItemSelect = async (item: InboxItem) => {
    setSelectedItem(item);
    // Mark as read when selected
    if (item.status === 'unread') {
      try {
        await inboxApi.markAsRead(item.id);
        // Update local state
        setInboxItems(items => 
          items.map(i => 
            i.id === item.id 
              ? { ...i, status: 'read' as const, updated_at: new Date() }
              : i
          )
        );
        // Update stats
        setInboxStats(stats => ({
          ...stats,
          unread: Math.max(0, stats.unread - 1)
        }));
      } catch (error) {
        console.error('Error marking item as read:', error);
      }
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

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'sol': return <Scale className="h-3 w-3" />;
      case 'legal': return <FileText className="h-3 w-3" />;
      case 'payment': return <DollarSign className="h-3 w-3" />;
      case 'document': return <FileText className="h-3 w-3" />;
      case 'performance': return <TrendingUp className="h-3 w-3" />;
      default: return null;
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
      if ('status' in filterObj && !filterObj.status.includes(item.status)) return false;
      if ('priority' in filterObj && !filterObj.priority.includes(item.priority)) return false;
      if ('type' in filterObj && !filterObj.type.includes(item.type)) return false;
      if ('category' in filterObj && (!item.category || !(filterObj.category as readonly string[]).includes(item.category))) return false;
      if ('assignedTo' in filterObj && filterObj.assignedTo?.includes('current_user') && currentUser && (item.assigned_to || item.assignedTo)?.id !== currentUser.id) return false;
    }
    
    return true;
  });

  const groupedItems = groupItemsByThread(filteredItems);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-text-muted)',
        fontSize: '12px'
      }}>
        LOADING INBOX...
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
        <div>Error loading inbox: {error}</div>
        <button 
          onClick={fetchInboxData}
          style={{
            padding: '8px 16px',
            fontSize: '11px',
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex',
      height: '100vh',
      backgroundColor: 'var(--color-background)',
      flexDirection: 'column'
    }}>
      {/* Success/Error Messages */}
      {(successMessage || error) && (
        <div style={{
          padding: '8px 16px',
          fontSize: '12px',
          backgroundColor: successMessage ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
          color: successMessage ? 'var(--color-success)' : 'var(--color-danger)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>{successMessage || error}</span>
          <button 
            onClick={() => {
              setSuccessMessage(null);
              setError(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ×
          </button>
        </div>
      )}
      
      {/* Main Content */}
      <div style={{ 
        display: 'flex',
        flex: 1,
        overflow: 'hidden'
      }}>
        {/* Left Sidebar - Filters */}
      <div style={{ 
        width: '250px',
        backgroundColor: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '8px' }}>
          <Search style={{ 
            position: 'absolute', 
            left: '8px', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            width: '12px', 
            height: '12px',
            color: 'var(--color-text-muted)' 
          }} />
          <input
            type="text"
            placeholder="Search inbox..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 6px 6px 24px',
              fontSize: '11px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text)'
            }}
          />
        </div>

        {/* Quick Filters */}
        <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
          QUICK FILTERS
        </div>
        
        {Object.entries(INBOX_QUICK_FILTERS).map(([key]) => {
          const count = key === 'UNREAD' ? inboxStats.unread :
                       key === 'URGENT' ? inboxStats.urgent :
                       key === 'MY_TASKS' ? (inboxStats.my_tasks || inboxStats.myTasks || 0) :
                       filteredItems.length;
          
          return (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                fontSize: '11px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: activeFilter === key ? 'var(--color-primary)' : 'transparent',
                color: activeFilter === key ? 'white' : 'var(--color-text)',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <span>{key.replace('_', ' ')}</span>
              {count > 0 && (
                <span style={{ 
                  fontSize: '10px',
                  backgroundColor: activeFilter === key ? 'rgba(255,255,255,0.2)' : 'var(--color-surface-light)',
                  padding: '2px 6px',
                  borderRadius: '10px'
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}

        {/* Categories */}
        <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--color-text-muted)', marginTop: '16px', marginBottom: '4px' }}>
          CATEGORIES
        </div>
        
        {Object.entries(inboxStats.by_category || inboxStats.byCategory || {}).map(([category, count]) => (
          <button
            key={category}
            onClick={() => setActiveFilter(category.toUpperCase())}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 8px',
              fontSize: '11px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'transparent',
              color: 'var(--color-text)',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {getCategoryIcon(category)}
              <span style={{ textTransform: 'capitalize' }}>{category}</span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Middle Panel - Message List */}
      <div style={{ 
        width: '400px',
        backgroundColor: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* List Header */}
        <div style={{ 
          padding: '12px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 2px 0' }}>
              INBOX
            </h2>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
              {filteredItems.length} items • {inboxStats.unread} unread
              {groupByThread && ` • ${groupedItems.length} threads`}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button 
              className={`btn-compact ${groupByThread ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setGroupByThread(!groupByThread)}
              title="Toggle threading"
            >
              <Users style={{ width: '12px', height: '12px' }} />
            </button>
            
            <button 
              className={`btn-compact ${showAdvancedFilters ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              title="Advanced filters"
            >
              <Filter style={{ width: '12px', height: '12px' }} />
            </button>

            {selectedItems.size > 0 && (
              <>
                <button 
                  className="btn-compact btn-secondary"
                  onClick={() => handleBulkAction('mark_read')}
                >
                  READ
                </button>
                <button 
                  className="btn-compact btn-secondary"
                  onClick={() => handleBulkAction('archive')}
                >
                  <Archive style={{ width: '12px', height: '12px' }} />
                </button>
                <button 
                  className="btn-compact btn-danger"
                  onClick={() => handleBulkAction('delete')}
                >
                  <Trash2 style={{ width: '12px', height: '12px' }} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Message List */}
        <div style={{ flex: 1, overflow: 'auto' }}>
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
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      backgroundColor: selectedItem?.threadId === group.thread ? 'var(--color-surface-light)' : 'transparent',
                      fontWeight: hasUnread ? '600' : 'normal'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <input 
                        type="checkbox"
                        checked={group.items.every(item => selectedItems.has(item.id))}
                        onChange={() => {
                          group.items.forEach(item => handleBulkSelect(item.id));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginTop: '2px' }}
                      />
                      
                      {group.items.length > 1 && (
                        <div style={{ marginTop: '2px' }}>
                          {isExpanded ? 
                            <ChevronDown style={{ width: '12px', height: '12px', color: 'var(--color-text-muted)' }} /> :
                            <ChevronRight style={{ width: '12px', height: '12px', color: 'var(--color-text-muted)' }} />
                          }
                        </div>
                      )}
                      
                      {getItemIcon(threadMain)}
                      
                      <div style={{ flex: 1, minWidth: 0 }}>
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
                  onClick={() => handleItemSelect(item)}
                  style={{
                    padding: '12px',
                    borderBottom: '1px solid var(--color-border)',
                    cursor: 'pointer',
                    backgroundColor: selectedItem?.id === item.id ? 'var(--color-surface-light)' : 'transparent',
                    fontWeight: item.status === 'unread' ? '600' : 'normal'
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
                          flex: 1
                        }}>
                          {item.subject}
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
      <div style={{ 
        flex: 1,
        backgroundColor: 'var(--color-background)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {selectedItem ? (
          <>
            {/* Detail Header */}
            <div style={{ 
              padding: '16px',
              borderBottom: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 4px 0' }}>
                    {selectedItem.subject}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {selectedItem.from && (
                      <span>From: {selectedItem.from.name}</span>
                    )}
                    <span>{format(selectedItem.created_at || selectedItem.createdAt!, 'MMM d, yyyy HH:mm')}</span>
                    <span className={`status-indicator ${selectedItem.priority}`}>
                      {selectedItem.priority.toUpperCase()}
                    </span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button 
                    className="btn-compact btn-secondary"
                    onClick={() => setShowReplyModal(true)}
                  >
                    <Reply style={{ width: '12px', height: '12px' }} />
                  </button>
                  <button 
                    className="btn-compact btn-secondary"
                    onClick={() => setShowForwardModal(true)}
                  >
                    <Forward style={{ width: '12px', height: '12px' }} />
                  </button>
                  <button 
                    className="btn-compact btn-secondary"
                    onClick={() => handleArchiveItem(selectedItem.id)}
                  >
                    <Archive style={{ width: '12px', height: '12px' }} />
                  </button>
                  <button 
                    className="btn-compact btn-danger"
                    onClick={() => handleDeleteItem(selectedItem.id)}
                  >
                    <Trash2 style={{ width: '12px', height: '12px' }} />
                  </button>
                  <button className="btn-compact btn-secondary">
                    <MoreVertical style={{ width: '12px', height: '12px' }} />
                  </button>
                </div>
              </div>
              
              {/* Context Info */}
              {((selectedItem.loan_ids || selectedItem.loanIds) || (selectedItem.assigned_to || selectedItem.assignedTo) || selectedItem.due_date) && (
                <div style={{ 
                  padding: '8px',
                  backgroundColor: 'var(--color-surface-light)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px'
                }}>
                  {(selectedItem.loan_ids || selectedItem.loanIds) && (
                    <div style={{ marginBottom: '4px' }}>
                      <strong>Related Loans:</strong> {(selectedItem.loan_ids || selectedItem.loanIds)!.join(', ')}
                    </div>
                  )}
                  {(selectedItem.assigned_to || selectedItem.assignedTo) && (
                    <div style={{ marginBottom: '4px' }}>
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
            <div style={{ 
              flex: 1,
              padding: '16px',
              overflow: 'auto'
            }}>
              <div style={{ 
                fontSize: '12px',
                lineHeight: '1.5',
                color: 'var(--color-text)',
                whiteSpace: 'pre-wrap'
              }}>
                {selectedItem.body}
              </div>
              
              {/* Debug info */}
              <div style={{ 
                marginTop: '10px',
                padding: '6px',
                backgroundColor: 'var(--color-background)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '10px',
                color: 'var(--color-text-muted)'
              }}>
                Type: {selectedItem.type} | Status: {selectedItem.status} | Priority: {selectedItem.priority}
              </div>
              
              {/* Quick Actions - Always show for any selected item */}
              <div style={{ 
                marginTop: '20px',
                padding: '12px',
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)'
              }}>
                <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '8px' }}>
                  QUICK ACTIONS
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button 
                    className="btn-compact btn-primary"
                    onClick={() => setShowCreateTaskModal(true)}
                  >
                    Create Task
                  </button>
                  {selectedItem.type === 'system_alert' && (
                    <>
                      <button className="btn-compact btn-secondary">
                        View Loans
                      </button>
                      <button className="btn-compact btn-secondary">
                        Acknowledge
                      </button>
                      <button className="btn-compact btn-secondary">
                        Escalate
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Task Status Actions */}
              {selectedItem.type === 'task_assignment' && (
                <div style={{ 
                  marginTop: '20px',
                  padding: '12px',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '8px' }}>
                    TASK STATUS
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedItem.status === 'unread' && (
                      <button 
                        className="btn-compact btn-primary"
                        onClick={() => handleUpdateTaskStatus(selectedItem.id, 'in_progress')}
                      >
                        Start Task
                      </button>
                    )}
                    {selectedItem.status === 'in_progress' && (
                      <button 
                        className="btn-compact btn-success"
                        onClick={() => handleUpdateTaskStatus(selectedItem.id, 'completed')}
                      >
                        Mark Complete
                      </button>
                    )}
                    {selectedItem.status === 'completed' && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        padding: '6px 12px',
                        backgroundColor: 'var(--color-success)',
                        color: 'white',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px'
                      }}>
                        ✓ Task Completed
                      </div>
                    )}
                    {selectedItem.status === 'in_progress' && (
                      <button 
                        className="btn-compact btn-secondary"
                        onClick={() => handleUpdateTaskStatus(selectedItem.id, 'unread')}
                      >
                        Reset to Pending
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {selectedItem.type === 'user_message' && (
                <div style={{ 
                  marginTop: '20px',
                  padding: '12px',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '8px' }}>
                    REPLY
                  </div>
                  <textarea
                    placeholder="Type your reply..."
                    style={{
                      width: '100%',
                      height: '80px',
                      padding: '8px',
                      fontSize: '11px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-background)',
                      color: 'var(--color-text)',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button 
                      className="btn-compact btn-primary"
                      onClick={() => setShowReplyModal(true)}
                    >
                      Send Reply
                    </button>
                    <button 
                      className="btn-compact btn-secondary"
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
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--color-text-muted)',
            fontSize: '12px'
          }}>
            Select an item to view details
          </div>
        )}
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
      {selectedItem && (
        <CreateTaskModal
          isOpen={showCreateTaskModal}
          onClose={() => setShowCreateTaskModal(false)}
          originalItem={selectedItem}
          onSend={handleCreateTask}
        />
      )}
    </div>
  );
}

export default InboxPage;