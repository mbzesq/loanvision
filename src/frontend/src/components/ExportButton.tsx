// src/frontend/src/components/ExportButton.tsx

import { useState } from 'react';
import { Button } from '@loanvision/shared/components/ui/button';
import { ChevronDown } from 'lucide-react';

interface ExportButtonProps {
  onExport?: (format: 'pdf' | 'excel') => void;
  exporting?: boolean;
}

export function ExportButton({ onExport, exporting = false }: ExportButtonProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  const handleExport = (format: 'pdf' | 'excel') => {
    setShowDropdown(false);
    onExport?.(format);
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={exporting}
        className="flex items-center gap-1"
      >
        {exporting ? 'Exporting...' : 'Export'}
        <ChevronDown className="h-3 w-3" />
      </Button>
      
      {showDropdown && !exporting && (
        <div className="absolute top-full right-0 mt-1 bg-white border rounded-md shadow-lg z-10 min-w-[150px]">
          <button
            onClick={() => handleExport('pdf')}
            className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
          >
            Download as PDF
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors border-t"
          >
            Download as Excel
          </button>
        </div>
      )}
    </div>
  );
}