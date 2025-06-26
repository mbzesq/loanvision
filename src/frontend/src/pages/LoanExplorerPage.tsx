import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { LoanDetailModal } from '../components/LoanDetailModal';
import { FilterPanel, FilterValues, initialFilters } from '../components/FilterPanel';
import { DataToolbar } from '../components/DataToolbar';
import { ExportCustomizerModal } from '../components/ExportCustomizerModal';
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
import milestoneBenchmarks from '../fcl_milestones_by_state.json';

export interface Loan {
  // from daily_metrics_current
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
  next_pymt_due: string | null;
  last_pymt_received: string | null;
  loan_type: string;
  legal_status: string;
  lien_pos: string;
  maturity_date: string | null;

  // from foreclosure_events
  fc_status: string | null;
  fc_jurisdiction: string | null;
  fc_start_date: string | null;
  referral_date: string | null;
  title_ordered_date: string | null;
  title_received_date: string | null;
  complaint_filed_date: string | null;
  service_completed_date: string | null;
  judgment_date: string | null;
  sale_scheduled_date: string | null;
  sale_held_date: string | null;

  // Expected Completion Dates
  referral_expected_completion_date: string | null;
  title_ordered_expected_completion_date: string | null;
  title_received_expected_completion_date: string | null;
  complaint_filed_expected_completion_date: string | null;
  service_completed_expected_completion_date: string | null;
  judgment_expected_completion_date: string | null;
  sale_scheduled_expected_completion_date: string | null;
  sale_held_expected_completion_date: string | null;
}

// IMPORTANT: Define this function OUTSIDE (above) the LoanExplorerPage component.
const getLoanTimelineStatus = (loan: Loan): 'On Track' | 'Overdue' | null => {
  if (loan.fc_status !== 'Active' && loan.fc_status !== 'Hold') {
    return null;
  }

  if (!loan.state || !loan.fc_jurisdiction) {
    return null;
  }

  const stateBenchmarks = milestoneBenchmarks[loan.state as keyof typeof milestoneBenchmarks];
  if (!stateBenchmarks) return null;

  const milestones = loan.fc_jurisdiction.toLowerCase().includes('non')
    ? stateBenchmarks.non_judicial_milestones
    : stateBenchmarks.judicial_milestones;

  if (!milestones || milestones.length === 0) return null;

  for (const milestone of milestones) {
    const actualDate = loan[milestone.db_column as keyof Loan];
    if (!actualDate) {
      const expectedDateKey = `${milestone.db_column.replace(/_date$/, '')}_expected_completion_date`;
      const expectedDate = loan[expectedDateKey as keyof Loan];

      if (!expectedDate) return 'On Track';

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return new Date(expectedDate) < today ? 'Overdue' : 'On Track';
    }
  }

  return 'On Track';
};

const columnHelper = createColumnHelper<Loan>();

const allLoanColumns = [ 'loan_id', 'investor_name', 'first_name', 'last_name', 'address', 'city', 'state', 'zip', 'prin_bal', 'int_rate', 'next_pymt_due', 'last_pymt_received', 'loan_type', 'legal_status', 'lien_pos', 'fc_status' ];

function LoanExplorerPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [exporting, setExporting] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterValues>(initialFilters);
  const [hasAppliedFilter, setHasAppliedFilter] = useState(false);
  const [isExportModalOpen, setExportModalOpen] = useState(false);
  const [customExportColumns, setCustomExportColumns] = useState<string[]>(['loan_id', 'prin_bal', 'legal_status']); // Set some defaults

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

  // Replace the old uniqueLienPositions with this new, robust version
  const uniqueLienPositions = useMemo(() => {
    if (!loans) return [];
    
    const positions = loans
      .map(loan => loan.lien_pos)
      .filter(pos => pos !== null && pos !== undefined) // Remove nulls/undefined
      .map(pos => String(pos).trim()) // Convert to string and trim whitespace
      .filter(pos => pos !== ''); // Filter out empty strings

    const uniquePositions = Array.from(new Set(positions));

    // Sort numerically, but keep as strings
    uniquePositions.sort((a, b) => Number(a) - Number(b));

    return uniquePositions;
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
      const { propertyState, assetStatus, investor, lienPos, principalBalance, timelineStatus } = activeFilters;

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
      if (lienPos.length > 0 && !lienPos.includes(String(loan.lien_pos))) {
        return false;
      }

      // Principal balance filter
      const loanBalance = parseFloat(loan.prin_bal) || 0;
      const minBalance = principalBalance.min !== '' ? principalBalance.min : -Infinity;
      const maxBalance = principalBalance.max !== '' ? principalBalance.max : Infinity;

      if (loanBalance < minBalance || loanBalance > maxBalance) {
        return false;
      }

      // Timeline status filter
      if (timelineStatus && timelineStatus.length > 0) {
        const loanTimelineStatus = getLoanTimelineStatus(loan);
        if (!loanTimelineStatus || !timelineStatus.includes(loanTimelineStatus)) {
          return false;
        }
      }

      return true; // If all checks pass, include the loan
    });
  }, [loans, activeFilters, hasAppliedFilter, globalFilter]);

  // Helper function for proper date formatting
  const formatDate = (value: string | null | undefined) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    // Add timezone offset to counteract browser conversion
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const correctedDate = new Date(date.getTime() + userTimezoneOffset);
    
    return isNaN(correctedDate.getTime()) ? 'N/A' : correctedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };


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
      columnHelper.accessor('city', {
        header: 'City',
        cell: info => (
          <span className="text-slate-700">
            {info.getValue() || 'N/A'}
          </span>
        ),
      }),
      columnHelper.accessor('state', {
        header: 'State',
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
              {formatDate(value)}
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
              {formatDate(value)}
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
            availableLienPos={uniqueLienPositions}
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
                onCustomize={() => setExportModalOpen(true)}
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
      {selectedLoanId && (
        <LoanDetailModal
          loanId={selectedLoanId}
          onClose={() => setSelectedLoanId(null)}
        />
      )}

      {/* Export Customizer Modal */}
      {isExportModalOpen && (
        <ExportCustomizerModal
          isOpen={isExportModalOpen}
          onClose={() => setExportModalOpen(false)}
          availableColumns={allLoanColumns}
          defaultColumns={customExportColumns}
          onSave={setCustomExportColumns}
        />
      )}
    </div>
  );
}

export default LoanExplorerPage;
