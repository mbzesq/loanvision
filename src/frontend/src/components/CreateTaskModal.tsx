import React, { useState, useEffect } from 'react';
import { X, Plus, Calendar, User } from 'lucide-react';
import { InboxItem, User as UserType } from '../types/inbox';
import { inboxApi } from '../services/inboxApi';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalItem?: InboxItem; // Made optional for standalone task creation
  onSend: (title: string, description?: string, assigned_to_user_id?: number, due_date?: Date, priority?: 'urgent' | 'high' | 'normal' | 'low', loanId?: string) => Promise<void>;
  prefilledAssignee?: { id: number; name: string; email: string };
}

export function CreateTaskModal({ isOpen, onClose, originalItem, onSend, prefilledAssignee }: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState<number | undefined>();
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'urgent' | 'high' | 'normal' | 'low'>('normal');
  const [creating, setCreating] = useState(false);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [loanSearchQuery, setLoanSearchQuery] = useState('');
  const [loanSearchResults, setLoanSearchResults] = useState<any[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [showLoanDropdown, setShowLoanDropdown] = useState(false);

  // Load users for assignment
  useEffect(() => {
    const fetchUsers = async () => {
      if (isOpen) {
        setLoadingUsers(true);
        try {
          const userList = await inboxApi.getUsers();
          setUsers(userList);
        } catch (error) {
          console.error('Error loading users:', error);
        } finally {
          setLoadingUsers(false);
        }
      }
    };

    fetchUsers();
  }, [isOpen]);

  // Handle prefilled assignee
  useEffect(() => {
    if (isOpen && prefilledAssignee) {
      setAssignedToUserId(prefilledAssignee.id);
      setTitle(`Task for ${prefilledAssignee.name}`);
    } else if (isOpen) {
      // Reset when opening without prefilled data
      setAssignedToUserId(undefined);
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('normal');
    }
  }, [isOpen, prefilledAssignee]);

  // Handle loan search
  const handleLoanSearch = async (query: string) => {
    console.log('handleLoanSearch called with query:', query);
    setLoanSearchQuery(query);
    
    if (query.length < 2) {
      console.log('Query too short, clearing results');
      setLoanSearchResults([]);
      setShowLoanDropdown(false);
      return;
    }

    console.log('Starting loan search for:', query);
    setLoadingLoans(true);
    try {
      const results = await inboxApi.searchLoans(query);
      console.log('Loan search results:', results);
      setLoanSearchResults(results);
      setShowLoanDropdown(true);
    } catch (error) {
      console.error('Error searching loans:', error);
      setLoanSearchResults([]);
    } finally {
      setLoadingLoans(false);
    }
  };

  const selectLoan = (loan: any) => {
    setSelectedLoan(loan);
    setLoanSearchQuery(loan.display_name);
    setShowLoanDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || creating) return;

    try {
      setCreating(true);
      // Create enhanced description with loan link if loan is selected
      let enhancedDescription = description.trim() || '';
      if (selectedLoan) {
        const loanLink = `View Loan: /loans/${selectedLoan.id}`;
        enhancedDescription = enhancedDescription 
          ? `${enhancedDescription}\n\n${loanLink}` 
          : loanLink;
      }

      await onSend(
        title.trim(),
        enhancedDescription || undefined,
        assignedToUserId,
        dueDate ? new Date(dueDate) : undefined,
        priority,
        selectedLoan?.id // Pass selected loan ID
      );
      
      // Reset form
      setTitle('');
      setDescription('');
      setAssignedToUserId(undefined);
      setDueDate('');
      setPriority('normal');
      setSelectedLoan(null);
      setLoanSearchQuery('');
      onClose();
    } catch (error) {
      console.error('Error creating task:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit(e);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'normal': return '#10b981';
      case 'low': return '#6b7280';
      default: return '#10b981';
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        backgroundColor: 'rgba(0, 0, 0, 0.6)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 50, 
        padding: '16px' 
      }}
      onClick={onClose}
    >
      <div 
        style={{ 
          backgroundColor: 'var(--color-surface)', 
          borderRadius: 'var(--radius-md)', 
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)', 
          maxWidth: '600px', 
          width: '100%', 
          maxHeight: '80vh', 
          display: 'flex', 
          flexDirection: 'column',
          border: '1px solid var(--color-border)' 
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '16px', 
          borderBottom: '1px solid var(--color-border)' 
        }}>
          <h2 style={{ 
            fontSize: '14px', 
            fontWeight: '600', 
            color: 'var(--color-text-primary)', 
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Plus style={{ width: '16px', height: '16px', color: 'var(--color-primary)' }} />
            {originalItem ? `Create Task from: ${originalItem.subject}` : 'Create New Task'}
          </h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              padding: '4px'
            }}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* Original Item Context - Only show if originalItem exists */}
        {originalItem && (
          <div style={{
            padding: '16px',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-background)',
            fontSize: '11px'
          }}>
            <div style={{ 
              color: 'var(--color-text-muted)', 
              marginBottom: '8px' 
            }}>
              Creating task from alert by {originalItem.created_by?.name || 'Unknown'} on {originalItem.created_at.toLocaleString()}:
            </div>
            <div style={{ 
              color: 'var(--color-text)', 
              fontStyle: 'italic',
              borderLeft: '2px solid var(--color-border)',
              paddingLeft: '8px',
              maxHeight: '60px',
              overflow: 'auto'
            }}>
              {originalItem.body}
            </div>
          </div>
        )}

        {/* Task Form */}
        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ 
            padding: '16px', 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column',
            gap: '16px'
          }}>
            {/* Task Title */}
            <div>
              <label style={{ 
                fontSize: '12px', 
                fontWeight: '600', 
                color: 'var(--color-text-primary)', 
                marginBottom: '4px',
                display: 'block'
              }}>
                Task Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter task title..."
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text-primary)'
                }}
                autoFocus
              />
            </div>

            {/* Task Description */}
            <div>
              <label style={{ 
                fontSize: '12px', 
                fontWeight: '600', 
                color: 'var(--color-text-primary)', 
                marginBottom: '4px',
                display: 'block'
              }}>
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add task description..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '8px',
                  fontSize: '12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text-primary)',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Assignment */}
            <div>
              <label style={{ 
                fontSize: '12px', 
                fontWeight: '600', 
                color: 'var(--color-text-primary)', 
                marginBottom: '4px',
                display: 'block'
              }}>
                Assign to
              </label>
              <select
                value={assignedToUserId || ''}
                onChange={(e) => setAssignedToUserId(e.target.value ? parseInt(e.target.value) : undefined)}
                disabled={loadingUsers}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text-primary)',
                  appearance: 'none',
                  opacity: loadingUsers ? 0.5 : 1
                }}
              >
                <option value="">Assign to myself</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Loan Selection */}
            <div>
              <label style={{ 
                fontSize: '12px', 
                fontWeight: '600', 
                color: 'var(--color-text-primary)', 
                marginBottom: '4px',
                display: 'block'
              }}>
                Related Loan (Optional)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={loanSearchQuery}
                  onChange={(e) => handleLoanSearch(e.target.value)}
                  placeholder="Search by loan ID, borrower name, or address..."
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '12px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-background)',
                    color: 'var(--color-text-primary)'
                  }}
                  onFocus={() => {
                    if (loanSearchResults.length > 0) {
                      setShowLoanDropdown(true);
                    }
                  }}
                />
                
                {/* Loan Search Dropdown */}
                {showLoanDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {loadingLoans && (
                      <div style={{ 
                        padding: '12px', 
                        fontSize: '11px', 
                        color: 'var(--color-text-muted)',
                        textAlign: 'center'
                      }}>
                        Searching loans...
                      </div>
                    )}
                    {!loadingLoans && loanSearchResults.length === 0 && loanSearchQuery.length >= 2 && (
                      <div style={{ 
                        padding: '12px', 
                        fontSize: '11px', 
                        color: 'var(--color-text-muted)',
                        textAlign: 'center'
                      }}>
                        No loans found
                      </div>
                    )}
                    {!loadingLoans && loanSearchResults.map((loan, index) => (
                      <div
                        key={loan.id}
                        onClick={() => selectLoan(loan)}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: index < loanSearchResults.length - 1 ? '1px solid var(--color-border)' : 'none',
                          fontSize: '11px',
                          transition: 'background-color 0.1s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-background)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <div style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>
                          {loan.id} - {loan.borrower_name}
                        </div>
                        <div style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          {loan.property_address}, {loan.property_city}, {loan.property_state}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Selected Loan Display */}
                {selectedLoan && (
                  <div style={{
                    marginTop: '6px',
                    padding: '6px 8px',
                    backgroundColor: 'var(--color-primary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '10px',
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>
                      ✓ Selected: {selectedLoan.id} - {selectedLoan.borrower_name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLoan(null);
                        setLoanSearchQuery('');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '12px',
                        padding: '0 4px'
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Priority and Due Date Row */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '12px' 
            }}>
              {/* Priority */}
              <div>
                <label style={{ 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  color: 'var(--color-text-primary)', 
                  marginBottom: '4px',
                  display: 'block'
                }}>
                  Priority
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'urgent' | 'high' | 'normal' | 'low')}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '12px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-background)',
                      color: 'var(--color-text-primary)',
                      appearance: 'none'
                    }}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <div style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: getPriorityColor(priority)
                  }} />
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label style={{ 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  color: 'var(--color-text-primary)', 
                  marginBottom: '4px',
                  display: 'block'
                }}>
                  Due Date (Optional)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '12px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-background)',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                  <Calendar style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '12px',
                    height: '12px',
                    color: 'var(--color-text-muted)',
                    pointerEvents: 'none'
                  }} />
                </div>
              </div>
            </div>

            {/* Assignment Note */}
            <div style={{
              padding: '8px',
              backgroundColor: 'var(--color-background)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              fontSize: '11px',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <User style={{ width: '12px', height: '12px' }} />
              {assignedToUserId ? 
                `Task will be assigned to ${users.find(u => u.id === assignedToUserId)?.name || 'selected user'}` :
                'Task will be assigned to you by default'
              }
            </div>

            <div style={{ 
              fontSize: '10px', 
              color: 'var(--color-text-muted)' 
            }}>
              Press Ctrl+Enter to create task
            </div>
          </div>

          {/* Footer */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            alignItems: 'center', 
            padding: '16px', 
            borderTop: '1px solid var(--color-border)', 
            gap: '8px' 
          }}>
            <button 
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={!title.trim() || creating}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: creating || !title.trim() ? 'var(--color-surface)' : 'var(--color-primary)',
                color: 'white',
                cursor: creating || !title.trim() ? 'not-allowed' : 'pointer',
                opacity: creating || !title.trim() ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Plus style={{ width: '12px', height: '12px' }} />
              {creating ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}