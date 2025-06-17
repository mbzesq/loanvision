import { useEffect, useState } from 'react';
import axios from 'axios';

interface LoanDetailModalProps {
  loanId: string;
  onClose: () => void;
}

interface LoanDetails {
  id: number;
  servicer_loan_id: string;
  borrower_name: string;
  property_address: string;
  property_city: string;
  property_state: string;
  property_zip: string;
  unpaid_principal_balance: string;
  loan_amount: string;
  interest_rate: string;
  legal_status: string;
  last_paid_date: string;
  next_due_date: string;
  remaining_term_months: string;
  created_at: string;
  [key: string]: any;
}

const fieldLabels: { [key: string]: string } = {
  servicer_loan_id: 'Loan Number',
  borrower_name: 'Borrower Name',
  property_address: 'Property Address',
  property_city: 'City',
  property_state: 'State',
  property_zip: 'ZIP Code',
  unpaid_principal_balance: 'Unpaid Principal Balance',
  loan_amount: 'Original Loan Amount',
  interest_rate: 'Interest Rate',
  legal_status: 'Legal Status',
  last_paid_date: 'Last Paid Date',
  next_due_date: 'Next Due Date',
  remaining_term_months: 'Remaining Term (Months)',
  created_at: 'Date Uploaded'
};

function LoanDetailModal({ loanId, onClose }: LoanDetailModalProps) {
  const [loan, setLoan] = useState<LoanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLoanDetails = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
        const response = await axios.get<LoanDetails>(`${apiUrl}/api/loans/${loanId}`);
        setLoan(response.data);
      } catch (err) {
        setError('Failed to fetch loan details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLoanDetails();
  }, [loanId]);

  const formatValue = (key: string, value: any): string => {
    if (value === null || value === undefined || value === '') {
      return 'N/A';
    }

    if (key === 'unpaid_principal_balance' || key === 'loan_amount') {
      return parseFloat(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    }

    if (key === 'interest_rate') {
      return `${(parseFloat(value) * 100).toFixed(2)}%`;
    }

    if (key === 'last_paid_date' || key === 'next_due_date' || key === 'created_at') {
      return new Date(value).toLocaleDateString('en-US');
    }

    return String(value);
  };

  const modalStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  };

  const contentStyles: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '24px',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '80vh',
    overflowY: 'auto',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
  };

  const headerStyles: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    borderBottom: '1px solid #e0e0e0',
    paddingBottom: '16px'
  };

  const closeButtonStyles: React.CSSProperties = {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#666'
  };

  const fieldRowStyles: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '200px 1fr',
    padding: '8px 0',
    borderBottom: '1px solid #f0f0f0'
  };

  const labelStyles: React.CSSProperties = {
    fontWeight: 'bold',
    color: '#333'
  };

  const valueStyles: React.CSSProperties = {
    color: '#666'
  };

  if (loading) {
    return (
      <div style={modalStyles} onClick={onClose}>
        <div style={contentStyles} onClick={(e) => e.stopPropagation()}>
          <div>Loading loan details...</div>
        </div>
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div style={modalStyles} onClick={onClose}>
        <div style={contentStyles} onClick={(e) => e.stopPropagation()}>
          <div style={{ color: 'red' }}>{error || 'Failed to load loan details'}</div>
          <button onClick={onClose} style={{ marginTop: '16px' }}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div style={modalStyles} onClick={onClose}>
      <div style={contentStyles} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyles}>
          <h2 style={{ margin: 0 }}>Details for Loan: {loan.servicer_loan_id}</h2>
          <button style={closeButtonStyles} onClick={onClose}>&times;</button>
        </div>
        
        <div>
          {Object.entries(loan).map(([key, value]) => {
            if (key === 'id') return null;
            
            const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            return (
              <div key={key} style={fieldRowStyles}>
                <div style={labelStyles}>{label}:</div>
                <div style={valueStyles}>{formatValue(key, value)}</div>
              </div>
            );
          })}
        </div>
        
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button 
            onClick={onClose}
            style={{
              padding: '8px 24px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoanDetailModal;