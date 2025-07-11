import React from 'react';
import { X, AlertTriangle, Calendar, MapPin, DollarSign, User, Building } from 'lucide-react';
import { solService } from '../../services/solService';

interface SOLLoanDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  loans: any[];
  title: string;
  subtitle?: string;
}

const SOLLoanDetailsModal: React.FC<SOLLoanDetailsModalProps> = ({
  isOpen,
  onClose,
  loans,
  title,
  subtitle
}) => {
  if (!isOpen) return null;

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'HIGH': return 'var(--color-danger)';
      case 'MEDIUM': return 'var(--color-warning)';
      case 'LOW': return 'var(--color-success)';
      default: return 'var(--color-text-muted)';
    }
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1200px', width: '95vw' }}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>{title}</h2>
            {subtitle && (
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Summary */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: 'var(--color-surface-light)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '12px'
        }}>
          <div>
            <span style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>
              {loans.length}
            </span>
            <span style={{ color: 'var(--color-text-muted)', marginLeft: '4px' }}>
              Total Loans
            </span>
          </div>
          <div>
            <span style={{ fontWeight: '600', color: 'var(--color-danger)' }}>
              {loans.filter(loan => loan.is_expired).length}
            </span>
            <span style={{ color: 'var(--color-text-muted)', marginLeft: '4px' }}>
              Expired
            </span>
          </div>
          <div>
            <span style={{ fontWeight: '600', color: 'var(--color-warning)' }}>
              {loans.filter(loan => loan.sol_risk_level === 'HIGH').length}
            </span>
            <span style={{ color: 'var(--color-text-muted)', marginLeft: '4px' }}>
              High Risk
            </span>
          </div>
          <div>
            <span style={{ fontWeight: '600', color: 'var(--color-primary)' }}>
              {formatCurrency(loans.reduce((sum, loan) => sum + (parseFloat(loan.upb) || 0), 0))}
            </span>
            <span style={{ color: 'var(--color-text-muted)', marginLeft: '4px' }}>
              Total UPB
            </span>
          </div>
        </div>

        {/* Loan List */}
        <div className="scroll-container" style={{ maxHeight: '500px' }}>
          {loans.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px', 
              color: 'var(--color-text-muted)' 
            }}>
              No loans found for the selected criteria.
            </div>
          ) : (
            <table className="financial-table">
              <thead>
                <tr>
                  <th>LOAN ID</th>
                  <th>BORROWER</th>
                  <th>PROPERTY</th>
                  <th>UPB</th>
                  <th>SOL STATUS</th>
                  <th>EXPIRATION</th>
                  <th>DAYS LEFT</th>
                  <th>JURISDICTION</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr key={loan.loan_id}>
                    <td>
                      <span style={{ fontWeight: '600', fontSize: '11px' }}>
                        {loan.loan_id}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={12} style={{ color: 'var(--color-text-muted)' }} />
                        <span style={{ fontSize: '11px' }}>
                          {loan.borrower_name || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Building size={12} style={{ color: 'var(--color-text-muted)' }} />
                        <span style={{ fontSize: '11px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {loan.property_address || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <DollarSign size={12} style={{ color: 'var(--color-text-muted)' }} />
                        <span style={{ fontSize: '11px', fontWeight: '600' }}>
                          {formatCurrency(loan.upb)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span 
                        className={`status-indicator ${
                          loan.is_expired ? 'critical' :
                          loan.sol_risk_level === 'HIGH' ? 'critical' :
                          loan.sol_risk_level === 'MEDIUM' ? 'warning' : 'success'
                        }`}
                        style={{ fontSize: '10px' }}
                      >
                        {loan.is_expired ? 'EXPIRED' : loan.sol_risk_level}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={12} style={{ color: 'var(--color-text-muted)' }} />
                        <span style={{ fontSize: '11px' }}>
                          {solService.formatDate(loan.adjusted_expiration_date)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span 
                        style={{ 
                          fontSize: '11px',
                          fontWeight: '600',
                          color: loan.days_until_expiration <= 30 ? 'var(--color-danger)' :
                                 loan.days_until_expiration <= 90 ? 'var(--color-warning)' :
                                 'var(--color-text-primary)'
                        }}
                      >
                        {loan.is_expired ? 'EXPIRED' : 
                         loan.days_until_expiration === 0 ? 'TODAY' :
                         loan.days_until_expiration === 1 ? '1 DAY' :
                         `${loan.days_until_expiration} DAYS`}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={12} style={{ color: 'var(--color-text-muted)' }} />
                        <span style={{ fontSize: '11px' }}>
                          {loan.property_state}
                        </span>
                        {loan.jurisdiction_risk_level && (
                          <span 
                            className={`status-indicator ${
                              loan.jurisdiction_risk_level === 'HIGH' ? 'critical' :
                              loan.jurisdiction_risk_level === 'MEDIUM' ? 'warning' : 'success'
                            }`}
                            style={{ fontSize: '9px', marginLeft: '4px' }}
                          >
                            {loan.jurisdiction_risk_level}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn-compact btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SOLLoanDetailsModal;