// src/frontend/src/components/ExportCustomizerModal.tsx
import { useState, useMemo } from 'react';
import { Checkbox } from '../components/ui/checkbox';
import { X } from 'lucide-react';

interface ExportCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableColumns: string[];
  defaultColumns: string[];
  onSave: (selectedColumns: string[]) => void;
}

export function ExportCustomizerModal({
  isOpen,
  onClose,
  availableColumns,
  defaultColumns,
  onSave,
}: ExportCustomizerModalProps) {
  const [selected, setSelected] = useState<string[]>(defaultColumns);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredColumns = useMemo(() =>
    availableColumns.filter(col =>
      col.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  [availableColumns, searchTerm]);

  const handleSelect = (column: string, checked: boolean) => {
    setSelected(prev =>
      checked ? [...prev, column] : prev.filter(c => c !== column)
    );
  };

  const handleSave = () => {
    onSave(selected);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{ 
      position: 'fixed', 
      inset: 0, 
      backgroundColor: 'rgba(0, 0, 0, 0.6)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 50, 
      padding: '16px' 
    }}>
      <div style={{ 
        backgroundColor: 'var(--color-surface)', 
        borderRadius: 'var(--radius)', 
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)', 
        maxWidth: '500px', 
        width: '100%', 
        maxHeight: '80vh', 
        display: 'flex', 
        flexDirection: 'column',
        border: '1px solid var(--color-border)'
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '16px', 
          borderBottom: '1px solid var(--color-border)'
        }}>
          <h2 style={{ 
            fontSize: '14px', 
            fontWeight: '600', 
            color: 'var(--color-text)', 
            margin: 0 
          }}>
            Customize Export
          </h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              padding: '4px'
            }}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ 
          padding: '20px', 
          flexGrow: 1, 
          overflowY: 'auto' 
        }}>
          <input
            placeholder="Search for fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '12px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text)',
              marginBottom: '16px'
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredColumns.map(column => (
              <div key={column} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px' 
              }}>
                <Checkbox
                  id={`col-${column}`}
                  checked={selected.includes(column)}
                  onCheckedChange={(checked) => handleSelect(column, !!checked)}
                />
                <label htmlFor={`col-${column}`} style={{ 
                  fontSize: '12px',
                  color: 'var(--color-text)',
                  cursor: 'pointer'
                }}>
                  {column}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          alignItems: 'center', 
          padding: '16px', 
          borderTop: '1px solid var(--color-border)', 
          gap: '8px' 
        }}>
          <button 
            onClick={onClose}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text)',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Apply to Export
          </button>
        </div>
      </div>
    </div>
  );
}