// src/frontend/src/components/FilterPanel.tsx

import { useState, useMemo } from 'react';
import { Button } from '@loanvision/shared/components/ui/button';
import { Checkbox } from '@loanvision/shared/components/ui/checkbox';
import { Input } from '@loanvision/shared/components/ui/input';
import { Label } from '@loanvision/shared/components/ui/label';
import { Badge } from '@loanvision/shared/components/ui/badge';
import { X } from 'lucide-react';
import { State } from '@loanvision/shared/lib/states';
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
  availableStates: State[];
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
  const [searchTerms, setSearchTerms] = useState({
    propertyState: '',
    loanType: '',
  });

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

  // Handler for search input changes
  const handleSearchChange = (field: 'propertyState' | 'loanType', value: string) => {
    setSearchTerms(prev => ({ ...prev, [field]: value }));
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

  // Create filtered lists based on search terms
  const filteredStates = useMemo(() =>
    availableStates.filter(state =>
      state.name.toLowerCase().includes(searchTerms.propertyState.toLowerCase()) ||
      state.abbr.toLowerCase().includes(searchTerms.propertyState.toLowerCase())
    ), [availableStates, searchTerms.propertyState]);

  const filteredLoanTypes = useMemo(() =>
    availableLoanTypes.filter(type =>
      type.toLowerCase().includes(searchTerms.loanType.toLowerCase())
    ), [availableLoanTypes, searchTerms.loanType]);

  const handleApply = () => onApplyFilters(filters);
  const handleClear = () => {
    setFilters(initialFilters);
    setSearchTerms({ propertyState: '', loanType: '' });
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
            {filters.propertyState.length > 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1">
                {filters.propertyState.map((stateAbbr) => {
                  const stateObj = availableStates.find(s => s.abbr === stateAbbr);
                  return (
                    <Badge key={stateAbbr} variant="secondary" className="flex items-center gap-1">
                      {stateObj ? `${stateObj.name} (${stateObj.abbr})` : stateAbbr}
                      <button
                        onClick={() => handleCheckboxChange('propertyState', stateAbbr, false)}
                        className="rounded-full hover:bg-slate-300"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
            <AccordionContent className="pt-0">
              <div className="p-2">
                <Input
                  placeholder="Search states..."
                  value={searchTerms.propertyState}
                  onChange={(e) => handleSearchChange('propertyState', e.target.value)}
                  className="mb-2"
                />
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {filteredStates.map((state) => (
                    <div key={state.abbr} className="flex items-center space-x-2">
                      <Checkbox
                        id={`state-${state.abbr}`}
                        checked={filters.propertyState.includes(state.abbr)}
                        onCheckedChange={(checked) => handleCheckboxChange('propertyState', state.abbr, !!checked)}
                      />
                      <Label htmlFor={`state-${state.abbr}`} className="font-normal">{state.name} ({state.abbr})</Label>
                    </div>
                  ))}
                </div>
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
            {filters.loanType.length > 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1">
                {filters.loanType.map((type) => (
                  <Badge key={type} variant="secondary" className="flex items-center gap-1">
                    {type}
                    <button
                      onClick={() => handleCheckboxChange('loanType', type, false)}
                      className="rounded-full hover:bg-slate-300"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <AccordionContent className="pt-0">
              <div className="p-2">
                <Input
                  placeholder="Search loan types..."
                  value={searchTerms.loanType}
                  onChange={(e) => handleSearchChange('loanType', e.target.value)}
                  className="mb-2"
                />
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {filteredLoanTypes.map((type) => (
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