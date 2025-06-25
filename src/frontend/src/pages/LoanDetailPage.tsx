// src/frontend/src/pages/LoanDetailPage.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

interface LoanDetails {
  loan_id: string;
  investor_name: string;
  first_name: string;
  last_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  prin_bal: string;
  int_rate: string;
  next_pymt_due: string;
  last_pymt_received: string;
  loan_type: string;
  legal_status: string;
  lien_pos: string;
  maturity_date: string;
  origination_date: string;
  pi_pmt: string;
  created_at: string;
  updated_at: string;
}

// Utility functions for formatting
const formatCurrency = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') return 'N/A';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(numValue);
};

const formatPercentage = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') return 'N/A';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return 'N/A';
  return `${numValue.toFixed(4)}%`;
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return 'N/A';
  }
};

// Card component for information display
interface CardProps {
  title: string;
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ title, children }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-100 pb-2">
        {title}
      </h3>
      {children}
    </div>
  );
};

// Key-value pair component
interface DataRowProps {
  label: string;
  value: string;
  valueClassName?: string;
}

const DataRow: React.FC<DataRowProps> = ({ label, value, valueClassName = "text-sm text-gray-900" }) => {
  return (
    <div className="flex justify-between py-2">
      <dt className="text-sm font-medium text-gray-600">{label}</dt>
      <dd className={valueClassName}>{value}</dd>
    </div>
  );
};

const LoanDetailPage = () => {
  const { loanId } = useParams<{ loanId: string }>();
  const [loanDetails, setLoanDetails] = useState<LoanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLoanData = async () => {
      if (!loanId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
        const response = await axios.get(`${apiUrl}/api/v2/loans/${loanId}`);
        
        console.log('Loan data fetched:', response.data);
        setLoanDetails(response.data);
        
      } catch (err) {
        console.error('Error fetching loan data:', err);
        setError('Failed to fetch loan details');
      } finally {
        setLoading(false);
      }
    };

    fetchLoanData();
  }, [loanId]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg text-gray-600">Loading loan details...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  if (!loanDetails) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg text-gray-600">Loan not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Loan Details for: {loanId}
      </h1>
      
      <div className="space-y-8">
        {/* Core Loan Data Section */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Core Loan Data</h2>
          
          {/* Responsive Grid of Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Card 1: Loan Information */}
            <Card title="Loan Information">
              <dl className="space-y-3">
                <DataRow 
                  label="Loan ID" 
                  value={loanDetails.loan_id || 'N/A'} 
                  valueClassName="text-sm text-gray-900 font-mono"
                />
                <DataRow label="Investor" value={loanDetails.investor_name || 'N/A'} />
                <DataRow label="Loan Type" value={loanDetails.loan_type || 'N/A'} />
                <DataRow label="Legal Status" value={loanDetails.legal_status || 'N/A'} />
              </dl>
            </Card>

            {/* Card 2: Borrower Information */}
            <Card title="Borrower Information">
              <dl className="space-y-3">
                <DataRow label="First Name" value={loanDetails.first_name || 'N/A'} />
                <DataRow label="Last Name" value={loanDetails.last_name || 'N/A'} />
                <DataRow 
                  label="Address" 
                  value={
                    loanDetails.address 
                      ? `${loanDetails.address}, ${loanDetails.city}, ${loanDetails.state} ${loanDetails.zip}` 
                      : 'N/A'
                  }
                  valueClassName="text-sm text-gray-900 text-right max-w-xs"
                />
              </dl>
            </Card>

            {/* Card 3: Financials */}
            <Card title="Financials">
              <dl className="space-y-3">
                <DataRow 
                  label="Principal Balance" 
                  value={formatCurrency(loanDetails.prin_bal)} 
                  valueClassName="text-sm text-gray-900 font-semibold"
                />
                <DataRow label="Interest Rate" value={formatPercentage(loanDetails.int_rate)} />
                <DataRow label="P&I Payment" value={formatCurrency(loanDetails.pi_pmt)} />
                <DataRow label="Lien Position" value={loanDetails.lien_pos || 'N/A'} />
              </dl>
            </Card>

            {/* Card 4: Key Dates */}
            <Card title="Key Dates">
              <dl className="space-y-3">
                <DataRow label="Origination Date" value={formatDate(loanDetails.origination_date)} />
                <DataRow label="Maturity Date" value={formatDate(loanDetails.maturity_date)} />
                <DataRow label="Next Payment Due" value={formatDate(loanDetails.next_pymt_due)} />
                <DataRow label="Last Payment Received" value={formatDate(loanDetails.last_pymt_received)} />
              </dl>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanDetailPage;