// src/frontend/src/pages/TestExportPage.tsx

import { ExportButton } from "../components/ExportButton";

export function TestExportPage() {

  const handleTestExport = (format: 'pdf' | 'excel') => {
    console.log(`Test page: Export button clicked with format: ${format}`);
    alert(`Test export triggered for: ${format}`);
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="p-10 border rounded-lg">
        <h1 className="text-2xl font-bold mb-4">Export Button Test</h1>
        <p className="text-slate-600 mb-6">This page renders the ExportButton in isolation.</p>
        <ExportButton
          onExport={handleTestExport}
          exporting={false}
        />
      </div>
    </div>
  );
}