// src/backend/src/services/foreclosureService.ts
import fs from 'fs';
import path from 'path';
import pool from '../db';
import { ForeclosureEventData, MilestoneData, mapForeclosureData } from './columnMappers';

// --- TYPE DEFINITIONS for fcl_milestones_by_state.json ---
interface MilestoneBenchmark {
    sequence: number;
    name: string;
    preferredDays: number;
    db_column_actual_completion: string;
}

interface StateBenchmark {
    state: string;
    judicial_milestones: MilestoneBenchmark[];
    non_judicial_milestones: MilestoneBenchmark[];
}

// --- HELPER FUNCTIONS ---

// Helper to load and parse the JSON ruleset
const loadMilestoneBenchmarks = (): StateBenchmark[] => {
  const jsonPath = path.resolve(__dirname, '..', 'fcl_milestones_by_state.json');
  const fileContents = fs.readFileSync(jsonPath, 'utf8');
  return JSON.parse(fileContents);
};

// Helper to get the milestone template for a specific state and jurisdiction
const getMilestonesForState = (stateAbbr: string, jurisdiction: string | null): MilestoneBenchmark[] => {
    const benchmarks = loadMilestoneBenchmarks();
    const stateData = benchmarks.find((s) => s.state === stateAbbr);
    if (!stateData) return [];
    return jurisdiction?.toLowerCase().includes('non') 
        ? stateData.non_judicial_milestones 
        : stateData.judicial_milestones;
};

// Helper to get the state for a given loan
export const getStateForLoan = async (loanId: string): Promise<string | null> => {
    const result = await pool.query('SELECT state FROM daily_metrics_current WHERE loan_id = $1', [loanId]);
    return result.rows.length > 0 ? result.rows[0].state : null;
};

// --- MAIN SERVICE FUNCTIONS ---

// Upserts the main foreclosure event record
export async function upsertForeclosureEvent(eventData: ForeclosureEventData): Promise<void> {
  // This function needs to be updated to handle all the new expected date columns
  // For now, we will keep it simple and assume the columns exist from a previous migration
  const columns = Object.keys(eventData).filter(k => k !== 'loan_id');
  const setClauses = columns.map((col, i) => `${col} = $${i + 2}`).join(', ');
  const values = [eventData.loan_id, ...columns.map(col => eventData[col])];

  const query = `
    INSERT INTO foreclosure_events (loan_id, ${columns.join(', ')})
    VALUES ($1, ${columns.map((_, i) => `$${i + 2}`).join(', ')})
    ON CONFLICT (loan_id) DO UPDATE SET
      ${setClauses},
      updated_at = now()
  `;
  await pool.query(query, values);
}

// Main function to get the calculated timeline for the modal
export async function getForeclosureTimeline(loanId: string): Promise<any[] | null> {
  const state = await getStateForLoan(loanId);
  const foreclosureEventResult = await pool.query('SELECT * FROM foreclosure_events WHERE loan_id = $1', [loanId]);

  if (!state || foreclosureEventResult.rows.length === 0) {
    return null;
  }

  const actualEvents = foreclosureEventResult.rows[0];
  const fcStartDate = actualEvents.fc_start_date ? new Date(actualEvents.fc_start_date) : new Date();
  const milestonesTemplate = getMilestonesForState(state, actualEvents.fc_jurisdiction);

  if (!milestonesTemplate || milestonesTemplate.length === 0) return [];

  const timeline: any[] = [];
  let lastCompletionDate = fcStartDate;

  for (const milestone of milestonesTemplate) {
    const actualCompletionDateStr = actualEvents[milestone.db_column_actual_completion];
    const actualCompletionDate = actualCompletionDateStr ? new Date(actualCompletionDateStr) : null;

    const calculationStartDate = actualCompletionDate || lastCompletionDate;
    const expectedCompletionDate = new Date(calculationStartDate);
    expectedCompletionDate.setDate(expectedCompletionDate.getDate() + milestone.preferredDays);

    timeline.push({
      milestone_name: milestone.name,
      actual_completion_date: actualCompletionDateStr,
      expected_completion_date: expectedCompletionDate.toISOString().split('T')[0],
    });

    // Update the cursor for the next iteration in the chain
    lastCompletionDate = expectedCompletionDate;
  }
  return timeline;
}

// --- LEGACY/OTHER FUNCTIONS (Needed for upload) ---
// These functions might still be called by upload.ts and are included for completeness.
// They may need future refactoring.

export function extractForeclosureEventData(row: any): ForeclosureEventData {
  // This function maps raw row data to the ForeclosureEventData interface
  // Assuming it's defined correctly in columnMappers.ts
  return mapForeclosureData(row, '', ''); // Pass dummy values for unused params
}

export async function insertMilestoneStatuses(loanId: string, state: string, record: any): Promise<void> {
    // Placeholder for potentially complex logic from previous versions
    console.log(`Placeholder: Inserting/updating milestone statuses for loan ${loanId} in state ${state}`);
}

export async function processForeclosureRecord(record: any, reportDate: string) {
    // Placeholder for potentially complex logic from previous versions
     console.log(`Placeholder: Processing foreclosure record for loan ${record.loan_id}`);
}