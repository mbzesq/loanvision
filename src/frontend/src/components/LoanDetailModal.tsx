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
import { Loan } from '../pages/LoanExplorerPage'; // Assuming Loan type is exported

interface LoanDetailModalProps {
  loan: Loan | null;
  onClose: () => void;
}

// A reusable component for displaying each data point
const DetailItem = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-sm text-slate-500">{label}</p>
    <div className="font-medium text-slate-900 mt-1">{children}</div>
  </div>
);

export function LoanDetailModal({ loan, onClose }: LoanDetailModalProps) {
  if (!loan) {
    return null;
  }

  // --- Helper Functions ---
  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return <span className="text-slate-500">—</span>;
    const numberValue = parseFloat(value);
    return isNaN(numberValue) ? <span className="text-slate-500">—</span> : numberValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return <span className="text-slate-500">—</span>;
    const date = new Date(value);
    return isNaN(date.getTime()) ? <span className="text-slate-500">—</span> : date.toLocaleDateString('en-US');
  };

  // CORRECTED: This function now correctly multiplies the decimal by 100.
  const formatPercent = (value: string | null | undefined) => {
    if (!value) return <span className="text-slate-500">—</span>;
    const numberValue = parseFloat(value);
    return isNaN(numberValue) ? <span className="text-slate-500">—</span> : `${(numberValue * 100).toFixed(2)}%`;
  };

  const formatValue = (value: string | number | null | undefined) => {
    return value ? String(value) : <span className="text-slate-500">—</span>;
  };

  const generateZillowUrl = (loanData: Loan) => {
    const address = `${loanData.property_address}, ${loanData.property_city}, ${loanData.property_state} ${loanData.property_zip}`;
    return `https://www.zillow.com/homes/${encodeURIComponent(address)}`;
  };

  const handleInvestorClick = (investorName: string) => {
    alert(`Functionality to view details for "${investorName}" is coming soon!`);
  };

  return (
    <Dialog open={!!loan} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Details for Loan: {loan.servicer_loan_id}</DialogTitle>
          <DialogDescription>
            A summary of the loan's key details.
          </DialogDescription>
        </DialogHeader>

        {/* Main Content Body */}
        <div className="py-4 grid grid-cols-2 gap-x-8 gap-y-6 max-h-[70vh] overflow-y-auto">
          <DetailItem label="Borrower Name">{formatValue(loan.borrower_name)}</DetailItem>
          <DetailItem label="Investor Name">
            <button onClick={() => handleInvestorClick(loan.investor_name)} className="text-blue-600 hover:underline font-medium text-left">
              {formatValue(loan.investor_name)}
            </button>
          </DetailItem>
          <DetailItem label="Property Address">
            <a href={generateZillowUrl(loan)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              {`${loan.property_address}, ${loan.property_city}, ${loan.property_state}`}
            </a>
          </DetailItem>
          <DetailItem label="Lien Position">{formatValue(loan.lien_position)}</DetailItem>
          <DetailItem label="Unpaid Principal Balance">
            <span className="text-lg font-semibold">{formatCurrency(loan.unpaid_principal_balance)}</span>
          </DetailItem>
          <DetailItem label="Interest Rate">{formatPercent(loan.interest_rate)}</DetailItem>
          <DetailItem label="Last Paid Date">{formatDate(loan.last_paid_date)}</DetailItem>
          <DetailItem label="Next Due Date">{formatDate(loan.next_due_date)}</DetailItem>
          <DetailItem label="Legal Status">{formatValue(loan.legal_status)}</DetailItem>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}