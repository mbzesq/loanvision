import React, { useState, useEffect } from 'react';
import { X, Send, User } from 'lucide-react';
import { User as UserType } from '../types/inbox';
import { inboxApi } from '../services/inboxApi';

interface NewMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (subject: string, body: string, recipients: Array<{ user_id: number; recipient_type?: 'to' | 'cc' | 'bcc' }>) => Promise<void>;
  prefilledRecipient?: { id: number; name: string; email: string };
}

export function NewMessageModal({ isOpen, onClose, onSend, prefilledRecipient }: NewMessageModalProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<Array<{ user_id: number; name: string }>>([]);
  const [sending, setSending] = useState(false);
  const [users, setUsers] = useState<UserType[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Load users
  useEffect(() => {
    const fetchUsers = async () => {
      if (isOpen) {
        try {
          const userList = await inboxApi.getUsers();
          setUsers(userList);
        } catch (error) {
          console.error('Error loading users:', error);
        }
      }
    };

    fetchUsers();
  }, [isOpen]);

  // Handle prefilled recipient
  useEffect(() => {
    if (isOpen && prefilledRecipient) {
      setRecipients([{ user_id: prefilledRecipient.id, name: prefilledRecipient.name }]);
      setSubject(`Message to ${prefilledRecipient.name}`);
    } else if (isOpen) {
      // Reset when opening without prefilled data
      setRecipients([]);
      setSubject('');
      setBody('');
    }
  }, [isOpen, prefilledRecipient]);

  // Filter users based on search
  const filteredUsers = users.filter(user => 
    !recipients.some(r => r.user_id === user.id) &&
    ((user.first_name || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
     (user.last_name || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
     (user.email || '').toLowerCase().includes(userSearchQuery.toLowerCase()))
  );

  const handleAddRecipient = (user: UserType) => {
    setRecipients([...recipients, { user_id: user.id, name: `${user.first_name || ''} ${user.last_name || ''}`.trim() }]);
    setUserSearchQuery('');
    setShowUserDropdown(false);
  };

  const handleRemoveRecipient = (userId: number) => {
    setRecipients(recipients.filter(r => r.user_id !== userId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !body.trim() || recipients.length === 0) {
      return;
    }

    setSending(true);
    try {
      await onSend(
        subject,
        body,
        recipients.map(r => ({ user_id: r.user_id, recipient_type: 'to' }))
      );
      
      // Reset form
      setSubject('');
      setBody('');
      setRecipients([]);
      onClose();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit(e as any);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        backgroundColor: 'rgba(0, 0, 0, 0.5)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 1000 
      }}
      onClick={onClose}
    >
      <div 
        style={{ 
          backgroundColor: 'var(--color-surface)', 
          borderRadius: 'var(--radius-md)', 
          width: '600px', 
          maxHeight: '80vh', 
          display: 'flex', 
          flexDirection: 'column',
          border: '1px solid var(--color-border)'
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div style={{ 
          padding: '16px', 
          borderBottom: '1px solid var(--color-border)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, textTransform: 'uppercase' }}>
            NEW MESSAGE
          </h3>
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

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Recipients */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
                TO
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px',
                  minHeight: '32px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px',
                  alignItems: 'center'
                }}>
                  {recipients.map(recipient => (
                    <span
                      key={recipient.user_id}
                      style={{
                        backgroundColor: 'var(--color-primary)',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {recipient.name}
                      <button
                        type="button"
                        onClick={() => handleRemoveRecipient(recipient.user_id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'white',
                          padding: 0,
                          fontSize: '12px'
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => {
                      setUserSearchQuery(e.target.value);
                      setShowUserDropdown(true);
                    }}
                    onFocus={() => setShowUserDropdown(true)}
                    placeholder={recipients.length === 0 ? "Type to search users..." : ""}
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      fontSize: '12px',
                      minWidth: '100px',
                      backgroundColor: 'transparent'
                    }}
                  />
                </div>
                
                {/* User dropdown */}
                {showUserDropdown && userSearchQuery && filteredUsers.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    marginTop: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 10
                  }}>
                    {filteredUsers.map(user => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleAddRecipient(user)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-light)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <User style={{ width: '14px', height: '14px', color: 'var(--color-text-muted)' }} />
                        <span>{user.first_name} {user.last_name}</span>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>({user.email})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
                SUBJECT
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text)'
                }}
              />
            </div>

            {/* Body */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
                MESSAGE
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                style={{
                  flex: 1,
                  padding: '8px',
                  fontSize: '12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text)',
                  minHeight: '200px',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>

          {/* Footer */}
          <div style={{ 
            padding: '16px', 
            borderTop: '1px solid var(--color-border)', 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
              Press Ctrl+Enter to send
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn-compact btn-secondary"
                disabled={sending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-compact btn-primary"
                disabled={sending || !subject.trim() || !body.trim() || recipients.length === 0}
              >
                <Send style={{ width: '12px', height: '12px', marginRight: '4px' }} />
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}