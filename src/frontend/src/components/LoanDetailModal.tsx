// src/frontend/src/components/LoanDetailModal.tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@loanvision/shared/components/ui/dialog';
import { Button } from '@loanvision/shared/components/ui/button';
import { Loan } from '../pages/LoanExplorerPage'; // Assuming Loan type is exported from parent

interface LoanDetailModalProps {
  loan: Loan | null;
  onClose: () => void;
}

export function LoanDetailModal({ loan, onClose }: LoanDetailModalProps) {
  if (!loan) {
    return null; // Don't render anything if there's no loan data
  }

  // Helper functions can be moved here or kept in a separate utils file
  const formatDate = (value: string | null | undefined) => {
     if (!value) return "—";
     const date = new Date(value);
     return isNaN(date.getTime()) ? "—" : date.toLocaleDateString('en-US');
  };

  return (
    <Dialog open={!!loan} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Details for Loan: {loan.servicer_loan_id}</DialogTitle>
          <DialogDescription>
            A summary of the loan's key details.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {/* Simplified content for now to guarantee a fix */}
          <p><span className="font-semibold">Borrower:</span> {loan.borrower_name}</p>
          <p><span className="font-semibold">Address:</span> {loan.property_address}</p>
          <p><span className="font-semibold">UPB:</span> {loan.unpaid_principal_balance}</p>
          <p><span className="font-semibold">Status:</span> {loan.legal_status}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}