import { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '@loanvision/shared/components/ui/button';

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
  investor_name: string;
  lien_position: string;
  [key: string]: any;
}



function LoanDetailModal({ loanId, onClose }: LoanDetailModalProps) {
  const [loan, setLoan] = useState<LoanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return <span className="text-slate-500">—</span>;
    const numberValue = parseFloat(value);
    return isNaN(numberValue) 
      ? <span className="text-slate-500">—</span> 
      : numberValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return <span className="text-slate-500">—</span>;
    const date = new Date(value);
    // Check for invalid date
    if (isNaN(date.getTime())) return <span className="text-slate-500">—</span>;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const formatPercent = (value: string | null | undefined) => {
      if (!value) return <span className="text-slate-500">—</span>;
      const numberValue = parseFloat(value);
       return isNaN(numberValue) 
      ? <span className="text-slate-500">—</span> 
      : `${(numberValue * 100).toFixed(2)}%`;
  }

  const formatValue = (value: string | number | null | undefined) => {
    return value || <span className="text-slate-500">—</span>;
  };

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
    maxWidth: '800px',
    width: '90%',
    maxHeight: '80vh',
    overflowY: 'auto',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
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
        {/* Dialog Header */}
        <header className="border-b pb-4 mb-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-slate-900">Details for Loan: {loan.servicer_loan_id}</h2>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
            >
              &times;
            </button>
          </div>
        </header>

        <div className="py-4 space-y-6">
          {/* Section 1: Borrower & Property */}
          <section>
            <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mb-4">Borrower & Property</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {/* Column 1 */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">Borrower Name</p>
                  <p className="font-medium text-slate-900">{formatValue(loan.borrower_name)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Investor Name</p>
                  <p className="font-medium text-slate-900">{formatValue(loan.investor_name)}</p>
                </div>
              </div>
              {/* Column 2 */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">Property Address</p>
                  <p className="font-medium text-slate-900">{`${loan.property_address || ''}, ${loan.property_city || ''}, ${loan.property_state || ''} ${loan.property_zip || ''}`}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Lien Position</p>
                  <p className="font-medium text-slate-900">{formatValue(loan.lien_position)}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Financial Details */}
          <section>
            <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mb-4">Financials & Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4">
              {/* Column 1 */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">Unpaid Principal Balance</p>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(loan.unpaid_principal_balance)}</p>
                </div>
                 <div>
                  <p className="text-sm text-slate-500">Interest Rate</p>
                  <p className="font-medium text-slate-900">{formatPercent(loan.interest_rate)}</p>
                </div>
              </div>
              {/* Column 2 */}
              <div className="space-y-4">
                 <div>
                  <p className="text-sm text-slate-500">Last Paid Date</p>
                  <p className="font-medium text-slate-900">{formatDate(loan.last_paid_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Next Due Date</p>
                  <p className="font-medium text-slate-900">{formatDate(loan.next_due_date)}</p>
                </div>
              </div>
              {/* Column 3 */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">Legal Status</p>
                  <p className="font-medium text-slate-900">{formatValue(loan.legal_status)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Maturity Date</p>
                  <p className="font-medium text-slate-900">{formatDate(loan.next_due_date)}</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Dialog Footer */}
        <footer className="border-t pt-4 mt-6 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </footer>
      </div>
    </div>
  );
}

export default LoanDetailModal;