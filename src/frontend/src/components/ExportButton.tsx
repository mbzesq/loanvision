// src/frontend/src/components/ExportButton.tsx
import { useState, useRef } from 'react';
import { Button } from '../components/ui/button';
import { useOnClickOutside } from '../hooks/useOnClickOutside';

interface ExportButtonProps {
  onExport: (format: 'pdf' | 'excel') => void;
  onCustomize: () => void; // Add this new prop
  exporting: boolean;
}

export function ExportButton({ onExport, onCustomize, exporting }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close the dropdown if a click is detected outside
  useOnClickOutside(dropdownRef, () => setIsOpen(false));

  const handleSelect = (format: 'pdf' | 'excel') => {
    onExport(format);
    setIsOpen(false); // Close the menu after selection
  };

  return (
    // The ref is attached to the parent div for click detection
    <div ref={dropdownRef} className="relative inline-block text-left">
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          disabled={exporting}
        >
          {exporting ? 'Exporting...' : 'Export'}
        </Button>
      </div>

      {/* Conditionally render the dropdown menu */}
      {isOpen && (
        <div
          className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50"
        >
          <div className="py-1" role="menu" aria-orientation="vertical">
            <button
              onClick={() => handleSelect('excel')}
              disabled={exporting}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              role="menuitem"
            >
              Download as Excel
            </button>
            <button
              onClick={() => handleSelect('pdf')}
              disabled={exporting}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              role="menuitem"
            >
              Download as PDF
            </button>
            <div className="border-t my-1"></div> {/* Separator */}
            <button
              onClick={onCustomize}
              className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-gray-100"
              role="menuitem"
            >
              Customize Export...
            </button>
          </div>
        </div>
      )}
    </div>
  );
}