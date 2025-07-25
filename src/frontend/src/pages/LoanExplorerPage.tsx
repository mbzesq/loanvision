import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { solService, SOLCalculation } from '../services/solService';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { LoanDetailModal } from '../components/LoanDetailModal';
import { FilterPanel, FilterValues, initialFilters } from '../components/FilterPanel';
import { DataToolbar } from '../components/DataToolbar';
import { ExportCustomizerModal } from '../components/ExportCustomizerModal';
import { states } from '../lib/states';
// Using modern SaaS design system from index.css
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
} from '@tanstack/react-table';
import { getOverallLoanStatus } from '../lib/timelineUtils';

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


const columnHelper = createColumnHelper<Loan>();

const allLoanColumns = [ 'loan_id', 'investor_name', 'first_name', 'last_name', 'address', 'city', 'state', 'zip', 'prin_bal', 'int_rate', 'next_pymt_due', 'last_pymt_received', 'loan_type', 'legal_status', 'lien_pos', 'fc_status' ];

function LoanExplorerPage() {
  const [searchParams] = useSearchParams();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [solData, setSOLData] = useState<Map<string, SOLCalculation>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [exporting, setExporting] = useState(false);
  
  // Initialize filters from URL parameters
  const getInitialFilters = (): FilterValues => {
    const urlFilters = { ...initialFilters };
    
    // Check for URL parameters and apply them to filters
    const state = searchParams.get('state');
    const status = searchParams.get('status');
    const milestone = searchParams.get('milestone');
    const month = searchParams.get('month');
    const solFilter = searchParams.get('sol_filter');
    const timelineStatus = searchParams.get('timeline_status');
    
    if (state) {
      urlFilters.propertyState = [state];
    }
    if (status) {
      // Handle special foreclosure status filter
      if (status === 'ACTIVE') {
        // For active foreclosure status, filter to FC (foreclosure) legal status
        urlFilters.assetStatus = ['FC'];
      } else {
        urlFilters.assetStatus = [status];
      }
    }
    if (milestone) {
      // For foreclosure milestones: Legal Status = FC + Latest milestone = clicked milestone
      urlFilters.assetStatus = ['FC']; // Must be currently in foreclosure
      // Store the milestone for custom filtering logic
      (urlFilters as any).foreclosureMilestone = milestone;
    }
    if (month) {
      // Could be used for date filtering in the future
      console.log('Month filter from URL:', month);
    }
    
    // Handle timeline status filter from foreclosure monitoring
    if (timelineStatus) {
      urlFilters.timelineStatus = [timelineStatus];
    }
    
    // Handle SOL filter from dashboard navigation
    if (solFilter) {
      switch (solFilter) {
        case 'expired':
          urlFilters.solExpiration = 'expired';
          break;
        case 'at_risk':
          urlFilters.solRiskLevel = ['MEDIUM', 'HIGH'];
          break;
        case 'high_risk':
          urlFilters.solRiskLevel = ['HIGH'];
          break;
        case 'expiring_soon':
          urlFilters.solExpiration = 'expiring_90';
          break;
      }
    }
    
    return urlFilters;
  };

  const [activeFilters, setActiveFilters] = useState<FilterValues>(getInitialFilters());
  const [hasAppliedFilter, setHasAppliedFilter] = useState(!!searchParams.toString());
  const [isExportModalOpen, setExportModalOpen] = useState(false);
  const [customExportColumns, setCustomExportColumns] = useState<string[]>(['loan_id', 'prin_bal', 'legal_status']); // Set some defaults

  const handleApplyFilters = (filters: FilterValues) => {
    setActiveFilters(filters);
    setHasAppliedFilter(true);
  };

  // Function to determine the latest completed foreclosure milestone
  const getLatestForeclosureMilestone = useCallback((loan: Loan): string | null => {
    const milestones = [
      { name: 'FC Start', date: loan.fc_start_date },
      { name: 'Referral', date: loan.referral_date },
      { name: 'Title Ordered', date: loan.title_ordered_date },
      { name: 'Title Received', date: loan.title_received_date },
      { name: 'Complaint Filed', date: loan.complaint_filed_date },
      { name: 'Service Completed', date: loan.service_completed_date },
      { name: 'Judgment', date: loan.judgment_date }
    ];

    // Filter milestones that have dates and sort by date (latest first)
    const completedMilestones = milestones
      .filter(milestone => milestone.date)
      .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());

    return completedMilestones.length > 0 ? completedMilestones[0].name : null;
  }, []);

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
        
        // Fetch SOL data for all loans using batch API
        try {
          const loanIds = response.data.map(loan => loan.loan_id);
          console.log(`[LoanExplorer] Fetching SOL data for ${loanIds.length} loans using batch API...`);
          
          const solMap = await solService.getBatchLoanSOL(loanIds);
          setSOLData(solMap);
          
          console.log(`[LoanExplorer] Successfully loaded SOL data for ${solMap.size} loans`);
        } catch (err) {
          console.warn('Failed to fetch SOL data:', err);
        }
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
    return states.filter((state: any) => loanStateAbbrs.has(state.code)).map((state: any) => ({ name: state.name, abbr: state.code })).sort((a: any, b: any) => a.name.localeCompare(b.name));
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
    if (!loans) return [];
    
    // If global search is active, search across all loans regardless of filters
    if (globalFilter && globalFilter.length > 0) {
      const searchTerm = globalFilter.toLowerCase();
      const searchResults = loans.filter(loan => 
        loan.loan_id?.toLowerCase().includes(searchTerm) ||
        `${loan.first_name} ${loan.last_name}`.toLowerCase().includes(searchTerm) ||
        loan.address?.toLowerCase().includes(searchTerm) ||
        loan.investor_name?.toLowerCase().includes(searchTerm)
      );
      
      // If search has results, return them regardless of hasAppliedFilter
      if (searchResults.length > 0) {
        return searchResults;
      }
    }
    
    // Show all loans by default, filter only when search/filters are applied
    // if (!hasAppliedFilter && (!globalFilter || globalFilter.length === 0)) {
    //   return [];
    // }

    return loans.filter(loan => {
      const { propertyState, assetStatus, investor, lienPos, principalBalance, timelineStatus, maturityFilter, solRiskLevel, solExpiration } = activeFilters;

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
      if (timelineStatus.length > 0) {
        const loanStatus = getOverallLoanStatus(loan);
        // If a loan's status is not in the selected filter array, exclude it.
        if (!loanStatus || !timelineStatus.includes(loanStatus)) {
          return false;
        }
      }

      // Maturity date filter
      if (maturityFilter && maturityFilter !== 'any') {
        const maturityDate = loan.maturity_date ? new Date(loan.maturity_date) : null;
        const today = new Date();
        const threeMonthsFromNow = new Date(today.getTime() + (90 * 24 * 60 * 60 * 1000));
        const sixMonthsFromNow = new Date(today.getTime() + (180 * 24 * 60 * 60 * 1000));
        const twelveMonthsFromNow = new Date(today.getTime() + (365 * 24 * 60 * 60 * 1000));
        const twelveMonthsAgo = new Date(today.getTime() - (365 * 24 * 60 * 60 * 1000));

        if (!maturityDate) {
          // If no maturity date and filter is not 'any', exclude the loan
          return false;
        }

        switch (maturityFilter) {
          case 'past':
            if (maturityDate >= today) return false;
            break;
          case 'next3':
            if (maturityDate < today || maturityDate > threeMonthsFromNow) return false;
            break;
          case 'next6':
            if (maturityDate < today || maturityDate > sixMonthsFromNow) return false;
            break;
          case 'next12':
            if (maturityDate < today || maturityDate > twelveMonthsFromNow) return false;
            break;
          case 'last12':
            if (maturityDate < twelveMonthsAgo || maturityDate > today) return false;
            break;
        }
      }

      // Foreclosure milestone filter (custom logic for dashboard drill-down)
      const foreclosureMilestone = (activeFilters as any).foreclosureMilestone;
      if (foreclosureMilestone) {
        // Must be currently in foreclosure (legal_status = 'FC')
        if (loan.legal_status !== 'FC') {
          return false;
        }
        
        // Latest completed milestone must match the clicked milestone
        const latestMilestone = getLatestForeclosureMilestone(loan);
        if (latestMilestone !== foreclosureMilestone) {
          return false;
        }
      }

      // SOL Risk Level filter
      if (solRiskLevel.length > 0) {
        const solCalc = solData.get(loan.loan_id);
        if (!solCalc || !solRiskLevel.includes(solCalc.sol_risk_level)) {
          return false;
        }
      }

      // SOL Expiration filter
      if (solExpiration && solExpiration !== 'any') {
        const solCalc = solData.get(loan.loan_id);
        if (!solCalc) {
          return false;
        }

        const today = new Date();
        const expirationDate = new Date(solCalc.adjusted_expiration_date);
        const daysUntilExpiration = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        switch (solExpiration) {
          case 'expired':
            if (!solCalc.is_expired) return false;
            break;
          case 'expiring_30':
            if (solCalc.is_expired || daysUntilExpiration < 0 || daysUntilExpiration > 30) return false;
            break;
          case 'expiring_90':
            if (solCalc.is_expired || daysUntilExpiration < 0 || daysUntilExpiration > 90) return false;
            break;
          case 'expiring_180':
            if (solCalc.is_expired || daysUntilExpiration < 0 || daysUntilExpiration > 180) return false;
            break;
          case 'expiring_365':
            if (solCalc.is_expired || daysUntilExpiration < 0 || daysUntilExpiration > 365) return false;
            break;
        }
      }

      return true; // If all checks pass, include the loan
    });
  }, [loans, activeFilters, hasAppliedFilter, globalFilter, getLatestForeclosureMilestone, solData]);

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
          <span className="financial-link" style={{ fontWeight: '500' }}>
            {info.getValue() || 'N/A'}
          </span>
        ),
      }),
      columnHelper.accessor((row) => `${row.first_name || ''} ${row.last_name || ''}`.trim(), {
        id: 'borrower_name',
        header: 'Borrower Name',
        cell: info => (
          <span style={{ color: 'var(--color-text)', fontWeight: '500' }}>
            {info.getValue() || 'N/A'}
          </span>
        ),
      }),
      columnHelper.accessor('address', {
        header: 'Property Address',
        cell: info => (
          <span style={{ color: 'var(--color-text)' }}>
            {info.getValue() || 'N/A'}
          </span>
        ),
      }),
      columnHelper.accessor('city', {
        header: 'City',
        cell: info => (
          <span style={{ color: 'var(--color-text)' }}>
            {info.getValue() || 'N/A'}
          </span>
        ),
      }),
      columnHelper.accessor('state', {
        header: 'State',
        cell: info => (
          <span style={{ color: 'var(--color-text)' }}>
            {info.getValue() || 'N/A'}
          </span>
        ),
      }),
      columnHelper.accessor('prin_bal', {
        header: 'UPB',
        cell: info => {
          const value = info.getValue();
          return (
            <span className="financial-mono" style={{ 
              fontWeight: '600', 
              color: 'var(--color-text)'
            }}>
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
            <span style={{ 
              color: 'var(--color-text)'
            }}>
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
            <span style={{ 
              color: 'var(--color-text)'
            }}>
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
          <span style={{ fontWeight: '500', color: 'var(--color-text)' }}>
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
      <div className="global-warm-theme" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh'
      }}>
        <div style={{ 
          fontSize: '14px', 
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>LOADING LOANS...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="global-warm-theme" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh'
      }}>
        <div style={{ 
          fontSize: '14px', 
          color: 'var(--color-danger)' 
        }}>{error}</div>
      </div>
    );
  }

  return (
    <div className="global-warm-theme" style={{ 
      padding: '12px', 
      minHeight: '100vh'
    }}>
      {/* Page Header */}
      <div className="quick-stats" style={{ marginBottom: '16px' }}>
        <div className="quick-stat">
          <span className="label">LOAN EXPLORER</span>
          <span className="value">PORTFOLIO ANALYSIS</span>
        </div>
        <div className="quick-stat">
          <span className="label">TOTAL LOANS</span>
          <span className="value">{loans.length}</span>
        </div>
        <div className="quick-stat">
          <span className="label">FILTERED</span>
          <span className="value">{filteredData.length}</span>
        </div>
        {searchParams.toString() && (
          <div className="quick-stat">
            <span className="label">DASHBOARD FILTER</span>
            <span className="value" style={{ color: 'var(--color-info)' }}>ACTIVE</span>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '12px', alignItems: 'start' }}>
        {/* Filter Panel (Left) */}
        <div>
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
        <div className="financial-card scroll-container">
          <div style={{ 
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '8px',
            marginBottom: '12px'
          }}>
            <DataToolbar
              globalFilter={globalFilter}
              setGlobalFilter={setGlobalFilter}
              filteredLoanCount={filteredData.length}
              totalLoanCount={loans.length}
              onExport={handleExport}
              onCustomize={() => setExportModalOpen(true)}
              exporting={exporting}
            />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="financial-table">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th key={header.id}>
                        {header.isPlaceholder ? null : (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: header.column.getCanSort() ? 'pointer' : 'default'
                            }}
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
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedLoanId(row.original.loan_id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="data-value">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {table.getRowModel().rows.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              padding: '48px 24px',
              color: 'var(--color-text-muted)' 
            }}>
              <h3 style={{ 
                fontSize: '14px', 
                fontWeight: '600', 
                color: 'var(--color-text-primary)',
                textTransform: 'uppercase',
                marginBottom: '8px'
              }}>
                {filteredData.length === 0 ? "NO LOANS FOUND" : "LOADING LOANS..."}
              </h3>
              <p style={{ 
                fontSize: '12px',
                color: 'var(--color-text-muted)'
              }}>
                {filteredData.length === 0
                  ? "No loans match your current filter criteria. Try adjusting your filters."
                  : "Loading loan data..."}
              </p>
            </div>
          )}
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
