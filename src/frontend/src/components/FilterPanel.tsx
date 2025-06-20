// src/frontend/src/components/FilterPanel.tsx

import { useMemo, useState } from 'react';
import { Button } from '@loanvision/shared/components/ui/button';
import { Checkbox } from '@loanvision/shared/components/ui/checkbox';
import { Input } from '@loanvision/shared/components/ui/input';
import { Label } from '@loanvision/shared/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@loanvision/shared/components/ui/accordion';
import { Badge } from '@loanvision/shared/components/ui/badge';

// Define the shape of the filter values
export type FilterValues = {
  propertyState: string[];
  assetStatus: string[];
  investor: string[];
  lienPosition: string[];
  principalBalance: { min: number | ''; max: number | '' };
};

// Define the component's props
interface FilterPanelProps {
  onApplyFilters: (filters: FilterValues) => void;
  availableStates: { name: string; abbr: string }[];
  availableAssetStatuses: string[];
  availableInvestors: string[];
  availableLienPositions: string[];
  onShowAll: () => void;
  onClearView: () => void;
}

// Define the initial state for the filters
export const initialFilters: FilterValues = {
  propertyState: [],
  assetStatus: [],
  investor: [],
  lienPosition: [],
  principalBalance: { min: '', max: '' },
};

export function FilterPanel({
  onApplyFilters,
  availableStates,
  availableAssetStatuses,
  availableInvestors,
  availableLienPositions,
  onShowAll,
  onClearView,
}: FilterPanelProps) {
  const [filters, setFilters] = useState<FilterValues>(initialFilters);
  const [searchTerms, setSearchTerms] = useState({
    propertyState: '',
    assetStatus: '',
    investor: '',
    lienPosition: '',
  });

  const handleSearchChange = (field: keyof typeof searchTerms, value: string) => {
    setSearchTerms(prev => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (
    field: 'propertyState' | 'assetStatus' | 'investor',
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

  const handleLienPosChange = (value: string, checked: boolean) => {
      setFilters((prev) => {
      const currentValues = prev.lienPosition;
      const newValues = checked
        ? [...currentValues, value]
        : currentValues.filter((item) => item !== value);
      return { ...prev, lienPosition: newValues };
    });
  };

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
    setSearchTerms({ propertyState: '', assetStatus: '', investor: '', lienPosition: '' });
    onApplyFilters(initialFilters);
  };

  // Memoized search results
  const filteredStates = useMemo(() => availableStates.filter(state => state.name.toLowerCase().includes(searchTerms.propertyState.toLowerCase()) || state.abbr.toLowerCase().includes(searchTerms.propertyState.toLowerCase())), [availableStates, searchTerms.propertyState]);
  const filteredAssetStatuses = useMemo(() => availableAssetStatuses.filter(status => status.toLowerCase().includes(searchTerms.assetStatus.toLowerCase())), [availableAssetStatuses, searchTerms.assetStatus]);
  const filteredInvestors = useMemo(() => availableInvestors.filter(inv => inv.toLowerCase().includes(searchTerms.investor.toLowerCase())), [availableInvestors, searchTerms.investor]);
  const filteredLienPositions = useMemo(() => availableLienPositions.filter(pos => pos.toLowerCase().includes(searchTerms.lienPosition.toLowerCase())), [availableLienPositions, searchTerms.lienPosition]);


  return (
    <div className="flex flex-col h-full border rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Filter Criteria</h2>
          <Button variant="link" size="sm" onClick={onShowAll}>Show All</Button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-b flex gap-2 flex-shrink-0">
        <Button variant="outline" className="w-full" onClick={onClearView}>Clear</Button>
        <Button className="w-full bg-blue-600 text-white hover:bg-blue-700" onClick={handleApply}>Apply</Button>
        <Button variant="outline" className="w-full" onClick={handleClear}>Reset</Button>
      </div>

      {/* Accordion Container */}
      <div className="flex-grow overflow-y-auto">
        <Accordion type="multiple" className="w-full">

          {/* Property State */}
          <AccordionItem value="state">
            <AccordionTrigger className="text-sm font-medium hover:no-underline px-4 py-3">
              <div className="flex justify-between w-full items-center">
                <span>Property State</span>
                {filters.propertyState.length > 0 && <Badge variant="secondary">{filters.propertyState.length}</Badge>}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="p-2 bg-slate-50/75 border-t">
                <Input placeholder="Search states..." value={searchTerms.propertyState} onChange={(e) => handleSearchChange('propertyState', e.target.value)} className="mb-2" />
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {filteredStates.map((state) => (
                    <div key={state.abbr} className="flex items-center space-x-2">
                      <Checkbox id={`state-${state.abbr}`} checked={filters.propertyState.includes(state.abbr)} onCheckedChange={(checked) => handleCheckboxChange('propertyState', state.abbr, !!checked)} />
                      <Label htmlFor={`state-${state.abbr}`} className="font-normal">{state.name} ({state.abbr})</Label>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Asset Status */}
          <AccordionItem value="asset-status">
            <AccordionTrigger className="text-sm font-medium hover:no-underline px-4 py-3">
                <div className="flex justify-between w-full items-center">
                    <span>Asset Status</span>
                    {filters.assetStatus.length > 0 && <Badge variant="secondary">{filters.assetStatus.length}</Badge>}
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <div className="p-2 bg-slate-50/75 border-t">
                    <Input placeholder="Search statuses..." value={searchTerms.assetStatus} onChange={(e) => handleSearchChange('assetStatus', e.target.value)} className="mb-2" />
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                        {filteredAssetStatuses.map((status) => (
                            <div key={status} className="flex items-center space-x-2">
                                <Checkbox id={`status-${status}`} checked={filters.assetStatus.includes(status)} onCheckedChange={(checked) => handleCheckboxChange('assetStatus', status, !!checked)} />
                                <Label htmlFor={`status-${status}`} className="font-normal">{status}</Label>
                            </div>
                        ))}
                    </div>
                </div>
            </AccordionContent>
          </AccordionItem>

          {/* Investor */}
          <AccordionItem value="investor">
            <AccordionTrigger className="text-sm font-medium hover:no-underline px-4 py-3">
                <div className="flex justify-between w-full items-center">
                    <span>Investor</span>
                    {filters.investor.length > 0 && <Badge variant="secondary">{filters.investor.length}</Badge>}
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <div className="p-2 bg-slate-50/75 border-t">
                    <Input placeholder="Search investors..." value={searchTerms.investor} onChange={(e) => handleSearchChange('investor', e.target.value)} className="mb-2" />
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                        {filteredInvestors.map((inv) => (
                            <div key={inv} className="flex items-center space-x-2">
                                <Checkbox id={`inv-${inv}`} checked={filters.investor.includes(inv)} onCheckedChange={(checked) => handleCheckboxChange('investor', inv, !!checked)} />
                                <Label htmlFor={`inv-${inv}`} className="font-normal">{inv}</Label>
                            </div>
                        ))}
                    </div>
                </div>
            </AccordionContent>
          </AccordionItem>

          {/* Lien Position */}
           <AccordionItem value="lien-position">
            <AccordionTrigger className="text-sm font-medium hover:no-underline px-4 py-3">
                <div className="flex justify-between w-full items-center">
                    <span>Lien Position</span>
                    {filters.lienPosition.length > 0 && <Badge variant="secondary">{filters.lienPosition.length}</Badge>}
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <div className="p-2 bg-slate-50/75 border-t">
                     <Input placeholder="Search positions..." value={searchTerms.lienPosition} onChange={(e) => handleSearchChange('lienPosition', e.target.value)} className="mb-2" />
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                        {filteredLienPositions.map((pos) => (
                            <div key={pos} className="flex items-center space-x-2">
                                <Checkbox id={`pos-${pos}`} checked={filters.lienPosition.includes(pos)} onCheckedChange={(checked) => handleLienPosChange(pos, !!checked)} />
                                <Label htmlFor={`pos-${pos}`} className="font-normal">{pos}</Label>
                            </div>
                        ))}
                    </div>
                </div>
            </AccordionContent>
          </AccordionItem>

          {/* Principal Balance */}
          <AccordionItem value="balance">
            <AccordionTrigger className="text-sm font-medium hover:no-underline px-4 py-3">
              <div className="flex justify-between w-full items-center">
                <span>Principal Balance</span>
                {(filters.principalBalance.min !== '' || filters.principalBalance.max !== '') && <Badge variant="secondary">Active</Badge>}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex gap-2 p-2 bg-slate-50/75 border-t">
                <Input type="number" placeholder="Min" value={filters.principalBalance.min} onChange={(e) => handleRangeChange('principalBalance', 'min', e.target.value)} />
                <Input type="number" placeholder="Max" value={filters.principalBalance.max} onChange={(e) => handleRangeChange('principalBalance', 'max', e.target.value)} />
              </div>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>
    </div>
  );
}
