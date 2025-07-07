// src/frontend/src/components/ExportCustomizerModal.tsx
import { useState, useMemo } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">Customize Export</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        {/* Body */}
        <div className="p-6 flex-grow overflow-y-auto">
          <Input
            placeholder="Search for fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-4"
          />
          <div className="space-y-2">
            {filteredColumns.map(column => (
              <div key={column} className="flex items-center space-x-3">
                <Checkbox
                  id={`col-${column}`}
                  checked={selected.includes(column)}
                  onCheckedChange={(checked) => handleSelect(column, !!checked)}
                />
                <Label htmlFor={`col-${column}`} className="font-normal text-sm">
                  {column}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center p-4 border-t gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Apply to Export</Button>
        </div>
      </div>
    </div>
  );
}