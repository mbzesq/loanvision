import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { LoanDetailModal } from '../components/LoanDetailModal';
import { FilterPanel, FilterValues, initialFilters } from '../components/FilterPanel';
import { DataToolbar } from '../components/DataToolbar';
import { states } from '@loanvision/shared/lib/states';
import { Card, CardContent, CardHeader } from '@loanvision/shared/components/ui/card';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
} from '@tanstack/react-table';

export interface Loan {
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
  loan_type: string; // This is the "Asset Status"
  legal_status: string;
  lien_position: string;
  // Joined fields from foreclosure_events
  fc_status: string | null;
}

const columnHelper = createColumnHelper<Loan>();

function LoanExplorerPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [modalLoanData, setModalLoanData] = useState<Loan | null>(null);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [exporting, setExporting] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterValues>(initialFilters);
  const [hasAppliedFilter, setHasAppliedFilter] = useState(false);

  const handleApplyFilters = (filters: FilterValues) => {
    setActiveFilters(filters);
    setHasAppliedFilter(true);
  };

  const handleShowAll = () => {
    setActiveFilters(initialFilters);
    setHasAppliedFilter(true);
  };

  const handleClearView = () => {
    setActiveFilters(initialFilters); // Reset the filters
    setHasAppliedFilter(false);       // This will cause the table to empty
  };

  useEffect(() => {
    const fetchLoans = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
        const response = await axios.get<Loan[]>(`${apiUrl}/api/v2/loans`);
        console.log('[Frontend] Received data from /api/v2/loans:', response.data); // MANDATORY LOG
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

  useEffect(() => {
    const fetchLoanDetails = async () => {
      if (selectedLoanId) {
        setIsModalLoading(true);
        setModalLoanData(null); // Clear old data
        try {
          const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
          const response = await axios.get(`${apiUrl}/api/loans/${selectedLoanId}`);
          setModalLoanData(response.data);
        } catch (error) {
          console.error('Failed to fetch loan details:', error);
        } finally {
          setIsModalLoading(false);
        }
      }
    };

    fetchLoanDetails();
  }, [selectedLoanId]);

  const uniqueStates = useMemo(() => {
    const loanStateAbbrs = new Set(loans?.map(loan => loan.state).filter(Boolean) ?? []);
    return states.filter(state => loanStateAbbrs.has(state.abbr)).sort((a, b) => a.name.localeCompare(b.name));
  }, [loans]);

  const uniqueLegalStatuses = useMemo(() => {
    const statuses = new Set(loans?.map(loan => loan.legal_status).filter(Boolean) ?? []);
    return Array.from(statuses).sort();
  }, [loans]);

  // Add derived data for new filters
  const uniqueInvestors = useMemo(() => {
    const investors = new Set(loans?.map(loan => loan.investor_name).filter(Boolean) ?? []);
    return Array.from(investors).sort();
  }, [loans]);

  const uniqueLienPositions = useMemo(() => {
    const positions = new Set(loans?.map(loan => loan.lien_position).filter(Boolean) ?? []);
    return Array.from(positions).sort();
  }, [loans]);

  const filteredData = useMemo(() => {
    if (!hasAppliedFilter) return []; // RESTORE THIS LINE
    if (!loans) return [];
    
    // If global search is active, search across all loans regardless of filters
    if (globalFilter && globalFilter.length > 0) {
      const searchTerm = globalFilter.toLowerCase();
      return loans.filter(loan => 
        loan.loan_id?.toLowerCase().includes(searchTerm) ||
        `${loan.first_name} ${loan.last_name}`.toLowerCase().includes(searchTerm) ||
        loan.address?.toLowerCase().includes(searchTerm) ||
        loan.investor_name?.toLowerCase().includes(searchTerm)
      );
    }

    return loans.filter(loan => {
      const { propertyState, assetStatus, investor, lienPosition, principalBalance } = activeFilters;

      // State filter
      if (propertyState.length > 0 && !propertyState.includes(loan.state)) {
        return false;
      }

      // Asset status filter (renamed from loan type)
      if (assetStatus.length > 0 && !assetStatus.includes(loan.legal_status)) {
        return false;
      }

      // Investor filter
      if (investor.length > 0 && !investor.includes(loan.investor_name)) {
        return false;
      }

      // Lien Position filter
      if (lienPosition.length > 0 && !lienPosition.includes(loan.lien_position)) {
        return false;
      }

      // Principal balance filter
      const loanBalance = parseFloat(loan.prin_bal) || 0;
      const minBalance = principalBalance.min !== '' ? principalBalance.min : -Infinity;
      const maxBalance = principalBalance.max !== '' ? principalBalance.max : Infinity;

      if (loanBalance < minBalance || loanBalance > maxBalance) {
        return false;
      }

      return true; // If all checks pass, include the loan
    });
  }, [loans, activeFilters, hasAppliedFilter, globalFilter]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('loan_id', {
        header: 'Loan Number',
        cell: info => (
          <span className="font-medium text-blue-600 hover:underline">
            {info.getValue() || 'N/A'}
          </span>
        ),
      }),
      columnHelper.accessor((row) => `${row.first_name || ''} ${row.last_name || ''}`.trim(), {
        id: 'borrower_name',
        header: 'Borrower Name',
        cell: info => (
          <span className="text-slate-900">
            {info.getValue() || 'N/A'}
          </span>
        ),
      }),
      columnHelper.accessor('address', {
        header: 'Property Address',
        cell: info => (
          <span className="text-slate-700">
            {info.getValue() || 'N/A'}
          </span>
        ),
      }),
      columnHelper.accessor('prin_bal', {
        header: 'UPB',
        cell: info => {
          const value = info.getValue();
          return (
            <span className="font-semibold text-slate-800 tabular-nums">
              {value 
                ? parseFloat(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                : 'N/A'}
            </span>
          );
        },
        sortingFn: (rowA, rowB, columnId) => {
          const a = parseFloat(rowA.getValue(columnId) || '0');
          const b = parseFloat(rowB.getValue(columnId) || '0');
          return a - b;
        },
      }),
      columnHelper.accessor('next_pymt_due', {
        header: 'Next Due Date',
        cell: info => {
          const value = info.getValue();
          return (
            <span className="text-slate-700 tabular-nums">
              {value 
                ? new Date(value).toLocaleDateString('en-US')
                : 'N/A'}
            </span>
          );
        },
        sortingFn: (rowA, rowB, columnId) => {
          const a = rowA.getValue(columnId) ? new Date(rowA.getValue(columnId)).getTime() : 0;
          const b = rowB.getValue(columnId) ? new Date(rowB.getValue(columnId)).getTime() : 0;
          return a - b;
        },
      }),
      columnHelper.accessor('last_pymt_received', {
        header: 'Last Paid Date',
        cell: info => {
          const value = info.getValue();
          return (
            <span className="text-slate-700 tabular-nums">
              {value 
                ? new Date(value).toLocaleDateString('en-US')
                : 'N/A'}
            </span>
          );
        },
        sortingFn: (rowA, rowB, columnId) => {
          const a = rowA.getValue(columnId) ? new Date(rowA.getValue(columnId)).getTime() : 0;
          const b = rowB.getValue(columnId) ? new Date(rowB.getValue(columnId)).getTime() : 0;
          return a - b;
        },
      }),
      // Add this to the columns array
      columnHelper.accessor('legal_status', {
        header: 'Legal Status',
        cell: info => (
          <span className="font-medium text-slate-700">
            {info.getValue() || 'N/A'}
          </span>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: filteredData ?? [],
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleExport = async (format: 'pdf' | 'excel') => {
    setExporting(true);
    
    try {
      if (format === 'pdf') {
        const doc = new jsPDF('landscape');
        
        doc.setFontSize(18);
        doc.text('Loan Portfolio Report', 14, 20);
        
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
        doc.text(`Total loans: ${table.getFilteredRowModel().rows.length}`, 14, 36);
        if (globalFilter) {
          doc.text(`Filter applied: "${globalFilter}"`, 14, 42);
        }
        
        const filteredRows = table.getFilteredRowModel().rows;
        const tableData = filteredRows.map(row => [
          row.original.loan_id || 'N/A',
          `${row.original.first_name || ''} ${row.original.last_name || ''}`.trim() || 'N/A',
          row.original.address || 'N/A',
          row.original.city || 'N/A',
          row.original.state || 'N/A',
          row.original.prin_bal 
            ? parseFloat(row.original.prin_bal).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
            : 'N/A',
          row.original.int_rate 
            ? (parseFloat(row.original.int_rate) * 100).toFixed(2) + '%'
            : 'N/A',
          row.original.next_pymt_due 
            ? new Date(row.original.next_pymt_due).toLocaleDateString('en-US')
            : 'N/A',
          row.original.last_pymt_received 
            ? new Date(row.original.last_pymt_received).toLocaleDateString('en-US')
            : 'N/A',
          row.original.legal_status || 'N/A'
        ]);
        
        autoTable(doc, {
          head: [['Loan Number', 'Borrower Name', 'Property Address', 'City', 'State', 'UPB', 'Interest Rate', 'Next Due Date', 'Last Paid Date', 'Legal Status']],
          body: tableData,
          startY: globalFilter ? 48 : 42,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [100, 100, 100] }
        });
        
        const filename = `loan_report_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
      } else {
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

  const getSortIcon = (isSorted: false | 'asc' | 'desc') => {
    if (isSorted === 'asc') return <ArrowUp className="h-4 w-4" />;
    if (isSorted === 'desc') return <ArrowDown className="h-4 w-4" />;
    return <ArrowUpDown className="h-4 w-4 opacity-50" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-slate-600">Loading loans...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-2">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Loan Explorer</h1>
        <p className="text-slate-600 mt-1">
          Analyze and filter your loan portfolio
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start min-h-[600px]">
        {/* Filter Panel (Left) */}
        <div className="lg:col-span-1 h-full">
          <FilterPanel
            onApplyFilters={handleApplyFilters}
            onShowAll={handleShowAll}
            onClearView={handleClearView}
            availableStates={uniqueStates}
            availableAssetStatuses={uniqueLegalStatuses}
            availableInvestors={uniqueInvestors}
            availableLienPositions={uniqueLienPositions}
          />
        </div>
        {/* Main Content (Right) */}
        <div className="lg:col-span-3 relative z-0">
          <Card className="py-0 gap-0">
            <CardHeader className="pb-2 flex flex-col gap-0 grid-rows-none">
              <DataToolbar
                globalFilter={globalFilter}
                setGlobalFilter={setGlobalFilter}
                filteredLoanCount={filteredData.length}
                totalLoanCount={loans.length}
                onExport={handleExport}
                exporting={exporting}
              />
            </CardHeader>
            <CardContent className="p-0 pt-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  {/* ... thead and tbody ... */}
                   <thead>
                      {table.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id} className="border-b-2 border-slate-200 bg-slate-50">
                          {headerGroup.headers.map(header => (
                            <th key={header.id} className="text-left p-2 text-xs font-semibold text-blue-700 uppercase tracking-wider select-none">
                              {header.isPlaceholder ? null : (
                                <div
                                  className={`flex items-center gap-2 ${header.column.getCanSort() ? 'cursor-pointer hover:text-blue-900' : ''}`}
                                  onClick={header.column.getToggleSortingHandler()}
                                >
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                  {getSortIcon(header.column.getIsSorted())}
                                </div>
                              )}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {table.getRowModel().rows.map((row, index) => (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedLoanId(row.original.loan_id)}
                          className={`border-b border-slate-100 transition-colors duration-150 cursor-pointer 
                            ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} 
                            hover:bg-blue-50
                          `}
                        >
                          {row.getVisibleCells().map(cell => (
                            <td key={cell.id} className="p-2 text-sm">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                </table>
              </div>
               {table.getRowModel().rows.length === 0 && (
                  <div className="text-center py-12 px-6">
                      <h3 className="text-lg font-semibold text-slate-800">
                        {hasAppliedFilter ? "No Loans Found" : "Begin Your Search"}
                      </h3>
                      <p className="text-slate-500 mt-2">
                        {hasAppliedFilter
                          ? "No loans match your current filter criteria."
                          : "Use the filters on the left to find specific loans in your portfolio."}
                      </p>
                  </div>
               )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal */}
      {(selectedLoanId && !isModalLoading) && (
        <LoanDetailModal
          loan={modalLoanData}
          onClose={() => setSelectedLoanId(null)}
        />
      )}
      {(selectedLoanId && isModalLoading) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="text-white">Loading loan details...</div>
          </div>
      )}
    </div>
  );
}

export default LoanExplorerPage;
