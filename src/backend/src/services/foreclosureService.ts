import pool from '../db';
import * as fs from 'fs';
import * as path from 'path';

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
}

// Load milestone benchmarks from JSON file
let milestoneBenchmarks: MilestoneBenchmark[] = [];
try {
  const benchmarkPath = path.resolve(__dirname, '../../../fcl_milestones_by_state.json');
  const benchmarkData = fs.readFileSync(benchmarkPath, 'utf8');
  milestoneBenchmarks = JSON.parse(benchmarkData);
  console.log(`Loaded ${milestoneBenchmarks.length} milestone benchmarks`);
} catch (error) {
  console.error('Error loading milestone benchmarks:', error);
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

// Extract foreclosure event data from the row based on new schema
export function extractForeclosureEventData(row: any): ForeclosureEventData {
  // Extract and parse dates from various milestone columns
  const referralDate = parseDate(row['First Legal Actual Start'] || row['Title Received Actual Start']);
  const titleOrderedDate = parseDate(row['Title Received Expected Start']);
  const titleReceivedDate = parseDate(row['Title Received Actual Completion']);
  const complaintFiledDate = parseDate(row['First Legal Actual Start'] || row['First Legal Actual Completion']);
  const serviceCompletedDate = parseDate(row['Service Perfected Actual Completion']);
  const judgmentDate = parseDate(row['Judgment Entered Actual Completion']);
  const saleScheduledDate = parseDate(row['Sale Held Expected Completion']);
  const saleHeldDate = parseDate(row['Sale Held Actual Completion']);
  
  return {
    loan_id: row['Loan ID'],
    fc_status: row['FC Status'],
    fc_jurisdiction: row['FC Jurisdiction'],
    fc_start_date: referralDate,
    current_attorney: row['FC Atty POC'],
    referral_date: referralDate,
    title_ordered_date: titleOrderedDate,
    title_received_date: titleReceivedDate,
    complaint_filed_date: complaintFiledDate,
    service_completed_date: serviceCompletedDate,
    judgment_date: judgmentDate,
    sale_scheduled_date: saleScheduledDate,
    sale_held_date: saleHeldDate,
    real_estate_owned_date: parseDate(row['RRC Actual Completion']),
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
      real_estate_owned_date, eviction_completed_date
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
    eventData.eviction_completed_date
  ];

  await pool.query(query, values);
}

// Get benchmarks for a specific state
function getBenchmarksForState(state: string, jurisdiction: string): MilestoneBenchmark[] {
  return milestoneBenchmarks.filter(
    b => b.state === state && b.jurisdiction === jurisdiction
  );
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
async function getStateForLoan(loanId: string): Promise<string | null> {
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
    // First, insert/update the foreclosure event
    const eventData = extractForeclosureEventData(row);
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