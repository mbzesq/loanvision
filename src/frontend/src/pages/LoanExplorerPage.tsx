import { useEffect, useState } from 'react';
import axios from 'axios';

interface Loan {
  id: number;
  borrower_name: string;
  property_address: string;
  property_state: string;
  unpaid_principal_balance: string;
  loan_amount: string;
  legal_status: string;
  created_at: string;
}

function LoanExplorerPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLoans = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
        const response = await axios.get<Loan[]>(`${apiUrl}/api/loans`);
        setLoans(response.data);
      } catch (err) {
        setError('Failed to fetch loans');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLoans();
  }, []);

  if (loading) return <div>Loading loans...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div>
      <h1>Loan Explorer</h1>
      <p>Total loans: {loans.length}</p>
      
      <table border={1} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ padding: '8px', textAlign: 'left' }}>Borrower Name</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Property Address</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>State</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>UPB</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Loan Amount</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Legal Status</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Created</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan) => (
            <tr key={loan.id}>
              <td style={{ padding: '8px' }}>{loan.borrower_name || 'N/A'}</td>
              <td style={{ padding: '8px' }}>{loan.property_address || 'N/A'}</td>
              <td style={{ padding: '8px' }}>{loan.property_state || 'N/A'}</td>
              <td style={{ padding: '8px' }}>{loan.unpaid_principal_balance || 'N/A'}</td>
              <td style={{ padding: '8px' }}>{loan.loan_amount || 'N/A'}</td>
              <td style={{ padding: '8px' }}>{loan.legal_status || 'N/A'}</td>
              <td style={{ padding: '8px' }}>
                {loan.created_at ? new Date(loan.created_at).toLocaleDateString() : 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {loans.length === 0 && (
        <p>No loans found. Upload a file to see loans here.</p>
      )}
    </div>
  );
}

export default LoanExplorerPage;