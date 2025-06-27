// src/frontend/src/pages/LoanDetailPage.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { differenceInMonths } from 'date-fns';
import { CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@loanvision/shared/components/ui/card';
import { Button } from '@loanvision/shared/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@loanvision/shared/components/ui/accordion';
import { useToast } from '@loanvision/shared/hooks/use-toast';
import { Loan } from './LoanExplorerPage';

// Enhanced interface for detailed loan data including origination and payment history
interface LoanDetail extends Loan {
  origination_date?: string | null;
  org_amount?: string | null;
  // Payment history columns for 2025
  january_2025?: number | null;
  february_2025?: number | null;
  march_2025?: number | null;
  april_2025?: number | null;
  may_2025?: number | null;
  june_2025?: number | null;
  july_2025?: number | null;
  august_2025?: number | null;
  september_2025?: number | null;
  october_2025?: number | null;
  november_2025?: number | null;
  december_2025?: number | null;
}

// Enhanced property data response interface
interface PropertyDataResponse {
  loan_id: string;
  property_data: any; // Keep as 'any' for now since RentCast returns varied structures
  last_updated: string | null;
}
import { 
  DetailItem, 
  Milestone, 
  formatCurrency, 
  formatDate, 
  formatValue,
  generateZillowUrl,
  getStatusIcon
} from '../lib/loanUtils';

const LoanDetailPage = () => {
  const { loanId } = useParams<{ loanId: string }>();
  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [timeline, setTimeline] = useState<Milestone[]>([]);
  const [propertyData, setPropertyData] = useState<PropertyDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const { toast } = useToast();

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

  // Helper function to check if borrower name and owner name are similar
  const areNamesSimilar = (borrowerFirstName: string, borrowerLastName: string, ownerName: string): boolean => {
    if (!borrowerFirstName || !borrowerLastName || !ownerName) return false;
    
    // Clean names: lowercase, remove periods and extra spaces
    const cleanName = (name: string) => name.toLowerCase().replace(/\./g, '').trim();
    
    const cleanBorrowerFirst = cleanName(borrowerFirstName);
    const cleanBorrowerLast = cleanName(borrowerLastName);
    const cleanOwnerName = cleanName(ownerName);
    
    // Check if owner name includes borrower's first or last name
    return cleanOwnerName.includes(cleanBorrowerFirst) || cleanOwnerName.includes(cleanBorrowerLast);
  };

  const handleEnrichData = async () => {
    if (!loanId) return;
    
    setIsEnriching(true);
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await axios.post(`${apiUrl}/api/v2/loans/${loanId}/enrich`);
      
      // Update property data state with the new data
      setPropertyData({
        loan_id: loanId,
        property_data: response.data.property_data,
        last_updated: new Date().toISOString()
      });
      
      toast({
        title: "Enrichment Successful",
        description: "Property data has been successfully enriched with RentCast data.",
      });
    } catch (error) {
      console.error('Error enriching property data:', error);
      
      let errorMessage = 'Failed to enrich property data';
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      toast({
        title: "Enrichment Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsEnriching(false);
    }
  };

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

  // Calculate financial metrics
  const intRate = parseFloat(loan.int_rate);
  const displayRate = intRate < 1 ? intRate * 100 : intRate;
  const monthsPastDue = loan.next_pymt_due ? differenceInMonths(new Date(), new Date(loan.next_pymt_due)) : 0;
  const accruedInterest = monthsPastDue > 0 ? parseFloat(loan.prin_bal) * (intRate / 12) * monthsPastDue : 0;
  const legalBalance = parseFloat(loan.prin_bal) + accruedInterest;
  const equity = propertyData?.property_data?.price ? propertyData.property_data.price - legalBalance : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Loan Details: {loanId}</h1>
        <p className="text-slate-600 mt-1">
          Comprehensive view of loan {loanId} for {loan.first_name} {loan.last_name}
        </p>
      </div>

      {/* Three-column grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Takes 2 columns on large screens */}
        <div className="lg:col-span-2 space-y-6">
          {/* Loan Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Loan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailItem label="Borrower Name">
                  {`${loan.first_name} ${loan.last_name}`}
                </DetailItem>
                <DetailItem label="Co-Borrower Name">
                  N/A
                </DetailItem>
                <DetailItem label="Loan Number">
                  {loan.loan_id}
                </DetailItem>
                <DetailItem label="Origination Date">
                  {formatDate(loan.origination_date)}
                </DetailItem>
                <DetailItem label="Origination Balance">
                  {formatCurrency(loan.org_amount || '0')}
                </DetailItem>
                <DetailItem label="Maturity Date">
                  {formatDate(loan.maturity_date)}
                </DetailItem>
                <DetailItem label="Last Paid Date">
                  {formatDate(loan.last_pymt_received)}
                </DetailItem>
                <DetailItem label="Next Due Date">
                  {formatDate(loan.next_pymt_due)}
                </DetailItem>
                <DetailItem label="Legal Status">
                  {formatValue(loan.legal_status)}
                </DetailItem>
                <DetailItem label="Lien Position">
                  {formatValue(loan.lien_pos)}
                </DetailItem>
              </div>
            </CardContent>
          </Card>

          {/* Financials Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Financials</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <DetailItem label="Current Unpaid Principal Balance">
                  <span className="text-xl font-bold text-green-600">
                    {formatCurrency(loan.prin_bal)}
                  </span>
                </DetailItem>
                <DetailItem label="Interest Rate">
                  <span className="text-lg font-semibold">
                    {displayRate.toFixed(2)}%
                  </span>
                </DetailItem>
                <DetailItem label="Current Legal Balance">
                  <span className="text-xl font-bold text-blue-600">
                    {formatCurrency(legalBalance.toFixed(2))}
                  </span>
                </DetailItem>
                <DetailItem label="NPV">
                  <span className="text-slate-500 italic">Calculation coming soon</span>
                </DetailItem>
                <DetailItem label="IRR">
                  <span className="text-slate-500 italic">Calculation coming soon</span>
                </DetailItem>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Takes 1 column on large screens */}
        <div className="lg:col-span-1 space-y-6">
          {/* Conditionally render Foreclosure Timeline Card */}
          {timeline && timeline.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Foreclosure Timeline</CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          )}

          {/* Property Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Property</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-pulse">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mx-auto mb-2"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto"></div>
                  </div>
                </div>
              ) : propertyData ? (
                <div className="space-y-4">
                  <DetailItem label={`Value Estimate ${propertyData?.last_updated ? `(${formatDate(propertyData.last_updated)})` : ''}`}>
                    <span className="text-xl font-bold text-green-600">
                      {formatCurrency(propertyData?.property_data?.price || 0)}
                    </span>
                  </DetailItem>
                  
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
                  
                  <DetailItem label="Value Range">
                    <span className="text-lg font-semibold">
                      {propertyData?.property_data?.priceRangeLow && propertyData?.property_data?.priceRangeHigh 
                        ? `${formatCurrency(propertyData.property_data.priceRangeLow)} - ${formatCurrency(propertyData.property_data.priceRangeHigh)}`
                        : 'N/A'
                      }
                    </span>
                  </DetailItem>
                  
                  <DetailItem label="Owner Occupied">
                    {propertyData?.property_data?.ownerOccupied !== undefined 
                      ? (propertyData.property_data.ownerOccupied ? 'Yes' : 'No')
                      : 'N/A'
                    }
                  </DetailItem>
                  
                  <DetailItem label="External Link">
                    <a 
                      href={`https://www.zillow.com/homes/${encodeURIComponent(propertyData?.property_data?.formattedAddress || `${loan.address} ${loan.city} ${loan.state} ${loan.zip}`)}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View on Zillow
                    </a>
                  </DetailItem>
                  
                  <DetailItem label="Owner Name">
                    <div className="flex items-center gap-2">
                      <span>{propertyData?.property_data?.owner?.names?.[0] || 'N/A'}</span>
                      {propertyData?.property_data?.owner?.names?.[0] && 
                       areNamesSimilar(loan.first_name, loan.last_name, propertyData.property_data.owner.names[0]) && (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                  </DetailItem>
                  
                  <DetailItem label="Equity Value">
                    <span className="text-lg font-bold text-indigo-600">
                      {formatCurrency(equity.toFixed(2))}
                    </span>
                  </DetailItem>
                  
                  {/* Refresh Button */}
                  <div className="pt-4 border-t">
                    <Button 
                      onClick={handleEnrichData}
                      disabled={isEnriching}
                      variant="outline"
                      size="sm"
                    >
                      {isEnriching ? 'Refreshing...' : 'Refresh Data'}
                    </Button>
                  </div>
                  
                  {/* Raw Data Accordion */}
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="raw-data">
                      <AccordionTrigger className="text-sm">
                        View Raw API Data
                      </AccordionTrigger>
                      <AccordionContent>
                        <pre className="text-xs whitespace-pre-wrap break-all p-3 bg-slate-50 rounded border max-h-64 overflow-y-auto">
                          {JSON.stringify(propertyData?.property_data, null, 2)}
                        </pre>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-500 mb-4">No enrichment data found.</p>
                  <p className="text-sm text-slate-400 mb-6">
                    Enrich this property with real-time valuation and market data from RentCast.
                  </p>
                  <Button 
                    onClick={handleEnrichData}
                    disabled={isEnriching}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {isEnriching ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Enriching...
                      </>
                    ) : (
                      'Enrich with RentCast'
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Full width Credit Data Card at bottom */}
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
  );
};

export default LoanDetailPage;