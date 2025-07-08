// src/frontend/src/components/LoanDetailModal.tsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loan } from '../pages/LoanExplorerPage';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { X } from 'lucide-react';
import axios from 'axios';
import '../styles/financial-design-system.css';
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
    <div style={{ 
      position: 'fixed', 
      inset: '0', 
      backgroundColor: 'rgba(0, 0, 0, 0.7)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 50, 
      padding: '16px' 
    }}>
      <div 
        ref={modalRef} 
        className="financial-card" 
        style={{ 
          maxWidth: '1024px', 
          width: '100%', 
          maxHeight: '90vh', 
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '16px',
          borderBottom: '1px solid var(--color-border)' 
        }}>
          <h2 style={{ 
            fontSize: '14px', 
            fontWeight: '600', 
            color: 'var(--color-text-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            {loading ? "LOADING..." : `LOAN DETAILS: ${loan?.loan_id}`}
          </h2>
          <button 
            onClick={onClose}
            className="btn-compact btn-secondary"
            style={{ 
              padding: '4px',
              minWidth: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
        
        {/* Body */}
        <div className="scroll-container" style={{ 
          flexGrow: 1, 
          padding: '16px',
          overflowY: 'auto' 
        }}>
          {loading && (
            <div style={{ 
              textAlign: 'center', 
              padding: '32px',
              color: 'var(--color-text-secondary)',
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              LOADING DETAILS...
            </div>
          )}
          {!loading && !loan && (
            <div style={{ 
              textAlign: 'center', 
              padding: '32px',
              color: 'var(--color-danger)',
              fontSize: '12px'
            }}>
              Failed to load loan details.
            </div>
          )}
          {!loading && loan && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* === Section 1: Borrower & Property === */}
              <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div className="financial-card">
                  <div style={{ 
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: '8px',
                    marginBottom: '12px'
                  }}>
                    <h3 style={{ 
                      fontSize: '12px', 
                      fontWeight: '600', 
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase'
                    }}>LOAN & BORROWER</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <DetailItem label="Borrower Name">{`${loan.first_name} ${loan.last_name}`}</DetailItem>
                    <DetailItem label="Investor">
                      <button 
                        onClick={() => handleInvestorClick(loan.investor_name)} 
                        style={{ 
                          color: 'var(--color-primary)', 
                          textDecoration: 'none',
                          fontWeight: '500',
                          cursor: 'pointer',
                          border: 'none',
                          background: 'none',
                          padding: 0,
                          textAlign: 'left'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                      >
                        {formatValue(loan.investor_name)}
                      </button>
                    </DetailItem>
                  </div>
                </div>
                <div className="financial-card">
                  <div style={{ 
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: '8px',
                    marginBottom: '12px'
                  }}>
                    <h3 style={{ 
                      fontSize: '12px', 
                      fontWeight: '600', 
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase'
                    }}>PROPERTY & COLLATERAL</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <DetailItem label="Property Address">
                      <a 
                        href={generateZillowUrl(loan)} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={{ 
                          color: 'var(--color-primary)', 
                          textDecoration: 'none' 
                        }}
                        onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                      >
                        {`${formatValue(loan.address)}, ${formatValue(loan.city)}, ${formatValue(loan.state)}`}
                      </a>
                    </DetailItem>
                    <DetailItem label="Lien Position">{formatValue(loan.lien_pos)}</DetailItem>
                  </div>
                </div>
              </section>
              
              {/* === Section 2: Financials & Status === */}
              <section className="financial-card">
                <div style={{ 
                  borderBottom: '1px solid var(--color-border)',
                  paddingBottom: '8px',
                  marginBottom: '12px'
                }}>
                  <h3 style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: 'var(--color-text-secondary)',
                    textTransform: 'uppercase'
                  }}>FINANCIALS & STATUS</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <DetailItem label="UPB">
                    <span className="data-value" style={{ 
                      fontSize: '18px', 
                      fontWeight: '600', 
                      color: 'var(--color-text-primary)' 
                    }}>
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
                <section className="financial-card">
                  <div style={{ 
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: '8px',
                    marginBottom: '12px'
                  }}>
                    <h3 style={{ 
                      fontSize: '12px', 
                      fontWeight: '600', 
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase'
                    }}>FORECLOSURE TIMELINE</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {timeline.map((milestone, index) => (
                      <div 
                        key={index} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '12px', 
                          padding: '8px',
                          borderRadius: 'var(--radius-sm)',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-light)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div>{getStatusIcon(milestone)}</div>
                        <div style={{ flex: 1 }}>
                          <p style={{ 
                            fontWeight: '500', 
                            color: 'var(--color-text-primary)',
                            fontSize: '12px',
                            marginBottom: '4px'
                          }}>
                            {milestone.milestone_name}
                          </p>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '12px', 
                            fontSize: '10px', 
                            color: 'var(--color-text-muted)'
                          }}>
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

              {/* === Section 5: Property Enrichment Data (Validation) === */}
              {propertyData && (
                <section className="financial-card">
                  <div style={{ 
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: '8px',
                    marginBottom: '12px'
                  }}>
                    <h3 style={{ 
                      fontSize: '12px', 
                      fontWeight: '600', 
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase'
                    }}>ENRICHMENT DATA (VALIDATION)</h3>
                  </div>
                  <pre style={{ 
                    fontSize: '10px', 
                    whiteSpace: 'pre-wrap', 
                    wordBreak: 'break-all',
                    color: 'var(--color-text-muted)',
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: 'var(--color-background)',
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'auto'
                  }}>
                    {JSON.stringify(propertyData, null, 2)}
                  </pre>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          alignItems: 'center', 
          padding: '16px',
          borderTop: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface-light)',
          gap: '8px'
        }}>
          <button className="btn-compact btn-secondary" onClick={onClose}>
            CLOSE
          </button>
          <button className="btn-compact btn-primary" onClick={handleViewFullPage}>
            VIEW FULL PAGE
          </button>
        </div>
      </div>
    </div>
  );
}