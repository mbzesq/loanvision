import React from 'react';
import { LoanPreview } from './LoanPreview';

interface TaskBodyRendererProps {
  body: string;
  compact?: boolean;
}

export function TaskBodyRenderer({ body, compact = false }: TaskBodyRendererProps) {
  const renderBodyWithLoanPreviews = (text: string) => {
    // Pattern to match loan links in the format "View Loan: /loans/LOAN_ID"
    const loanLinkPattern = /View Loan: \/loans\/([A-Za-z0-9]+)/g;
    
    let lastIndex = 0;
    const elements: React.ReactNode[] = [];
    let match;
    
    while ((match = loanLinkPattern.exec(text)) !== null) {
      const loanId = match[1];
      const matchStart = match.index;
      const matchEnd = loanLinkPattern.lastIndex;
      
      // Add text before the match
      if (matchStart > lastIndex) {
        const beforeText = text.substring(lastIndex, matchStart);
        if (beforeText.trim()) {
          elements.push(
            <span key={`text-${lastIndex}`} style={{ whiteSpace: 'pre-wrap' }}>
              {beforeText}
            </span>
          );
        }
      }
      
      // Add loan preview component
      elements.push(
        <LoanPreview key={`loan-${loanId}`} loanId={loanId} compact={compact} />
      );
      
      lastIndex = matchEnd;
    }
    
    // Add remaining text after the last match
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      if (remainingText.trim()) {
        elements.push(
          <span key={`text-${lastIndex}`} style={{ whiteSpace: 'pre-wrap' }}>
            {remainingText}
          </span>
        );
      }
    }
    
    // If no matches found, return the original text
    if (elements.length === 0) {
      return (
        <span style={{ whiteSpace: 'pre-wrap' }}>
          {text}
        </span>
      );
    }
    
    return elements;
  };

  return (
    <div style={{ 
      fontSize: '12px',
      lineHeight: '1.5',
      color: 'var(--color-text)'
    }}>
      {renderBodyWithLoanPreviews(body)}
    </div>
  );
}