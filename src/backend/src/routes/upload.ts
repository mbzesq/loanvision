import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { Loan } from '@loanvision/shared';
import { detectFileType, FileType } from '../services/fileTypeDetector';
import { 
  mapForeclosureData, 
  mapDailyMetricsData, 
  ForeclosureRecord, 
  DailyMetricsRecord,
  mapDailyMetricsCurrentData,
  mapDailyMetricsHistoryData,
  cleanCurrency,
  cleanPercentage,
  parseExcelDate,
  getValue
} from '../services/columnMappers';
import { processForeclosureRecord } from '../services/foreclosureService';
import { 
  insertDailyMetricsHistory, 
  upsertDailyMetricsCurrent 
} from '../services/currentHistoryService';

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper function to extract report date from filename or default to today
function getReportDate(filename: string): string {
  try {
    // Try to extract date from filename patterns like:
    // daily_metrics_2024-01-15.xlsx
    // foreclosure_data_20240115.xlsx
    // metrics-2024.01.15.xlsx
    const datePatterns = [
      /(\d{4}-\d{2}-\d{2})/,           // YYYY-MM-DD
      /(\d{4})(\d{2})(\d{2})/,         // YYYYMMDD
      /(\d{4})\.(\d{2})\.(\d{2})/,     // YYYY.MM.DD
      /(\d{4})_(\d{2})_(\d{2})/        // YYYY_MM_DD
    ];
    
    for (const pattern of datePatterns) {
      const match = filename.match(pattern);
      if (match) {
        if (match.length === 2) {
          // Already in YYYY-MM-DD format
          const date = new Date(match[1]);
          if (!isNaN(date.getTime())) {
            return match[1];
          }
        } else if (match.length === 4) {
          // Year, month, day captured separately
          const dateStr = `${match[1]}-${match[2]}-${match[3]}`;
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return dateStr;
          }
        }
      }
    }
  } catch (error) {
    console.warn('Error extracting date from filename:', error);
  }
  
  // Default to today's date
  return new Date().toISOString().split('T')[0];
}

// Helper function to parse CSV data
function parseCsvData(buffer: Buffer): any[] {
  const csvText = buffer.toString('utf-8');
  const lines = csvText.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return [];
  }
  
  // Parse headers
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  // Parse data rows
  const records: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (values.length >= headers.length) {
      const record: any = {};
      headers.forEach((header, index) => {
        record[header] = values[index] || '';
      });
      records.push(record);
    }
  }
  
  return records;
}

// --- Existing Data Cleaning Helpers for Legacy Loans ---
const combineName = (loan: Loan, firstKeys: string[], lastKeys: string[]): string | null => {
    const first = firstKeys.map(k => loan[k]).find(v => v) || '';
    const last = lastKeys.map(k => loan[k]).find(v => v) || '';
    const combined = `${first} ${last}`.trim();
    return combined || null;
};

// --- Database Insertion Functions ---
async function insertForeclosureRecords(records: ForeclosureRecord[]): Promise<number> {
  let insertedCount = 0;
  const insertQuery = `
    INSERT INTO foreclosure_events (
      upload_session_id, file_date, loan_id, investor_id, investor_loan_number,
      fc_atty_poc, fc_atty_poc_phone, fc_atty_poc_email, fc_jurisdiction, fc_status,
      active_fc_days, hold_fc_days, total_fc_days, fc_closed_date, fc_closed_reason,
      contested_start_date, contested_reason, contested_summary, active_loss_mit,
      active_loss_mit_start_date, active_loss_mit_reason, last_note_date, last_note,
      title_received_actual_start, title_received_expected_completion, title_received_actual_completion,
      title_received_delay_reason, first_legal_expected_start, first_legal_actual_start,
      first_legal_expected_completion, first_legal_actual_completion, first_legal_completion_variance,
      first_legal_delay_reason, service_perfected_expected_start, service_perfected_actual_start,
      service_perfected_expected_completion, service_perfected_actual_completion,
      service_perfected_completion_variance, service_perfected_delay_reason,
      publication_started_expected_start, publication_started_actual_start,
      publication_started_expected_completion, publication_started_actual_completion,
      publication_started_completion_variance, publication_started_delay_reason,
      order_of_reference_expected_start, order_of_reference_actual_start,
      order_of_reference_expected_completion, order_of_reference_actual_completion,
      order_of_reference_completion_variance, order_of_reference_delay_reason,
      judgment_entered_expected_start, judgment_entered_actual_start,
      judgment_entered_expected_completion, judgment_entered_actual_completion,
      judgment_entered_completion_variance, judgment_entered_delay_reason,
      redemption_expires_expected_start, redemption_expires_actual_start,
      redemption_expires_expected_completion, redemption_expires_actual_completion,
      redemption_expires_completion_variance, redemption_expires_delay_reason,
      sale_held_expected_start, sale_held_expected_completion, sale_held_actual_completion,
      sale_held_completion_variance, sale_held_delay_reason, rrc_expected_start,
      rrc_actual_start, rrc_expected_completion, rrc_actual_completion,
      rrc_completion_variance, rrc_delay_reason, source_filename, data_issues
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39,
      $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58,
      $59, $60, $61, $62, $63, $64, $65, $66, $67, $68, $69, $70, $71, $72, $73
    )
  `;

  for (const record of records) {
    try {
      const values = [
        record.upload_session_id, record.file_date, record.loan_id, record.investor_id, record.investor_loan_number,
        record.fc_atty_poc, record.fc_atty_poc_phone, record.fc_atty_poc_email, record.fc_jurisdiction, record.fc_status,
        record.active_fc_days, record.hold_fc_days, record.total_fc_days, record.fc_closed_date, record.fc_closed_reason,
        record.contested_start_date, record.contested_reason, record.contested_summary, record.active_loss_mit,
        record.active_loss_mit_start_date, record.active_loss_mit_reason, record.last_note_date, record.last_note,
        record.title_received_actual_start, record.title_received_expected_completion, record.title_received_actual_completion,
        record.title_received_delay_reason, record.first_legal_expected_start, record.first_legal_actual_start,
        record.first_legal_expected_completion, record.first_legal_actual_completion, record.first_legal_completion_variance,
        record.first_legal_delay_reason, record.service_perfected_expected_start, record.service_perfected_actual_start,
        record.service_perfected_expected_completion, record.service_perfected_actual_completion,
        record.service_perfected_completion_variance, record.service_perfected_delay_reason,
        record.publication_started_expected_start, record.publication_started_actual_start,
        record.publication_started_expected_completion, record.publication_started_actual_completion,
        record.publication_started_completion_variance, record.publication_started_delay_reason,
        record.order_of_reference_expected_start, record.order_of_reference_actual_start,
        record.order_of_reference_expected_completion, record.order_of_reference_actual_completion,
        record.order_of_reference_completion_variance, record.order_of_reference_delay_reason,
        record.judgment_entered_expected_start, record.judgment_entered_actual_start,
        record.judgment_entered_expected_completion, record.judgment_entered_actual_completion,
        record.judgment_entered_completion_variance, record.judgment_entered_delay_reason,
        record.redemption_expires_expected_start, record.redemption_expires_actual_start,
        record.redemption_expires_expected_completion, record.redemption_expires_actual_completion,
        record.redemption_expires_completion_variance, record.redemption_expires_delay_reason,
        record.sale_held_expected_start, record.sale_held_expected_completion, record.sale_held_actual_completion,
        record.sale_held_completion_variance, record.sale_held_delay_reason, record.rrc_expected_start,
        record.rrc_actual_start, record.rrc_expected_completion, record.rrc_actual_completion,
        record.rrc_completion_variance, record.rrc_delay_reason, record.source_filename, record.data_issues
      ];

      await pool.query(insertQuery, values);
      insertedCount++;
    } catch (error) {
      console.error('Error inserting foreclosure record:', error, 'Record data:', record);
    }
  }

  return insertedCount;
}

async function insertDailyMetricsRecords(records: DailyMetricsRecord[]): Promise<number> {
  let insertedCount = 0;
  const insertQuery = `
    INSERT INTO daily_metrics (
      upload_session_id, loan_id, investor, investor_name, inv_loan, first_name, last_name,
      address, city, state, zip, prin_bal, unapplied_bal, int_rate, pi_pmt, remg_term,
      origination_date, org_term, org_amount, lien_pos, next_pymt_due, last_pymt_received,
      first_pymt_due, maturity_date, loan_type, legal_status, warning, pymt_method, draft_day,
      spoc, jan_25, feb_25, mar_25, apr_25, may_25, jun_25, jul_25, aug_25, sep_25, oct_25,
      nov_25, dec_25, source_filename, data_issues
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39,
      $40, $41, $42, $43, $44
    )
  `;

  for (const record of records) {
    try {
      const values = [
        record.upload_session_id, record.loan_id, record.investor, record.investor_name, record.inv_loan,
        record.first_name, record.last_name, record.address, record.city, record.state, record.zip,
        record.prin_bal, record.unapplied_bal, record.int_rate, record.pi_pmt, record.remg_term,
        record.origination_date, record.org_term, record.org_amount, record.lien_pos, record.next_pymt_due,
        record.last_pymt_received, record.first_pymt_due, record.maturity_date, record.loan_type,
        record.legal_status, record.warning, record.pymt_method, record.draft_day, record.spoc,
        record.jan_25, record.feb_25, record.mar_25, record.apr_25, record.may_25, record.jun_25,
        record.jul_25, record.aug_25, record.sep_25, record.oct_25, record.nov_25, record.dec_25,
        record.source_filename, record.data_issues
      ];

      await pool.query(insertQuery, values);
      insertedCount++;
    } catch (error) {
      console.error('Error inserting daily metrics record:', error, 'Record data:', record);
    }
  }

  return insertedCount;
}

async function insertLoanRecords(loans: Loan[], uploadSessionId: string, sourceFilename: string): Promise<number> {
  let insertedCount = 0;
  const insertQuery = `
    INSERT INTO loans (
      upload_session_id, servicer_loan_id, borrower_name, property_address,
      property_city, property_state, property_zip, loan_amount,
      interest_rate, maturity_date, unpaid_principal_balance, last_paid_date,
      next_due_date, remaining_term_months, legal_status, lien_position,
      investor_name, source_filename, data_issues
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
    )
  `;

  for (const loan of loans) {
    try {
      const values = [
        uploadSessionId, // $1
        getValue(loan, ['Loan ID']), // $2 servicer_loan_id
        combineName(loan, ['First Name'], ['Last Name']), // $3 borrower_name
        getValue(loan, ['Address', 'Property Address']), // $4 property_address
        getValue(loan, ['City']), // $5 property_city
        getValue(loan, ['State']), // $6 property_state
        getValue(loan, ['Zip']), // $7 property_zip
        cleanCurrency(getValue(loan, ['Org Amount'])), // $8 loan_amount
        cleanPercentage(getValue(loan, ['Int Rate'])), // $9 interest_rate
        parseExcelDate(getValue(loan, ['Maturity Date'])), // $10 maturity_date
        cleanCurrency(getValue(loan, ['Prin Bal', 'UPB'])), // $11 unpaid_principal_balance
        parseExcelDate(getValue(loan, ['Last Pymt Received'])), // $12 last_paid_date
        parseExcelDate(getValue(loan, ['Next Pymt Due'])), // $13 next_due_date
        getValue(loan, ['Remg Term']), // $14 remaining_term_months
        getValue(loan, ['Legal Status']), // $15 legal_status
        getValue(loan, ['Lien Pos']), // $16 lien_position
        getValue(loan, ['Investor Name']), // $17 investor_name
        sourceFilename, // $18 source_filename
        null, // $19 data_issues (for now)
      ];

      await pool.query(insertQuery, values);
      insertedCount++;
    } catch (error) {
      console.error('Error inserting loan:', error, 'Loan data:', loan);
    }
  }

  return insertedCount;
}

// --- Main Upload Endpoint ---
router.post('/upload', upload.single('loanFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Parse file based on extension
    let jsonData: any[];
    const fileExtension = req.file.originalname.toLowerCase();
    
    if (fileExtension.endsWith('.xlsx') || fileExtension.endsWith('.xls')) {
      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } else if (fileExtension.endsWith('.csv')) {
      // Parse CSV file
      jsonData = parseCsvData(req.file.buffer);
    } else {
      return res.status(400).json({ 
        error: 'Unsupported file type. Please upload a .csv, .xlsx, or .xls file.' 
      });
    }

    if (jsonData.length === 0) {
      return res.status(400).json({ error: 'No data found in the uploaded file' });
    }

    // Detect file type based on headers
    const headers = Object.keys(jsonData[0] as any);
    const detection = detectFileType(headers);

    console.log(`File type detected: ${detection.fileType} (${detection.confidence.toFixed(1)}% confidence)`);
    console.log(`Matched headers: ${detection.matchedHeaders.join(', ')}`);

    if (detection.fileType === 'unknown') {
      return res.status(400).json({ 
        error: 'Unable to identify file type. Please ensure your file contains the expected column headers.',
        details: {
          detectedConfidence: detection.confidence,
          supportedTypes: ['loan_portfolio', 'foreclosure_data', 'daily_metrics']
        }
      });
    }

    const uploadSessionId = uuidv4();
    await pool.query(
      `INSERT INTO upload_sessions (id, original_filename, file_type, record_count, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [uploadSessionId, req.file.originalname, detection.fileType, jsonData.length, 'processing']
    );

    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let successMessage = '';

    // Extract report date from filename or default to today  
    const reportDate = getReportDate(req.file.originalname);
    console.log(`Processing ${detection.fileType} upload with report date: ${reportDate}`);

    if (detection.fileType === 'foreclosure_data') {
      // Process foreclosure records with current/history schema
      console.log(`Starting foreclosure data processing for ${jsonData.length} records`);
      
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        try {
          // Validate required fields
          const loanId = getValue(row, ['Loan ID']);
          if (!loanId) {
            console.warn(`Row ${i + 1}: Skipping foreclosure record with missing loan_id`);
            skippedCount++;
            continue;
          }

          // The state will be fetched from existing loan data within processForeclosureRecord
          await processForeclosureRecord(row, 'NY', reportDate);
          insertedCount++;
          
          if (insertedCount % 100 === 0) {
            console.log(`Processed ${insertedCount} foreclosure records...`);
          }
        } catch (error) {
          errorCount++;
          console.error(`Row ${i + 1}: Error processing foreclosure record for loan ${getValue(row, ['Loan ID'])}:`, error);
          // Continue processing other records even if one fails
        }
      }
      
      console.log(`Foreclosure processing complete: ${insertedCount} inserted, ${skippedCount} skipped, ${errorCount} errors`);
      successMessage = `Successfully imported ${insertedCount} of ${jsonData.length} foreclosure records (${skippedCount} skipped, ${errorCount} errors).`;
    } 
    else if (detection.fileType === 'daily_metrics') {
      // Process daily metrics with current/history schema
      console.log(`Starting daily metrics processing for ${jsonData.length} records`);
      
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        try {
          // Map the data using new structure
          const historyRecord = mapDailyMetricsHistoryData(row, reportDate);
          const currentRecord = mapDailyMetricsCurrentData(row, reportDate);
          
          // Validate required fields
          if (!historyRecord.loan_id) {
            console.warn(`Row ${i + 1}: Skipping daily metrics record with missing loan_id`);
            skippedCount++;
            continue;
          }
          
          // Insert into history table (idempotent with ON CONFLICT)
          await insertDailyMetricsHistory(historyRecord);
          
          // Upsert into current table (idempotent by design)
          await upsertDailyMetricsCurrent(currentRecord);
          
          insertedCount++;
          
          if (insertedCount % 100 === 0) {
            console.log(`Processed ${insertedCount} daily metrics records...`);
          }
        } catch (error) {
          errorCount++;
          console.error(`Row ${i + 1}: Error processing daily metrics record for loan ${getValue(row, ['Loan ID'])}:`, error);
          // Continue processing other records even if one fails
        }
      }
      
      console.log(`Daily metrics processing complete: ${insertedCount} inserted, ${skippedCount} skipped, ${errorCount} errors`);
      successMessage = `Successfully imported ${insertedCount} of ${jsonData.length} daily metrics records (${skippedCount} skipped, ${errorCount} errors).`;
    }
    else if (detection.fileType === 'loan_portfolio') {
      const loans = jsonData as Loan[];
      insertedCount = await insertLoanRecords(loans, uploadSessionId, req.file.originalname);
      successMessage = `Successfully imported ${insertedCount} of ${jsonData.length} loans.`;
      // No skipped/error counts for legacy loan portfolio processing
      skippedCount = 0;
      errorCount = 0;
    }

    // Update upload session with final status
    const finalStatus = errorCount > 0 ? 'completed_with_errors' : 'completed';
    await pool.query(
      `UPDATE upload_sessions SET status = $1 WHERE id = $2`,
      [finalStatus, uploadSessionId]
    );

    res.json({
      status: 'success',
      message: successMessage,
      fileType: detection.fileType,
      confidence: detection.confidence,
      record_count: insertedCount,
      skipped_count: skippedCount || 0,
      error_count: errorCount || 0,
      total_records: jsonData.length,
      report_date: reportDate,
      upload_session_id: uploadSessionId
    });

  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

export default router;