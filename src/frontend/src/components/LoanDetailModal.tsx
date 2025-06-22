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

// New interface for the timeline data
interface Milestone {
  milestone_name: string;
  actual_start_date: string | null;
  actual_completion_date: string | null;
  expected_completion_date: string | null;
}

export function LoanDetailModal({ loanId, onClose }: LoanDetailModalProps) {
  const [loan, setLoan] = useState<Loan | null>(null);
  const [timeline, setTimeline] = useState<Milestone[] | null>(null);
  const [loading, setLoading] = useState(true);

  const modalRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(modalRef, onClose);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const fetchAllDetails = async () => {
      if (!loanId) return;
      setLoading(true);
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
        // Fetch both data points in parallel
        const [loanRes, timelineRes] = await Promise.all([
          axios.get(`${apiUrl}/api/v2/loans/${loanId}`),
          axios.get(`${apiUrl}/api/loans/${loanId}/foreclosure-timeline`).catch(() => null) // Allow timeline to fail gracefully
        ]);
        setLoan(loanRes.data);
        if (timelineRes) {
          setTimeline(timelineRes.data);
        }
      } catch (error) {
        console.error('Failed to fetch loan details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllDetails();
  }, [loanId]);

  // --- Helper Functions ---
  const formatDate = (value: string | null | undefined) => {
    if (!value) return <span className="text-slate-400">N/A</span>;
    const date = new Date(value);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const correctedDate = new Date(date.getTime() + userTimezoneOffset);
    return isNaN(correctedDate.getTime()) ? "Invalid Date" : correctedDate.toLocaleDateString('en-US');
  };

  const calculateVariance = (actual: string | null, expected: string | null): React.ReactNode => {
    if (!actual || !expected) return null;
    const actualDate = new Date(actual);
    const expectedDate = new Date(expected);
    if (isNaN(actualDate.getTime()) || isNaN(expectedDate.getTime())) return null;

    const diffTime = actualDate.getTime() - expectedDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) return <span className="text-xs font-semibold text-red-600">(+{diffDays} days)</span>;
    if (diffDays < 0) return <span className="text-xs font-semibold text-green-600">({diffDays} days)</span>;
    return <span className="text-xs font-semibold text-slate-500">(On Time)</span>;
  };

  const getStatusIcon = (milestone: Milestone) => {
    if (milestone.actual_completion_date) {
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
    if (milestone.actual_start_date) {
        return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />;
    }
    return <AlertCircle className="h-5 w-5 text-slate-300" />;
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-slate-900">
            {loading ? "Loading..." : `Details for Loan: ${loan?.loan_id}`}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        <div className="flex-grow overflow-y-auto">
          {loading && <div className="p-8 text-center">Loading details...</div>}
          {!loading && loan && (
            <div className="p-6 space-y-6">
              {/* ... other sections ... */}

              {/* Foreclosure Timeline Section */}
              <section>
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mb-4">Foreclosure Timeline</h3>
                {timeline && timeline.length > 0 ? (
                  <div className="space-y-4">
                    {timeline.map((milestone, index) => (
                      <div key={index} className="flex items-start gap-4 p-3 rounded-md bg-slate-50/75">
                        <div className="mt-1">{getStatusIcon(milestone)}</div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-800">{milestone.milestone_name}</p>
                          <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                            <span>Actual: {formatDate(milestone.actual_completion_date)}</span>
                            <span>Expected: {formatDate(milestone.expected_completion_date)}</span>
                            {calculateVariance(milestone.actual_completion_date, milestone.expected_completion_date)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">No foreclosure data available for this loan.</p>
                )}
              </section>
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