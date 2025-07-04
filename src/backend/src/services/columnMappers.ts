// Column Mapping Services for Different File Types
import * as XLSX from 'xlsx';

// Helper functions (from existing upload.ts)
export const cleanCurrency = (value: any): number | null => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const cleaned = String(value).replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

export const cleanPercentage = (value: any): number | null => {
  // Handles null, undefined, or empty string values
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  // Removes any percentage signs and trims whitespace
  const cleaned = String(value).replace(/%/g, '').trim();
  const num = parseFloat(cleaned);

  // Returns null if the value is not a number
  if (isNaN(num)) {
    return null;
  }

  // THIS IS THE CRITICAL LOGIC:
  // If the number is 1 or greater (e.g., 10.75), it's treated as a percentage and divided by 100.
  // If the number is less than 1 (e.g., 0.1075), it's treated as the correct decimal value already.
  return num >= 1 ? num / 100.0 : num;
};

export const parseExcelDate = (excelDate: any): string | null => {
  if (!excelDate) return null;
  
  // Handle numeric values and numeric strings (e.g., "45323")
  if (typeof excelDate === 'number' || (typeof excelDate === 'string' && /^\d+(\.\d+)?$/.test(excelDate))) {
    const numericValue = typeof excelDate === 'string' ? parseFloat(excelDate) : excelDate;
    if (!isNaN(numericValue) && numericValue > 0) {
      const jsDate = XLSX.SSF.parse_date_code(numericValue);
      if (jsDate) {
        const year = jsDate.y;
        const month = String(jsDate.m).padStart(2, '0');
        const day = String(jsDate.d).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
  }
  
  // Handle string dates
  if (typeof excelDate === 'string') {
    // Check if already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(excelDate)) {
      return excelDate;
    }
    
    // Try to parse other date formats
    const date = new Date(excelDate);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  return null;
};

export const getValue = (row: any, keys: string[]): any | null => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
};

export const cleanInteger = (value: any): number | null => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const num = parseInt(String(value), 10);
  return isNaN(num) ? null : num;
};

// Foreclosure Event Data Interface - Single source of truth
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
  [key: string]: any; // Allow additional properties
}

// Foreclosure Data Column Mapping
export interface ForeclosureRecord {
  upload_session_id: string;
  file_date?: string | null;
  loan_id?: string | null;
  investor_id?: string | null;
  investor_loan_number?: string | null;
  fc_atty_poc?: string | null;
  fc_atty_poc_phone?: string | null;
  fc_atty_poc_email?: string | null;
  fc_jurisdiction?: string | null;
  fc_status?: string | null;
  active_fc_days?: number | null;
  hold_fc_days?: number | null;
  total_fc_days?: number | null;
  fc_closed_date?: string | null;
  fc_closed_reason?: string | null;
  contested_start_date?: string | null;
  contested_reason?: string | null;
  contested_summary?: string | null;
  active_loss_mit?: string | null;
  active_loss_mit_start_date?: string | null;
  active_loss_mit_reason?: string | null;
  last_note_date?: string | null;
  last_note?: string | null;
  title_received_actual_start?: string | null;
  title_received_expected_completion?: string | null;
  title_received_actual_completion?: string | null;
  title_received_delay_reason?: string | null;
  first_legal_expected_start?: string | null;
  first_legal_actual_start?: string | null;
  first_legal_expected_completion?: string | null;
  first_legal_actual_completion?: string | null;
  first_legal_completion_variance?: number | null;
  first_legal_delay_reason?: string | null;
  service_perfected_expected_start?: string | null;
  service_perfected_actual_start?: string | null;
  service_perfected_expected_completion?: string | null;
  service_perfected_actual_completion?: string | null;
  service_perfected_completion_variance?: number | null;
  service_perfected_delay_reason?: string | null;
  publication_started_expected_start?: string | null;
  publication_started_actual_start?: string | null;
  publication_started_expected_completion?: string | null;
  publication_started_actual_completion?: string | null;
  publication_started_completion_variance?: number | null;
  publication_started_delay_reason?: string | null;
  order_of_reference_expected_start?: string | null;
  order_of_reference_actual_start?: string | null;
  order_of_reference_expected_completion?: string | null;
  order_of_reference_actual_completion?: string | null;
  order_of_reference_completion_variance?: number | null;
  order_of_reference_delay_reason?: string | null;
  judgment_entered_expected_start?: string | null;
  judgment_entered_actual_start?: string | null;
  judgment_entered_expected_completion?: string | null;
  judgment_entered_actual_completion?: string | null;
  judgment_entered_completion_variance?: number | null;
  judgment_entered_delay_reason?: string | null;
  redemption_expires_expected_start?: string | null;
  redemption_expires_actual_start?: string | null;
  redemption_expires_expected_completion?: string | null;
  redemption_expires_actual_completion?: string | null;
  redemption_expires_completion_variance?: number | null;
  redemption_expires_delay_reason?: string | null;
  sale_held_expected_start?: string | null;
  sale_held_expected_completion?: string | null;
  sale_held_actual_completion?: string | null;
  sale_held_completion_variance?: number | null;
  sale_held_delay_reason?: string | null;
  rrc_expected_start?: string | null;
  rrc_actual_start?: string | null;
  rrc_expected_completion?: string | null;
  rrc_actual_completion?: string | null;
  rrc_completion_variance?: number | null;
  rrc_delay_reason?: string | null;
  source_filename?: string | null;
  data_issues?: any | null;
}

export function mapForeclosureData(row: any, uploadSessionId: string, sourceFilename: string): ForeclosureRecord {
  return {
    upload_session_id: uploadSessionId,
    file_date: parseExcelDate(getValue(row, ['File Date'])),
    loan_id: getValue(row, ['Loan ID']),
    investor_id: getValue(row, ['Investor ID']),
    investor_loan_number: getValue(row, ['Investor Loan Number']),
    fc_atty_poc: getValue(row, ['FC Atty POC']),
    fc_atty_poc_phone: getValue(row, ['FC Atty POC Phone']),
    fc_atty_poc_email: getValue(row, ['FC Atty POC Email']),
    fc_jurisdiction: getValue(row, ['FC Jurisdiction']),
    fc_status: getValue(row, ['FC Status']),
    active_fc_days: cleanInteger(getValue(row, ['Active FC Days'])),
    hold_fc_days: cleanInteger(getValue(row, ['Hold FC Days'])),
    total_fc_days: cleanInteger(getValue(row, ['Total FC Days'])),
    fc_closed_date: parseExcelDate(getValue(row, ['FC Closed Date'])),
    fc_closed_reason: getValue(row, ['FC Closed Reason']),
    contested_start_date: parseExcelDate(getValue(row, ['Contested Start Date'])),
    contested_reason: getValue(row, ['Contested Reason']),
    contested_summary: getValue(row, ['Contested Summary']),
    active_loss_mit: getValue(row, ['Active Loss Mit']),
    active_loss_mit_start_date: parseExcelDate(getValue(row, ['Active Loss Mit Start Date'])),
    active_loss_mit_reason: getValue(row, ['Active Loss Mit Reason']),
    last_note_date: parseExcelDate(getValue(row, ['Last Note Date'])),
    last_note: getValue(row, ['Last Note']),
    title_received_actual_start: parseExcelDate(getValue(row, ['Title Received Actual Start'])),
    title_received_expected_completion: parseExcelDate(getValue(row, ['Title Received Expected Completion'])),
    title_received_actual_completion: parseExcelDate(getValue(row, ['Title Received Actual Completion'])),
    title_received_delay_reason: getValue(row, ['Title Received Delay Reason']),
    first_legal_expected_start: parseExcelDate(getValue(row, ['First Legal Expected Start'])),
    first_legal_actual_start: parseExcelDate(getValue(row, ['First Legal Actual Start'])),
    first_legal_expected_completion: parseExcelDate(getValue(row, ['First Legal Expected Completion'])),
    first_legal_actual_completion: parseExcelDate(getValue(row, ['First Legal Actual Completion'])),
    first_legal_completion_variance: cleanInteger(getValue(row, ['First Legal Completion Variance'])),
    first_legal_delay_reason: getValue(row, ['First Legal Delay Reason']),
    service_perfected_expected_start: parseExcelDate(getValue(row, ['Service Perfected Expected Start'])),
    service_perfected_actual_start: parseExcelDate(getValue(row, ['Service Perfected Actual Start'])),
    service_perfected_expected_completion: parseExcelDate(getValue(row, ['Service Perfected Expected Completion'])),
    service_perfected_actual_completion: parseExcelDate(getValue(row, ['Service Perfected Actual Completion'])),
    service_perfected_completion_variance: cleanInteger(getValue(row, ['Service Perfected Completion Variance'])),
    service_perfected_delay_reason: getValue(row, ['Service Perfected Delay Reason']),
    publication_started_expected_start: parseExcelDate(getValue(row, ['Publication Started Expected Start'])),
    publication_started_actual_start: parseExcelDate(getValue(row, ['Publication Started Actual Start'])),
    publication_started_expected_completion: parseExcelDate(getValue(row, ['Publication Started Expected Completion'])),
    publication_started_actual_completion: parseExcelDate(getValue(row, ['Publication Started Actual Completion'])),
    publication_started_completion_variance: cleanInteger(getValue(row, ['Publication Started Completion Variance'])),
    publication_started_delay_reason: getValue(row, ['Publication Started Delay Reason']),
    order_of_reference_expected_start: parseExcelDate(getValue(row, ['Order of Reference Expected Start'])),
    order_of_reference_actual_start: parseExcelDate(getValue(row, ['Order of Reference Actual Start'])),
    order_of_reference_expected_completion: parseExcelDate(getValue(row, ['Order of Reference Expected Completion'])),
    order_of_reference_actual_completion: parseExcelDate(getValue(row, ['Order of Reference Actual Completion'])),
    order_of_reference_completion_variance: cleanInteger(getValue(row, ['Order of Reference Completion Variance'])),
    order_of_reference_delay_reason: getValue(row, ['Order of Reference Delay Reason']),
    judgment_entered_expected_start: parseExcelDate(getValue(row, ['Judgment Entered Expected Start'])),
    judgment_entered_actual_start: parseExcelDate(getValue(row, ['Judgment Entered Actual Start'])),
    judgment_entered_expected_completion: parseExcelDate(getValue(row, ['Judgment Entered Expected Completion'])),
    judgment_entered_actual_completion: parseExcelDate(getValue(row, ['Judgment Entered Actual Completion'])),
    judgment_entered_completion_variance: cleanInteger(getValue(row, ['Judgment Entered Completion Variance'])),
    judgment_entered_delay_reason: getValue(row, ['Judgment Entered Delay Reason']),
    redemption_expires_expected_start: parseExcelDate(getValue(row, ['Redemption Expires Expected Start'])),
    redemption_expires_actual_start: parseExcelDate(getValue(row, ['Redemption Expires Actual Start'])),
    redemption_expires_expected_completion: parseExcelDate(getValue(row, ['Redemption Expires Expected Completion'])),
    redemption_expires_actual_completion: parseExcelDate(getValue(row, ['Redemption Expires Actual Completion'])),
    redemption_expires_completion_variance: cleanInteger(getValue(row, ['Redemption Expires Completion Variance'])),
    redemption_expires_delay_reason: getValue(row, ['Redemption Expires Delay Reason']),
    sale_held_expected_start: parseExcelDate(getValue(row, ['Sale Held Expected Start'])),
    sale_held_expected_completion: parseExcelDate(getValue(row, ['Sale Held Expected Completion'])),
    sale_held_actual_completion: parseExcelDate(getValue(row, ['Sale Held Actual Completion'])),
    sale_held_completion_variance: cleanInteger(getValue(row, ['Sale Held Completion Variance'])),
    sale_held_delay_reason: getValue(row, ['Sale Held Delay Reason']),
    rrc_expected_start: parseExcelDate(getValue(row, ['RRC Expected Start'])),
    rrc_actual_start: parseExcelDate(getValue(row, ['RRC Actual Start'])),
    rrc_expected_completion: parseExcelDate(getValue(row, ['RRC Expected Completion'])),
    rrc_actual_completion: parseExcelDate(getValue(row, ['RRC Actual Completion'])),
    rrc_completion_variance: cleanInteger(getValue(row, ['RRC Completion Variance'])),
    rrc_delay_reason: getValue(row, ['RRC Delay Reason']),
    source_filename: sourceFilename,
    data_issues: null
  };
}

// Simple foreclosure event data mapping (for ForeclosureEventData interface)
export function mapForeclosureEventData(row: any): ForeclosureEventData {
  return {
    loan_id: getValue(row, ['Loan ID', 'loan_id']),
    fc_status: getValue(row, ['FC Status', 'fc_status']),
    fc_jurisdiction: getValue(row, ['FC Jurisdiction', 'fc_jurisdiction']),
    fc_start_date: parseExcelDate(getValue(row, ['Title Received Actual Start', 'fc_start_date'])),
    current_attorney: getValue(row, ['FC Atty POC', 'current_attorney']),
    referral_date: parseExcelDate(getValue(row, ['First Legal Actual Start', 'referral_date'])),
    title_ordered_date: parseExcelDate(getValue(row, ['Title Received Expected Start', 'title_ordered_date'])),
    title_received_date: parseExcelDate(getValue(row, ['Title Received Actual Completion', 'title_received_date'])),
    complaint_filed_date: parseExcelDate(getValue(row, ['First Legal Actual Completion', 'complaint_filed_date'])),
    service_completed_date: parseExcelDate(getValue(row, ['Service Perfected Actual Completion', 'service_completed_date'])),
    judgment_date: parseExcelDate(getValue(row, ['Judgment Entered Actual Completion', 'judgment_date'])),
    sale_scheduled_date: parseExcelDate(getValue(row, ['Sale Held Expected Completion', 'sale_scheduled_date'])),
    sale_held_date: parseExcelDate(getValue(row, ['Sale Held Actual Completion', 'sale_held_date'])),
    real_estate_owned_date: parseExcelDate(getValue(row, ['RRC Actual Completion', 'real_estate_owned_date'])),
    eviction_completed_date: null // Not in current data
  };
}

// Daily Metrics Column Mapping - Legacy interface (for old daily_metrics table)
export interface DailyMetricsRecord {
  upload_session_id: string;
  loan_id?: string | null;
  investor?: string | null;
  investor_name?: string | null;
  inv_loan?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  prin_bal?: number | null;
  unapplied_bal?: number | null;
  int_rate?: number | null;
  pi_pmt?: number | null;
  remg_term?: number | null;
  origination_date?: string | null;
  org_term?: number | null;
  org_amount?: number | null;
  lien_pos?: string | null;
  next_pymt_due?: string | null;
  last_pymt_received?: string | null;
  first_pymt_due?: string | null;
  maturity_date?: string | null;
  loan_type?: string | null;
  legal_status?: string | null;
  warning?: string | null;
  pymt_method?: string | null;
  draft_day?: number | null;
  spoc?: string | null;
  jan_25?: number | null;
  feb_25?: number | null;
  mar_25?: number | null;
  apr_25?: number | null;
  may_25?: number | null;
  jun_25?: number | null;
  jul_25?: number | null;
  aug_25?: number | null;
  sep_25?: number | null;
  oct_25?: number | null;
  nov_25?: number | null;
  dec_25?: number | null;
  source_filename?: string | null;
  data_issues?: any | null;
}

export function mapDailyMetricsData(row: any, uploadSessionId: string, sourceFilename: string): DailyMetricsRecord {
  return {
    upload_session_id: uploadSessionId,
    loan_id: getValue(row, ['Loan ID']),
    investor: getValue(row, ['Investor']),
    investor_name: getValue(row, ['Investor Name']),
    inv_loan: getValue(row, ['Inv Loan']),
    first_name: getValue(row, ['First Name']),
    last_name: getValue(row, ['Last Name']),
    address: getValue(row, ['Address']),
    city: getValue(row, ['City']),
    state: getValue(row, ['State']),
    zip: getValue(row, ['Zip']),
    prin_bal: cleanCurrency(getValue(row, ['Prin Bal'])),
    unapplied_bal: cleanCurrency(getValue(row, ['Unapplied Bal'])),
    int_rate: cleanPercentage(getValue(row, ['Int Rate'])),
    pi_pmt: cleanCurrency(getValue(row, ['PI Pmt'])),
    remg_term: cleanInteger(getValue(row, ['Remg Term'])),
    origination_date: parseExcelDate(getValue(row, ['Origination Date'])),
    org_term: cleanInteger(getValue(row, ['Org Term'])),
    org_amount: cleanCurrency(getValue(row, ['Org Amount'])),
    lien_pos: getValue(row, ['Lien Pos']),
    next_pymt_due: parseExcelDate(getValue(row, ['Next Pymt Due'])),
    last_pymt_received: parseExcelDate(getValue(row, ['Last Pymt Received'])),
    first_pymt_due: parseExcelDate(getValue(row, ['First Pymt Due'])),
    maturity_date: parseExcelDate(getValue(row, ['Maturity Date'])),
    loan_type: getValue(row, ['Loan Type']),
    legal_status: getValue(row, ['Legal Status']),
    warning: getValue(row, ['Warning']),
    pymt_method: getValue(row, ['Pymt Method']),
    draft_day: cleanInteger(getValue(row, ['Draft Day'])),
    spoc: getValue(row, ['SPOC']),
    jan_25: cleanCurrency(getValue(row, ['Jan-25'])),
    feb_25: cleanCurrency(getValue(row, ['Feb-25'])),
    mar_25: cleanCurrency(getValue(row, ['Mar-25'])),
    apr_25: cleanCurrency(getValue(row, ['Apr-25'])),
    may_25: cleanCurrency(getValue(row, ['May-25'])),
    jun_25: cleanCurrency(getValue(row, ['Jun-25'])),
    jul_25: cleanCurrency(getValue(row, ['Jul-25'])),
    aug_25: cleanCurrency(getValue(row, ['Aug-25'])),
    sep_25: cleanCurrency(getValue(row, ['Sep-25'])),
    oct_25: cleanCurrency(getValue(row, ['Oct-25'])),
    nov_25: cleanCurrency(getValue(row, ['Nov-25'])),
    dec_25: cleanCurrency(getValue(row, ['Dec-25'])),
    source_filename: sourceFilename,
    data_issues: null
  };
}

// New interfaces for current/history table structure

// Daily Metrics Current Record (for daily_metrics_current table)
export interface DailyMetricsCurrentRecord {
  loan_id: string;
  investor?: string | null;
  investor_name?: string | null;
  inv_loan?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  prin_bal?: number | null;
  unapplied_bal?: number | null;
  int_rate?: number | null;
  pi_pmt?: number | null;
  remg_term?: number | null;
  origination_date?: string | null;
  org_term?: number | null;
  org_amount?: number | null;
  lien_pos?: string | null;
  next_pymt_due?: string | null;
  last_pymt_received?: string | null;
  first_pymt_due?: string | null;
  maturity_date?: string | null;
  loan_type?: string | null;
  legal_status?: string | null;
  warning?: string | null;
  pymt_method?: string | null;
  draft_day?: string | null;
  spoc?: string | null;
  january_2025?: number | null;
  february_2025?: number | null;
  march_2025?: number | null;
  april_2025?: number | null;
  may_2025?: number | null;
  june_2025?: number | null;
  july_2025?: number | null;
  august_2025?: number | null;
  september_2025?: number | null;
  october_2025?: number | null;
  november_2025?: number | null;
  december_2025?: number | null;
}

// Daily Metrics History Record (for daily_metrics_history table)
export interface DailyMetricsHistoryRecord extends DailyMetricsCurrentRecord {
  report_date: string;
}

// Foreclosure Events History Record (for foreclosure_events_history table)
export interface ForeclosureEventsHistoryRecord {
  loan_id: string;
  report_date: string;
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
}

// Mapping function for new daily metrics structure
export function mapDailyMetricsCurrentData(row: any, reportDate: string): DailyMetricsCurrentRecord {
  const loanId = getValue(row, ['Loan ID']);
  if (loanId === '0000360121') {
    const rawRate = getValue(row, ['Int Rate']);
    const cleanedRate = cleanPercentage(rawRate);
    console.log(`[DEBUG 0000360121] Raw Int Rate from file: '${rawRate}', Type: ${typeof rawRate}`);
    console.log(`[DEBUG 0000360121] Cleaned Int Rate after processing: ${cleanedRate}`);
  }

  return {
    loan_id: loanId,
    investor: getValue(row, ['Investor']),
    investor_name: getValue(row, ['Investor Name']),
    inv_loan: getValue(row, ['Inv Loan']),
    first_name: getValue(row, ['First Name']),
    last_name: getValue(row, ['Last Name']),
    address: getValue(row, ['Address']),
    city: getValue(row, ['City']),
    state: getValue(row, ['State']),
    zip: getValue(row, ['Zip']),
    prin_bal: cleanCurrency(getValue(row, ['Prin Bal'])),
    unapplied_bal: cleanCurrency(getValue(row, ['Unapplied Bal'])),
    int_rate: cleanPercentage(getValue(row, ['Int Rate'])),
    pi_pmt: cleanCurrency(getValue(row, ['PI Pmt'])),
    remg_term: cleanInteger(getValue(row, ['Remg Term'])),
    origination_date: parseExcelDate(getValue(row, ['Origination Date'])),
    org_term: cleanInteger(getValue(row, ['Org Term'])),
    org_amount: cleanCurrency(getValue(row, ['Org Amount'])),
    lien_pos: getValue(row, ['Lien Pos']),
    next_pymt_due: parseExcelDate(getValue(row, ['Next Pymt Due'])),
    last_pymt_received: parseExcelDate(getValue(row, ['Last Pymt Received'])),
    first_pymt_due: parseExcelDate(getValue(row, ['First Pymt Due'])),
    maturity_date: parseExcelDate(getValue(row, ['Maturity Date'])),
    loan_type: getValue(row, ['Loan Type']),
    legal_status: getValue(row, ['Legal Status']),
    warning: getValue(row, ['Warning']),
    pymt_method: getValue(row, ['Pymt Method']),
    draft_day: getValue(row, ['Draft Day']),
    spoc: getValue(row, ['SPOC']),
    january_2025: cleanCurrency(getValue(row, ['Jan-25', 'January 2025', 'Jan 2025', 'january_2025'])),
    february_2025: cleanCurrency(getValue(row, ['Feb-25', 'February 2025', 'Feb 2025', 'february_2025'])),
    march_2025: cleanCurrency(getValue(row, ['Mar-25', 'March 2025', 'Mar 2025', 'march_2025'])),
    april_2025: cleanCurrency(getValue(row, ['Apr-25', 'April 2025', 'Apr 2025', 'april_2025'])),
    may_2025: cleanCurrency(getValue(row, ['May-25', 'May 2025', 'may_2025'])),
    june_2025: cleanCurrency(getValue(row, ['Jun-25', 'June 2025', 'Jun 2025', 'june_2025'])),
    july_2025: cleanCurrency(getValue(row, ['Jul-25', 'July 2025', 'Jul 2025', 'july_2025'])),
    august_2025: cleanCurrency(getValue(row, ['Aug-25', 'August 2025', 'Aug 2025', 'august_2025'])),
    september_2025: cleanCurrency(getValue(row, ['Sep-25', 'September 2025', 'Sep 2025', 'september_2025'])),
    october_2025: cleanCurrency(getValue(row, ['Oct-25', 'October 2025', 'Oct 2025', 'october_2025'])),
    november_2025: cleanCurrency(getValue(row, ['Nov-25', 'November 2025', 'Nov 2025', 'november_2025'])),
    december_2025: cleanCurrency(getValue(row, ['Dec-25', 'December 2025', 'Dec 2025', 'december_2025']))
  };
}

// Mapping function for daily metrics history data
export function mapDailyMetricsHistoryData(row: any, reportDate: string): DailyMetricsHistoryRecord {
  return {
    ...mapDailyMetricsCurrentData(row, reportDate),
    report_date: reportDate
  };
}