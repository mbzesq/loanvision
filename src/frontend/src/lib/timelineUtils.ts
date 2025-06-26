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
  // Log the initial loan object to see what data we're working with.
  console.log(`[Diagnostic] Processing loan ${loan.loan_id}:`, { 
    fc_status: loan.fc_status, 
    state: loan.state, 
    jurisdiction: loan.fc_jurisdiction 
  });

  if (loan.fc_status?.toUpperCase() !== 'ACTIVE' && loan.fc_status?.toUpperCase() !== 'HOLD') {
    // This log will not print if the status is null/undefined, which is correct.
    console.log(`[Diagnostic] -> Status: null (fc_status is '${loan.fc_status}')`);
    return null;
  }

  if (!loan.state || !loan.fc_jurisdiction) {
    console.log(`[Diagnostic] -> Status: null (missing state or jurisdiction)`);
    return null;
  }

  const stateBenchmarks = milestoneBenchmarks[loan.state as keyof typeof milestoneBenchmarks];
  if (!stateBenchmarks) {
    console.log(`[Diagnostic] -> Status: null (no benchmarks for state ${loan.state})`);
    return null;
  }

  const milestones = loan.fc_jurisdiction.toLowerCase().includes('non')
    ? stateBenchmarks.non_judicial_milestones
    : stateBenchmarks.judicial_milestones;

  if (!milestones || milestones.length === 0) {
    console.log(`[Diagnostic] -> Status: null (no milestones for jurisdiction)`);
    return null;
  }

  for (const milestone of milestones) {
    const actualDate = loan[milestone.db_column as keyof Loan];
    const expectedDateKey = `${milestone.db_column.replace(/_date$/, '')}_expected_completion_date`;
    const expectedDate = loan[expectedDateKey as keyof Loan];

    const status = getMilestoneStatus(actualDate, expectedDate);

    if (status === 'COMPLETED_LATE' || status === 'PENDING_OVERDUE') {
      console.log(`[Diagnostic] -> Status: Overdue (Reason: Milestone '${milestone.milestone}' has status ${status})`);
      return 'Overdue';
    }
  }

  console.log(`[Diagnostic] -> Status: On Track (all milestones passed checks)`);
  return 'On Track';
};