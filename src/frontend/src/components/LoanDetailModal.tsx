// src/frontend/src/components/LoanDetailModal.tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@loanvision/shared/components/ui/dialog';
import { Button } from '@loanvision/shared/components/ui/button';
import { useEffect, useState } from 'react';
import axios from 'axios';

// Define the shape of the full loan object
interface Loan {
    id: number;
    servicer_loan_id: string;
    borrower_name: string;
    property_address: string;
    property_city: string;
    property_state: string;
    property_zip: string;
    unpaid_principal_balance: string;
    interest_rate: string;
    legal_status: string;
    last_paid_date: string;
    next_due_date: string;
    investor_name: string;
    lien_position: string;
    maturity_date: string;
    // Add any other fields you expect from the API
}

interface LoanDetailModalProps {
  loanId: string;
  onClose: () => void;
}

// A reusable component for displaying each data point
const DetailItem = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-sm text-slate-500">{label}</p>
    <div className="font-medium text-slate-900">{children}</div>
  </div>
);

export function LoanDetailModal({ loanId, onClose }: LoanDetailModalProps) {
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLoanDetails = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
        const response = await axios.get(`${apiUrl}/api/loans/${loanId}`);
        setLoan(response.data);
      } catch (error) {
        console.error('Failed to fetch loan details:', error);
      } finally {
        setLoading(false);
      }
    };
    if (loanId) {
      fetchLoanDetails();
    }
  }, [loanId]);

  // --- Helper Functions for Formatting ---
  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return <span className="text-slate-500">—</span>;
    const numberValue = parseFloat(value);
    return isNaN(numberValue) ? <span className="text-slate-500">—</span> : numberValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return <span className="text-slate-500">—</span>;
    const date = new Date(value);
    return isNaN(date.getTime()) ? <span className="text-slate-500">—</span> : date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  // CORRECTED: This function now correctly multiplies the decimal by 100.
  const formatPercent = (value: string | null | undefined) => {
    if (!value) return <span className="text-slate-500">—</span>;
    const numberValue = parseFloat(value);
    return isNaN(numberValue) ? <span className="text-slate-500">—</span> : `${(numberValue * 100).toFixed(2)}%`;
  };

  const formatValue = (value: string | number | null | undefined) => {
    return value || <span className="text-slate-500">—</span>;
  };

  // NEW: Function to generate a Zillow search URL
  const generateZillowUrl = (loanData: Loan) => {
    const address = `${loanData.property_address}, ${loanData.property_city}, ${loanData.property_state} ${loanData.property_zip}`;
    return `https://www.zillow.com/homes/${encodeURIComponent(address)}`;
  };

  const handleInvestorClick = (investorName: string) => {
    console.log(`Placeholder: Clicked on investor: ${investorName}. Future implementation will show an investor-specific view.`);
    alert(`Functionality to view details for "${investorName}" is coming soon!`);
  };

  return (
    <Dialog open={!!loanId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {loading && <div className="p-8 text-center">Loading...</div>}
        {!loading && loan && (
          <>
            <DialogHeader>
              <DialogTitle>Debug Modal: Loan {loan.servicer_loan_id}</DialogTitle>
              <DialogDescription>
                This is a test to see if the basic dialog renders.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <p>If you can see this text, the Dialog component itself is working.</p>
              <p className="mt-4 font-mono">Borrower: {loan.borrower_name}</p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Close</Button>
            </DialogFooter>
          </>
        )}
        {!loading && !loan && (
           <div className="p-8 text-center text-red-500">Error: Loan data could not be loaded.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}