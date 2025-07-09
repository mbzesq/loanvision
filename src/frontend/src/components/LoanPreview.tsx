import React, { useState, useEffect } from 'react';
import { DollarSign, MapPin, Calendar, Eye, ExternalLink, User, Home, AlertTriangle } from 'lucide-react';

interface LoanData {
  loan_id: string;
  first_name: string;
  last_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  prin_bal: number;
  legal_status: string;
  // Add more fields as needed
}

interface LoanPreviewProps {
  loanId: string;
  compact?: boolean;
}

export function LoanPreview({ loanId, compact = false }: LoanPreviewProps) {
  const [loanData, setLoanData] = useState<LoanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLoanData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const authToken = localStorage.getItem('authToken');
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v2/loans/${loanId}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch loan data: ${response.status}`);
        }

        const data = await response.json();
        setLoanData(data);
      } catch (err) {
        console.error('Error fetching loan data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load loan data');
      } finally {
        setLoading(false);
      }
    };

    if (loanId) {
      fetchLoanData();
    }
  }, [loanId]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'current':
        return 'var(--color-success)';
      case 'delinquent':
        return 'var(--color-warning)';
      case 'foreclosure':
        return 'var(--color-danger)';
      default:
        return 'var(--color-text-muted)';
    }
  };

  const handleViewLoan = () => {
    // Navigate to loan detail page
    window.open(`/loans/${loanId}`, '_blank');
  };

  if (loading) {
    return (
      <div style={{
        padding: '12px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        fontSize: '11px',
        color: 'var(--color-text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <div style={{
          width: '12px',
          height: '12px',
          border: '2px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        Loading loan {loanId}...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '12px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        fontSize: '11px',
        color: 'var(--color-danger)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <AlertTriangle style={{ width: '12px', height: '12px' }} />
        Error loading loan {loanId}: {error}
      </div>
    );
  }

  if (!loanData) {
    return (
      <div style={{
        padding: '12px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        fontSize: '11px',
        color: 'var(--color-text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <AlertTriangle style={{ width: '12px', height: '12px' }} />
        Loan {loanId} not found
      </div>
    );
  }

  const borrowerName = `${loanData.first_name || ''} ${loanData.last_name || ''}`.trim();
  const propertyAddress = `${loanData.address}, ${loanData.city}, ${loanData.state} ${loanData.zip}`.trim();

  return (
    <div style={{
      margin: '12px 0',
      padding: '12px',
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-sm)',
      fontSize: '11px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
        paddingBottom: '6px',
        borderBottom: '1px solid var(--color-border)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Home style={{ width: '14px', height: '14px', color: 'var(--color-primary)' }} />
          <span style={{
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--color-text-primary)'
          }}>
            Loan {loanData.loan_id}
          </span>
          <span style={{
            fontSize: '10px',
            padding: '2px 6px',
            backgroundColor: getStatusColor(loanData.legal_status),
            color: 'white',
            borderRadius: '10px',
            textTransform: 'uppercase'
          }}>
            {loanData.legal_status || 'Unknown'}
          </span>
        </div>
        <button
          onClick={handleViewLoan}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            fontSize: '10px',
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer'
          }}
        >
          <Eye style={{ width: '10px', height: '10px' }} />
          View Details
        </button>
      </div>

      {/* Loan Details */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: compact ? '1fr' : '1fr 1fr',
        gap: '8px'
      }}>
        {/* Borrower Info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <User style={{ width: '12px', height: '12px', color: 'var(--color-text-muted)' }} />
          <div>
            <div style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>
              {borrowerName || 'Unknown Borrower'}
            </div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
              Borrower
            </div>
          </div>
        </div>

        {/* Property Address */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <MapPin style={{ width: '12px', height: '12px', color: 'var(--color-text-muted)' }} />
          <div>
            <div style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>
              {propertyAddress || 'Address not available'}
            </div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
              Property Address
            </div>
          </div>
        </div>

        {/* Principal Balance */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <DollarSign style={{ width: '12px', height: '12px', color: 'var(--color-text-muted)' }} />
          <div>
            <div style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>
              {loanData.prin_bal ? formatCurrency(loanData.prin_bal) : 'N/A'}
            </div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
              Principal Balance
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <ExternalLink style={{ width: '12px', height: '12px', color: 'var(--color-text-muted)' }} />
          <div>
            <button
              onClick={handleViewLoan}
              style={{
                fontSize: '10px',
                color: 'var(--color-primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              View Full Loan Details
            </button>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
              Quick Actions
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}