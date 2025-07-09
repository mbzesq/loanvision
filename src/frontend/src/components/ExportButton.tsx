// src/frontend/src/components/ExportButton.tsx
import { useState, useRef } from 'react';
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
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={exporting}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            cursor: exporting ? 'not-allowed' : 'pointer',
            opacity: exporting ? 0.5 : 1
          }}
        >
          {exporting ? 'Exporting...' : 'Export'}
        </button>
      </div>

      {/* Conditionally render the dropdown menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: '4px',
            width: '180px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 50
          }}
        >
          <div style={{ padding: '4px 0' }}>
            <button
              onClick={() => handleSelect('excel')}
              disabled={exporting}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                fontSize: '11px',
                backgroundColor: 'transparent',
                color: 'var(--color-text)',
                border: 'none',
                cursor: exporting ? 'not-allowed' : 'pointer',
                opacity: exporting ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!exporting) {
                  (e.target as HTMLElement).style.backgroundColor = 'var(--color-surface-light)';
                }
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              Download as Excel
            </button>
            <button
              onClick={() => handleSelect('pdf')}
              disabled={exporting}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                fontSize: '11px',
                backgroundColor: 'transparent',
                color: 'var(--color-text)',
                border: 'none',
                cursor: exporting ? 'not-allowed' : 'pointer',
                opacity: exporting ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!exporting) {
                  (e.target as HTMLElement).style.backgroundColor = 'var(--color-surface-light)';
                }
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              Download as PDF
            </button>
            <div style={{ borderTop: '1px solid var(--color-border)', margin: '4px 0' }}></div>
            <button
              onClick={onCustomize}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                fontSize: '11px',
                backgroundColor: 'transparent',
                color: 'var(--color-accent)',
                border: 'none',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = 'var(--color-surface-light)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              Customize Export...
            </button>
          </div>
        </div>
      )}
    </div>
  );
}