// src/frontend/src/components/DataToolbar.tsx

import { Search, X } from 'lucide-react';
import { ExportButton } from "./ExportButton";

interface DataToolbarProps {
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  totalLoanCount: number;
  filteredLoanCount: number;
  onExport?: (format: 'pdf' | 'excel') => void;
  onCustomize?: () => void;
  exporting?: boolean;
}

export function DataToolbar({
  globalFilter,
  setGlobalFilter,
  totalLoanCount,
  filteredLoanCount,
  onExport,
  onCustomize,
  exporting,
}: DataToolbarProps) {
  const handleClearSearch = () => {
    setGlobalFilter('');
    // Focus the input after clearing
    const searchInput = document.querySelector('input[placeholder="Search all loans..."]') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-6">
        {/* Results Summary */}
        <span className="text-sm text-gray-500">
          Viewing <span className="font-semibold text-gray-900">{filteredLoanCount.toLocaleString()}</span> of <span className="font-semibold text-gray-900">{totalLoanCount.toLocaleString()}</span> loans
        </span>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            placeholder="Search all loans..."
            value={globalFilter ?? ''}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="h-8 w-64 pl-8 pr-8 text-sm border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
          {globalFilter && globalFilter.length > 0 && (
            <button
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
              type="button"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Future Feature Buttons */}
        <button 
          disabled
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-md bg-gray-50 text-gray-400 cursor-not-allowed"
        >
          Save View
        </button>
        <button 
          disabled
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-md bg-gray-50 text-gray-400 cursor-not-allowed"
        >
          Compare
        </button>

        {/* Export Button */}
        <ExportButton
          onExport={onExport || (() => {})}
          onCustomize={onCustomize || (() => {})}
          exporting={exporting || false}
        />
      </div>
    </div>
  );
}