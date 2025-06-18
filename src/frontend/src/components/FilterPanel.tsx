// src/frontend/src/components/FilterPanel.tsx

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@loanvision/shared/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@loanvision/shared/components/ui/select';
import { Button } from '@loanvision/shared/components/ui/button';
import { Slider } from '@loanvision/shared/components/ui/slider';
import { Label } from '@loanvision/shared/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@loanvision/shared/components/ui/popover';
import { Calendar } from '@loanvision/shared/components/ui/calendar';
import { useState } from 'react';
import { format } from 'date-fns';

// Define the shape of the filter values
export type FilterValues = {
  principalBalance: [number, number];
  interestRate: [number, number];
  propertyState: string;
  legalStatus: string;
  maturityDate: Date | undefined;
};

// Define the component's props
interface FilterPanelProps {
  onApplyFilters: (filters: FilterValues) => void;
  availableStates: string[];
  availableLegalStatuses: string[]; // Assuming we will add this
}

// Define the initial state for the filters
const initialFilters: FilterValues = {
  principalBalance: [0, 1000000],
  interestRate: [0, 20],
  propertyState: '',
  legalStatus: '',
  maturityDate: undefined,
};

export function FilterPanel({
  onApplyFilters,
  availableStates,
  availableLegalStatuses,
}: FilterPanelProps) {
  const [filters, setFilters] = useState<FilterValues>(initialFilters);

  const handleClearFilters = () => {
    setFilters(initialFilters);
    onApplyFilters(initialFilters);
  };

  const handleApply = () => {
    onApplyFilters(filters);
  };

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle>Filter Loans</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* === Financial Filters === */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-500">Financial Filters</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <Label htmlFor="principal-balance">Principal Balance</Label>
              <span>${filters.principalBalance[0].toLocaleString()} - ${filters.principalBalance[1].toLocaleString()}</span>
            </div>
            <Slider
              id="principal-balance"
              min={0}
              max={1000000}
              step={10000}
              value={filters.principalBalance}
              onValueChange={(value) => setFilters({ ...filters, principalBalance: value as [number, number] })}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <Label htmlFor="interest-rate">Interest Rate</Label>
              <span>{filters.interestRate[0]}% - {filters.interestRate[1]}%</span>
            </div>
            <Slider
              id="interest-rate"
              min={0}
              max={20}
              step={0.5}
              value={filters.interestRate}
              onValueChange={(value) => setFilters({ ...filters, interestRate: value as [number, number] })}
            />
          </div>
        </div>

        {/* === Location & Status Filters === */}
        <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-gray-500">Property & Status Filters</h3>
             <div className="space-y-2">
                <Label>Property State</Label>
                <Select value={filters.propertyState} onValueChange={(value) => setFilters({ ...filters, propertyState: value })}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a state" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableStates.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
             <div className="space-y-2">
                <Label>Legal Status</Label>
                <Select value={filters.legalStatus} onValueChange={(value) => setFilters({ ...filters, legalStatus: value })}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableLegalStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
             <div className="space-y-2">
                <Label>Maturity Date</Label>
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start font-normal">
                            {filters.maturityDate ? format(filters.maturityDate, 'PPP') : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={filters.maturityDate}
                            onSelect={(date) => setFilters({ ...filters, maturityDate: date })}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={handleClearFilters}>Clear</Button>
        <Button onClick={handleApply}>Apply Filters</Button>
      </CardFooter>
    </Card>
  );
}