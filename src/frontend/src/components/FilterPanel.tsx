import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@loanvision/shared/components/ui/card';
import { Button } from '@loanvision/shared/components/ui/button';
import { Slider } from '@loanvision/shared/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@loanvision/shared/components/ui/select';

const FilterPanel: React.FC = () => {
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
            <label className="text-sm font-medium">Principal Balance</label>
            <Slider defaultValue={[50]} max={100} step={1} />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Interest Rate</label>
            <Slider defaultValue={[50]} max={100} step={1} />
          </div>
        </div>

        {/* Location Filters */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Location Filters</h3>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Property State</label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select a state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="placeholder">Select state...</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status Filters */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Status Filters</h3>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Maturity Date</label>
            <Button variant="outline" className="w-full justify-start text-left font-normal">
              Pick a date
            </Button>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Loan Type</label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select loan type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="placeholder">Select type...</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button variant="ghost">Clear</Button>
        <Button>Apply Filters</Button>
      </CardFooter>
    </Card>
  );
};

export default FilterPanel;