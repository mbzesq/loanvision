// src/frontend/src/pages/LoanDetailPage.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { differenceInDays } from 'date-fns';
import { CheckCircle } from 'lucide-react';
import '../styles/financial-design-system.css';
import { useToast } from '../hooks/use-toast';
import { Loan } from './LoanExplorerPage';
import StreetViewPanorama from '../components/StreetViewPanorama';
import { DocumentAnalysisCard } from '../components/DocumentAnalysisCard';
import SOLInfoCard from '../components/SOL/SOLInfoCard';

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
      <div style={{ 
        padding: '12px', 
        minHeight: '100vh',
        backgroundColor: 'var(--color-background)'
      }}>
        <div className="loading-skeleton">
          <div style={{ 
            height: '32px', 
            backgroundColor: 'var(--color-surface)', 
            borderRadius: '4px',
            width: '33%',
            marginBottom: '24px'
          }}></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ height: '192px', backgroundColor: 'var(--color-surface)', borderRadius: '4px' }}></div>
              <div style={{ height: '192px', backgroundColor: 'var(--color-surface)', borderRadius: '4px' }}></div>
              <div style={{ height: '128px', backgroundColor: 'var(--color-surface)', borderRadius: '4px' }}></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ height: '256px', backgroundColor: 'var(--color-surface)', borderRadius: '4px' }}></div>
              <div style={{ height: '128px', backgroundColor: 'var(--color-surface)', borderRadius: '4px' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '12px', 
        minHeight: '100vh',
        backgroundColor: 'var(--color-background)'
      }}>
        <h1 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          color: 'var(--color-text)',
          marginBottom: '16px',
          textTransform: 'uppercase'
        }}>Loan Details</h1>
        <div className="financial-card" style={{ 
          backgroundColor: 'var(--color-danger-bg)',
          border: '1px solid var(--color-danger)',
          padding: '12px'
        }}>
          <p style={{ color: 'var(--color-danger)', fontSize: '12px' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div style={{ 
        padding: '12px', 
        minHeight: '100vh',
        backgroundColor: 'var(--color-background)'
      }}>
        <h1 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          color: 'var(--color-text)',
          marginBottom: '16px',
          textTransform: 'uppercase'
        }}>Loan Details</h1>
        <div className="financial-card" style={{ 
          backgroundColor: 'var(--color-warning-bg)',
          border: '1px solid var(--color-warning)',
          padding: '12px'
        }}>
          <p style={{ color: 'var(--color-warning)', fontSize: '12px' }}>Loan not found.</p>
        </div>
      </div>
    );
  }

  // Calculate financial metrics
  let legalBalance = parseFloat(loan.prin_bal) || 0;

  if (loan.next_pymt_due && loan.int_rate && loan.prin_bal) {
    const today = new Date();
    const nextDueDate = new Date(loan.next_pymt_due);

    // Only calculate interest if the due date is in the past
    if (today > nextDueDate) {
      const daysPastDue = differenceInDays(today, nextDueDate);
      const dailyRate = parseFloat(loan.int_rate) / 365.25;
      const accruedInterest = parseFloat(loan.prin_bal) * dailyRate * daysPastDue;
      legalBalance += accruedInterest;
    }
  }
  
  const equity = propertyData?.property_data?.price ? propertyData.property_data.price - legalBalance : 0;

  return (
    <div style={{ 
      padding: '12px', 
      minHeight: '100vh',
      backgroundColor: 'var(--color-background)'
    }}>
      {/* Quick Stats Header */}
      <div className="quick-stats" style={{ marginBottom: '16px' }}>
        <div className="quick-stat">
          <span className="label">LOAN ID</span>
          <span className="value">{loanId}</span>
        </div>
        <div className="quick-stat">
          <span className="label">BORROWER</span>
          <span className="value">{loan.first_name} {loan.last_name}</span>
        </div>
        <div className="quick-stat">
          <span className="label">STATUS</span>
          <span className="value status-indicator">{loan.legal_status || 'UNKNOWN'}</span>
        </div>
        <div className="quick-stat">
          <span className="label">BALANCE</span>
          <span className="value">{formatCurrency(loan.prin_bal)}</span>
        </div>
      </div>

      {/* Three-column grid layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
        {/* Left Column - Takes 2 columns on large screens */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Loan Card */}
          <div className="financial-card">
            <div style={{ 
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: '8px',
              marginBottom: '12px'
            }}>
              <h3 style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
                LOAN DETAILS
              </h3>
            </div>
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="financial-detail-item">
                  <span className="label">BORROWER NAME</span>
                  <span className="value">{`${loan.first_name} ${loan.last_name}`}</span>
                </div>
                <div className="financial-detail-item">
                  <span className="label">CO-BORROWER NAME</span>
                  <span className="value">N/A</span>
                </div>
                <div className="financial-detail-item">
                  <span className="label">LOAN NUMBER</span>
                  <span className="value">{loan.loan_id}</span>
                </div>
                <div className="financial-detail-item">
                  <span className="label">ORIGINATION DATE</span>
                  <span className="value">{formatDate(loan.origination_date)}</span>
                </div>
                <div className="financial-detail-item">
                  <span className="label">ORIGINATION BALANCE</span>
                  <span className="value">{formatCurrency(loan.org_amount || '0')}</span>
                </div>
                <div className="financial-detail-item">
                  <span className="label">MATURITY DATE</span>
                  <span className="value">{formatDate(loan.maturity_date)}</span>
                </div>
                <div className="financial-detail-item">
                  <span className="label">LAST PAID DATE</span>
                  <span className="value">{formatDate(loan.last_pymt_received)}</span>
                </div>
                <div className="financial-detail-item">
                  <span className="label">NEXT DUE DATE</span>
                  <span className="value">{formatDate(loan.next_pymt_due)}</span>
                </div>
                <div className="financial-detail-item">
                  <span className="label">LEGAL STATUS</span>
                  <span className="value">{formatValue(loan.legal_status)}</span>
                </div>
                <div className="financial-detail-item">
                  <span className="label">LIEN POSITION</span>
                  <span className="value">{formatValue(loan.lien_pos)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Financials Card */}
          <div className="financial-card">
            <div style={{ 
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: '8px',
              marginBottom: '12px'
            }}>
              <h3 style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
                FINANCIALS
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="financial-detail-item">
                <span className="label">CURRENT UNPAID PRINCIPAL BALANCE</span>
                <span className="value" style={{ 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: 'var(--color-success)' 
                }}>
                  {formatCurrency(loan.prin_bal)}
                </span>
              </div>
              <div className="financial-detail-item">
                <span className="label">INTEREST RATE</span>
                <span className="value" style={{ fontSize: '14px', fontWeight: '500' }}>
                  {loan.int_rate ? `${(parseFloat(loan.int_rate) * 100).toFixed(2)}%` : 'N/A'}
                </span>
              </div>
              <div className="financial-detail-item">
                <span className="label">CURRENT LEGAL BALANCE</span>
                <span className="value" style={{ 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: 'var(--color-primary)' 
                }}>
                  {formatCurrency(legalBalance.toFixed(2))}
                </span>
              </div>
              <div className="financial-detail-item">
                <span className="label">NPV</span>
                <span className="value" style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Calculation coming soon</span>
              </div>
              <div className="financial-detail-item">
                <span className="label">IRR</span>
                <span className="value" style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Calculation coming soon</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Takes 1 column on large screens */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Conditionally render Foreclosure Timeline Card */}
          {timeline && timeline.length > 0 && (
            <div className="financial-card">
              <div style={{ 
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: '8px',
                marginBottom: '12px'
              }}>
                <h3 style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
                  FORECLOSURE TIMELINE
                </h3>
              </div>
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {timeline.map((milestone, index) => (
                    <div key={index} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px', 
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)'
                    }}>
                      <div>{getStatusIcon(milestone)}</div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: '500', fontSize: '11px', color: 'var(--color-text)' }}>
                          {milestone.milestone_name}
                        </p>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '12px', 
                          fontSize: '10px', 
                          color: 'var(--color-text-muted)', 
                          marginTop: '2px' 
                        }}>
                          <span>Actual: {formatDate(milestone.actual_completion_date)}</span>
                          <span>Expected: {formatDate(milestone.expected_completion_date)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Property Card */}
          <div className="financial-card">
            <div style={{ 
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: '8px',
              marginBottom: '12px'
            }}>
              <h3 style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
                PROPERTY
              </h3>
            </div>
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div className="loading-skeleton">
                    <div style={{ height: '12px', backgroundColor: 'var(--color-surface)', borderRadius: '4px', width: '75%', margin: '0 auto 8px' }}></div>
                    <div style={{ height: '12px', backgroundColor: 'var(--color-surface)', borderRadius: '4px', width: '50%', margin: '0 auto' }}></div>
                  </div>
                </div>
              ) : propertyData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Dynamic Street View Panorama */}
                  {propertyData?.property_data?.latitude && propertyData?.property_data?.longitude ? (
                    <div style={{ marginBottom: '12px' }}>
                      <StreetViewPanorama 
                        lat={propertyData.property_data.latitude} 
                        lng={propertyData.property_data.longitude} 
                      />
                    </div>
                  ) : (
                    <div style={{ 
                      marginBottom: '12px', 
                      padding: '12px', 
                      textAlign: 'center', 
                      backgroundColor: 'var(--color-surface)', 
                      borderRadius: '4px' 
                    }}>
                      <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Street View not available.</p>
                    </div>
                  )}

                  <div className="financial-detail-item">
                    <span className="label">VALUE ESTIMATE {propertyData?.last_updated ? `(${formatDate(propertyData.last_updated)})` : ''}</span>
                    <span className="value" style={{ 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      color: 'var(--color-success)' 
                    }}>
                      {formatCurrency(propertyData?.property_data?.price || 0)}
                    </span>
                  </div>
                  
                  <div className="financial-detail-item">
                    <span className="label">PROPERTY ADDRESS</span>
                    <a 
                      href={generateZillowUrl(loan)} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="financial-link"
                    >
                      {`${formatValue(loan.address)}, ${formatValue(loan.city)}, ${formatValue(loan.state)} ${formatValue(loan.zip)}`}
                    </a>
                  </div>
                  
                  <div className="financial-detail-item">
                    <span className="label">VALUE RANGE</span>
                    <span className="value" style={{ fontSize: '14px', fontWeight: '500' }}>
                      {propertyData?.property_data?.priceRangeLow && propertyData?.property_data?.priceRangeHigh 
                        ? `${formatCurrency(propertyData.property_data.priceRangeLow)} - ${formatCurrency(propertyData.property_data.priceRangeHigh)}`
                        : 'N/A'
                      }
                    </span>
                  </div>
                  
                  <div className="financial-detail-item">
                    <span className="label">OWNER OCCUPIED</span>
                    <span className="value">
                      {propertyData?.property_data?.ownerOccupied !== undefined 
                        ? (propertyData.property_data.ownerOccupied ? 'Yes' : 'No')
                        : 'N/A'
                      }
                    </span>
                  </div>
                  
                  <div className="financial-detail-item">
                    <span className="label">EXTERNAL LINK</span>
                    <a 
                      href={`https://www.zillow.com/homes/${encodeURIComponent(propertyData?.property_data?.formattedAddress || `${loan.address} ${loan.city} ${loan.state} ${loan.zip}`)}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="financial-link"
                    >
                      View on Zillow
                    </a>
                  </div>
                  
                  <div className="financial-detail-item">
                    <span className="label">OWNER NAME</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="value">{propertyData?.property_data?.owner?.names?.[0] || 'N/A'}</span>
                      {propertyData?.property_data?.owner?.names?.[0] && 
                       areNamesSimilar(loan.first_name, loan.last_name, propertyData.property_data.owner.names[0]) && (
                        <CheckCircle style={{ width: '12px', height: '12px', color: 'var(--color-success)' }} />
                      )}
                    </div>
                  </div>
                  
                  <div className="financial-detail-item">
                    <span className="label">EQUITY VALUE</span>
                    <span className="value" style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: 'var(--color-primary)' 
                    }}>
                      {formatCurrency(equity.toFixed(2))}
                    </span>
                  </div>
                  
                  {/* Refresh Button */}
                  <div style={{ 
                    paddingTop: '12px', 
                    borderTop: '1px solid var(--color-border)' 
                  }}>
                    <button 
                      onClick={handleEnrichData}
                      disabled={isEnriching}
                      className="btn-compact btn-secondary"
                    >
                      {isEnriching ? 'REFRESHING...' : 'REFRESH DATA'}
                    </button>
                  </div>
                  
                  {/* Raw Data Accordion */}
                  <details style={{ marginTop: '12px' }}>
                    <summary style={{ 
                      fontSize: '11px', 
                      fontWeight: '500', 
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      padding: '4px 0',
                      borderBottom: '1px solid var(--color-border)'
                    }}>
                      VIEW RAW API DATA
                    </summary>
                    <pre style={{ 
                      fontSize: '10px', 
                      whiteSpace: 'pre-wrap', 
                      wordBreak: 'break-all', 
                      padding: '8px', 
                      backgroundColor: 'var(--color-surface)', 
                      borderRadius: '4px', 
                      border: '1px solid var(--color-border)', 
                      maxHeight: '256px', 
                      overflowY: 'auto',
                      marginTop: '8px'
                    }}>
                      {JSON.stringify(propertyData?.property_data, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <p style={{ color: 'var(--color-text-muted)', marginBottom: '12px', fontSize: '12px' }}>No enrichment data found.</p>
                  <p style={{ 
                    fontSize: '11px', 
                    color: 'var(--color-text-secondary)', 
                    marginBottom: '16px' 
                  }}>
                    Enrich this property with real-time valuation and market data from RentCast.
                  </p>
                  <button 
                    onClick={handleEnrichData}
                    disabled={isEnriching}
                    className="btn-compact btn-primary"
                  >
                    {isEnriching ? (
                      <>
                        <div className="loading-spinner"></div>
                        ENRICHING...
                      </>
                    ) : (
                      'ENRICH WITH RENTCAST'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full width SOL Card */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <SOLInfoCard loanId={loanId!} />
        
        {/* Empty space for second column - can add another card here later */}
        <div></div>
      </div>

      {/* Full width Collateral Documents Card */}
      <DocumentAnalysisCard loanId={loanId!} />

      {/* Full width Credit Data Card at bottom */}
      <div className="financial-card">
        <div style={{ 
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '8px',
          marginBottom: '12px'
        }}>
          <h3 style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
            CREDIT DATA
          </h3>
        </div>
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Credit report integration is coming soon.</p>
          <p style={{ 
            fontSize: '11px', 
            color: 'var(--color-text-secondary)', 
            marginTop: '8px' 
          }}>
            This section will include credit scores, payment history, and bureau reports.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoanDetailPage;