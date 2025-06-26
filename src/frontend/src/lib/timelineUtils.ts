import { Loan } from '../pages/LoanExplorerPage';
import milestoneBenchmarks from '../fcl_milestones_by_state.json';

export type MilestoneStatus = 'COMPLETED_ON_TIME' | 'COMPLETED_LATE' | 'PENDING_OVERDUE' | 'PENDING_ON_TRACK';

// This function determines the status of a SINGLE milestone (for modal icons)
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

// Helper function to calculate the difference between two dates in days.
const dateDiffInDays = (date1: Date, date2: Date): number => {
  const _MS_PER_DAY = 1000 * 60 * 60 * 24;
  const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.floor((utc2 - utc1) / _MS_PER_DAY);
};

// The main function to determine the loan's overall status.
export const getOverallLoanStatus = (loan: Loan): 'On Track' | 'Overdue' | null => {
  const status = loan.fc_status?.trim().toUpperCase();
  if (status !== 'ACTIVE' && status !== 'HOLD') return null;

  if (!loan.state || !loan.fc_jurisdiction || !loan.fc_start_date) return null;

  const stateBenchmarks = milestoneBenchmarks[loan.state as keyof typeof milestoneBenchmarks];
  if (!stateBenchmarks) return null;

  const milestones = loan.fc_jurisdiction.toLowerCase().includes('non')
    ? stateBenchmarks.non_judicial_milestones
    : stateBenchmarks.judicial_milestones;

  if (!milestones || milestones.length === 0) return null;

  let cumulativeVariance = 0;
  let previousMilestoneActualDate = new Date(loan.fc_start_date);

  for (const milestone of milestones) {
    const actualCompletionDateStr = loan[milestone.db_column as keyof Loan];

    if (actualCompletionDateStr) {
      const currentMilestoneActualDate = new Date(actualCompletionDateStr);

      const actualDaysForStep = dateDiffInDays(previousMilestoneActualDate, currentMilestoneActualDate);
      const expectedDaysForStep = milestone.preferredDays;

      cumulativeVariance += (actualDaysForStep - expectedDaysForStep);

      previousMilestoneActualDate = currentMilestoneActualDate;
    } else {
      // This is the first uncompleted milestone, so we stop calculating here.
      break;
    }
  }

  // After checking all completed milestones, if the cumulative variance is positive, we are behind schedule.
  return cumulativeVariance > 0 ? 'Overdue' : 'On Track';
};