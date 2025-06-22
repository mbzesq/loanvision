import pool from '../db';
import { 
  DailyMetricsCurrentRecord, 
  DailyMetricsHistoryRecord, 
  ForeclosureEventsHistoryRecord 
} from './columnMappers';
import { ForeclosureEventData } from './foreclosureService';

// Daily Metrics Operations

export async function insertDailyMetricsHistory(record: DailyMetricsHistoryRecord): Promise<void> {
  const query = `
    INSERT INTO daily_metrics_history (
      loan_id, report_date, investor, investor_name, inv_loan, first_name, last_name,
      address, city, state, zip, prin_bal, unapplied_bal, int_rate, pi_pmt, remg_term,
      origination_date, org_term, org_amount, lien_pos, next_pymt_due, last_pymt_received,
      first_pymt_due, maturity_date, loan_type, legal_status, warning, pymt_method, draft_day,
      spoc, january_2025, february_2025, march_2025, april_2025, may_2025, june_2025,
      july_2025, august_2025, september_2025, october_2025, november_2025, december_2025
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39,
      $40, $41, $42
    )
    ON CONFLICT (loan_id, report_date) DO UPDATE SET
      investor = EXCLUDED.investor,
      investor_name = EXCLUDED.investor_name,
      inv_loan = EXCLUDED.inv_loan,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      zip = EXCLUDED.zip,
      prin_bal = EXCLUDED.prin_bal,
      unapplied_bal = EXCLUDED.unapplied_bal,
      int_rate = EXCLUDED.int_rate,
      pi_pmt = EXCLUDED.pi_pmt,
      remg_term = EXCLUDED.remg_term,
      origination_date = EXCLUDED.origination_date,
      org_term = EXCLUDED.org_term,
      org_amount = EXCLUDED.org_amount,
      lien_pos = EXCLUDED.lien_pos,
      next_pymt_due = EXCLUDED.next_pymt_due,
      last_pymt_received = EXCLUDED.last_pymt_received,
      first_pymt_due = EXCLUDED.first_pymt_due,
      maturity_date = EXCLUDED.maturity_date,
      loan_type = EXCLUDED.loan_type,
      legal_status = EXCLUDED.legal_status,
      warning = EXCLUDED.warning,
      pymt_method = EXCLUDED.pymt_method,
      draft_day = EXCLUDED.draft_day,
      spoc = EXCLUDED.spoc,
      january_2025 = EXCLUDED.january_2025,
      february_2025 = EXCLUDED.february_2025,
      march_2025 = EXCLUDED.march_2025,
      april_2025 = EXCLUDED.april_2025,
      may_2025 = EXCLUDED.may_2025,
      june_2025 = EXCLUDED.june_2025,
      july_2025 = EXCLUDED.july_2025,
      august_2025 = EXCLUDED.august_2025,
      september_2025 = EXCLUDED.september_2025,
      october_2025 = EXCLUDED.october_2025,
      november_2025 = EXCLUDED.november_2025,
      december_2025 = EXCLUDED.december_2025
  `;

  const values = [
    record.loan_id, record.report_date, record.investor, record.investor_name, record.inv_loan,
    record.first_name, record.last_name, record.address, record.city, record.state, record.zip,
    record.prin_bal, record.unapplied_bal, record.int_rate, record.pi_pmt, record.remg_term,
    record.origination_date, record.org_term, record.org_amount, record.lien_pos, record.next_pymt_due,
    record.last_pymt_received, record.first_pymt_due, record.maturity_date, record.loan_type,
    record.legal_status, record.warning, record.pymt_method, record.draft_day, record.spoc,
    record.january_2025, record.february_2025, record.march_2025, record.april_2025, record.may_2025,
    record.june_2025, record.july_2025, record.august_2025, record.september_2025, record.october_2025,
    record.november_2025, record.december_2025
  ];

  await pool.query(query, values);
}

export async function upsertDailyMetricsCurrent(record: DailyMetricsCurrentRecord): Promise<void> {
  const query = `
    INSERT INTO daily_metrics_current (
      loan_id, investor, investor_name, inv_loan, first_name, last_name,
      address, city, state, zip, prin_bal, unapplied_bal, int_rate, pi_pmt, remg_term,
      origination_date, org_term, org_amount, lien_pos, next_pymt_due, last_pymt_received,
      first_pymt_due, maturity_date, loan_type, legal_status, warning, pymt_method, draft_day,
      spoc, january_2025, february_2025, march_2025, april_2025, may_2025, june_2025,
      july_2025, august_2025, september_2025, october_2025, november_2025, december_2025
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39,
      $40, $41
    )
    ON CONFLICT (loan_id) DO UPDATE SET
      investor = EXCLUDED.investor,
      investor_name = EXCLUDED.investor_name,
      inv_loan = EXCLUDED.inv_loan,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      zip = EXCLUDED.zip,
      prin_bal = EXCLUDED.prin_bal,
      unapplied_bal = EXCLUDED.unapplied_bal,
      int_rate = EXCLUDED.int_rate,
      pi_pmt = EXCLUDED.pi_pmt,
      remg_term = EXCLUDED.remg_term,
      origination_date = EXCLUDED.origination_date,
      org_term = EXCLUDED.org_term,
      org_amount = EXCLUDED.org_amount,
      lien_pos = EXCLUDED.lien_pos,
      next_pymt_due = EXCLUDED.next_pymt_due,
      last_pymt_received = EXCLUDED.last_pymt_received,
      first_pymt_due = EXCLUDED.first_pymt_due,
      maturity_date = EXCLUDED.maturity_date,
      loan_type = EXCLUDED.loan_type,
      legal_status = EXCLUDED.legal_status,
      warning = EXCLUDED.warning,
      pymt_method = EXCLUDED.pymt_method,
      draft_day = EXCLUDED.draft_day,
      spoc = EXCLUDED.spoc,
      january_2025 = EXCLUDED.january_2025,
      february_2025 = EXCLUDED.february_2025,
      march_2025 = EXCLUDED.march_2025,
      april_2025 = EXCLUDED.april_2025,
      may_2025 = EXCLUDED.may_2025,
      june_2025 = EXCLUDED.june_2025,
      july_2025 = EXCLUDED.july_2025,
      august_2025 = EXCLUDED.august_2025,
      september_2025 = EXCLUDED.september_2025,
      october_2025 = EXCLUDED.october_2025,
      november_2025 = EXCLUDED.november_2025,
      december_2025 = EXCLUDED.december_2025,
      updated_at = now()
  `;

  const values = [
    record.loan_id, record.investor, record.investor_name, record.inv_loan,
    record.first_name, record.last_name, record.address, record.city, record.state, record.zip,
    record.prin_bal, record.unapplied_bal, record.int_rate, record.pi_pmt, record.remg_term,
    record.origination_date, record.org_term, record.org_amount, record.lien_pos, record.next_pymt_due,
    record.last_pymt_received, record.first_pymt_due, record.maturity_date, record.loan_type,
    record.legal_status, record.warning, record.pymt_method, record.draft_day, record.spoc,
    record.january_2025, record.february_2025, record.march_2025, record.april_2025, record.may_2025,
    record.june_2025, record.july_2025, record.august_2025, record.september_2025, record.october_2025,
    record.november_2025, record.december_2025
  ];

  await pool.query(query, values);
}

// Foreclosure Events Operations

export async function insertForeclosureEventsHistory(record: ForeclosureEventsHistoryRecord): Promise<void> {
  const query = `
    INSERT INTO foreclosure_events_history (
      loan_id, report_date, fc_status, fc_jurisdiction, fc_start_date, current_attorney,
      referral_date, title_ordered_date, title_received_date, complaint_filed_date,
      service_completed_date, judgment_date, sale_scheduled_date, sale_held_date,
      real_estate_owned_date, eviction_completed_date,
      referral_expected_completion_date, title_ordered_expected_completion_date,
      title_received_expected_completion_date, complaint_filed_expected_completion_date,
      service_completed_expected_completion_date, judgment_expected_completion_date,
      sale_scheduled_expected_completion_date, sale_held_expected_completion_date,
      real_estate_owned_expected_completion_date, eviction_completed_expected_completion_date
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
    ON CONFLICT (loan_id, report_date) DO UPDATE SET
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
      eviction_completed_expected_completion_date = EXCLUDED.eviction_completed_expected_completion_date
  `;

  const values = [
    record.loan_id, record.report_date, record.fc_status, record.fc_jurisdiction, record.fc_start_date,
    record.current_attorney, record.referral_date, record.title_ordered_date, record.title_received_date,
    record.complaint_filed_date, record.service_completed_date, record.judgment_date,
    record.sale_scheduled_date, record.sale_held_date, record.real_estate_owned_date, record.eviction_completed_date,
    record.referral_expected_completion_date || null, record.title_ordered_expected_completion_date || null,
    record.title_received_expected_completion_date || null, record.complaint_filed_expected_completion_date || null,
    record.service_completed_expected_completion_date || null, record.judgment_expected_completion_date || null,
    record.sale_scheduled_expected_completion_date || null, record.sale_held_expected_completion_date || null,
    record.real_estate_owned_expected_completion_date || null, record.eviction_completed_expected_completion_date || null
  ];

  await pool.query(query, values);
}

// Helper function to convert ForeclosureEventData to ForeclosureEventsHistoryRecord
export function createForeclosureHistoryRecord(eventData: ForeclosureEventData, reportDate: string): ForeclosureEventsHistoryRecord {
  return {
    loan_id: eventData.loan_id,
    report_date: reportDate,
    fc_status: eventData.fc_status,
    fc_jurisdiction: eventData.fc_jurisdiction,
    fc_start_date: eventData.fc_start_date,
    current_attorney: eventData.current_attorney,
    referral_date: eventData.referral_date,
    title_ordered_date: eventData.title_ordered_date,
    title_received_date: eventData.title_received_date,
    complaint_filed_date: eventData.complaint_filed_date,
    service_completed_date: eventData.service_completed_date,
    judgment_date: eventData.judgment_date,
    sale_scheduled_date: eventData.sale_scheduled_date,
    sale_held_date: eventData.sale_held_date,
    real_estate_owned_date: eventData.real_estate_owned_date,
    eviction_completed_date: eventData.eviction_completed_date,
    // Expected completion dates
    referral_expected_completion_date: eventData.referral_expected_completion_date,
    title_ordered_expected_completion_date: eventData.title_ordered_expected_completion_date,
    title_received_expected_completion_date: eventData.title_received_expected_completion_date,
    complaint_filed_expected_completion_date: eventData.complaint_filed_expected_completion_date,
    service_completed_expected_completion_date: eventData.service_completed_expected_completion_date,
    judgment_expected_completion_date: eventData.judgment_expected_completion_date,
    sale_scheduled_expected_completion_date: eventData.sale_scheduled_expected_completion_date,
    sale_held_expected_completion_date: eventData.sale_held_expected_completion_date,
    real_estate_owned_expected_completion_date: eventData.real_estate_owned_expected_completion_date,
    eviction_completed_expected_completion_date: eventData.eviction_completed_expected_completion_date
  };
}