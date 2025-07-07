// src/frontend/src/components/LoanDetailModal.tsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Loan } from '../pages/LoanExplorerPage';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { X } from 'lucide-react';
import axios from 'axios';
import {
  DetailItem,
  Milestone,
  formatCurrency,
  formatDate,
  formatPercent,
  formatValue,
  generateZillowUrl,
  handleInvestorClick,
  getStatusIcon
} from '../lib/loanUtils';

interface LoanDetailModalProps {
  loanId: string;
  onClose: () => void;
}


export function LoanDetailModal({ loanId, onClose }: LoanDetailModalProps) {
  const [loan, setLoan] = useState<Loan | null>(null);
  const [timeline, setTimeline] = useState<Milestone[]>([]);
  const [propertyData, setPropertyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  // Navigation handler
  const handleViewFullPage = () => {
    navigate(`/loans/${loanId}`);
    onClose();
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
          <Button onClick={handleViewFullPage} className="bg-blue-600 text-white hover:bg-blue-700">
            View Full Page
          </Button>
        </div>
      </div>
    </div>
  );
}