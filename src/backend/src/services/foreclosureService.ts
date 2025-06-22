import pool from '../db';
import * as fs from 'fs';
import * as path from 'path';

// Helper to add days to a date
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Helper function to convert Excel serial date to ISO format
function excelDateToISO(serial: number): string {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400; // seconds in a day
  const date = new Date(utc_value * 1000);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Enhanced date parser that handles Excel serial numbers and date strings
function parseDate(value: any): string | null {
  if (!value) return null;
  
  // If it's a number, treat it as Excel serial date
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value))) {
    const serial = typeof value === 'string' ? parseFloat(value) : value;
    if (!isNaN(serial) && serial > 0) {
      try {
        return excelDateToISO(serial);
      } catch (error) {
        console.error('Error converting Excel date:', error);
        return null;
      }
    }
  }
  
  // If it's already a string date, validate it
  if (typeof value === 'string') {
    // Check if it's already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    
    // Try to parse other date formats
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  return null;
}

interface MilestoneBenchmark {
  state: string;
  jurisdiction: string;
  stepCode: number;
  sequence: number;
  milestone: string;
  preferredDays: number;
  standardFee: number;
  standardCost: number;
  standardSpend: number;
  db_column_actual_completion?: string;
  db_column_expected_completion?: string;
}

export interface ForeclosureEventData {
  loan_id: string;
  fc_status?: string | null;
  fc_jurisdiction?: string | null;
  fc_start_date?: string | null;
  current_attorney?: string | null;
  referral_date?: string | null;
  title_ordered_date?: string | null;
  title_received_date?: string | null;
  complaint_filed_date?: string | null;
  service_completed_date?: string | null;
  judgment_date?: string | null;
  sale_scheduled_date?: string | null;
  sale_held_date?: string | null;
  real_estate_owned_date?: string | null;
  eviction_completed_date?: string | null;
  // Expected completion dates
  referral_expected_completion_date?: string | null;
  title_ordered_expected_completion_date?: string | null;
  title_received_expected_completion_date?: string | null;
  complaint_filed_expected_completion_date?: string | null;
  service_completed_expected_completion_date?: string | null;
  judgment_expected_completion_date?: string | null;
  sale_scheduled_expected_completion_date?: string | null;
  sale_held_expected_completion_date?: string | null;
  real_estate_owned_expected_completion_date?: string | null;
  eviction_completed_expected_completion_date?: string | null;
  [key: string]: any; // Allow dynamic properties
}

// Load milestone benchmarks from JSON file
let milestoneBenchmarks: MilestoneBenchmark[] = [];

// Helper function to try multiple possible paths for the JSON file
function loadMilestoneBenchmarks(): MilestoneBenchmark[] {
  const possiblePaths = [
    // From dist/services/ to dist/ - copied by build script
    path.resolve(__dirname, '../fcl_milestones_by_state.json'),
    // From dist/services/ - local development after build
    path.resolve(__dirname, '../../../../fcl_milestones_by_state.json'),
    // From dist/services/ - alternative structure
    path.resolve(__dirname, '../../../fcl_milestones_by_state.json'),
    // From project root using process.cwd() - fallback
    path.resolve(process.cwd(), 'fcl_milestones_by_state.json'),
    // For Render deployment structure
    path.resolve(__dirname, '../../fcl_milestones_by_state.json'),
  ];

  console.log(`Current __dirname: ${__dirname}`);
  
  for (const benchmarkPath of possiblePaths) {
    try {
      console.log(`Attempting to load milestone benchmarks from: ${benchmarkPath}`);
      if (fs.existsSync(benchmarkPath)) {
        const benchmarkData = fs.readFileSync(benchmarkPath, 'utf8');
        const data = JSON.parse(benchmarkData);
        console.log(`Successfully loaded ${data.length} milestone benchmarks from: ${benchmarkPath}`);
        return data;
      } else {
        console.log(`File does not exist at: ${benchmarkPath}`);
      }
    } catch (error) {
      console.log(`Failed to load from ${benchmarkPath}:`, error instanceof Error ? error.message : String(error));
    }
  }
  
  console.error('Unable to load milestone benchmarks from any attempted path');
  return [];
}

try {
  milestoneBenchmarks = loadMilestoneBenchmarks();
} catch (error) {
  console.error('Critical error loading milestone benchmarks:', error);
}

// Map milestone names from file columns to benchmark milestone names
const milestoneMappings: Record<string, string> = {
  'Title Received': 'Title Received',
  'First Legal': 'Complaint Filing',
  'Service Perfected': 'Service Complete',
  'Publication Started': 'Publication',
  'Order of Reference': 'Order of Reference',
  'Judgment Entered': 'Judgment',
  'Redemption Expires': 'Redemption Expires',
  'Sale Held': 'Sale Held',
  'RRC': 'Receivership/REO'
};

// Map milestone names to database columns
const milestoneToDbColumn: Record<string, { actual: string; expected: string }> = {
  'Referral': { actual: 'referral_date', expected: 'referral_expected_completion_date' },
  'Title Ordered': { actual: 'title_ordered_date', expected: 'title_ordered_expected_completion_date' },
  'Title Received': { actual: 'title_received_date', expected: 'title_received_expected_completion_date' },
  'Complaint Filing': { actual: 'complaint_filed_date', expected: 'complaint_filed_expected_completion_date' },
  'Service Complete': { actual: 'service_completed_date', expected: 'service_completed_expected_completion_date' },
  'Judgment': { actual: 'judgment_date', expected: 'judgment_expected_completion_date' },
  'Sale Scheduled': { actual: 'sale_scheduled_date', expected: 'sale_scheduled_expected_completion_date' },
  'Sale Held': { actual: 'sale_held_date', expected: 'sale_held_expected_completion_date' },
  'Receivership/REO': { actual: 'real_estate_owned_date', expected: 'real_estate_owned_expected_completion_date' },
  'Eviction Complete': { actual: 'eviction_completed_date', expected: 'eviction_completed_expected_completion_date' }
};

// Extract foreclosure event data from the row based on new schema
export function extractForeclosureEventData(row: any): ForeclosureEventData {
  // Import getValue for dynamic header lookup
  const { getValue } = require('./columnMappers');
  
  // Use dynamic header lookup and Title Received Actual Start as fc_start_date
  const fcStartDate = parseDate(getValue(row, ['Title Received Actual Start', 'title_received_actual_start']));
  const referralDate = parseDate(getValue(row, ['First Legal Actual Start', 'Title Received Actual Start', 'referral_date']));
  const titleOrderedDate = parseDate(getValue(row, ['Title Received Expected Start', 'title_received_expected_start']));
  const titleReceivedDate = parseDate(getValue(row, ['Title Received Actual Completion', 'title_received_actual_completion']));
  const complaintFiledDate = parseDate(getValue(row, ['First Legal Actual Start', 'First Legal Actual Completion', 'complaint_filed_date']));
  const serviceCompletedDate = parseDate(getValue(row, ['Service Perfected Actual Completion', 'service_completed_date']));
  const judgmentDate = parseDate(getValue(row, ['Judgment Entered Actual Completion', 'judgment_date']));
  const saleScheduledDate = parseDate(getValue(row, ['Sale Held Expected Completion', 'sale_scheduled_date']));
  const saleHeldDate = parseDate(getValue(row, ['Sale Held Actual Completion', 'sale_held_date']));
  
  return {
    loan_id: getValue(row, ['Loan ID', 'loan_id']),
    fc_status: getValue(row, ['FC Status', 'fc_status']),
    fc_jurisdiction: getValue(row, ['FC Jurisdiction', 'fc_jurisdiction']),
    fc_start_date: fcStartDate, // Use Title Received Actual Start as proxy
    current_attorney: getValue(row, ['FC Atty POC', 'current_attorney']),
    referral_date: referralDate,
    title_ordered_date: titleOrderedDate,
    title_received_date: titleReceivedDate,
    complaint_filed_date: complaintFiledDate,
    service_completed_date: serviceCompletedDate,
    judgment_date: judgmentDate,
    sale_scheduled_date: saleScheduledDate,
    sale_held_date: saleHeldDate,
    real_estate_owned_date: parseDate(getValue(row, ['RRC Actual Completion', 'real_estate_owned_date'])),
    eviction_completed_date: null // Not in current data
  };
}

// Insert or update foreclosure event record
export async function upsertForeclosureEvent(eventData: ForeclosureEventData): Promise<void> {
  const query = `
    INSERT INTO foreclosure_events (
      loan_id, fc_status, fc_jurisdiction, fc_start_date, current_attorney,
      referral_date, title_ordered_date, title_received_date, complaint_filed_date,
      service_completed_date, judgment_date, sale_scheduled_date, sale_held_date,
      real_estate_owned_date, eviction_completed_date,
      referral_expected_completion_date, title_ordered_expected_completion_date,
      title_received_expected_completion_date, complaint_filed_expected_completion_date,
      service_completed_expected_completion_date, judgment_expected_completion_date,
      sale_scheduled_expected_completion_date, sale_held_expected_completion_date,
      real_estate_owned_expected_completion_date, eviction_completed_expected_completion_date
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
    ON CONFLICT (loan_id) DO UPDATE SET
      fc_status = EXCLUDED.fc_status,
      fc_jurisdiction = EXCLUDED.fc_jurisdiction,
      fc_start_date = EXCLUDED.fc_start_date,
      current_attorney = EXCLUDED.current_attorney,
      referral_date = EXCLUDED.referral_date,
      title_ordered_date = EXCLUDED.title_ordered_date,
      title_received_date = EXCLUDED.title_received_date,
      complaint_filed_date = EXCLUDED.complaint_filed_date,
      service_completed_date = EXCLUDED.service_completed_date,
      judgment_date = EXCLUDED.judgment_date,
      sale_scheduled_date = EXCLUDED.sale_scheduled_date,
      sale_held_date = EXCLUDED.sale_held_date,
      real_estate_owned_date = EXCLUDED.real_estate_owned_date,
      eviction_completed_date = EXCLUDED.eviction_completed_date,
      referral_expected_completion_date = EXCLUDED.referral_expected_completion_date,
      title_ordered_expected_completion_date = EXCLUDED.title_ordered_expected_completion_date,
      title_received_expected_completion_date = EXCLUDED.title_received_expected_completion_date,
      complaint_filed_expected_completion_date = EXCLUDED.complaint_filed_expected_completion_date,
      service_completed_expected_completion_date = EXCLUDED.service_completed_expected_completion_date,
      judgment_expected_completion_date = EXCLUDED.judgment_expected_completion_date,
      sale_scheduled_expected_completion_date = EXCLUDED.sale_scheduled_expected_completion_date,
      sale_held_expected_completion_date = EXCLUDED.sale_held_expected_completion_date,
      real_estate_owned_expected_completion_date = EXCLUDED.real_estate_owned_expected_completion_date,
      eviction_completed_expected_completion_date = EXCLUDED.eviction_completed_expected_completion_date,
      updated_at = now()
  `;

  const values = [
    eventData.loan_id,
    eventData.fc_status,
    eventData.fc_jurisdiction,
    eventData.fc_start_date,
    eventData.current_attorney,
    eventData.referral_date,
    eventData.title_ordered_date,
    eventData.title_received_date,
    eventData.complaint_filed_date,
    eventData.service_completed_date,
    eventData.judgment_date,
    eventData.sale_scheduled_date,
    eventData.sale_held_date,
    eventData.real_estate_owned_date,
    eventData.eviction_completed_date,
    eventData.referral_expected_completion_date || null,
    eventData.title_ordered_expected_completion_date || null,
    eventData.title_received_expected_completion_date || null,
    eventData.complaint_filed_expected_completion_date || null,
    eventData.service_completed_expected_completion_date || null,
    eventData.judgment_expected_completion_date || null,
    eventData.sale_scheduled_expected_completion_date || null,
    eventData.sale_held_expected_completion_date || null,
    eventData.real_estate_owned_expected_completion_date || null,
    eventData.eviction_completed_expected_completion_date || null
  ];

  await pool.query(query, values);
}

// Get benchmarks for a specific state
function getBenchmarksForState(state: string, jurisdiction: string): MilestoneBenchmark[] {
  return milestoneBenchmarks.filter(
    b => b.state === state && b.jurisdiction === jurisdiction
  );
}

// Get milestones for a state with db column mappings
function getMilestonesForState(state: string, jurisdiction: string = 'Judicial'): MilestoneBenchmark[] {
  const benchmarks = getBenchmarksForState(state, jurisdiction);
  
  // Enhance benchmarks with db column mappings
  return benchmarks.map(benchmark => {
    const columnMapping = milestoneToDbColumn[benchmark.milestone];
    if (columnMapping) {
      return {
        ...benchmark,
        db_column_actual_completion: columnMapping.actual,
        db_column_expected_completion: columnMapping.expected
      };
    }
    return benchmark;
  }).filter(b => b.db_column_actual_completion && b.db_column_expected_completion);
}

// Calculate expected timeline for foreclosure milestones
export async function calculateExpectedTimeline(loanId: string, fcStartDate: Date, actualDates: any, jurisdiction: string = 'Judicial') {
  const state = await getStateForLoan(loanId);
  if (!state) {
    console.warn(`Cannot calculate timeline for loan ${loanId}: state not found.`);
    return {};
  }

  const milestones = getMilestonesForState(state, jurisdiction);
  if (!milestones || milestones.length === 0) {
    console.warn(`No milestone template found for state: ${state}`);
    return {};
  }

  const expectedDates: { [key: string]: string | null } = {};
  let currentDateCursor = fcStartDate;

  for (const milestone of milestones) {
    const actualCompletionKey = milestone.db_column_actual_completion!;
    const expectedCompletionKey = milestone.db_column_expected_completion!;

    const actualCompletionDate = actualDates[actualCompletionKey] ? new Date(actualDates[actualCompletionKey]) : null;

    // The next milestone calculation starts from the *actual* completion if it exists, otherwise from the cursor
    const calculationStartDate = actualCompletionDate || currentDateCursor;

    const expectedCompletionDate = addDays(calculationStartDate, milestone.preferredDays);
    expectedDates[expectedCompletionKey] = expectedCompletionDate.toISOString().split('T')[0];

    // Update the cursor for the next iteration
    currentDateCursor = expectedCompletionDate;
  }

  return expectedDates;
}

// Calculate status flag based on dates
function calculateStatusFlag(
  actualDate: string | null,
  expectedDate: string | null,
  expectedDays: number,
  startDate: string | null
): string {
  if (!actualDate && !expectedDate) return 'Not Started';
  if (!actualDate && expectedDate) {
    const today = new Date();
    const expected = new Date(expectedDate);
    if (today > expected) return 'Overdue';
    return 'On Track';
  }
  if (actualDate && expectedDate) {
    const actual = new Date(actualDate);
    const expected = new Date(expectedDate);
    if (actual <= expected) return 'On Track';
    return 'Delayed';
  }
  if (actualDate && startDate && expectedDays) {
    const start = new Date(startDate);
    const actual = new Date(actualDate);
    const daysDiff = Math.floor((actual.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= expectedDays) return 'Ahead';
    return 'Delayed';
  }
  return 'In Progress';
}

// Insert milestone statuses for a loan
export async function insertMilestoneStatuses(
  loanId: string,
  state: string,
  row: any
): Promise<void> {
  const jurisdiction = row['FC Jurisdiction'] || 'Judicial';
  const benchmarks = getBenchmarksForState(state, jurisdiction);
  
  if (benchmarks.length === 0) {
    console.warn(`No benchmarks found for state: ${state}, jurisdiction: ${jurisdiction}`);
    return;
  }

  // Process each milestone type
  for (const [filePrefix, benchmarkName] of Object.entries(milestoneMappings)) {
    const benchmark = benchmarks.find(b => b.milestone === benchmarkName);
    if (!benchmark) continue;

    const actualStartKey = `${filePrefix} Actual Start`;
    const expectedStartKey = `${filePrefix} Expected Start`;
    const actualCompletionKey = `${filePrefix} Actual Completion`;
    const expectedCompletionKey = `${filePrefix} Expected Completion`;

    const actualStart = parseDate(row[actualStartKey]);
    const expectedStart = parseDate(row[expectedStartKey]);
    const actualCompletion = parseDate(row[actualCompletionKey]);
    const expectedCompletion = parseDate(row[expectedCompletionKey]);

    // Skip if no data for this milestone
    if (!actualStart && !expectedStart && !actualCompletion && !expectedCompletion) {
      continue;
    }

    const statusFlag = calculateStatusFlag(
      actualCompletion,
      expectedCompletion,
      benchmark.preferredDays,
      actualStart || expectedStart
    );

    const query = `
      INSERT INTO foreclosure_milestone_statuses (
        loan_id, state, milestone_order, milestone_name,
        actual_start_date, expected_start_date,
        actual_completion_date, expected_completion_date,
        expected_duration_days, expected_cost_usd, status_flag
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (loan_id, milestone_name) DO UPDATE SET
        actual_start_date = EXCLUDED.actual_start_date,
        expected_start_date = EXCLUDED.expected_start_date,
        actual_completion_date = EXCLUDED.actual_completion_date,
        expected_completion_date = EXCLUDED.expected_completion_date,
        status_flag = EXCLUDED.status_flag,
        updated_at = now()
    `;

    const values = [
      loanId,
      state,
      benchmark.sequence,
      benchmark.milestone,
      actualStart,
      expectedStart,
      actualCompletion,
      expectedCompletion,
      benchmark.preferredDays,
      benchmark.standardSpend,
      statusFlag
    ];

    try {
      await pool.query(query, values);
    } catch (error) {
      console.error(`Error inserting milestone status for ${loanId}, ${benchmark.milestone}:`, error);
    }
  }
}

// Get state for a loan from loans or daily_metrics table
export async function getStateForLoan(loanId: string): Promise<string | null> {
  // First try to get state from loans table
  const loansQuery = `
    SELECT property_state 
    FROM loans 
    WHERE servicer_loan_id = $1 
    LIMIT 1
  `;
  
  const loansResult = await pool.query(loansQuery, [loanId]);
  if (loansResult.rows.length > 0 && loansResult.rows[0].property_state) {
    return loansResult.rows[0].property_state;
  }
  
  // If not found, try daily_metrics_current table
  const metricsQuery = `
    SELECT state 
    FROM daily_metrics_current 
    WHERE loan_id = $1 
    ORDER BY created_at DESC 
    LIMIT 1
  `;
  
  const metricsResult = await pool.query(metricsQuery, [loanId]);
  if (metricsResult.rows.length > 0 && metricsResult.rows[0].state) {
    return metricsResult.rows[0].state;
  }
  
  return null;
}

// Process a complete foreclosure record
export async function processForeclosureRecord(row: any, defaultState?: string, reportDate?: string): Promise<void> {
  try {
    // First, extract the base foreclosure event data
    const eventData = extractForeclosureEventData(row);
    
    // Calculate expected timeline if we have a start date
    if (eventData.fc_start_date) {
      const fcStartDate = new Date(eventData.fc_start_date);
      const jurisdiction = eventData.fc_jurisdiction || 'Judicial';
      const expectedTimelineDates = await calculateExpectedTimeline(eventData.loan_id, fcStartDate, eventData, jurisdiction);
      
      // Merge expected dates into event data
      Object.assign(eventData, expectedTimelineDates);
    }
    
    // Insert/update the foreclosure event with expected dates
    await upsertForeclosureEvent(eventData);
    
    // If reportDate is provided, also insert into history table
    if (reportDate) {
      const { insertForeclosureEventsHistory, createForeclosureHistoryRecord } = await import('./currentHistoryService');
      const historyRecord = createForeclosureHistoryRecord(eventData, reportDate);
      await insertForeclosureEventsHistory(historyRecord);
    }
    
    // Get the state for this loan
    const state = await getStateForLoan(eventData.loan_id) || defaultState || 'NY';
    
    // Then, insert/update milestone statuses
    await insertMilestoneStatuses(eventData.loan_id, state, row);
  } catch (error) {
    console.error('Error processing foreclosure record:', error);
    throw error;
  }
}