// Force re-bundle to defeat cache v2
import React from 'react';

export type FilterSheetValues = {
  principalBalance: [number, number];
  interestRate: [number, number];
  propertyState: string;
  loanType: string;
  maturityDate: Date | undefined;
};

interface FilterSheetProps {
  onApplyFilters: (filters: FilterSheetValues) => void;
}

const FilterSheet: React.FC<FilterSheetProps> = ({ onApplyFilters: _onApplyFilters }) => {
  // Simplified for debugging - _onApplyFilters will be used when full content is restored
  
  return (
    <div>
      <p>Filter Sheet Content Renders!</p>
    </div>
  );
};

export default FilterSheet;