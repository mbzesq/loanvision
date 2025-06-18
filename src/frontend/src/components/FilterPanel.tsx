// Force re-bundle to defeat cache v2
import React, { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@loanvision/shared/components/ui/card';
import { Button } from '@loanvision/shared/components/ui/button';
import { Slider } from '@loanvision/shared/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@loanvision/shared/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@loanvision/shared/components/ui/popover';
import { Calendar } from '@loanvision/shared/components/ui/calendar';
import { cn } from '@loanvision/shared/lib/utils';

export type FilterValues = {
  principalBalance: [number, number];
  interestRate: [number, number];
  propertyState: string;
  loanType: string;
  maturityDate: Date | undefined;
};

interface FilterPanelProps {
  onApplyFilters: (filters: FilterValues) => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ onApplyFilters }) => {
  const defaultFilters: FilterValues = {
    principalBalance: [0, 1000000],
    interestRate: [0, 20],
    propertyState: '',
    loanType: '',
    maturityDate: undefined,
  };

  const [filters, setFilters] = useState<FilterValues>(defaultFilters);

  const handlePrincipalBalanceChange = (value: number[]) => {
    setFilters(prev => ({ ...prev, principalBalance: value as [number, number] }));
  };

  const handleInterestRateChange = (value: number[]) => {
    setFilters(prev => ({ ...prev, interestRate: value as [number, number] }));
  };

  const handlePropertyStateChange = (value: string) => {
    setFilters(prev => ({ ...prev, propertyState: value }));
  };

  const handleLoanTypeChange = (value: string) => {
    setFilters(prev => ({ ...prev, loanType: value }));
  };

  const handleMaturityDateChange = (date: Date | undefined) => {
    setFilters(prev => ({ ...prev, maturityDate: date }));
  };

  const handleClear = () => {
    setFilters(defaultFilters);
  };

  const handleApply = () => {
    onApplyFilters(filters);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Filter Loans</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Financial Filters */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Financial Filters</h3>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Principal Balance: ${filters.principalBalance[0].toLocaleString()} - ${filters.principalBalance[1].toLocaleString()}
            </label>
            <Slider 
              value={filters.principalBalance}
              onValueChange={handlePrincipalBalanceChange}
              max={1000000}
              min={0}
              step={10000}
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Interest Rate: {filters.interestRate[0]}% - {filters.interestRate[1]}%
            </label>
            <Slider 
              value={filters.interestRate}
              onValueChange={handleInterestRateChange}
              max={20}
              min={0}
              step={0.5}
              className="w-full"
            />
          </div>
        </div>

        {/* Location Filters */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Location Filters</h3>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Property State</label>
            <Select value={filters.propertyState} onValueChange={handlePropertyStateChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FL">Florida</SelectItem>
                <SelectItem value="NY">New York</SelectItem>
                <SelectItem value="TX">Texas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status Filters */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Status Filters</h3>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Maturity Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.maturityDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.maturityDate ? format(filters.maturityDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.maturityDate}
                  onSelect={handleMaturityDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Loan Type</label>
            <Select value={filters.loanType} onValueChange={handleLoanTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select loan type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bridge">Bridge</SelectItem>
                <SelectItem value="New Construction">New Construction</SelectItem>
                <SelectItem value="Refinance">Refinance</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={handleClear}>Clear</Button>
        <Button onClick={handleApply}>Apply Filters</Button>
      </CardFooter>
    </Card>
  );
};

export default FilterPanel;