// src/backend/src/services/foreclosureService.ts
import fs from 'fs';
import path from 'path';
import pool from '../db';
import { ForeclosureEventData } from './columnMappers';

// --- TYPE DEFINITIONS for the new nested fcl_milestones_by_state.json ---
interface Milestone {
  sequence: number;
  milestone: string;
  preferredDays: number;
}

interface StateData {
  judicial_milestones: Milestone[];
  non_judicial_milestones: Milestone[];
}

interface MilestoneBenchmarks {
  [state: string]: StateData;
}

// --- HELPER FUNCTIONS ---
const loadMilestoneBenchmarks = (): MilestoneBenchmarks => {
  const jsonPath = path.resolve(__dirname, '..', 'fcl_milestones_by_state.json');
  const fileContents = fs.readFileSync(jsonPath, 'utf8');
  return JSON.parse(fileContents);
};

const getMilestonesForState = (stateAbbr: string, jurisdiction: string | null): Milestone[] => {
    const benchmarks = loadMilestoneBenchmarks();
    const stateData = benchmarks[stateAbbr]; // Direct lookup

    if (!stateData) {
        console.warn(`No milestone benchmark found for state: ${stateAbbr}`);
        return [];
    }

    return jurisdiction?.toLowerCase().includes('non') 
        ? stateData.non_judicial_milestones 
        : stateData.judicial_milestones;
};

export const getStateForLoan = async (loanId: string): Promise<string | null> => {
    const result = await pool.query('SELECT state FROM daily_metrics_current WHERE loan_id = $1', [loanId]);
    return result.rows.length > 0 ? result.rows[0].state : null;
};

// --- MAIN SERVICE FUNCTION ---
export async function getForeclosureTimeline(loanId: string): Promise<any[] | null> {
  const state = await getStateForLoan(loanId);
  const foreclosureEventResult = await pool.query('SELECT * FROM foreclosure_events WHERE loan_id = $1', [loanId]);

  if (!state || foreclosureEventResult.rows.length === 0) {
    return null;
  }

  const actualEvents = foreclosureEventResult.rows[0];
  const fcStartDate = actualEvents.fc_start_date ? new Date(actualEvents.fc_start_date) : new Date();
  const milestonesTemplate = getMilestonesForState(state, actualEvents.fc_jurisdiction);

  if (!milestonesTemplate || milestonesTemplate.length === 0) {
    return [];
  }

  const timeline: any[] = [];
  let lastCompletionDate = fcStartDate;

  for (const milestone of milestonesTemplate) {
    // NOTE: The JSON no longer has db_column_actual_completion. We need to construct it.
    // This is a placeholder for a more robust mapping if needed.
    const dbColumnName = milestone.milestone.toLowerCase().replace(/ /g, '_') + '_date';

    const actualCompletionDateStr = actualEvents[dbColumnName];
    const actualCompletionDate = actualCompletionDateStr ? new Date(actualCompletionDateStr) : null;

    const calculationStartDate = actualCompletionDate || lastCompletionDate;
    const expectedCompletionDate = new Date(calculationStartDate);
    expectedCompletionDate.setDate(expectedCompletionDate.getDate() + milestone.preferredDays);

    timeline.push({
      milestone_name: milestone.milestone,
      actual_completion_date: actualCompletionDateStr,
      expected_completion_date: expectedCompletionDate.toISOString().split('T')[0],
    });
    lastCompletionDate = expectedCompletionDate;
  }
  return timeline;
}