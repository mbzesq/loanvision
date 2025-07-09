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
  const [maturityFilter, setMaturityFilter] = useState<string>('any');
  const [searchTerms, setSearchTerms] = useState({
    propertyState: '',
    assetStatus: '',
    investor: '',
    lienPos: '',
  });
  const [solExpiration, setSolExpiration] = useState<string>('any');

  const handleSearchChange = (field: keyof typeof searchTerms, value: string) => {
    setSearchTerms(prev => ({ ...prev, [field]: value }));
  };


  // Unified handler for all checkbox groups
  const handleCheckboxChange = (
    field: 'propertyState' | 'assetStatus' | 'investor' | 'lienPos' | 'timelineStatus' | 'solRiskLevel',
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
    <div className="filter-panel" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      border: '1px solid var(--color-border)', 
      borderRadius: 'var(--radius)', 
      backgroundColor: 'var(--color-surface)', 
      overflow: 'hidden'
    }}>
      <div style={{ 
        padding: '12px', 
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ 
            fontSize: '12px', 
            fontWeight: '600', 
            textTransform: 'uppercase',
            color: 'var(--color-text)',
            margin: 0
          }}>
            Filter Criteria
          </h2>
          <button 
            onClick={onShowAll}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary)',
              fontSize: '11px',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Show All
          </button>
        </div>
      </div>
      <div style={{ 
        padding: '12px', 
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        display: 'flex',
        gap: '8px'
      }}>
        <button 
          onClick={handleClear}
          style={{
            flex: 1,
            padding: '6px 12px',
            fontSize: '11px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-text)',
            cursor: 'pointer'
          }}
        >
          Clear Filters
        </button>
        <button 
          onClick={handleApply}
          style={{
            flex: 1,
            padding: '6px 12px',
            fontSize: '11px',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Apply
        </button>
      </div>
      <div style={{ flexGrow: 1, overflowY: 'auto', backgroundColor: 'var(--color-surface)' }}>
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
              <div style={{ 
                padding: '8px', 
                backgroundColor: 'var(--color-background)', 
                borderTop: '1px solid var(--color-border)'
              }}>
                <input 
                  placeholder="Search states..." 
                  value={searchTerms.propertyState} 
                  onChange={(e) => handleSearchChange('propertyState', e.target.value)} 
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    fontSize: '11px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    marginBottom: '8px'
                  }}
                />
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '6px', 
                  maxHeight: '192px', 
                  overflowY: 'auto' 
                }}>
                  {filteredStates.length === 0 ? (
                    <div style={{ 
                      fontSize: '11px', 
                      color: 'var(--color-text-muted)', 
                      fontStyle: 'italic', 
                      padding: '8px' 
                    }}>
                      No states match your search
                    </div>
                  ) : (
                    filteredStates.map((state) => (
                      <div key={state.abbr} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        padding: '2px 0'
                      }}>
                        <Checkbox id={`state-${state.abbr}`} checked={filters.propertyState.includes(state.abbr)} onCheckedChange={(checked) => handleCheckboxChange('propertyState', state.abbr, !!checked)} />
                        <label htmlFor={`state-${state.abbr}`} style={{ 
                          fontSize: '11px',
                          color: 'var(--color-text)',
                          cursor: 'pointer'
                        }}>
                          {state.name} ({state.abbr})
                        </label>
                      </div>
                    ))
                  )}
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
                  {filteredAssetStatuses.length === 0 ? (
                    <div className="text-sm text-slate-500 italic p-2">
                      No statuses match your search
                    </div>
                  ) : (
                    filteredAssetStatuses.map((status) => (
                      <div key={status} className="flex items-center space-x-2">
                        <Checkbox id={`status-${status}`} checked={filters.assetStatus.includes(status)} onCheckedChange={(checked) => handleCheckboxChange('assetStatus', status, !!checked)} />
                        <Label htmlFor={`status-${status}`} className="font-normal">{status}</Label>
                      </div>
                    ))
                  )}
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
                  {filteredInvestors.length === 0 ? (
                    <div className="text-sm text-slate-500 italic p-2">
                      No investors match your search
                    </div>
                  ) : (
                    filteredInvestors.map((inv) => (
                      <div key={inv} className="flex items-center space-x-2">
                        <Checkbox id={`inv-${inv}`} checked={filters.investor.includes(inv)} onCheckedChange={(checked) => handleCheckboxChange('investor', inv, !!checked)} />
                        <Label htmlFor={`inv-${inv}`} className="font-normal">{inv}</Label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Lien Position */}
          <AccordionItem value="lien-position">
            <AccordionTrigger className="text-sm font-medium hover:no-underline px-4 py-3">
              <div className="flex justify-between w-full items-center">
                <span>Lien Position</span>
                {filters.lienPos.length > 0 && <Badge variant="secondary">{filters.lienPos.length}</Badge>}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="p-2 bg-slate-50/75 border-t">
                <Input placeholder="Search positions..." value={searchTerms.lienPos} onChange={(e) => handleSearchChange('lienPos', e.target.value)} className="mb-2" />
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {filteredLienPositions.length === 0 ? (
                    <div className="text-sm text-slate-500 italic p-2">
                      No lien positions available
                    </div>
                  ) : (
                    filteredLienPositions.map((pos) => (
                      <div key={pos} className="flex items-center space-x-2">
                        <Checkbox id={`pos-${pos}`} checked={filters.lienPos.includes(pos)} onCheckedChange={(checked) => handleCheckboxChange('lienPos', pos, !!checked)} />
                        <Label htmlFor={`pos-${pos}`} className="font-normal">{pos}</Label>
                      </div>
                    ))
                  )}
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

          {/* Timeline Status */}
          <AccordionItem value="timeline-status">
            <AccordionTrigger className="text-sm font-medium hover:no-underline px-4 py-3">
              <div className="flex justify-between w-full items-center">
                <span>Foreclosure Timeline Status</span>
                {filters.timelineStatus.length > 0 && <Badge variant="secondary">{filters.timelineStatus.length}</Badge>}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="p-2 bg-slate-50/75 border-t">
                <div className="flex flex-col gap-2">
                  {['On Track', 'Overdue'].map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`timeline-${status}`} 
                        checked={filters.timelineStatus.includes(status)} 
                        onCheckedChange={(checked) => handleCheckboxChange('timelineStatus', status, !!checked)} 
                      />
                      <Label htmlFor={`timeline-${status}`} className="font-normal">{status}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Maturity Date */}
          <AccordionItem value="maturity-date">
            <AccordionTrigger className="text-sm font-medium hover:no-underline px-4 py-3">
              <div className="flex justify-between w-full items-center">
                <span>Maturity Date</span>
                {maturityFilter !== 'any' && <Badge variant="secondary">Active</Badge>}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-2 p-2 bg-slate-50/75 border-t">
                {[
                  { value: 'any', label: 'Any' },
                  { value: 'past', label: 'Past Maturity' },
                  { value: 'next3', label: 'Next 3 Months' },
                  { value: 'next6', label: 'Next 6 Months' },
                  { value: 'next12', label: 'Next 12 Months' },
                  { value: 'last12', label: 'Last 12 Months' },
                ].map((option) => (
                  <Label
                    key={option.value}
                    className={`flex items-center space-x-2 p-2 rounded-md cursor-pointer hover:bg-slate-200 ${
                      maturityFilter === option.value ? 'bg-blue-100 text-blue-800' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="maturityDate"
                      value={option.value}
                      checked={maturityFilter === option.value}
                      onChange={() => setMaturityFilter(option.value)}
                      className="h-4 w-4"
                    />
                    <span className="font-normal">{option.label}</span>
                  </Label>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* SOL Risk Level */}
          <AccordionItem value="sol-risk">
            <AccordionTrigger className="text-sm font-medium hover:no-underline px-4 py-3">
              <div className="flex justify-between w-full items-center">
                <span>SOL Risk Level</span>
                {filters.solRiskLevel.length > 0 && <Badge variant="secondary">{filters.solRiskLevel.length}</Badge>}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="p-2 bg-slate-50/75 border-t">
                <div className="flex flex-col gap-2">
                  {['LOW', 'MEDIUM', 'HIGH'].map((risk) => (
                    <div key={risk} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`sol-risk-${risk}`} 
                        checked={filters.solRiskLevel.includes(risk)} 
                        onCheckedChange={(checked) => handleCheckboxChange('solRiskLevel', risk, !!checked)} 
                      />
                      <Label htmlFor={`sol-risk-${risk}`} className="font-normal">
                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                          risk === 'LOW' ? 'bg-green-500' : 
                          risk === 'MEDIUM' ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                        {risk}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* SOL Expiration Timeline */}
          <AccordionItem value="sol-expiration">
            <AccordionTrigger className="text-sm font-medium hover:no-underline px-4 py-3">
              <div className="flex justify-between w-full items-center">
                <span>SOL Expiration</span>
                {solExpiration !== 'any' && <Badge variant="secondary">1</Badge>}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="p-2 bg-slate-50/75 border-t">
                {[
                  { value: 'any', label: 'Any' },
                  { value: 'expired', label: 'Already Expired' },
                  { value: 'expiring_30', label: 'Expiring in 30 Days' },
                  { value: 'expiring_90', label: 'Expiring in 90 Days' },
                  { value: 'expiring_180', label: 'Expiring in 6 Months' },
                  { value: 'expiring_365', label: 'Expiring in 1 Year' },
                ].map((option) => (
                  <Label
                    key={option.value}
                    className={`flex items-center space-x-2 p-2 rounded-md cursor-pointer hover:bg-slate-200 ${
                      solExpiration === option.value ? 'bg-blue-100 text-blue-800' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="solExpiration"
                      value={option.value}
                      checked={solExpiration === option.value}
                      onChange={() => setSolExpiration(option.value)}
                      className="h-4 w-4"
                    />
                    <span className="font-normal">{option.label}</span>
                  </Label>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}