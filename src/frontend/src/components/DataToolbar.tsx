// src/frontend/src/components/DataToolbar.tsx

import { Search } from 'lucide-react';
import { Input } from "@loanvision/shared/components/ui/input";
import { Button } from "@loanvision/shared/components/ui/button";
import { ExportButton } from "./ExportButton";

interface DataToolbarProps {
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  totalLoanCount: number;
  filteredLoanCount: number;
  onExport?: (format: 'pdf' | 'excel') => void;
  exporting?: boolean;
}

export function DataToolbar({
  globalFilter,
  setGlobalFilter,
  totalLoanCount,
  filteredLoanCount,
  onExport,
  exporting,
}: DataToolbarProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-6">
        {/* Results Summary */}
        <span className="text-sm text-slate-600">
          Viewing <span className="font-semibold text-slate-800">{filteredLoanCount.toLocaleString()}</span> of <span className="font-semibold text-slate-800">{totalLoanCount.toLocaleString()}</span> loans
        </span>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search all loans..."
            value={globalFilter ?? ''}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="h-9 w-[250px] pl-10"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Future Feature Buttons */}
        <Button variant="outline" size="sm" disabled>
          Save View
        </Button>
        <Button variant="outline" size="sm" disabled>
          Compare
        </Button>

        {/* Export Button */}
        <ExportButton
          onExport={onExport || (() => {})}
          exporting={exporting || false}
        />
      </div>
    </div>
  );
}