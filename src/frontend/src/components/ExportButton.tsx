// src/frontend/src/components/ExportButton.tsx
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@loanvision/shared/components/ui/dropdown-menu';
import { Button } from '@loanvision/shared/components/ui/button';

interface ExportButtonProps {
  onExport: (format: 'pdf' | 'excel') => void;
  exporting: boolean;
}

export function ExportButton({ onExport, exporting }: ExportButtonProps) {
  const [open, setOpen] = useState(false);

  const handleExport = (format: 'pdf' | 'excel') => {
    setOpen(false); // Close dropdown after selection
    onExport(format);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exporting}>
          {exporting ? 'Exporting...' : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('excel')} disabled={exporting}>
          Download as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')} disabled={exporting}>
          Download as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}