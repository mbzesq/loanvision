// src/frontend/src/components/LoanDetailModal.tsx
import { useEffect, useRef } from 'react';
import { Button } from '@loanvision/shared/components/ui/button';
import { Loan } from '../pages/LoanExplorerPage'; // Assuming Loan type is exported
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { X } from 'lucide-react';

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
  const modalRef = useRef<HTMLDivElement>(null);

  // Close the modal if a click is detected outside
  useOnClickOutside(modalRef, onClose);

  // Also allow closing with the Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
    return isNaN(date.getTime()) ? <span className="text-slate-500">—</span> : date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-slate-900">Details for Loan: {loan.servicer_loan_id}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Modal Body */}
        <div className="py-4 px-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 overflow-y-auto">
          {/* Section 1: Loan & Borrower */}
          <section className="space-y-4">
             <h3 className="text-base font-semibold text-slate-600 border-b pb-2">Loan & Borrower</h3>
             <DetailItem label="Borrower Name">{formatValue(loan.borrower_name)}</DetailItem>
             <DetailItem label="Investor Name">
               <button onClick={() => handleInvestorClick(loan.investor_name)} className="text-blue-600 hover:underline font-medium text-left">
                 {formatValue(loan.investor_name)}
               </button>
             </DetailItem>
          </section>

          {/* Section 2: Property & Collateral */}
          <section className="space-y-4">
             <h3 className="text-base font-semibold text-slate-600 border-b pb-2">Property & Collateral</h3>
             <DetailItem label="Property Address">
               <a href={generateZillowUrl(loan)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                 {`${loan.property_address}, ${loan.property_city}, ${loan.property_state} ${loan.property_zip}`}
               </a>
             </DetailItem>
             <DetailItem label="Lien Position">{formatValue(loan.lien_position)}</DetailItem>
          </section>

          {/* Section 3: Financials & Status */}
          <section className="md:col-span-2 space-y-4 pt-4">
             <h3 className="text-base font-semibold text-slate-600 border-b pb-2">Financials & Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4 pt-2">
                <DetailItem label="Unpaid Principal Balance">
                    <span className="text-xl font-bold text-slate-900">{formatCurrency(loan.unpaid_principal_balance)}</span>
                </DetailItem>
                <DetailItem label="Interest Rate">{formatPercent(loan.interest_rate)}</DetailItem>
                <DetailItem label="Legal Status">{formatValue(loan.legal_status)}</DetailItem>
                <DetailItem label="Last Paid Date">{formatDate(loan.last_paid_date)}</DetailItem>
                <DetailItem label="Next Due Date">{formatDate(loan.next_due_date)}</DetailItem>
                {/* Maturity Date will be added back when the data field exists */}
              </div>
          </section>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end items-center p-4 border-t gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button disabled>Manage</Button>
        </div>
      </div>
    </div>
  );
}