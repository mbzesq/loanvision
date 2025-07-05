// src/frontend/src/components/LoanDetailModal.tsx
import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { X } from 'lucide-react';
import SOLInfoCard from './SOL/SOLInfoCard';
import '../styles/design-system.css';

interface LoanDetailModalProps {
  loanId: string;
  onClose: () => void;
}

export function LoanDetailModal({ loanId, onClose }: LoanDetailModalProps) {
  const navigate = useNavigate();
  const modalRef = useRef<HTMLDivElement>(null);
  
  useOnClickOutside(modalRef, onClose);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleViewFullDetails = () => {
    navigate(`/loans/${loanId}`);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 'var(--space-lg)'
    }}>
      <div 
        ref={modalRef}
        style={{
          backgroundColor: 'white',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-lg)',
          borderBottom: '1px solid var(--neutral-200)'
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--neutral-900)'
            }}>
              Loan Quick View
            </h2>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--neutral-600)'
            }}>
              Loan ID: {loanId}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--neutral-500)',
              transition: 'all var(--transition-fast)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--neutral-100)';
              e.currentTarget.style.color = 'var(--neutral-700)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--neutral-500)';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: 'var(--space-lg)',
          overflow: 'auto',
          flex: 1
        }}>
          {/* SOL Information */}
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <h3 style={{
              margin: '0 0 var(--space-md) 0',
              fontSize: 'var(--font-size-md)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--neutral-800)'
            }}>
              Statute of Limitations Status
            </h3>
            <SOLInfoCard loanId={parseInt(loanId)} showCalculateButton={true} />
          </div>

          {/* Basic Loan Information Placeholder */}
          <div style={{ 
            padding: 'var(--space-md)',
            backgroundColor: 'var(--neutral-50)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--neutral-200)'
          }}>
            <p style={{
              margin: 0,
              fontSize: 'var(--font-size-sm)',
              color: 'var(--neutral-600)',
              textAlign: 'center'
            }}>
              Additional loan details will be loaded here
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-lg)',
          borderTop: '1px solid var(--neutral-200)',
          backgroundColor: 'var(--neutral-50)'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              backgroundColor: 'white',
              color: 'var(--neutral-700)',
              border: '1px solid var(--neutral-300)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--neutral-50)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
            }}
          >
            Close
          </button>
          <button
            onClick={handleViewFullDetails}
            style={{
              padding: '8px 16px',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              backgroundColor: 'var(--primary-blue)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--primary-blue-dark)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--primary-blue)';
            }}
          >
            View Full Details
          </button>
        </div>
      </div>
    </div>
  );
}