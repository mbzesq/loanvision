// src/frontend/src/components/FilterPanel.tsx
import { useMemo, useState } from 'react';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
import { Badge } from '../components/ui/badge';

export type FilterValues = {
  propertyState: string[];
  assetStatus: string[];
  investor: string[];
  lienPos: string[]; // Keep as string for consistency
  principalBalance: { min: number | ''; max: number | '' };
  timelineStatus: string[];
  maturityFilter: string;
  solRiskLevel: string[];
  solExpiration: string;
};

interface FilterPanelProps {
  onApplyFilters: (filters: FilterValues) => void;
  availableStates: { name: string; abbr: string }[];
  availableAssetStatuses: string[];
  availableInvestors: string[];
  availableLienPos: string[];
  onShowAll: () => void;
  onClearView: () => void;
}

export const initialFilters: FilterValues = {
  propertyState: [],
  assetStatus: [],
  investor: [],
  lienPos: [],
  principalBalance: { min: '', max: '' },
  timelineStatus: [],
  maturityFilter: 'any',
  solRiskLevel: [],
  solExpiration: 'any',
};

export function FilterPanel(props: FilterPanelProps) {
  const {
    onApplyFilters,
    availableStates,
    availableAssetStatuses,
    availableInvestors,
    availableLienPos,
    onShowAll,
    onClearView,
  } = props;

  const [filters, setFilters] = useState<FilterValues>(initialFilters);
  const [maturityFilter, setMaturityFilter] = useState('any');
  const [solExpiration, setSolExpiration] = useState('any');
  const [searchTerms, setSearchTerms] = useState({
    propertyState: '',
    assetStatus: '',
    investor: '',
    lienPos: '',
  });

  const handleSearchChange = (field: keyof typeof searchTerms, value: string) => {
    setSearchTerms((prev) => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (
    field: keyof FilterValues,
    value: string,
    checked: boolean
  ) => {
    setFilters((prev) => {
      const currentValues = prev[field] as string[];
      const newValues = checked
        ? [...currentValues, value]
        : currentValues.filter((item) => item !== value);
      return { ...prev, [field]: newValues };
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

  const handleApply = () => onApplyFilters({ ...filters, maturityFilter, solExpiration });
  const handleClear = () => {
    setFilters(initialFilters);
    setMaturityFilter('any');
    setSolExpiration('any');
    setSearchTerms({ propertyState: '', assetStatus: '', investor: '', lienPos: '' });
    onClearView();
  };

  const filteredStates = useMemo(() => availableStates.filter(state => state.name.toLowerCase().includes(searchTerms.propertyState.toLowerCase()) || state.abbr.toLowerCase().includes(searchTerms.propertyState.toLowerCase())), [availableStates, searchTerms.propertyState]);
  const filteredAssetStatuses = useMemo(() => availableAssetStatuses.filter(status => status.toLowerCase().includes(searchTerms.assetStatus.toLowerCase())), [availableAssetStatuses, searchTerms.assetStatus]);
  const filteredInvestors = useMemo(() => availableInvestors.filter(inv => inv.toLowerCase().includes(searchTerms.investor.toLowerCase())), [availableInvestors, searchTerms.investor]);
  const filteredLienPositions = useMemo(() => availableLienPos.filter(pos => String(pos).toLowerCase().includes(searchTerms.lienPos.toLowerCase())), [availableLienPos, searchTerms.lienPos]);

  return (
    <div className="premium-card h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="premium-card-header">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="premium-card-title">Filters</h3>
            <p className="premium-card-subtitle">Refine your loan portfolio view</p>
          </div>
          <button 
            onClick={onShowAll}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium underline"
          >
            Show All
          </button>
        </div>
      </div>

      {/* Filter Content */}
      <div className="flex-1 overflow-auto">
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
              <div className="p-3 bg-gray-50 border-t border-gray-200">
                <Input
                  placeholder="Search states..."
                  value={searchTerms.propertyState}
                  onChange={(e) => handleSearchChange('propertyState', e.target.value)}
                  className="mb-3 text-sm"
                />
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredStates.map((state) => (
                    <div key={state.abbr} className="flex items-center space-x-2">
                      <Checkbox
                        id={`state-${state.abbr}`}
                        checked={filters.propertyState.includes(state.abbr)}
                        onCheckedChange={(checked) =>
                          handleCheckboxChange('propertyState', state.abbr, checked as boolean)
                        }
                      />
                      <Label htmlFor={`state-${state.abbr}`} className="text-sm font-normal cursor-pointer">
                        {state.name} ({state.abbr})
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Asset Status */}
          <AccordionItem value="assetStatus">
            <AccordionTrigger className="text-sm font-medium hover:no-underline px-4 py-3">
              <div className="flex justify-between w-full items-center">
                <span>Asset Status</span>
                {filters.assetStatus.length > 0 && <Badge variant="secondary">{filters.assetStatus.length}</Badge>}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="p-3 bg-gray-50 border-t border-gray-200">
                <Input
                  placeholder="Search status..."
                  value={searchTerms.assetStatus}
                  onChange={(e) => handleSearchChange('assetStatus', e.target.value)}
                  className="mb-3 text-sm"
                />
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredAssetStatuses.map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status}`}
                        checked={filters.assetStatus.includes(status)}
                        onCheckedChange={(checked) =>
                          handleCheckboxChange('assetStatus', status, checked as boolean)
                        }
                      />
                      <Label htmlFor={`status-${status}`} className="text-sm font-normal cursor-pointer">
                        {status}
                      </Label>
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
              <div className="p-3 bg-gray-50 border-t border-gray-200">
                <Input
                  placeholder="Search investors..."
                  value={searchTerms.investor}
                  onChange={(e) => handleSearchChange('investor', e.target.value)}
                  className="mb-3 text-sm"
                />
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredInvestors.map((investor) => (
                    <div key={investor} className="flex items-center space-x-2">
                      <Checkbox
                        id={`investor-${investor}`}
                        checked={filters.investor.includes(investor)}
                        onCheckedChange={(checked) =>
                          handleCheckboxChange('investor', investor, checked as boolean)
                        }
                      />
                      <Label htmlFor={`investor-${investor}`} className="text-sm font-normal cursor-pointer">
                        {investor}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Lien Position */}
          <AccordionItem value="lienPos">
            <AccordionTrigger className="text-sm font-medium hover:no-underline px-4 py-3">
              <div className="flex justify-between w-full items-center">
                <span>Lien Position</span>
                {filters.lienPos.length > 0 && <Badge variant="secondary">{filters.lienPos.length}</Badge>}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="p-3 bg-gray-50 border-t border-gray-200">
                <Input
                  placeholder="Search positions..."
                  value={searchTerms.lienPos}
                  onChange={(e) => handleSearchChange('lienPos', e.target.value)}
                  className="mb-3 text-sm"
                />
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredLienPositions.map((pos) => (
                    <div key={pos} className="flex items-center space-x-2">
                      <Checkbox
                        id={`lien-${pos}`}
                        checked={filters.lienPos.includes(String(pos))}
                        onCheckedChange={(checked) =>
                          handleCheckboxChange('lienPos', String(pos), checked as boolean)
                        }
                      />
                      <Label htmlFor={`lien-${pos}`} className="text-sm font-normal cursor-pointer">
                        {pos}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Principal Balance */}
          <AccordionItem value="principalBalance">
            <AccordionTrigger className="text-sm font-medium hover:no-underline px-4 py-3">
              <div className="flex justify-between w-full items-center">
                <span>Principal Balance</span>
                {(filters.principalBalance.min !== '' || filters.principalBalance.max !== '') && (
                  <Badge variant="secondary">Range</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="p-3 bg-gray-50 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Min Amount</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={filters.principalBalance.min}
                      onChange={(e) => handleRangeChange('principalBalance', 'min', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Max Amount</Label>
                    <Input
                      type="number"
                      placeholder="No limit"
                      value={filters.principalBalance.max}
                      onChange={(e) => handleRangeChange('principalBalance', 'max', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Timeline Status */}
          <AccordionItem value="timelineStatus">
            <AccordionTrigger className="text-sm font-medium hover:no-underline px-4 py-3">
              <div className="flex justify-between w-full items-center">
                <span>Timeline Status</span>
                {filters.timelineStatus.length > 0 && <Badge variant="secondary">{filters.timelineStatus.length}</Badge>}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="p-3 bg-gray-50 border-t border-gray-200">
                <div className="space-y-2">
                  {['On Track', 'Overdue', 'Completed'].map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={`timeline-${status}`}
                        checked={filters.timelineStatus.includes(status)}
                        onCheckedChange={(checked) =>
                          handleCheckboxChange('timelineStatus', status, checked as boolean)
                        }
                      />
                      <Label htmlFor={`timeline-${status}`} className="text-sm font-normal cursor-pointer">
                        {status}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* SOL Risk Level */}
          <AccordionItem value="solRiskLevel">
            <AccordionTrigger className="text-sm font-medium hover:no-underline px-4 py-3">
              <div className="flex justify-between w-full items-center">
                <span>SOL Risk Level</span>
                {filters.solRiskLevel.length > 0 && <Badge variant="secondary">{filters.solRiskLevel.length}</Badge>}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="p-3 bg-gray-50 border-t border-gray-200">
                <div className="space-y-2">
                  {['HIGH', 'MEDIUM', 'LOW'].map((level) => (
                    <div key={level} className="flex items-center space-x-2">
                      <Checkbox
                        id={`sol-${level}`}
                        checked={filters.solRiskLevel.includes(level)}
                        onCheckedChange={(checked) =>
                          handleCheckboxChange('solRiskLevel', level, checked as boolean)
                        }
                      />
                      <Label htmlFor={`sol-${level}`} className="text-sm font-normal cursor-pointer">
                        {level}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Maturity Filter */}
          <AccordionItem value="maturity">
            <AccordionTrigger className="text-sm font-medium hover:no-underline px-4 py-3">
              <div className="flex justify-between w-full items-center">
                <span>Maturity</span>
                {maturityFilter !== 'any' && <Badge variant="secondary">Filtered</Badge>}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="p-3 bg-gray-50 border-t border-gray-200">
                <div className="space-y-2">
                  {[
                    { value: 'any', label: 'Any' },
                    { value: 'past_due', label: 'Past Due' },
                    { value: 'within_year', label: 'Within 1 Year' },
                    { value: 'over_year', label: 'Over 1 Year' },
                  ].map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id={`maturity-${option.value}`}
                        name="maturity"
                        value={option.value}
                        checked={maturityFilter === option.value}
                        onChange={(e) => setMaturityFilter(e.target.value)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <Label htmlFor={`maturity-${option.value}`} className="text-sm font-normal cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* SOL Expiration */}
          <AccordionItem value="solExpiration">
            <AccordionTrigger className="text-sm font-medium hover:no-underline px-4 py-3">
              <div className="flex justify-between w-full items-center">
                <span>SOL Expiration</span>
                {solExpiration !== 'any' && <Badge variant="secondary">Filtered</Badge>}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="p-3 bg-gray-50 border-t border-gray-200">
                <div className="space-y-2">
                  {[
                    { value: 'any', label: 'Any' },
                    { value: 'expired', label: 'Expired' },
                    { value: 'expiring_90', label: 'Expiring within 90 days' },
                    { value: 'expiring_180', label: 'Expiring within 180 days' },
                    { value: 'expiring_365', label: 'Expiring within 1 year' },
                  ].map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id={`sol-${option.value}`}
                        name="solExpiration"
                        value={option.value}
                        checked={solExpiration === option.value}
                        onChange={(e) => setSolExpiration(e.target.value)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <Label htmlFor={`sol-${option.value}`} className="text-sm font-normal cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Footer with buttons */}
      <div className="premium-card-content border-t border-gray-200 bg-gray-50">
        <div className="flex gap-3">
          <button 
            onClick={handleClear}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Clear Filters
          </button>
          <button 
            onClick={handleApply}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}