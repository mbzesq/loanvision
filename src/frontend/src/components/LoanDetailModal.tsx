// src/frontend/src/components/LoanDetailModal.tsx
import { useEffect, useState, useRef } from 'react';
import { Button } from '@loanvision/shared/components/ui/button';
import { Loan } from '../pages/LoanExplorerPage';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { X, CheckCircle2, Clock } from 'lucide-react';
import axios from 'axios';

interface LoanDetailModalProps {
  loanId: string;
  onClose: () => void;
}

interface Milestone {
  milestone_name: string;
  actual_completion_date: string | null;
  expected_completion_date: string | null;
}

const DetailItem = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-sm text-slate-500">{label}</p>
    <div className="font-medium text-slate-900 mt-1">{children}</div>
  </div>
);

export function LoanDetailModal({ loanId, onClose }: LoanDetailModalProps) {
  const [loan, setLoan] = useState<Loan | null>(null);
  const [timeline, setTimeline] = useState<Milestone[] | null>(null);
  const [loading, setLoading] = useState(true);

  const modalRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(modalRef, onClose);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const fetchAllDetails = async () => {
      if (!loanId) return;
      setLoading(true);
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
        const [loanRes, timelineRes] = await Promise.all([
          axios.get(`${apiUrl}/api/v2/loans/${loanId}`),
          axios.get(`${apiUrl}/api/loans/${loanId}/foreclosure-timeline`).catch((error) => {
            console.error('Error fetching foreclosure timeline:', error.response?.status, error.response?.data || error.message);
            return null;
          })
        ]);
        setLoan(loanRes.data);
        if (timelineRes && timelineRes.data) {
          setTimeline(Array.isArray(timelineRes.data) ? timelineRes.data : []);
          console.log('Timeline data received:', timelineRes.data);
        } else {
          console.log('No timeline data available for loan:', loanId);
        }
      } catch (error) {
        console.error('Failed to fetch loan details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllDetails();
  }, [loanId]);

  const formatDate = (value: any): string => {
    if (!value) return "—";
    const date = new Date(value);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const correctedDate = new Date(date.getTime() + userTimezoneOffset);
    return isNaN(correctedDate.getTime()) ? "—" : correctedDate.toLocaleDateString('en-US');
  };

  const formatCurrency = (value: any) => !value ? "—" : parseFloat(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const formatPercent = (value: any) => !value ? "—" : `${(parseFloat(value) * 100).toFixed(2)}%`;
  const formatValue = (value: any) => value || "—";
  const generateZillowUrl = (l: Loan) => `https://www.zillow.com/homes/${encodeURIComponent(`${l.address}, ${l.city}, ${l.state} ${l.zip}`)}`;
  const handleInvestorClick = (name: string) => alert(`Investor view for ${name} coming soon!`);
  const getStatusIcon = (m: Milestone) => m.actual_completion_date ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Clock className="h-5 w-5 text-slate-400" />;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-slate-900">
            {loading ? "Loading..." : `Details for Loan: ${loan?.loan_id}`}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        <div className="flex-grow overflow-y-auto p-6">
          {loading && <div className="text-center">Loading details...</div>}
          {!loading && loan && (
            <div className="space-y-8">
              <section className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div>
                  <h3 className="text-base font-semibold text-slate-600 border-b pb-2 mb-3">Loan & Borrower</h3>
                  <div className="space-y-3">
                    <DetailItem label="Borrower Name">{`${loan.first_name} ${loan.last_name}`}</DetailItem>
                    <DetailItem label="Investor"><button onClick={() => handleInvestorClick(loan.investor_name)} className="text-blue-600 hover:underline font-medium text-left">{formatValue(loan.investor_name)}</button></DetailItem>
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-600 border-b pb-2 mb-3">Property & Collateral</h3>
                   <div className="space-y-3">
                    <DetailItem label="Property Address"><a href={generateZillowUrl(loan)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{formatValue(loan.address)}</a></DetailItem>
                    <DetailItem label="Lien Position">{formatValue(loan.lien_pos)}</DetailItem>
                  </div>
                </div>
              </section>
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
              {timeline && timeline.length > 0 && (
                <section>
                  <h3 className="text-base font-semibold text-slate-600 border-b pb-2 mb-3">Foreclosure Timeline</h3>
                  <div className="space-y-3">
                    {timeline.map((milestone, index) => (
                      <div key={index} className="flex items-center gap-4">
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
            </div>
          )}
        </div>
        <div className="flex justify-end items-center p-4 border-t gap-2 bg-slate-50">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button disabled>Manage</Button>
        </div>
      </div>
    </div>
  );
}