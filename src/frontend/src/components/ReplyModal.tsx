import React, { useState } from 'react';
import { X, Send } from 'lucide-react';
import { InboxItem } from '../types/inbox';

interface ReplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalItem: InboxItem;
  onSend: (body: string) => Promise<void>;
}

export function ReplyModal({ isOpen, onClose, originalItem, onSend }: ReplyModalProps) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || sending) return;

    try {
      setSending(true);
      await onSend(body.trim());
      setBody('');
      onClose();
    } catch (error) {
      console.error('Error sending reply:', error);
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
            Reply to: {originalItem.subject}
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

        {/* Reply Form */}
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
              Your Reply
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your reply..."
              style={{
                flex: 1,
                minHeight: '120px',
                padding: '12px',
                fontSize: '12px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text-primary)',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
              autoFocus
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
              disabled={!body.trim() || sending}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: sending ? 'var(--color-surface)' : 'var(--color-primary)',
                color: 'white',
                cursor: sending || !body.trim() ? 'not-allowed' : 'pointer',
                opacity: sending || !body.trim() ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Send style={{ width: '12px', height: '12px' }} />
              {sending ? 'Sending...' : 'Send Reply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}