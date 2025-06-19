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
  assetStatus: string[]; // Renamed from loanType
  investor: string[];    // New
  lienPosition: number[]; // New
  principalBalance: { min: number | ''; max: number | '' };
};

// Define the component's props
interface FilterPanelProps {
  onApplyFilters: (filters: FilterValues) => void;
  availableStates: State[];
  availableAssetStatuses: string[]; // Renamed
  availableInvestors: string[];     // New
  availableLienPositions: number[]; // New
}

// Define the initial state for the filters
export const initialFilters: FilterValues = {
  propertyState: [],
  assetStatus: [], // Renamed
  investor: [],    // New
  lienPosition: [], // New
  principalBalance: { min: '', max: '' },
};

export function FilterPanel({
  onApplyFilters,
  availableStates,
  availableAssetStatuses,
  availableInvestors,
  availableLienPositions,
}: FilterPanelProps) {
  const [filters, setFilters] = useState<FilterValues>(initialFilters);
  const [searchTerms, setSearchTerms] = useState({
    propertyState: '',
    assetStatus: '',
    investor: '',
    lienPosition: '',
  });

  // Handler for multi-select checkbox groups
  const handleCheckboxChange = (
    field: 'propertyState' | 'assetStatus' | 'investor' | 'lienPosition',
    value: string | number,
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
  const handleSearchChange = (field: 'propertyState' | 'assetStatus' | 'investor' | 'lienPosition', value: string) => {
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

  const filteredAssetStatuses = useMemo(() =>
    availableAssetStatuses.filter(status =>
      status.toLowerCase().includes(searchTerms.assetStatus.toLowerCase())
    ), [availableAssetStatuses, searchTerms.assetStatus]);

  const filteredInvestors = useMemo(() =>
    availableInvestors.filter(investor =>
      investor.toLowerCase().includes(searchTerms.investor.toLowerCase())
    ), [availableInvestors, searchTerms.investor]);

  const filteredLienPositions = useMemo(() =>
    availableLienPositions.filter(position =>
      position.toString().includes(searchTerms.lienPosition)
    ), [availableLienPositions, searchTerms.lienPosition]);

  const handleApply = () => onApplyFilters(filters);
  const handleClear = () => {
    setFilters(initialFilters);
    setSearchTerms({ propertyState: '', assetStatus: '', investor: '', lienPosition: '' });
    onApplyFilters(initialFilters);
  };

  return (
    <div className="flex flex-col h-full border rounded-lg">
      <div className="p-4 border-b bg-slate-50">
        <h2 className="text-base font-semibold">Filter Criteria</h2>
      </div>

      <div className="p-4 border-b flex gap-2">
        <Button variant="ghost" className="w-full text-slate-600" onClick={handleClear}>Reset</Button>
        <Button className="w-full" onClick={handleApply}>Apply</Button>
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

          {/* Asset Status Filter */}
          <AccordionItem value="asset-status">
            <AccordionTrigger className="text-sm font-medium hover:no-underline border-b">
              <div className="flex justify-between w-full items-center pr-2">
                <span>Asset Status</span>
                {filters.assetStatus.length > 0 && (
                  <Badge variant="secondary">{filters.assetStatus.length}</Badge>
                )}
              </div>
            </AccordionTrigger>
            {filters.assetStatus.length > 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1">
                {filters.assetStatus.map((status) => (
                  <Badge key={status} variant="secondary" className="flex items-center gap-1">
                    {status}
                    <button
                      onClick={() => handleCheckboxChange('assetStatus', status, false)}
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
                  placeholder="Search asset statuses..."
                  value={searchTerms.assetStatus}
                  onChange={(e) => handleSearchChange('assetStatus', e.target.value)}
                  className="mb-2"
                />
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {filteredAssetStatuses.map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status}`}
                        checked={filters.assetStatus.includes(status)}
                        onCheckedChange={(checked) => handleCheckboxChange('assetStatus', status, !!checked)}
                      />
                      <Label htmlFor={`status-${status}`} className="font-normal">{status}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Investor Filter */}
          <AccordionItem value="investor">
            <AccordionTrigger className="text-sm font-medium hover:no-underline border-b">
              <div className="flex justify-between w-full items-center pr-2">
                <span>Investor</span>
                {filters.investor.length > 0 && (
                  <Badge variant="secondary">{filters.investor.length}</Badge>
                )}
              </div>
            </AccordionTrigger>
            {filters.investor.length > 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1">
                {filters.investor.map((investor) => (
                  <Badge key={investor} variant="secondary" className="flex items-center gap-1">
                    {investor}
                    <button
                      onClick={() => handleCheckboxChange('investor', investor, false)}
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
                  placeholder="Search investors..."
                  value={searchTerms.investor}
                  onChange={(e) => handleSearchChange('investor', e.target.value)}
                  className="mb-2"
                />
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {filteredInvestors.map((investor) => (
                    <div key={investor} className="flex items-center space-x-2">
                      <Checkbox
                        id={`investor-${investor}`}
                        checked={filters.investor.includes(investor)}
                        onCheckedChange={(checked) => handleCheckboxChange('investor', investor, !!checked)}
                      />
                      <Label htmlFor={`investor-${investor}`} className="font-normal">{investor}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Lien Position Filter */}
          <AccordionItem value="lien-position">
            <AccordionTrigger className="text-sm font-medium hover:no-underline border-b">
              <div className="flex justify-between w-full items-center pr-2">
                <span>Lien Position</span>
                {filters.lienPosition.length > 0 && (
                  <Badge variant="secondary">{filters.lienPosition.length}</Badge>
                )}
              </div>
            </AccordionTrigger>
            {filters.lienPosition.length > 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1">
                {filters.lienPosition.map((position) => (
                  <Badge key={position} variant="secondary" className="flex items-center gap-1">
                    {position}
                    <button
                      onClick={() => handleCheckboxChange('lienPosition', position, false)}
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
                  placeholder="Search lien positions..."
                  value={searchTerms.lienPosition}
                  onChange={(e) => handleSearchChange('lienPosition', e.target.value)}
                  className="mb-2"
                />
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {filteredLienPositions.map((position) => (
                    <div key={position} className="flex items-center space-x-2">
                      <Checkbox
                        id={`position-${position}`}
                        checked={filters.lienPosition.includes(position)}
                        onCheckedChange={(checked) => handleCheckboxChange('lienPosition', position, !!checked)}
                      />
                      <Label htmlFor={`position-${position}`} className="font-normal">{position}</Label>
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
    </div>
  );
}