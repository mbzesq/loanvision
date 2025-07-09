import React, { useState } from 'react';
import { X, Send, UserPlus } from 'lucide-react';
import { InboxItem, User } from '../types/inbox';

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalItem: InboxItem;
  onSend: (body: string, recipients: Array<{ user_id: number; recipient_type?: 'to' | 'cc' | 'bcc' }>) => Promise<void>;
}

export function ForwardModal({ isOpen, onClose, originalItem, onSend }: ForwardModalProps) {
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<Array<{ user_id: number; recipient_type: 'to' | 'cc' | 'bcc' }>>([]);
  const [emailInput, setEmailInput] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recipients.length === 0 || sending) return;

    try {
      setSending(true);
      await onSend(body.trim(), recipients);
      setBody('');
      setRecipients([]);
      setEmailInput('');
      onClose();
    } catch (error) {
      console.error('Error forwarding message:', error);
    } finally {
      setSending(false);
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

  const addRecipient = () => {
    if (!emailInput.trim()) return;
    
    // For now, we'll create a mock user ID based on email
    // In a real implementation, this would lookup actual user IDs
    const mockUserId = Math.floor(Math.random() * 1000) + 1;
    
    const newRecipient = {
      user_id: mockUserId,
      recipient_type: 'to' as const,
      email: emailInput.trim()
    };
    
    setRecipients([...recipients, newRecipient]);
    setEmailInput('');
  };

  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
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
            margin: 0 
          }}>
            Forward: {originalItem.subject}
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

        {/* Recipients Section */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid var(--color-border)'
        }}>
          <label style={{ 
            fontSize: '12px', 
            fontWeight: '600', 
            color: 'var(--color-text-primary)', 
            marginBottom: '8px',
            display: 'block'
          }}>
            Forward to:
          </label>
          
          {/* Recipient List */}
          {recipients.length > 0 && (
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '4px', 
              marginBottom: '8px' 
            }}>
              {recipients.map((recipient, index) => (
                <div 
                  key={index} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: 'var(--color-primary)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px'
                  }}
                >
                  <span>{(recipient as any).email || `User ${recipient.user_id}`}</span>
                  <button
                    onClick={() => removeRecipient(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      padding: '0',
                      fontSize: '14px'
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Recipient Input */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Enter email address..."
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '12px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text-primary)'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addRecipient();
                }
              }}
            />
            <button
              type="button"
              onClick={addRecipient}
              style={{
                padding: '8px 12px',
                fontSize: '12px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <UserPlus style={{ width: '12px', height: '12px' }} />
              Add
            </button>
          </div>
        </div>

        {/* Original Message Context */}
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
            Original message from {originalItem.created_by?.name || 'Unknown'} on {originalItem.created_at.toLocaleString()}:
          </div>
          <div style={{ 
            color: 'var(--color-text)', 
            fontStyle: 'italic',
            borderLeft: '2px solid var(--color-border)',
            paddingLeft: '8px',
            maxHeight: '100px',
            overflow: 'auto'
          }}>
            {originalItem.body}
          </div>
        </div>

        {/* Forward Form */}
        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ 
            padding: '16px', 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column' 
          }}>
            <label style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              color: 'var(--color-text-primary)', 
              marginBottom: '8px' 
            }}>
              Add Message (Optional)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add your message here..."
              style={{
                flex: 1,
                minHeight: '80px',
                padding: '12px',
                fontSize: '12px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text-primary)',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
            <div style={{ 
              fontSize: '10px', 
              color: 'var(--color-text-muted)', 
              marginTop: '4px' 
            }}>
              Press Ctrl+Enter to send
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
              disabled={recipients.length === 0 || sending}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: sending || recipients.length === 0 ? 'var(--color-surface)' : 'var(--color-primary)',
                color: 'white',
                cursor: sending || recipients.length === 0 ? 'not-allowed' : 'pointer',
                opacity: sending || recipients.length === 0 ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Send style={{ width: '12px', height: '12px' }} />
              {sending ? 'Forwarding...' : 'Forward Message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}