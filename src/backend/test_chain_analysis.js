const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testChainAnalysis() {
  const loanId = '0000519312';
  
  try {
    console.log(`🔍 Testing chain analysis for loan: ${loanId}`);
    
    // Check document_analysis table for assignment documents
    console.log('\n📋 Checking document_analysis table for assignment documents:');
    const docQuery = `
      SELECT 
        id, file_name, document_type, confidence_score, 
        assignor, assignee, assignment_date, recording_date, 
        instrument_number, created_at
      FROM document_analysis 
      WHERE loan_id = $1 
      ORDER BY created_at DESC
    `;
    
    const docResult = await pool.query(docQuery, [loanId]);
    console.log(`Found ${docResult.rows.length} documents:`);
    docResult.rows.forEach(doc => {
      console.log(`  - ${doc.file_name} (${doc.document_type}) - Confidence: ${doc.confidence_score}`);
      if (doc.document_type === 'Assignment') {
        console.log(`    Assignor: ${doc.assignor}, Assignee: ${doc.assignee}`);
        console.log(`    Assignment Date: ${doc.assignment_date}, Recording Date: ${doc.recording_date}`);
      }
    });
    
    // Check chain_of_title table
    console.log('\n🔗 Checking chain_of_title table:');
    const chainQuery = `
      SELECT 
        id, transferor, transferee, transfer_date, recording_date,
        instrument_number, sequence_number, is_gap, gap_reason,
        document_analysis_id, created_at
      FROM chain_of_title 
      WHERE loan_id = $1 
      ORDER BY sequence_number ASC
    `;
    
    const chainResult = await pool.query(chainQuery, [loanId]);
    console.log(`Found ${chainResult.rows.length} chain entries:`);
    chainResult.rows.forEach(entry => {
      console.log(`  ${entry.sequence_number}. ${entry.transferor} → ${entry.transferee}`);
      console.log(`     Date: ${entry.transfer_date}, Recorded: ${entry.recording_date}`);
      console.log(`     Document ID: ${entry.document_analysis_id}, Gap: ${entry.is_gap}`);
    });
    
    // Check document counts by type
    console.log('\n📊 Document counts by type:');
    const countQuery = `
      SELECT 
        document_type,
        COUNT(*) as count
      FROM document_analysis 
      WHERE loan_id = $1
      GROUP BY document_type
      ORDER BY count DESC
    `;
    
    const countResult = await pool.query(countQuery, [loanId]);
    countResult.rows.forEach(row => {
      console.log(`  ${row.document_type}: ${row.count}`);
    });
    
    // Test the API logic simulation
    console.log('\n🧪 Simulating API response logic:');
    const docCounts = {
      note_count: countResult.rows.find(r => r.document_type === 'Note')?.count || 0,
      security_instrument_count: countResult.rows.find(r => r.document_type === 'Security Instrument')?.count || 0,
      assignment_count: countResult.rows.find(r => r.document_type === 'Assignment')?.count || 0
    };
    
    console.log('Document counts:', docCounts);
    
    // Transform assignment chain data (like the API does)
    const transformedAssignmentChain = chainResult.rows.map(row => ({
      sequenceNumber: row.sequence_number,
      assignor: row.transferor,
      assignee: row.transferee,
      assignmentText: `${row.transferor} → ${row.transferee}`,
      recordingInfo: row.recording_date ? 
        `Recorded: ${new Date(row.recording_date).toLocaleDateString()}${row.instrument_number ? `, Instrument: ${row.instrument_number}` : ''}` : 
        null,
      isGap: row.is_gap,
      gapReason: row.gap_reason
    }));
    
    console.log('\nTransformed assignment chain:', JSON.stringify(transformedAssignmentChain, null, 2));
    
    // Determine if assignment chain ends with current investor
    const lastAssignment = transformedAssignmentChain[transformedAssignmentChain.length - 1];
    const assignmentEndsWithCurrentInvestor = lastAssignment?.assignee?.toLowerCase().includes('ns194') || false;
    
    console.log(`\nAssignment ends with current investor: ${assignmentEndsWithCurrentInvestor}`);
    console.log(`Last assignee: ${lastAssignment?.assignee}`);
    
    // Show what the API would return
    const apiResponse = {
      success: true,
      loanId,
      timestamp: new Date().toISOString(),
      
      documentPresence: {
        hasNote: parseInt(docCounts.note_count) > 0,
        hasSecurityInstrument: parseInt(docCounts.security_instrument_count) > 0,
        noteCount: parseInt(docCounts.note_count),
        securityInstrumentCount: parseInt(docCounts.security_instrument_count),
        assignmentCount: parseInt(docCounts.assignment_count)
      },
      
      assignmentChain: {
        hasAssignmentChain: chainResult.rows.length > 0,
        assignmentCount: chainResult.rows.length,
        assignmentChain: transformedAssignmentChain,
        assignmentEndsWithCurrentInvestor,
        sourceDocument: chainResult.rows[0] ? {
          fileName: 'N/A', // Would need to join with document_analysis
          confidence: 'N/A'
        } : null
      }
    };
    
    console.log('\n📋 Final API Response Preview:');
    console.log(JSON.stringify(apiResponse, null, 2));
    
  } catch (error) {
    console.error('Error testing chain analysis:', error);
  } finally {
    await pool.end();
  }
}

testChainAnalysis();