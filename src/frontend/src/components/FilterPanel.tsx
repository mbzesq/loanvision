// src/frontend/src/components/FilterPanel.tsx

import { useState } from 'react';
import { Button } from '@loanvision/shared/components/ui/button';
import { Checkbox } from '@loanvision/shared/components/ui/checkbox';
import { Input } from '@loanvision/shared/components/ui/input';
import { Label } from '@loanvision/shared/components/ui/label';
import { Badge } from '@loanvision/shared/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@loanvision/shared/components/ui/accordion';

// Define the shape of the filter values for state management
export type FilterValues = {
  propertyState: string[];
  loanType: string[];
  principalBalance: { min: number | ''; max: number | '' };
};

// Define the component's props
interface FilterPanelProps {
  onApplyFilters: (filters: FilterValues) => void;
  availableStates: string[];
  availableLoanTypes: string[];
}

// Define the initial state for the filters
export const initialFilters: FilterValues = {
  propertyState: [],
  loanType: [],
  principalBalance: { min: '', max: '' },
};

export function FilterPanel({
  onApplyFilters,
  availableStates,
  availableLoanTypes,
}: FilterPanelProps) {
  const [filters, setFilters] = useState<FilterValues>(initialFilters);

  // Handler for multi-select checkbox groups
  const handleCheckboxChange = (
    field: 'propertyState' | 'loanType',
    value: string,
    checked: boolean
  ) => {
    setFilters((prev) => {
      const currentValues = prev[field];
      const newValues = checked
        ? [...currentValues, value]
        : currentValues.filter((item) => item !== value);
      return { ...prev, [field]: newValues };
    });
  };

  // Handler for min/max range input fields
  const handleRangeChange = (
    field: 'principalBalance',
    type: 'min' | 'max',
    value: string
  ) => {
    setFilters((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [type]: value === '' ? '' : Number(value),
      },
    }));
  };

  const handleApply = () => onApplyFilters(filters);
  const handleClear = () => {
    setFilters(initialFilters);
    onApplyFilters(initialFilters);
  };

  return (
    <div className="flex flex-col h-full border rounded-lg">
      <div className="p-4 border-b bg-slate-50">
        <h2 className="text-base font-semibold">Filter Criteria</h2>
      </div>

      <div className="flex-grow overflow-y-auto">
        <Accordion type="multiple" className="w-full">
          {/* Property State Filter */}
          <AccordionItem value="state">
            <AccordionTrigger className="text-sm font-medium hover:no-underline border-b">
              <div className="flex justify-between w-full items-center pr-2">
                <span>Property State</span>
                {filters.propertyState.length > 0 && (
                  <Badge variant="secondary">{filters.propertyState.length}</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-0">
              <div className="flex flex-col gap-2 p-4 max-h-48 overflow-y-auto">
                {availableStates.map((state) => (
                  <div key={state} className="flex items-center space-x-2">
                    <Checkbox
                      id={`state-${state}`}
                      checked={filters.propertyState.includes(state)}
                      onCheckedChange={(checked) => handleCheckboxChange('propertyState', state, !!checked)}
                    />
                    <Label htmlFor={`state-${state}`} className="font-normal">{state}</Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Loan Type Filter */}
          <AccordionItem value="loan-type">
            <AccordionTrigger className="text-sm font-medium hover:no-underline border-b">
              <div className="flex justify-between w-full items-center pr-2">
                <span>Loan Type</span>
                {filters.loanType.length > 0 && (
                  <Badge variant="secondary">{filters.loanType.length}</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-0">
               <div className="flex flex-col gap-2 p-4 max-h-48 overflow-y-auto">
                {availableLoanTypes.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`type-${type}`}
                      checked={filters.loanType.includes(type)}
                      onCheckedChange={(checked) => handleCheckboxChange('loanType', type, !!checked)}
                    />
                    <Label htmlFor={`type-${type}`} className="font-normal">{type}</Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Principal Balance Filter */}
          <AccordionItem value="balance">
            <AccordionTrigger className="text-sm font-medium hover:no-underline border-b">
              <div className="flex justify-between w-full items-center pr-2">
                <span>Principal Balance</span>
                {(filters.principalBalance.min !== '' || filters.principalBalance.max !== '') && (
                  <Badge variant="secondary">Active</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-0">
              <div className="flex gap-2 p-4">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.principalBalance.min}
                  onChange={(e) => handleRangeChange('principalBalance', 'min', e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.principalBalance.max}
                  onChange={(e) => handleRangeChange('principalBalance', 'max', e.target.value)}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="p-4 border-t flex gap-2">
        <Button variant="ghost" className="w-full text-slate-600" onClick={handleClear}>Reset</Button>
        <Button className="w-full" onClick={handleApply}>Apply</Button>
      </div>
    </div>
  );
}