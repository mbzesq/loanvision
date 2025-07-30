// src/frontend/src/components/LoanDetailModal.tsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loan } from '../pages/LoanExplorerPage';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { X } from 'lucide-react';
import axios from 'axios';
import '../styles/premium-saas-design.css';
import SOLInfoCard from './SOL/SOLInfoCard';
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
    <div className="premium-modal-backdrop">
      <div 
        ref={modalRef} 
        className="premium-modal-container"
        style={{ 
          maxWidth: '1024px', 
          width: '100%', 
          maxHeight: '90vh', 
          display: 'flex', 
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            {loading ? "LOADING..." : `LOAN DETAILS: ${loan?.loan_id}`}
          </h2>
          <button 
            onClick={onClose}
            className="p-1 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Body */}
        <div className="flex-1 p-4 overflow-y-auto">
          {loading && (
            <div className="text-center py-8 text-gray-500 text-xs uppercase tracking-wide">
              LOADING DETAILS...
            </div>
          )}
          {!loading && !loan && (
            <div className="text-center py-8 text-red-600 text-xs">
              Failed to load loan details.
            </div>
          )}
          {!loading && loan && (
            <div className="flex flex-col gap-6">
              {/* === Section 1: Borrower & Property === */}
              <section className="grid grid-cols-2 gap-6">
                <div className="premium-card">
                  <div className="border-b border-gray-200 pb-2 mb-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase">LOAN & BORROWER</h3>
                  </div>
                  <div className="flex flex-col gap-3">
                    <DetailItem label="Borrower Name">{`${loan.first_name} ${loan.last_name}`}</DetailItem>
                    <DetailItem label="Investor">
                      <button 
                        onClick={() => handleInvestorClick(loan.investor_name)} 
                        className="text-blue-600 no-underline font-medium cursor-pointer border-none bg-transparent p-0 text-left hover:text-blue-800"
                        onMouseOver={(e) => e.currentTarget.classList.add('underline')}
                        onMouseOut={(e) => e.currentTarget.classList.remove('underline')}
                      >
                        {formatValue(loan.investor_name)}
                      </button>
                    </DetailItem>
                  </div>
                </div>
                <div className="premium-card">
                  <div className="border-b border-gray-200 pb-2 mb-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase">PROPERTY & COLLATERAL</h3>
                  </div>
                  <div className="flex flex-col gap-3">
                    <DetailItem label="Property Address">
                      <a 
                        href={generateZillowUrl(loan)} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-600 no-underline hover:text-blue-800"
                        onMouseOver={(e) => e.currentTarget.classList.add('underline')}
                        onMouseOut={(e) => e.currentTarget.classList.remove('underline')}
                      >
                        {`${formatValue(loan.address)}, ${formatValue(loan.city)}, ${formatValue(loan.state)}`}
                      </a>
                    </DetailItem>
                    <DetailItem label="Lien Position">{formatValue(loan.lien_pos)}</DetailItem>
                    <DetailItem label="Collateral Status">
                      <span className="text-xs text-gray-400 italic">
                        View full details in Loan Detail Page
                      </span>
                    </DetailItem>
                  </div>
                </div>
              </section>
              
              {/* === Section 2: Financials & Status === */}
              <section className="premium-card">
                <div className="border-b border-gray-200 pb-2 mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase">FINANCIALS & STATUS</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <DetailItem label="UPB">
                    <span className="text-lg font-semibold text-gray-900">
                      {formatCurrency(loan.prin_bal)}
                    </span>
                  </DetailItem>
                  <DetailItem label="Interest Rate">{formatPercent(loan.int_rate)}</DetailItem>
                  <DetailItem label="Legal Status">{formatValue(loan.legal_status)}</DetailItem>
                  <DetailItem label="Last Paid">{formatDate(loan.last_pymt_received)}</DetailItem>
                  <DetailItem label="Next Due">{formatDate(loan.next_pymt_due)}</DetailItem>
                </div>
              </section>

              {/* === Section 3: Foreclosure Timeline === */}
              {timeline && timeline.length > 0 && (
                <section className="premium-card">
                  <div className="border-b border-gray-200 pb-2 mb-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase">FORECLOSURE TIMELINE</h3>
                  </div>
                  <div className="flex flex-col gap-2">
                    {timeline.map((milestone, index) => (
                      <div 
                        key={index} 
                        className="flex items-center gap-3 p-2 rounded-md transition-colors hover:bg-gray-50"
                      >
                        <div>{getStatusIcon(milestone)}</div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-xs mb-1">
                            {milestone.milestone_name}
                          </p>
                          <div className="flex items-center gap-3 text-[10px] text-gray-400">
                            <span>Actual: {formatDate(milestone.actual_completion_date)}</span>
                            <span>Expected: {formatDate(milestone.expected_completion_date)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* === Section 4: Statute of Limitations === */}
              <section>
                <SOLInfoCard loanId={loanId} className="w-full" />
              </section>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button 
            onClick={handleViewFullPage}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Full Page
          </button>
        </div>
      </div>
    </div>
  );
}