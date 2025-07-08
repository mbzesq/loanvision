import { useState, useEffect } from 'react';
import { 
  Search, Archive, MessageCircle, 
  AlertTriangle, FileText, DollarSign, Scale, TrendingUp,
  Reply, Forward, MoreVertical
} from 'lucide-react';
import { format } from 'date-fns';
import { InboxItem, InboxStats, INBOX_QUICK_FILTERS, InboxBulkAction, User as UserType } from '../types/inbox';
import '../styles/design-system.css';

function InboxPage() {
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('UNREAD');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [inboxStats, setInboxStats] = useState<InboxStats>({
    total: 0,
    unread: 0,
    urgent: 0,
    overdue: 0,
    myTasks: 0,
    byCategory: {},
    byPriority: {}
  });

  // Mock current user (in production, get from auth context)
  const currentUser: UserType = {
    id: 'current_user',
    name: 'John Analyst',
    email: 'john@nplvision.com',
    role: 'analyst'
  };

  useEffect(() => {
    fetchInboxData();
  }, [activeFilter, searchQuery]);

  const fetchInboxData = async () => {
    setLoading(true);
    try {
      // Mock data generation - replace with actual API calls
      const mockItems: InboxItem[] = [
        {
          id: '1',
          type: 'system_alert',
          subject: 'SOL Expiring Within 30 Days',
          body: '12 loans approaching statute of limitations deadline. Immediate action required to prevent loss of collection rights.',
          priority: 'urgent',
          status: 'unread',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          loanIds: ['L001', 'L002', 'L003', 'L004', 'L005', 'L006', 'L007', 'L008', 'L009', 'L010', 'L011', 'L012'],
          category: 'sol',
          source: 'system',
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
        },
        {
          id: '2',
          type: 'user_message',
          subject: 'Review needed: Foreclosure timeline for Loan #L001',
          body: '@john can you review the foreclosure timeline for loan L001? The title seems to have some issues that might delay the process.',
          priority: 'high',
          status: 'unread',
          createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          updatedAt: new Date(Date.now() - 30 * 60 * 1000),
          from: { id: '2', name: 'Sarah Manager', email: 'sarah@nplvision.com', role: 'manager' },
          to: [currentUser],
          loanIds: ['L001'],
          category: 'legal',
          source: 'user',
          threadId: 'thread_1'
        },
        {
          id: '3',
          type: 'task_assignment',
          subject: 'Upload missing mortgage documentation',
          body: 'Please obtain and upload missing mortgage documentation for 5 loans. Required for SOL compliance review.',
          priority: 'high',
          status: 'in_progress',
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
          updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // Updated 1 hour ago
          assignedTo: currentUser,
          loanIds: ['L013', 'L014', 'L015', 'L016', 'L017'],
          category: 'document',
          source: 'user',
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
          estimatedDuration: 120 // 2 hours
        },
        {
          id: '4',
          type: 'loan_update',
          subject: 'Payment received: Loan #L008',
          body: 'Unexpected payment of $2,450.00 received for loan L008. Please review payment allocation and update loan status.',
          priority: 'normal',
          status: 'read',
          createdAt: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
          updatedAt: new Date(Date.now() - 20 * 60 * 1000), // Read 20 minutes ago
          loanIds: ['L008'],
          category: 'payment',
          source: 'api'
        },
        {
          id: '5',
          type: 'system_notification',
          subject: 'Daily Portfolio Summary Available',
          body: 'Your daily portfolio summary for June 8, 2025 is now available. Review performance metrics and new alerts.',
          priority: 'low',
          status: 'read',
          createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
          updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
          source: 'system'
        }
      ];

      // Calculate stats
      const stats: InboxStats = {
        total: mockItems.length,
        unread: mockItems.filter(item => item.status === 'unread').length,
        urgent: mockItems.filter(item => item.priority === 'urgent').length,
        overdue: mockItems.filter(item => 
          item.dueDate && item.dueDate < new Date() && item.status !== 'completed'
        ).length,
        myTasks: mockItems.filter(item => 
          item.type === 'task_assignment' && item.assignedTo?.id === currentUser.id
        ).length,
        byCategory: mockItems.reduce((acc, item) => {
          if (item.category) {
            acc[item.category] = (acc[item.category] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>),
        byPriority: mockItems.reduce((acc, item) => {
          acc[item.priority] = (acc[item.priority] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };

      setInboxItems(mockItems);
      setInboxStats(stats);
      
      // Auto-select first item if none selected
      if (!selectedItem && mockItems.length > 0) {
        setSelectedItem(mockItems[0]);
      }
    } catch (error) {
      console.error('Error fetching inbox data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleItemSelect = (item: InboxItem) => {
    setSelectedItem(item);
    // Mark as read when selected
    if (item.status === 'unread') {
      updateItemStatus(item.id, 'read');
    }
  };

  const handleBulkSelect = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const updateItemStatus = (itemId: string, newStatus: InboxItem['status']) => {
    setInboxItems(items => 
      items.map(item => 
        item.id === itemId 
          ? { ...item, status: newStatus, updatedAt: new Date() }
          : item
      )
    );
  };

  const handleBulkAction = (action: InboxBulkAction) => {
    console.log(`Performing ${action} on ${selectedItems.size} items`);
    // Implement bulk action logic
    setSelectedItems(new Set());
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
      if ('category' in filterObj && (!item.category || !filterObj.category.includes(item.category))) return false;
      if ('assignedTo' in filterObj && filterObj.assignedTo?.includes('current_user') && item.assignedTo?.id !== currentUser.id) return false;
    }
    
    return true;
  });

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

  return (
    <div style={{ 
      display: 'flex',
      height: '100vh',
      backgroundColor: 'var(--color-background)'
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
                       key === 'MY_TASKS' ? inboxStats.myTasks :
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
        
        {Object.entries(inboxStats.byCategory).map(([category, count]) => (
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
            </div>
          </div>
          
          {selectedItems.size > 0 && (
            <div style={{ display: 'flex', gap: '4px' }}>
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
            </div>
          )}
        </div>

        {/* Message List */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filteredItems.map((item) => (
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
                      {format(item.createdAt, 'HH:mm')}
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
                    {item.loanIds && item.loanIds.length > 0 && (
                      <span style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
                        {item.loanIds.length} loan{item.loanIds.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {item.dueDate && (
                      <span style={{ 
                        fontSize: '9px', 
                        color: item.dueDate < new Date() ? 'var(--color-danger)' : 'var(--color-text-muted)'
                      }}>
                        Due: {format(item.dueDate, 'MM/dd')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {filteredItems.length === 0 && (
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
                    <span>{format(selectedItem.createdAt, 'MMM d, yyyy HH:mm')}</span>
                    <span className={`status-indicator ${selectedItem.priority}`}>
                      {selectedItem.priority.toUpperCase()}
                    </span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn-compact btn-secondary">
                    <Reply style={{ width: '12px', height: '12px' }} />
                  </button>
                  <button className="btn-compact btn-secondary">
                    <Forward style={{ width: '12px', height: '12px' }} />
                  </button>
                  <button className="btn-compact btn-secondary">
                    <Archive style={{ width: '12px', height: '12px' }} />
                  </button>
                  <button className="btn-compact btn-secondary">
                    <MoreVertical style={{ width: '12px', height: '12px' }} />
                  </button>
                </div>
              </div>
              
              {/* Context Info */}
              {(selectedItem.loanIds || selectedItem.assignedTo || selectedItem.dueDate) && (
                <div style={{ 
                  padding: '8px',
                  backgroundColor: 'var(--color-surface-light)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px'
                }}>
                  {selectedItem.loanIds && (
                    <div style={{ marginBottom: '4px' }}>
                      <strong>Related Loans:</strong> {selectedItem.loanIds.join(', ')}
                    </div>
                  )}
                  {selectedItem.assignedTo && (
                    <div style={{ marginBottom: '4px' }}>
                      <strong>Assigned to:</strong> {selectedItem.assignedTo.name}
                    </div>
                  )}
                  {selectedItem.dueDate && (
                    <div>
                      <strong>Due Date:</strong> {format(selectedItem.dueDate, 'MMM d, yyyy')}
                      {selectedItem.estimatedDuration && (
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {' '}(Est. {Math.floor(selectedItem.estimatedDuration / 60)}h {selectedItem.estimatedDuration % 60}m)
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
              
              {/* Quick Actions */}
              {selectedItem.type === 'system_alert' && (
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
                    <button className="btn-compact btn-primary">
                      Create Task
                    </button>
                    <button className="btn-compact btn-secondary">
                      View Loans
                    </button>
                    <button className="btn-compact btn-secondary">
                      Acknowledge
                    </button>
                    <button className="btn-compact btn-secondary">
                      Escalate
                    </button>
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
                    <button className="btn-compact btn-primary">
                      Send Reply
                    </button>
                    <button className="btn-compact btn-secondary">
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
  );
}

export default InboxPage;