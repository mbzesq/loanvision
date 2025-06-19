// src/frontend/src/components/ExportButton.tsx

import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@loanvision/shared/components/ui/dropdown-menu';
import { Button } from '@loanvision/shared/components/ui/button';
import { ChevronDown } from 'lucide-react';

interface ExportButtonProps {
  onExport?: (format: 'pdf' | 'excel') => void;
  exporting?: boolean;
}

export function ExportButton({ onExport, exporting = false }: ExportButtonProps) {
  const [isOpen, setOpen] = useState(false);

  const handleExport = (format: 'pdf' | 'excel') => {
    setOpen(false);
    onExport?.(format);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exporting}>
          {exporting ? 'Exporting...' : 'Export'}
          <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          Download as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('excel')}>
          Download as Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}