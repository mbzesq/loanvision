// src/frontend/src/pages/LoanDetailPage.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@loanvision/shared/components/ui/card';
import { Loan } from './LoanExplorerPage';
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

const LoanDetailPage = () => {
  const { loanId } = useParams<{ loanId: string }>();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [timeline, setTimeline] = useState<Milestone[]>([]);
  const [propertyData, setPropertyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllDetails = async () => {
      if (!loanId) return;
      setLoading(true);
      setError(null);
      
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
        
        // Fetch all data points in parallel
        const [loanRes, timelineRes, propertyRes] = await Promise.all([
          axios.get(`${apiUrl}/api/v2/loans/${loanId}`),
          axios.get(`${apiUrl}/api/loans/${loanId}/foreclosure-timeline`).catch(() => ({ data: [] })),
          axios.get(`${apiUrl}/api/v2/loans/${loanId}/property-details`).catch(() => ({ data: null }))
        ]);
        
        setLoan(loanRes.data);
        setTimeline(timelineRes.data);
        setPropertyData(propertyRes.data);
      } catch (error) {
        console.error('Failed to fetch loan details:', error);
        setError('Failed to load loan details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchAllDetails();
  }, [loanId]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="h-48 bg-slate-200 rounded"></div>
              <div className="h-48 bg-slate-200 rounded"></div>
              <div className="h-32 bg-slate-200 rounded"></div>
            </div>
            <div className="space-y-6">
              <div className="h-64 bg-slate-200 rounded"></div>
              <div className="h-32 bg-slate-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Loan Details</h1>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Loan Details</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-600">Loan not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Loan Details: {loanId}</h1>
        <p className="text-slate-600 mt-1">
          Comprehensive view of loan {loanId} for {loan.first_name} {loan.last_name}
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Primary Info */}
        <div className="space-y-6">
          {/* Loan & Property Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Loan & Property</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Borrower Section */}
              <div>
                <h4 className="text-sm font-semibold text-slate-600 border-b pb-2 mb-3">Borrower Information</h4>
                <div className="space-y-4">
                  <DetailItem label="Borrower Name">
                    {`${loan.first_name} ${loan.last_name}`}
                  </DetailItem>
                  <DetailItem label="Investor">
                    <button 
                      onClick={() => handleInvestorClick(loan.investor_name)} 
                      className="text-blue-600 hover:underline font-medium text-left"
                    >
                      {formatValue(loan.investor_name)}
                    </button>
                  </DetailItem>
                </div>
              </div>

              {/* Property Section */}
              <div>
                <h4 className="text-sm font-semibold text-slate-600 border-b pb-2 mb-3">Property & Collateral</h4>
                <div className="space-y-4">
                  <DetailItem label="Property Address">
                    <a 
                      href={generateZillowUrl(loan)} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:underline"
                    >
                      {`${formatValue(loan.address)}, ${formatValue(loan.city)}, ${formatValue(loan.state)} ${formatValue(loan.zip)}`}
                    </a>
                  </DetailItem>
                  <DetailItem label="Lien Position">{formatValue(loan.lien_pos)}</DetailItem>
                  <DetailItem label="Loan Type">{formatValue(loan.loan_type)}</DetailItem>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financials Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Financials</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <DetailItem label="UPB">
                    <span className="text-xl font-bold text-green-600">
                      {formatCurrency(loan.prin_bal)}
                    </span>
                  </DetailItem>
                  <DetailItem label="Interest Rate">
                    <span className="text-lg font-semibold">
                      {formatPercent(loan.int_rate)}
                    </span>
                  </DetailItem>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <DetailItem label="Last Payment">{formatDate(loan.last_pymt_received)}</DetailItem>
                  <DetailItem label="Next Due Date">{formatDate(loan.next_pymt_due)}</DetailItem>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <DetailItem label="Legal Status">{formatValue(loan.legal_status)}</DetailItem>
                  <DetailItem label="Maturity Date">{formatDate(loan.maturity_date)}</DetailItem>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Credit Data Placeholder Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Credit Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-slate-500">Credit report integration is coming soon.</p>
                <p className="text-sm text-slate-400 mt-2">
                  This section will include credit scores, payment history, and bureau reports.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Ancillary Info */}
        <div className="space-y-6">
          {/* Foreclosure Timeline Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Foreclosure Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {timeline && timeline.length > 0 ? (
                <div className="space-y-3">
                  {timeline.map((milestone, index) => (
                    <div key={index} className="flex items-center gap-4 p-3 rounded-md hover:bg-slate-50 border border-slate-100">
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
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-500">No foreclosure timeline data available.</p>
                  <p className="text-sm text-slate-400 mt-2">
                    Timeline will appear when foreclosure proceedings begin.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Property Enrichment Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Property Enrichment</CardTitle>
            </CardHeader>
            <CardContent>
              {propertyData ? (
                <div>
                  <div className="mb-4">
                    <p className="text-sm text-slate-600 mb-2">Enrichment data available. Key insights:</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500">Data Points:</span>
                        <span className="ml-2 font-medium">{Object.keys(propertyData).length}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Source:</span>
                        <span className="ml-2 font-medium">External API</span>
                      </div>
                    </div>
                  </div>
                  <details className="mt-4">
                    <summary className="text-sm text-blue-600 cursor-pointer hover:underline">
                      View Raw Data
                    </summary>
                    <pre className="text-xs whitespace-pre-wrap break-all mt-2 p-3 bg-slate-50 rounded border max-h-64 overflow-y-auto">
                      {JSON.stringify(propertyData, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-500">No property enrichment data available.</p>
                  <p className="text-sm text-slate-400 mt-2">
                    Property data will be enriched from external sources when available.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LoanDetailPage;