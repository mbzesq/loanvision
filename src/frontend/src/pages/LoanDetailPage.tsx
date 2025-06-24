// src/frontend/src/pages/LoanDetailPage.tsx
import { useParams } from 'react-router-dom';

const LoanDetailPage = () => {
  const { loanId } = useParams<{ loanId: string }>();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Loan Detail Page</h1>
      <p className="text-gray-600">Details for Loan ID: {loanId}</p>
    </div>
  );
};

export default LoanDetailPage;