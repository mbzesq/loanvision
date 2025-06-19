// src/frontend/src/components/ExportButton.tsx
import { Button } from '@loanvision/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@loanvision/shared/components/ui/dropdown-menu';

interface ExportButtonProps {
  onExport: (format: 'pdf' | 'excel') => void;
  exporting: boolean;
}

export function ExportButton({ onExport, exporting }: ExportButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exporting}>
          {exporting ? 'Exporting...' : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48">
        <DropdownMenuItem
          onClick={() => onExport('excel')}
          disabled={exporting}
        >
          Download as Excel
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onExport('pdf')}
          disabled={exporting}
        >
          Download as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}