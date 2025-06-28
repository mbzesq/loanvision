// src/frontend/src/pages/LoanDetailPage.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@loanvision/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@loanvision/shared/components/ui/card';
import { Loan } from './LoanExplorerPage';
import { ArrowLeft, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { getMilestoneStatus } from '../lib/timelineUtils';
import StreetViewPanorama from '../components/StreetViewPanorama';

// Interface for the timeline data from the backend
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

const LoanDetailPage = () => {
  const { loanId } = useParams<{ loanId: string }>();
  const navigate = useNavigate();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [timeline, setTimeline] = useState<Milestone[]>([]);
  const [propertyData, setPropertyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch property data function
  const fetchPropertyData = async (loanId: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await axios.get(`${apiUrl}/api/v2/loans/${loanId}/property-details`);
      console.log('Property data fetched:', response.data);
      setPropertyData(response.data);
    } catch (error) {
      console.error('Failed to fetch property data:', error);
      // Don't fail the entire page if property data is not available
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
  const getStatusIcon = (milestone: Milestone) => {
    const status = getMilestoneStatus(milestone.actual_completion_date, milestone.expected_completion_date);

    if (status === 'COMPLETED_ON_TIME') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (status === 'COMPLETED_LATE' || status === 'PENDING_OVERDUE') return <AlertCircle className="h-5 w-5 text-red-500" />;
    return <Clock className="h-5 w-5 text-slate-400" />;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center p-8">Loading loan details...</div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center p-8 text-red-600">Failed to load loan details.</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate('/loans')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loan Details</h1>
          <p className="text-gray-600">Loan ID: {loan.loan_id}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* === Section 1: Borrower & Property === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Loan & Borrower</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailItem label="Borrower Name">{`${loan.first_name} ${loan.last_name}`}</DetailItem>
              <DetailItem label="Investor">
                <button 
                  onClick={() => handleInvestorClick(loan.investor_name)} 
                  className="text-blue-600 hover:underline font-medium text-left"
                >
                  {formatValue(loan.investor_name)}
                </button>
              </DetailItem>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Property</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                {propertyData?.property_data?.latitude && propertyData?.property_data?.longitude ? (
                  <StreetViewPanorama 
                    lat={propertyData.property_data.latitude} 
                    lng={propertyData.property_data.longitude} 
                  />
                ) : (
                  <div className="flex items-center justify-center h-[300px] bg-slate-100 rounded-md">
                    <p className="text-sm text-slate-500">Street View not available.</p>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <DetailItem label="Property Address">
                  <a 
                    href={generateZillowUrl(loan)} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-600 hover:underline"
                  >
                    {`${formatValue(loan.address)}, ${formatValue(loan.city)}, ${formatValue(loan.state)}`}
                  </a>
                </DetailItem>
                <DetailItem label="Lien Position">{formatValue(loan.lien_pos)}</DetailItem>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* === Section 2: Financials & Status === */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Financials & Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-4">
              <DetailItem label="UPB">
                <span className="text-xl font-bold">{formatCurrency(loan.prin_bal)}</span>
              </DetailItem>
              <DetailItem label="Interest Rate">{formatPercent(loan.int_rate)}</DetailItem>
              <DetailItem label="Legal Status">{formatValue(loan.legal_status)}</DetailItem>
              <DetailItem label="Last Paid">{formatDate(loan.last_pymt_received)}</DetailItem>
              <DetailItem label="Next Due">{formatDate(loan.next_pymt_due)}</DetailItem>
            </div>
          </CardContent>
        </Card>

        {/* === Section 3: Foreclosure Timeline === */}
        {timeline && timeline.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Foreclosure Timeline</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}

        {/* === Section 4: Property Enrichment Data (Validation) === */}
        {propertyData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enrichment Data (Validation)</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs whitespace-pre-wrap break-all bg-gray-50 p-4 rounded">
                {JSON.stringify(propertyData, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LoanDetailPage;