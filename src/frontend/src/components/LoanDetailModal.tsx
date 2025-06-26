// src/frontend/src/components/LoanDetailModal.tsx
import { useEffect, useState, useRef } from 'react';
import { Button } from '@loanvision/shared/components/ui/button';
import { Loan } from '../pages/LoanExplorerPage';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { X, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface LoanDetailModalProps {
  loanId: string;
  onClose: () => void;
}

// New interface for the timeline data from the backend
interface Milestone {
  milestone_name: string;
  actual_completion_date: string | null;
  expected_completion_date: string | null;
}

// A reusable component for displaying each data point
const DetailItem = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-sm text-slate-500">{label}</p>
    <div className="font-medium text-slate-900 mt-1">{children}</div>
  </div>
);

export function LoanDetailModal({ loanId, onClose }: LoanDetailModalProps) {
  const [loan, setLoan] = useState<Loan | null>(null);
  const [timeline, setTimeline] = useState<Milestone[]>([]);
  const [propertyData, setPropertyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const modalRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(modalRef, onClose);

  useEffect(() => {
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

  // Fetch property data function
  const fetchPropertyData = async (loanId: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await axios.get(`${apiUrl}/api/v2/loans/${loanId}/property-details`);
      console.log('Property data fetched:', response.data);
      setPropertyData(response.data);
    } catch (error) {
      console.error('Failed to fetch property data:', error);
      // Don't fail the entire modal if property data is not available
      setPropertyData(null);
    }
  };

  useEffect(() => {
    const fetchAllDetails = async () => {
      if (!loanId) return;
      setLoading(true);
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
        // Fetch all data points in parallel
        const [loanRes, timelineRes] = await Promise.all([
          axios.get(`${apiUrl}/api/v2/loans/${loanId}`),
          axios.get(`${apiUrl}/api/loans/${loanId}/foreclosure-timeline`).catch(() => ({ data: [] })) // Gracefully handle no timeline
        ]);
        setLoan(loanRes.data);
        setTimeline(timelineRes.data);
        
        // Fetch property data separately (non-blocking)
        fetchPropertyData(loanId);
      } catch (error) {
        console.error('Failed to fetch loan details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllDetails();
  }, [loanId]);

  // --- Helper Functions ---
  const formatCurrency = (value: any) => !value ? "—" : parseFloat(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const formatDate = (value: any) => {
    if (!value) return "—";
    const date = new Date(value);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const correctedDate = new Date(date.getTime() + userTimezoneOffset);
    return isNaN(correctedDate.getTime()) ? "—" : correctedDate.toLocaleDateString('en-US');
  };
  const formatPercent = (value: any) => !value ? "—" : `${(parseFloat(value) * 100).toFixed(2)}%`;
  const formatValue = (value: any) => value || "—";
  const generateZillowUrl = (l: Loan | null) => l ? `https://www.zillow.com/homes/${encodeURIComponent(`${l.address}, ${l.city}, ${l.state} ${l.zip}`)}` : '#';
  const handleInvestorClick = (name: string | null | undefined) => alert(`Investor view for ${name || 'N/A'} coming soon!`);
  const getStatusIcon = (m: Milestone) => {
    const today = new Date();
    
    if (m.actual_completion_date) {
      // Milestone is completed - check if it was on time or late
      const actualDate = new Date(m.actual_completion_date);
      const expectedDate = new Date(m.expected_completion_date || '');
      
      if (m.expected_completion_date && actualDate > expectedDate) {
        // Completed late
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      } else {
        // Completed on time
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      }
    } else {
      // Milestone is not completed - check if it's overdue
      if (m.expected_completion_date) {
        const expectedDate = new Date(m.expected_completion_date);
        if (expectedDate < today) {
          // Overdue
          return <AlertCircle className="h-5 w-5 text-red-500" />;
        }
      }
      // Pending
      return <Clock className="h-5 w-5 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-slate-900">
            {loading ? "Loading..." : `Details for Loan: ${loan?.loan_id}`}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        
        {/* Body */}
        <div className="flex-grow overflow-y-auto p-6">
          {loading && <div className="text-center p-8">Loading details...</div>}
          {!loading && !loan && <div className="text-center p-8 text-red-600">Failed to load loan details.</div>}
          {!loading && loan && (
            <div className="space-y-8">
              {/* === Section 1: Borrower & Property === */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div>
                  <h3 className="text-base font-semibold text-slate-600 border-b pb-2 mb-3">Loan & Borrower</h3>
                  <div className="space-y-4">
                    <DetailItem label="Borrower Name">{`${loan.first_name} ${loan.last_name}`}</DetailItem>
                    <DetailItem label="Investor"><button onClick={() => handleInvestorClick(loan.investor_name)} className="text-blue-600 hover:underline font-medium text-left">{formatValue(loan.investor_name)}</button></DetailItem>
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-600 border-b pb-2 mb-3">Property & Collateral</h3>
                   <div className="space-y-4">
                    <DetailItem label="Property Address"><a href={generateZillowUrl(loan)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{`${formatValue(loan.address)}, ${formatValue(loan.city)}, ${formatValue(loan.state)}`}</a></DetailItem>
                    <DetailItem label="Lien Position">{formatValue(loan.lien_pos)}</DetailItem>
                  </div>
                </div>
              </section>
              
              {/* === Section 2: Financials & Status === */}
              <section>
                <h3 className="text-base font-semibold text-slate-600 border-b pb-2 mb-3">Financials & Status</h3>
                <div className="grid grid-cols-3 gap-x-8 gap-y-4">
                  <DetailItem label="UPB"><span className="text-xl font-bold">{formatCurrency(loan.prin_bal)}</span></DetailItem>
                  <DetailItem label="Interest Rate">{formatPercent(loan.int_rate)}</DetailItem>
                  <DetailItem label="Legal Status">{formatValue(loan.legal_status)}</DetailItem>
                  <DetailItem label="Last Paid">{formatDate(loan.last_pymt_received)}</DetailItem>
                  <DetailItem label="Next Due">{formatDate(loan.next_pymt_due)}</DetailItem>
                </div>
              </section>

              {/* === Section 3: Foreclosure Timeline === */}
              {timeline && timeline.length > 0 && (
                <section>
                  <h3 className="text-base font-semibold text-slate-600 border-b pb-2 mb-3">Foreclosure Timeline</h3>
                  <div className="space-y-3">
                    {timeline.map((milestone, index) => (
                      <div key={index} className="flex items-center gap-4 p-2 rounded-md hover:bg-slate-50">
                        <div>{getStatusIcon(milestone)}</div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-800">{milestone.milestone_name}</p>
                          <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                            <span>Actual: {formatDate(milestone.actual_completion_date)}</span>
                            <span>Expected: {formatDate(milestone.expected_completion_date)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* === Section 4: Property Enrichment Data (Validation) === */}
              {propertyData && (
                <section className="mt-4 p-4 bg-gray-100 rounded">
                  <h3 className="text-base font-semibold text-slate-600 border-b pb-2 mb-3">Enrichment Data (Validation)</h3>
                  <pre className="text-xs whitespace-pre-wrap break-all">
                    {JSON.stringify(propertyData, null, 2)}
                  </pre>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center p-4 border-t gap-2 bg-slate-50">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button disabled>Manage</Button>
        </div>
      </div>
    </div>
  );
}