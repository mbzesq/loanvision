import { Loan } from '../pages/LoanExplorerPage'; // Assuming Loan type is exported
import milestoneBenchmarks from '../fcl_milestones_by_state.json';

export type MilestoneStatus = 'COMPLETED_ON_TIME' | 'COMPLETED_LATE' | 'PENDING_OVERDUE' | 'PENDING_ON_TRACK';

// This function determines the status of a SINGLE milestone
export const getMilestoneStatus = (
  actualDateStr: string | null | undefined,
  expectedDateStr: string | null | undefined
): MilestoneStatus => {
  if (actualDateStr && expectedDateStr) {
    const actualDate = new Date(actualDateStr);
    const expectedDate = new Date(expectedDateStr);
    return actualDate > expectedDate ? 'COMPLETED_LATE' : 'COMPLETED_ON_TIME';
  }
  if (expectedDateStr) {
    const expectedDate = new Date(expectedDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expectedDate < today ? 'PENDING_OVERDUE' : 'PENDING_ON_TRACK';
  }
  return 'PENDING_ON_TRACK'; // Default if no dates are present
};

// This function determines the OVERALL status of the loan's foreclosure
export const getOverallLoanStatus = (loan: Loan): 'On Track' | 'Overdue' | null => {
  if (loan.fc_status?.toUpperCase() !== 'ACTIVE' && loan.fc_status?.toUpperCase() !== 'HOLD') {
    return null;
  }
  if (!loan.state || !loan.fc_jurisdiction) {
    return null;
  }
  const stateBenchmarks = milestoneBenchmarks[loan.state as keyof typeof milestoneBenchmarks];
  if (!stateBenchmarks) return null;

  const milestones = loan.fc_jurisdiction.toLowerCase().includes('non')
    ? stateBenchmarks.non_judicial_milestones
    : stateBenchmarks.judicial_milestones;

  if (!milestones || milestones.length === 0) return null;

  for (const milestone of milestones) {
    const actualDate = loan[milestone.db_column as keyof Loan];
    const expectedDateKey = `${milestone.db_column.replace(/_date$/, '')}_expected_completion_date`;
    const expectedDate = loan[expectedDateKey as keyof Loan];

    const status = getMilestoneStatus(actualDate, expectedDate);

    if (status === 'COMPLETED_LATE' || status === 'PENDING_OVERDUE') {
      return 'Overdue'; // If any milestone is late or overdue, the whole loan is Overdue.
    }
  }

  return 'On Track'; // If all milestones are on time, the loan is On Track.
};