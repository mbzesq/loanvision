import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import LoanDetailModal from '../components/LoanDetailModal';
import FilterSheet, { FilterSheetValues } from '../components/FilterSheet';
import { Input } from '@loanvision/shared/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@loanvision/shared/components/ui/sheet';
import { Button } from '@loanvision/shared/components/ui/button';
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
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isSheetOpen, setSheetOpen] = useState(false);

  const handleApplyFilters = (filters: FilterSheetValues) => {
    console.log('Filters applied from parent:', filters);
    // Filtering logic will be added here in a future step
  };

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

  const handleExport = async (format: 'pdf' | 'excel') => {
    setExporting(true);
    setShowExportDropdown(false);
    
    try {
      if (format === 'pdf') {
        // Client-side PDF generation
        const doc = new jsPDF('landscape');
        
        // Add title
        doc.setFontSize(18);
        doc.text('Loan Portfolio Report', 14, 20);
        
        // Add metadata
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
        doc.text(`Total loans: ${table.getFilteredRowModel().rows.length}`, 14, 36);
        if (globalFilter) {
          doc.text(`Filter applied: "${globalFilter}"`, 14, 42);
        }
        
        // Prepare table data
        const filteredRows = table.getFilteredRowModel().rows;
        const tableData = filteredRows.map(row => [
          row.original.servicer_loan_id || 'N/A',
          row.original.borrower_name || 'N/A',
          row.original.property_address || 'N/A',
          row.original.property_city || 'N/A',
          row.original.property_state || 'N/A',
          row.original.unpaid_principal_balance 
            ? parseFloat(row.original.unpaid_principal_balance).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
            : 'N/A',
          row.original.interest_rate 
            ? (parseFloat(row.original.interest_rate) * 100).toFixed(2) + '%'
            : 'N/A',
          row.original.next_due_date 
            ? new Date(row.original.next_due_date).toLocaleDateString('en-US')
            : 'N/A',
          row.original.last_paid_date 
            ? new Date(row.original.last_paid_date).toLocaleDateString('en-US')
            : 'N/A',
          row.original.legal_status || 'N/A'
        ]);
        
        // Add table
        autoTable(doc, {
          head: [['Loan Number', 'Borrower Name', 'Property Address', 'City', 'State', 'UPB', 'Interest Rate', 'Next Due Date', 'Last Paid Date', 'Legal Status']],
          body: tableData,
          startY: globalFilter ? 48 : 42,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [100, 100, 100] }
        });
        
        // Save the PDF
        const filename = `loan_report_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
      } else {
        // Excel export - still server-side
        const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
        const params = globalFilter ? `?filter=${encodeURIComponent(globalFilter)}` : '';
        
        const response = await axios.get(`${apiUrl}/api/reports/excel${params}`, {
          responseType: 'blob'
        });
        
        const filename = `loan_report_${new Date().toISOString().split('T')[0]}.xlsx`;
        saveAs(response.data, filename);
      }
    } catch (err) {
      console.error(`Error exporting ${format}:`, err);
      alert(`Failed to export ${format.toUpperCase()} report`);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div>Loading loans...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Loan Explorer</h1>
      
      <div className="flex items-center justify-between mb-4">
        <Input 
          placeholder="Search loans..." 
          className="max-w-sm"
          value={globalFilter ?? ''}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />
        <Button onClick={() => setSheetOpen(true)}>
          Filter
        </Button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p>Total loans: {table.getFilteredRowModel().rows.length} of {loans.length}</p>
        
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowExportDropdown(!showExportDropdown)}
            disabled={exporting}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: exporting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {exporting ? 'Exporting...' : 'Export'}
            <span style={{ fontSize: '12px' }}>▼</span>
          </button>
          
          {showExportDropdown && !exporting && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              zIndex: 10
            }}>
              <button
                onClick={() => handleExport('pdf')}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 16px',
                  textAlign: 'left',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Download as PDF
              </button>
              <button
                onClick={() => handleExport('excel')}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 16px',
                  textAlign: 'left',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Download as Excel
              </button>
            </div>
          )}
        </div>
      </div>
      
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

      <Sheet open={isSheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Filter Loans</SheetTitle>
            <SheetDescription>
              Apply filters to find specific loans in your portfolio.
            </SheetDescription>
          </SheetHeader>
          <FilterSheet onApplyFilters={handleApplyFilters} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default LoanExplorerPage;