// src/frontend/src/pages/LoanDetailPageCompact.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../utils/axios';
// Using modern SaaS design system from index.css
import { useToast } from '../hooks/use-toast';
import { Loan } from './LoanExplorerPage';
import StreetViewPanorama from '../components/StreetViewPanorama';
import SOLInfoCard from '../components/SOL/SOLInfoCard';
import UnifiedCollateralCard from '../components/UnifiedCollateralCard';
import EnhancedCollateralStatusCard from '../components/EnhancedCollateralStatusCard';

// Enhanced interface for detailed loan data
interface LoanDetail extends Loan {
  origination_date?: string | null;
  org_amount?: string | null;
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

interface PropertyDataResponse {
  loan_id: string;
  property_data: any;
  last_updated: string | null;
}

import { 
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
  const [loading, setLoading] = useState(true);
  const [propertyData, setPropertyData] = useState<PropertyDataResponse | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const { toast } = useToast();

  const fetchLoanDetails = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await axios.get(`${apiUrl}/api/v2/loans/${loanId}`);
      setLoan(response.data);
    } catch (error) {
      console.error('Error fetching loan details:', error);
      toast({
        title: "Error",
        description: "Failed to load loan details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPropertyData = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await axios.get(`${apiUrl}/api/v2/loans/${loanId}/property-details`);
      setPropertyData(response.data);
    } catch (error) {
      console.log('Property data not available');
    }
  };

  const fetchMilestones = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await axios.get(`${apiUrl}/api/loans/${loanId}/foreclosure-timeline`);
      setMilestones(response.data || []);
    } catch (error) {
      console.log('Milestones not available');
    }
  };

  const enrichWithRentCast = async () => {
    setIsEnriching(true);
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      await axios.post(`${apiUrl}/api/loans/${loanId}/enrich-property`);
      await fetchPropertyData();
      toast({
        title: "Property Enriched",
        description: "Property data has been updated with RentCast information.",
      });
    } catch (error) {
      console.error('Error enriching property:', error);
      toast({
        title: "Enrichment Failed",
        description: "Failed to enrich property data.",
        variant: "destructive",
      });
    } finally {
      setIsEnriching(false);
    }
  };

  useEffect(() => {
    if (loanId) {
      fetchLoanDetails();
      fetchPropertyData();
      fetchMilestones();
    }
  }, [loanId]);

  if (loading) {
    return (
      <div style={{ padding: '12px' }}>
        <div className="loading-skeleton" style={{ height: '400px', backgroundColor: 'var(--color-surface)', borderRadius: '4px' }}></div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div style={{ padding: '12px', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Loan not found.</p>
      </div>
    );
  }

  // Calculate payment history for 2025
  const paymentMonths = [
    { month: 'Jan', value: loan.january_2025 },
    { month: 'Feb', value: loan.february_2025 },
    { month: 'Mar', value: loan.march_2025 },
    { month: 'Apr', value: loan.april_2025 },
    { month: 'May', value: loan.may_2025 },
    { month: 'Jun', value: loan.june_2025 },
    { month: 'Jul', value: loan.july_2025 },
    { month: 'Aug', value: loan.august_2025 },
    { month: 'Sep', value: loan.september_2025 },
    { month: 'Oct', value: loan.october_2025 },
    { month: 'Nov', value: loan.november_2025 },
    { month: 'Dec', value: loan.december_2025 }
  ];

  const ltv = propertyData?.property_data?.price && loan.prin_bal 
    ? ((parseFloat(loan.prin_bal) / propertyData.property_data.price) * 100).toFixed(1)
    : null;

  // Calculate Legal Balance (UPB + accrued interest from next due date)
  const calculateLegalBalance = () => {
    if (!loan.prin_bal || !loan.int_rate || !loan.next_pymt_due) return null;
    
    const principal = parseFloat(loan.prin_bal);
    const annualRate = parseFloat(loan.int_rate);
    const nextDue = new Date(loan.next_pymt_due);
    const today = new Date();
    
    if (nextDue <= today) return principal; // Past due, no additional interest
    
    const daysOverdue = Math.max(0, Math.floor((today.getTime() - nextDue.getTime()) / (1000 * 60 * 60 * 24)));
    const dailyRate = annualRate / 365;
    const accruedInterest = principal * dailyRate * daysOverdue;
    
    return principal + accruedInterest;
  };

  const legalBalance = calculateLegalBalance();
  
  // Calculate estimated equity (Property Value - Legal Balance)
  const estimatedEquity = propertyData?.property_data?.price && legalBalance 
    ? propertyData.property_data.price - legalBalance
    : null;

  return (
    <div className="container mx-auto p-4 min-h-screen bg-background">
      {/* Header Section - Clean & Modern */}
      <div className="card grid grid-cols-3 gap-4 mb-6 p-6">
        <div>
          <h1 className="text-xl font-bold text-foreground mb-1">
            Loan {loanId}
          </h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{formatValue(loan.first_name)} {formatValue(loan.last_name)}</span>
            <span>•</span>
            <span>{formatValue(loan.city)}, {formatValue(loan.state)}</span>
            <span>•</span>
            <span>Status: {formatValue(loan.legal_status)}</span>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(loan.prin_bal)}
          </div>
          <div className="text-xs text-muted-foreground">
            Principal Balance
          </div>
        </div>

        <div className="text-right">
          <div className={`text-lg font-semibold ${propertyData?.property_data?.price ? 'text-success' : 'text-muted-foreground'}`}>
            {propertyData?.property_data?.price ? formatCurrency(propertyData.property_data.price) : 'N/A'}
          </div>
          <div className="text-xs text-muted-foreground">
            Property Value {ltv && `(LTV: ${ltv}%)`}
          </div>
        </div>
      </div>

      {/* Main Content Grid - Modern Layout */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        
        {/* Column 1: Financial Summary */}
        <div className="card p-6">
          <h3 className="text-xs font-semibold uppercase mb-3 pb-2 border-b border-border text-muted-foreground">
            FINANCIALS
          </h3>
          
          <div className="flex flex-col gap-3">
            <div className="py-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">ORIGINAL AMOUNT</div>
              <div className="text-sm font-semibold text-foreground">
                {formatCurrency(loan.org_amount)}
              </div>
            </div>
            
            <div className="py-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">INTEREST RATE</div>
              <div className="text-sm text-foreground">
                {loan.int_rate ? `${parseFloat(loan.int_rate).toFixed(2)}%` : 'N/A'}
              </div>
            </div>
            
            <div className="py-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">MATURITY DATE</div>
              <div className="text-sm text-foreground">
                {formatDate(loan.maturity_date)}
              </div>
            </div>
            
            <div className="py-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">LEGAL BALANCE</div>
              <div className="text-sm font-semibold text-foreground">
                {legalBalance ? formatCurrency(legalBalance.toString()) : 'N/A'}
              </div>
            </div>
            
            <div className="py-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">ESTIMATED EQUITY</div>
              <div className={`text-sm font-semibold ${
                estimatedEquity ? (estimatedEquity > 0 ? 'text-success' : 'text-danger') : 'text-foreground'
              }`}>
                {estimatedEquity ? formatCurrency(estimatedEquity.toString()) : 'N/A'}
              </div>
            </div>
            
            <div className="py-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">NPV (EST.)</div>
              <div className="text-sm text-muted-foreground">
                TBD
              </div>
            </div>
            
            <div className="py-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">IRR (EST.)</div>
              <div className="text-sm text-muted-foreground">
                TBD
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Property Summary */}
        <div className="financial-card" style={{ padding: '12px' }}>
          <h3 style={{ 
            fontSize: '11px', 
            fontWeight: '600', 
            textTransform: 'uppercase',
            margin: '0 0 8px 0',
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '4px'
          }}>
            PROPERTY
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="financial-detail-item" style={{ padding: '4px 0' }}>
              <span className="label" style={{ fontSize: '9px' }}>ADDRESS</span>
              <a 
                href={generateZillowUrl(loan)} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="financial-link"
                style={{ fontSize: '11px' }}
              >
                {`${formatValue(loan.address)}, ${formatValue(loan.city)}, ${formatValue(loan.state)}`}
              </a>
            </div>
            
            <div className="financial-detail-item" style={{ padding: '4px 0' }}>
              <span className="label" style={{ fontSize: '9px' }}>LIEN POSITION</span>
              <span className="value" style={{ fontSize: '12px' }}>
                {formatValue(loan.lien_pos)}
              </span>
            </div>
            
            {propertyData?.property_data?.priceRangeLow && (
              <div className="financial-detail-item" style={{ padding: '4px 0' }}>
                <span className="label" style={{ fontSize: '9px' }}>VALUE RANGE</span>
                <span className="value" style={{ fontSize: '11px' }}>
                  {formatCurrency(propertyData.property_data.priceRangeLow)} - {formatCurrency(propertyData.property_data.priceRangeHigh)}
                </span>
              </div>
            )}
            
            {!propertyData?.property_data && (
              <button
                onClick={enrichWithRentCast}
                disabled={isEnriching}
                style={{
                  padding: '6px 8px',
                  fontSize: '10px',
                  backgroundColor: 'var(--color-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isEnriching ? 'not-allowed' : 'pointer',
                  marginTop: '4px'
                }}
              >
                {isEnriching ? 'ENRICHING...' : 'ENRICH PROPERTY'}
              </button>
            )}
          </div>
        </div>

        {/* Column 3: SOL Info - Compact */}
        <div className="financial-card" style={{ padding: '12px' }}>
          <h3 style={{ 
            fontSize: '11px', 
            fontWeight: '600', 
            textTransform: 'uppercase',
            margin: '0 0 8px 0',
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '4px'
          }}>
            STATUTE OF LIMITATIONS
          </h3>
          <div style={{ height: '140px', overflow: 'hidden' }}>
            <SOLInfoCard loanId={loanId!} compact={true} />
          </div>
        </div>

        {/* Column 4: Payment History Compact */}
        <div className="financial-card" style={{ padding: '12px' }}>
          <h3 style={{ 
            fontSize: '11px', 
            fontWeight: '600', 
            textTransform: 'uppercase',
            margin: '0 0 8px 0',
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '4px'
          }}>
            2025 PAYMENTS
          </h3>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: '4px',
            fontSize: '9px'
          }}>
            {paymentMonths.map((month, index) => (
              <div key={index} style={{ 
                textAlign: 'center',
                padding: '3px',
                backgroundColor: month.value ? 'var(--color-success-bg)' : 'var(--color-surface)',
                borderRadius: '3px',
                border: '1px solid var(--color-border)'
              }}>
                <div style={{ fontWeight: '600' }}>{month.month}</div>
                <div style={{ 
                  color: month.value ? 'var(--color-success)' : 'var(--color-text-muted)',
                  fontSize: '8px'
                }}>
                  {month.value ? '✓' : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Second Row - Enhanced Chain Analysis */}
      <EnhancedCollateralStatusCard loanId={loanId!} />

      {/* Third Row - Unified Collateral (Upload & Document Management) */}
      <UnifiedCollateralCard loanId={loanId!} />

      {/* Fourth Row - Foreclosure Timeline (if exists) */}
      {milestones.length > 0 && (
        <div className="financial-card" style={{ padding: '12px', marginBottom: '12px' }}>
          <h3 style={{ 
            fontSize: '11px', 
            fontWeight: '600', 
            textTransform: 'uppercase',
            margin: '0 0 8px 0',
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '4px'
          }}>
            FORECLOSURE TIMELINE
          </h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '8px' 
          }}>
            {milestones.map((milestone, index) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px',
                borderRadius: '4px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: '10px'
              }}>
                <div>{getStatusIcon(milestone)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500' }}>{milestone.milestone_name}</div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '9px' }}>
                    {formatDate(milestone.actual_completion_date) || formatDate(milestone.expected_completion_date)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Street View - Compact */}
      {propertyData?.property_data?.latitude && propertyData?.property_data?.longitude && (
        <div style={{ marginBottom: '12px' }}>
          <StreetViewPanorama 
            lat={propertyData.property_data.latitude} 
            lng={propertyData.property_data.longitude} 
          />
        </div>
      )}

    </div>
  );
};

export default LoanDetailPage;