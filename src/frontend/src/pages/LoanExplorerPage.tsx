import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import LoanDetailModal from '../components/LoanDetailModal';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  SortingState,
} from '@tanstack/react-table';

interface Loan {
  id: number;
  servicer_loan_id: string;
  borrower_name: string;
  property_address: string;
  property_city: string;
  property_state: string;
  property_zip: string;
  unpaid_principal_balance: string;
  loan_amount: string;
  interest_rate: string;
  legal_status: string;
  last_paid_date: string;
  next_due_date: string;
  remaining_term_months: string;
  created_at: string;
}

const columnHelper = createColumnHelper<Loan>();

function LoanExplorerPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

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

  const columns = useMemo(
    () => [
      columnHelper.accessor('servicer_loan_id', {
        header: 'Loan Number',
        cell: info => info.getValue() || 'N/A',
      }),
      columnHelper.accessor('borrower_name', {
        header: 'Borrower Name',
        cell: info => info.getValue() || 'N/A',
      }),
      columnHelper.accessor('property_address', {
        header: 'Property Address',
        cell: info => info.getValue() || 'N/A',
      }),
      columnHelper.accessor('unpaid_principal_balance', {
        header: 'UPB',
        cell: info => {
          const value = info.getValue();
          return value 
            ? parseFloat(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
            : 'N/A';
        },
        sortingFn: (rowA, rowB, columnId) => {
          const a = parseFloat(rowA.getValue(columnId) || '0');
          const b = parseFloat(rowB.getValue(columnId) || '0');
          return a - b;
        },
      }),
      columnHelper.accessor('next_due_date', {
        header: 'Next Due Date',
        cell: info => {
          const value = info.getValue();
          return value 
            ? new Date(value).toLocaleDateString('en-US')
            : 'N/A';
        },
        sortingFn: (rowA, rowB, columnId) => {
          const a = rowA.getValue(columnId) ? new Date(rowA.getValue(columnId)).getTime() : 0;
          const b = rowB.getValue(columnId) ? new Date(rowB.getValue(columnId)).getTime() : 0;
          return a - b;
        },
      }),
      columnHelper.accessor('last_paid_date', {
        header: 'Last Paid Date',
        cell: info => {
          const value = info.getValue();
          return value 
            ? new Date(value).toLocaleDateString('en-US')
            : 'N/A';
        },
        sortingFn: (rowA, rowB, columnId) => {
          const a = rowA.getValue(columnId) ? new Date(rowA.getValue(columnId)).getTime() : 0;
          const b = rowB.getValue(columnId) ? new Date(rowB.getValue(columnId)).getTime() : 0;
          return a - b;
        },
      }),
    ],
    []
  );

  const table = useReactTable({
    data: loans,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (loading) return <div>Loading loans...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div>
      <h1>Loan Explorer</h1>
      
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          value={globalFilter ?? ''}
          onChange={e => setGlobalFilter(e.target.value)}
          placeholder="Search loans..."
          style={{
            padding: '8px 12px',
            fontSize: '14px',
            width: '300px',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        />
      </div>

      <p>Total loans: {table.getFilteredRowModel().rows.length} of {loans.length}</p>
      
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id} style={{ backgroundColor: '#f0f0f0' }}>
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  style={{
                    padding: '8px',
                    textAlign: 'left',
                    cursor: header.column.getCanSort() ? 'pointer' : 'default',
                    userSelect: 'none',
                  }}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                    {{
                      asc: ' ↑',
                      desc: ' ↓',
                    }[header.column.getIsSorted() as string] ?? null}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr
              key={row.id}
              onClick={() => setSelectedLoanId(row.original.servicer_loan_id)}
              style={{
                cursor: 'pointer',
                backgroundColor: 'transparent',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {row.getVisibleCells().map(cell => (
                <td key={cell.id} style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      
      {table.getRowModel().rows.length === 0 && (
        <p style={{ textAlign: 'center', marginTop: '20px' }}>
          {globalFilter ? 'No loans found matching your search.' : 'No loans found. Upload a file to see loans here.'}
        </p>
      )}
      
      {selectedLoanId && (
        <LoanDetailModal 
          loanId={selectedLoanId} 
          onClose={() => setSelectedLoanId(null)} 
        />
      )}
    </div>
  );
}

export default LoanExplorerPage;