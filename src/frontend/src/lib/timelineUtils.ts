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
  
  // Special logging for our example loans
  const isExampleLoan = loan.loan_id === '0000359811' || loan.loan_id === '0000361043';
  
  if (isExampleLoan) {
    console.log(`\n🔍 DETAILED ANALYSIS FOR LOAN ${loan.loan_id}`);
    console.log(`State: ${loan.state}`);
    console.log(`FC Status: ${loan.fc_status}`);
    console.log(`FC Jurisdiction: ${loan.fc_jurisdiction}`);
    console.log(`FC Start Date: ${loan.fc_start_date}`);
  }
  
  if (status !== 'ACTIVE' && status !== 'HOLD') {
    if (isExampleLoan) console.log(`❌ Rejected: FC Status '${status}' is not ACTIVE or HOLD`);
    return null;
  }

  if (!loan.state || !loan.fc_jurisdiction || !loan.fc_start_date) {
    if (isExampleLoan) console.log(`❌ Rejected: Missing required fields - state: ${loan.state}, jurisdiction: ${loan.fc_jurisdiction}, start: ${loan.fc_start_date}`);
    return null;
  }

  const stateBenchmarks = milestoneBenchmarks[loan.state as keyof typeof milestoneBenchmarks];
  if (!stateBenchmarks) {
    if (isExampleLoan) console.log(`❌ Rejected: No benchmarks found for state ${loan.state}`);
    return null;
  }

  const milestones = loan.fc_jurisdiction.toLowerCase().includes('non')
    ? stateBenchmarks.non_judicial_milestones
    : stateBenchmarks.judicial_milestones;

  if (!milestones || milestones.length === 0) {
    if (isExampleLoan) console.log(`❌ Rejected: No milestones for jurisdiction type`);
    return null;
  }

  if (isExampleLoan) {
    console.log(`📋 Using ${loan.fc_jurisdiction.toLowerCase().includes('non') ? 'NON-JUDICIAL' : 'JUDICIAL'} milestones for ${loan.state}`);
    console.log(`📅 Starting calculation from FC Start Date: ${loan.fc_start_date}`);
  }

  let cumulativeVariance = 0;
  let previousMilestoneActualDate = new Date(loan.fc_start_date);

  for (const milestone of milestones) {
    const actualCompletionDateStr = loan[milestone.db_column as keyof Loan];

    if (actualCompletionDateStr) {
      const currentMilestoneActualDate = new Date(actualCompletionDateStr);
      const actualDaysForStep = dateDiffInDays(previousMilestoneActualDate, currentMilestoneActualDate);
      const expectedDaysForStep = milestone.preferredDays;
      const stepVariance = actualDaysForStep - expectedDaysForStep;
      
      cumulativeVariance += stepVariance;

      if (isExampleLoan) {
        console.log(`\n📍 Milestone: ${milestone.milestone}`);
        console.log(`   From: ${previousMilestoneActualDate.toISOString().split('T')[0]} → To: ${currentMilestoneActualDate.toISOString().split('T')[0]}`);
        console.log(`   Actual Days: ${actualDaysForStep} | Expected Days: ${expectedDaysForStep} | Variance: ${stepVariance > 0 ? '+' : ''}${stepVariance}`);
        console.log(`   Cumulative Variance: ${cumulativeVariance > 0 ? '+' : ''}${cumulativeVariance} days`);
      }

      previousMilestoneActualDate = currentMilestoneActualDate;
    } else {
      if (isExampleLoan) {
        console.log(`\n⏹️  Stopped at incomplete milestone: ${milestone.milestone} (${milestone.db_column})`);
      }
      break;
    }
  }

  const result = cumulativeVariance > 0 ? 'Overdue' : 'On Track';
  
  if (isExampleLoan) {
    console.log(`\n🏁 FINAL RESULT FOR ${loan.loan_id}:`);
    console.log(`   Total Cumulative Variance: ${cumulativeVariance > 0 ? '+' : ''}${cumulativeVariance} days`);
    console.log(`   Status: ${result} ${result === 'Overdue' ? '🔴' : '🟢'}`);
    console.log(`   Logic: ${cumulativeVariance > 0 ? 'Cumulative variance is positive → Behind schedule' : 'Cumulative variance is zero or negative → On schedule'}`);
  }

  return result;
};