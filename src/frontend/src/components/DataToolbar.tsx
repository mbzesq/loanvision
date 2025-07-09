// src/frontend/src/components/DataToolbar.tsx

import { Search, X } from 'lucide-react';
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { ExportButton } from "./ExportButton";

interface DataToolbarProps {
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  totalLoanCount: number;
  filteredLoanCount: number;
  onExport?: (format: 'pdf' | 'excel') => void;
  onCustomize?: () => void;
  exporting?: boolean;
}

export function DataToolbar({
  globalFilter,
  setGlobalFilter,
  totalLoanCount,
  filteredLoanCount,
  onExport,
  onCustomize,
  exporting,
}: DataToolbarProps) {
  const handleClearSearch = () => {
    setGlobalFilter('');
    // Focus the input after clearing
    const searchInput = document.querySelector('input[placeholder="Search all loans..."]') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
  };

  return (
    <div className="data-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        {/* Results Summary */}
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          Viewing <span style={{ fontWeight: '600', color: 'var(--color-text)' }}>{filteredLoanCount.toLocaleString()}</span> of <span style={{ fontWeight: '600', color: 'var(--color-text)' }}>{totalLoanCount.toLocaleString()}</span> loans
        </span>

        {/* Search Input */}
        <div style={{ position: 'relative' }}>
          <Search style={{ 
            position: 'absolute', 
            left: '8px', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            width: '12px', 
            height: '12px', 
            color: 'var(--color-text-muted)' 
          }} />
          <input
            placeholder="Search all loans..."
            value={globalFilter ?? ''}
            onChange={(event) => setGlobalFilter(event.target.value)}
            style={{
              height: '28px',
              width: '200px',
              paddingLeft: '28px',
              paddingRight: globalFilter ? '28px' : '8px',
              fontSize: '11px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text)'
            }}
          />
          {globalFilter && globalFilter.length > 0 && (
            <button
              onClick={handleClearSearch}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                padding: '2px'
              }}
              type="button"
              aria-label="Clear search"
            >
              <X style={{ width: '12px', height: '12px' }} />
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Future Feature Buttons */}
        <button 
          disabled
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-text-muted)',
            cursor: 'not-allowed',
            opacity: 0.6
          }}
        >
          Save View
        </button>
        <button 
          disabled
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-text-muted)',
            cursor: 'not-allowed',
            opacity: 0.6
          }}
        >
          Compare
        </button>

        {/* Export Button */}
        <ExportButton
          onExport={onExport || (() => {})}
          onCustomize={onCustomize || (() => {})}
          exporting={exporting || false}
        />
      </div>
    </div>
  );
}