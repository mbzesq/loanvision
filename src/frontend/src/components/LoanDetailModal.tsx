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