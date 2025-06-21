// src/frontend/src/components/LoanDetailModal.tsx
import { useEffect, useRef, useState } from 'react';
import { Button } from '@loanvision/shared/components/ui/button';
import { Loan } from '../pages/LoanExplorerPage'; // Assuming Loan type is exported
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { X, ChevronDown, ChevronRight } from 'lucide-react';

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

// TODO: REMOVE AFTER DATA VALIDATION - Temporary debug section for new data types
const DebugSection = ({ loan }: { loan: Loan }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDebugValue = (value: any) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-slate-400 italic">No data</span>;
    }
    return <span className="text-slate-700">{String(value)}</span>;
  };

  const formatDebugDate = (value: any) => {
    if (!value) return <span className="text-slate-400 italic">No date</span>;
    const date = new Date(value);
    return isNaN(date.getTime()) ? 
      <span className="text-slate-400 italic">Invalid date</span> : 
      <span className="text-slate-700">{date.toLocaleDateString('en-US')}</span>;
  };

  const DebugField = ({ label, value, isDate = false }: { label: string; value: any; isDate?: boolean }) => (
    <div className="flex justify-between items-center py-1 border-b border-slate-100 last:border-b-0">
      <span className="text-xs text-slate-600 font-medium">{label}:</span>
      <span className="text-xs">{isDate ? formatDebugDate(value) : formatDebugValue(value)}</span>
    </div>
  );

  const MilestoneGroup = ({ title, actualStart, expectedCompletion, actualCompletion }: {
    title: string;
    actualStart: any;
    expectedCompletion: any;
    actualCompletion: any;
  }) => (
    <div className="bg-slate-50 p-2 rounded border">
      <h5 className="text-xs font-semibold text-slate-700 mb-2">{title}</h5>
      <div className="space-y-1">
        <DebugField label="Actual Start" value={actualStart} isDate />
        <DebugField label="Expected Completion" value={expectedCompletion} isDate />
        <DebugField label="Actual Completion" value={actualCompletion} isDate />
      </div>
    </div>
  );

  return (
    <section className="md:col-span-2 mt-6 pt-4 border-t-2 border-orange-200">
      <div 
        className="flex items-center cursor-pointer p-3 bg-orange-50 rounded-lg border border-orange-200"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-lg mr-2">⚠️</span>
        <h3 className="text-sm font-semibold text-orange-800 flex-1">
          Debug: Servicer & Foreclosure Data (Temporary)
        </h3>
        {isExpanded ? 
          <ChevronDown className="h-4 w-4 text-orange-600" /> : 
          <ChevronRight className="h-4 w-4 text-orange-600" />
        }
      </div>
      
      {isExpanded && (
        <div className="mt-3 p-4 bg-gray-50 rounded border space-y-4">
          {/* Daily Metrics Data */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              📊 Daily Metrics Data
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <DebugField label="Loan Status (B)" value={(loan as any).loan_status} />
                <DebugField label="Legal Status (Y)" value={loan.legal_status} />
                <DebugField label="Next Due Date (T)" value={loan.next_pymt_due} isDate />
              </div>
              <div className="space-y-1">
                <DebugField label="Monthly P&I (U)" value={(loan as any).pi_pmt} />
                <DebugField label="UPB (AA)" value={loan.prin_bal} />
                <DebugField label="Servicer Comments (W)" value={(loan as any).servicer_comments} />
              </div>
            </div>
          </div>

          {/* Foreclosure Data */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              🏛️ Foreclosure Data
            </h4>
            
            {/* Basic Foreclosure Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <DebugField label="FC Status (I)" value={loan.fc_status} />
              <DebugField label="FC Jurisdiction (H)" value={(loan as any).fc_jurisdiction} />
              <DebugField label="Legal State (F)" value={(loan as any).legal_state} />
            </div>
            
            <DebugField label="Foreclosure Referral Date (G)" value={(loan as any).foreclosure_referral_date} isDate />

            {/* Legal Milestones */}
            <div className="mt-4">
              <h5 className="text-sm font-medium text-gray-600 mb-3">Legal Milestones</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <MilestoneGroup
                  title="1st: Judgment Application"
                  actualStart={(loan as any).judgment_application_actual_start}
                  expectedCompletion={(loan as any).judgment_application_expected_completion}
                  actualCompletion={(loan as any).judgment_application_actual_completion}
                />
                <MilestoneGroup
                  title="2nd: Judgment Entry"
                  actualStart={(loan as any).judgment_entry_actual_start}
                  expectedCompletion={(loan as any).judgment_entry_expected_completion}
                  actualCompletion={(loan as any).judgment_entry_actual_completion}
                />
                <MilestoneGroup
                  title="3rd: Sheriff Sale Scheduled"
                  actualStart={(loan as any).sheriff_sale_scheduled_actual_start}
                  expectedCompletion={(loan as any).sheriff_sale_scheduled_expected_completion}
                  actualCompletion={(loan as any).sheriff_sale_scheduled_actual_completion}
                />
                <MilestoneGroup
                  title="4th: Sheriff Sale Held"
                  actualStart={(loan as any).sheriff_sale_held_actual_start}
                  expectedCompletion={(loan as any).sheriff_sale_held_expected_completion}
                  actualCompletion={(loan as any).sheriff_sale_held_actual_completion}
                />
                <MilestoneGroup
                  title="5th: EV/Lockout Filed"
                  actualStart={(loan as any).ev_lockout_filed_actual_start}
                  expectedCompletion={(loan as any).ev_lockout_filed_expected_completion}
                  actualCompletion={(loan as any).ev_lockout_filed_actual_completion}
                />
                <MilestoneGroup
                  title="6th: EV/Lockout Approved"
                  actualStart={(loan as any).ev_lockout_approved_actual_start}
                  expectedCompletion={(loan as any).ev_lockout_approved_expected_completion}
                  actualCompletion={(loan as any).ev_lockout_approved_actual_completion}
                />
                <MilestoneGroup
                  title="7th: EV/Lockout Executed"
                  actualStart={(loan as any).ev_lockout_executed_actual_start}
                  expectedCompletion={(loan as any).ev_lockout_executed_expected_completion}
                  actualCompletion={(loan as any).ev_lockout_executed_actual_completion}
                />
                <MilestoneGroup
                  title="8th: Deed Recorded"
                  actualStart={(loan as any).deed_recorded_actual_start}
                  expectedCompletion={(loan as any).deed_recorded_expected_completion}
                  actualCompletion={(loan as any).deed_recorded_actual_completion}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

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
    // Add timezone offset to counteract browser conversion
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const correctedDate = new Date(date.getTime() + userTimezoneOffset);

    return isNaN(correctedDate.getTime()) ? <span className="text-slate-500">—</span> : correctedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatPercent = (value: string | null | undefined) => {
    if (!value) return <span className="text-slate-500">—</span>;
    const numberValue = parseFloat(value);
    return isNaN(numberValue) ? <span className="text-slate-500">—</span> : `${(numberValue * 10000).toFixed(2)}%`;
  };

  const formatValue = (value: string | number | null | undefined) => {
    return value ? String(value) : <span className="text-slate-500">—</span>;
  };

  const generateZillowUrl = (loanData: Loan) => {
    const address = `${loanData.address}, ${loanData.city}, ${loanData.state} ${loanData.zip}`;
    return `https://www.zillow.com/homes/${encodeURIComponent(address)}`;
  };

  const handleInvestorClick = (investorName: string) => {
    alert(`Functionality to view details for "${investorName}" is coming soon!`);
  };

  console.log('Raw int_rate value received by modal:', loan.int_rate);
  console.log('Raw lien_pos value received by modal:', loan.lien_pos);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-slate-900">Details for Loan: {loan.loan_id}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Modal Body */}
        <div className="py-4 px-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 overflow-y-auto">
          {/* Section 1: Loan & Borrower */}
          <section className="space-y-4">
             <h3 className="text-base font-semibold text-slate-600 border-b pb-2">Loan & Borrower</h3>
             <DetailItem label="Borrower Name">{formatValue(`${loan.first_name || ''} ${loan.last_name || ''}`.trim())}</DetailItem>
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
                 {`${loan.address}, ${loan.city}, ${loan.state} ${loan.zip}`}
               </a>
             </DetailItem>
             <DetailItem label="Lien Position">{formatValue(loan.lien_pos)}</DetailItem>
          </section>

          {/* Section 3: Financials & Status */}
          <section className="md:col-span-2 space-y-4 pt-4">
             <h3 className="text-base font-semibold text-slate-600 border-b pb-2">Financials & Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4 pt-2">
                <DetailItem label="Unpaid Principal Balance">
                    <span className="text-xl font-bold text-slate-900">{formatCurrency(loan.prin_bal)}</span>
                </DetailItem>
                <DetailItem label="Interest Rate">{formatPercent(loan.int_rate)}</DetailItem>
                <DetailItem label="Legal Status">{formatValue(loan.legal_status)}</DetailItem>
                <DetailItem label="Last Paid Date">{formatDate(loan.last_pymt_received)}</DetailItem>
                <DetailItem label="Next Due Date">{formatDate(loan.next_pymt_due)}</DetailItem>
                {/* Maturity Date will be added back when the data field exists */}
              </div>
          </section>

          {/* DEBUG SECTION - TEMPORARY: Remove after data validation */}
          <DebugSection loan={loan} />
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