import React, { useState, useRef, useCallback } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { Button } from '../ui/button';
import { useInternalChat } from '../../contexts/InternalChatContext';

interface ChatMessageInputProps {
  roomId: number;
  placeholder?: string;
}

export function ChatMessageInput({ roomId, placeholder = 'Type a message...' }: ChatMessageInputProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const { sendMessage, wsActions } = useInternalChat();

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, []);

  // Handle typing indicators
  const handleTypingStart = useCallback(() => {
    wsActions.startTyping(roomId);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = window.setTimeout(() => {
      wsActions.stopTyping(roomId);
    }, 3000);
  }, [roomId, wsActions]);

  const handleTypingStop = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    wsActions.stopTyping(roomId);
  }, [roomId, wsActions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    adjustTextareaHeight();
    
    // Handle typing indicators
    if (value.trim()) {
      handleTypingStart();
    } else {
      handleTypingStop();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSending) return;

    try {
      setIsSending(true);
      handleTypingStop();
      
      await sendMessage(trimmedMessage, roomId);
      setMessage('');
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const canSend = message.trim().length > 0 && !isSending;

  return (
    <div className="p-3">
      <form onSubmit={handleSubmit} className="flex items-end space-x-2">
        {/* File attachment button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="flex-shrink-0 text-gray-500 hover:text-gray-700 p-2"
          disabled={isSending}
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        {/* Message input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isSending}
            className="
              w-full resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              min-h-[40px] max-h-[120px]
            "
            rows={1}
          />
          
          {/* Send button */}
          <Button
            type="submit"
            size="sm"
            disabled={!canSend}
            className="
              absolute right-2 bottom-2 p-1.5 h-7 w-7
              bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300
              text-white rounded-md transition-colors
            "
          >
            {isSending ? (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
            ) : (
              <Send className="h-3 w-3" />
            )}
          </Button>
        </div>
      </form>
      
      {/* Helper text */}
      <div className="mt-1 text-xs text-gray-500">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
}