// src/frontend/src/components/DataToolbar.tsx

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
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-4">
        {/* Results Summary */}
        <span className="text-sm text-gray-600">
          Viewing {filteredLoanCount.toLocaleString()} of {totalLoanCount.toLocaleString()} loans
        </span>

        {/* Keyword Search */}
        <Input
          placeholder="Search all loans..."
          value={globalFilter ?? ''}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className="h-9 w-[250px]"
        />
      </div>

      <div className="flex items-center gap-2">
        {/* Stubbed Buttons for Future Features */}
        <Button variant="outline" size="sm" disabled>Save View</Button>
        <Button variant="outline" size="sm" disabled>Compare</Button>

        {/* Existing Export Button */}
        <ExportButton
          onExport={onExport || (() => {})}
          exporting={exporting || false}
        />
      </div>
    </div>
  );
}