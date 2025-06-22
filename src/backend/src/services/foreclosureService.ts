// src/backend/src/services/foreclosureService.ts
import fs from 'fs';
import path from 'path';
import pool from '../db';
import { ForeclosureEventData, mapForeclosureEventData } from './columnMappers';

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
const loadMilestoneBenchmarks = (): StateBenchmark[] => {
  // Try multiple possible paths for the JSON file
  const possiblePaths = [
    path.resolve(__dirname, '..', 'fcl_milestones_by_state.json'), // dist/fcl_milestones_by_state.json
    path.resolve(__dirname, '..', '..', '..', 'fcl_milestones_by_state.json'), // project root
    path.resolve(process.cwd(), 'fcl_milestones_by_state.json'), // current working directory
    path.resolve(process.cwd(), 'src', 'backend', 'dist', 'fcl_milestones_by_state.json') // absolute from project root
  ];

  for (const jsonPath of possiblePaths) {
    try {
      if (fs.existsSync(jsonPath)) {
        console.log(`[ForeclosureService] Loading milestones from: ${jsonPath}`);
        const fileContents = fs.readFileSync(jsonPath, 'utf8');
        return JSON.parse(fileContents);
      }
    } catch (error) {
      console.warn(`[ForeclosureService] Failed to read milestones from ${jsonPath}:`, error instanceof Error ? error.message : String(error));
      continue;
    }
  }
  
  throw new Error(`[ForeclosureService] Could not find fcl_milestones_by_state.json in any of the expected locations: ${possiblePaths.join(', ')}`);
};

const getMilestonesForState = (stateAbbr: string, jurisdiction: string | null): MilestoneBenchmark[] => {
    const benchmarks = loadMilestoneBenchmarks();

    // --- START DIAGNOSTIC LOGGING ---
    console.log(`[Diagnostics] Searching for state abbreviation: "${stateAbbr}"`);
    const availableStatesInJSON = benchmarks.map(s => s.state);
    console.log(`[Diagnostics] Available states in JSON file: [${availableStatesInJSON.join(', ')}]`);
    // --- END DIAGNOSTIC LOGGING ---

    const stateData = benchmarks.find((s) => s.state === stateAbbr);

    if (!stateData) {
      console.warn(`[Diagnostics] No milestone benchmark found for state: ${stateAbbr}`);
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
  console.log(`[ForeclosureService] Getting timeline for loan: ${loanId}`);
  
  const state = await getStateForLoan(loanId);
  console.log(`[ForeclosureService] Loan ${loanId} state: ${state}`);
  
  const foreclosureEventResult = await pool.query('SELECT * FROM foreclosure_events WHERE loan_id = $1', [loanId]);
  console.log(`[ForeclosureService] Found ${foreclosureEventResult.rows.length} foreclosure events for loan: ${loanId}`);

  if (!state) {
    console.log(`[ForeclosureService] No state found for loan: ${loanId}`);
    return null;
  }
  
  if (foreclosureEventResult.rows.length === 0) {
    console.log(`[ForeclosureService] No foreclosure events found for loan: ${loanId}`);
    return null;
  }

  const actualEvents = foreclosureEventResult.rows[0];
  console.log(`[ForeclosureService] Foreclosure data for loan ${loanId}:`, {
    fc_jurisdiction: actualEvents.fc_jurisdiction,
    fc_start_date: actualEvents.fc_start_date
  });
  
  const fcStartDate = actualEvents.fc_start_date ? new Date(actualEvents.fc_start_date) : new Date();
  const milestonesTemplate = getMilestonesForState(state, actualEvents.fc_jurisdiction);
  console.log(`[ForeclosureService] Found ${milestonesTemplate.length} milestone templates for state ${state}`);

  if (!milestonesTemplate || milestonesTemplate.length === 0) {
    console.log(`[ForeclosureService] No milestone templates found for state: ${state}`);
    return [];
  }

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
    lastCompletionDate = expectedCompletionDate;
  }
  
  console.log(`[ForeclosureService] Generated ${timeline.length} timeline milestones for loan: ${loanId}`);
  return timeline;
}

// --- OTHER FUNCTIONS ---
// These functions might be called by other services and are included for completeness.

export async function upsertForeclosureEvent(eventData: ForeclosureEventData): Promise<void> {
    const columns = Object.keys(eventData).filter(k => k !== 'loan_id' && eventData[k] !== undefined);
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

export function extractForeclosureEventData(row: any): ForeclosureEventData {
  return mapForeclosureEventData(row);
}

export async function insertMilestoneStatuses(loanId: string, state: string, record: any) {
    console.log(`Placeholder: Inserting/updating milestone statuses for loan ${loanId} in state ${state}`);
}

export async function processForeclosureRecord(record: any, defaultState?: string, reportDate?: string) {
    try {
        // Extract the foreclosure event data
        const eventData = extractForeclosureEventData(record);
        
        // Upsert the foreclosure event
        await upsertForeclosureEvent(eventData);
        
        // Get state for loan and insert milestone statuses
        const state = await getStateForLoan(eventData.loan_id) || defaultState || 'NY';
        await insertMilestoneStatuses(eventData.loan_id, state, record);
        
        console.log(`Processed foreclosure record for loan ${eventData.loan_id}`);
    } catch (error) {
        console.error('Error processing foreclosure record:', error);
        throw error;
    }
}