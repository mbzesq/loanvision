// src/frontend/src/components/ExportButton.tsx

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@loanvision/shared/components/ui/dropdown-menu';
import { Button } from '@loanvision/shared/components/ui/button';

// Placeholder functions for the export logic.
// In the future, these will trigger API calls.
const handleExportExcel = () => {
  console.log('Exporting to Excel...');
};

const handleExportPdf = () => {
  console.log('Exporting to PDF...');
};

export function ExportButton() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportExcel}>
          Download as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPdf}>
          Download as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}