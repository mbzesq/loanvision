const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://michaelzimmerman@127.0.0.1:5432/nplvision_db'
});

async function testChainAnalysisWorkflow() {
  const loanId = '0000519312';
  
  console.log(`🔍 Testing assignment chain workflow for loan: ${loanId}`);
  
  try {
    // Test 1: Check document_analysis data
    console.log('\n1. Checking document_analysis data...');
    const docQuery = `
      SELECT id, file_name, document_type, assignor, assignee, assignment_date, confidence_score
      FROM document_analysis 
      WHERE loan_id = $1 
      ORDER BY created_at ASC
    `;
    const docResult = await pool.query(docQuery, [loanId]);
    console.log(`Found ${docResult.rows.length} documents:`);
    docResult.rows.forEach(doc => {
      console.log(`  - ${doc.file_name} (${doc.document_type}): ${doc.assignor} → ${doc.assignee}`);
    });
    
    // Test 2: Check chain_of_title data
    console.log('\n2. Checking chain_of_title data...');
    const chainQuery = `
      SELECT cot.*, da.file_name
      FROM chain_of_title cot
      JOIN document_analysis da ON cot.document_analysis_id = da.id
      WHERE cot.loan_id = $1
      ORDER BY cot.sequence_number ASC
    `;
    const chainResult = await pool.query(chainQuery, [loanId]);
    console.log(`Found ${chainResult.rows.length} chain links:`);
    chainResult.rows.forEach(link => {
      console.log(`  ${link.sequence_number}. ${link.transferor} → ${link.transferee} (${link.file_name})`);
    });
    
    // Test 3: Simulate the API response format
    console.log('\n3. Simulating API response format...');
    
    // Get document counts
    const documentCountQuery = `
      SELECT 
        COUNT(CASE WHEN document_type = 'Note' THEN 1 END) as note_count,
        COUNT(CASE WHEN document_type = 'Security Instrument' THEN 1 END) as security_instrument_count,
        COUNT(CASE WHEN document_type = 'Assignment' THEN 1 END) as assignment_count
      FROM document_analysis 
      WHERE loan_id = $1
    `;
    const docCountResult = await pool.query(documentCountQuery, [loanId]);
    const docCounts = docCountResult.rows[0];
    
    // Get assignment chain data for API format
    const assignmentAPIQuery = `
      SELECT 
        cot.id,
        cot.transferor as assignor,
        cot.transferee as assignee,
        cot.transfer_date as assignment_date,
        cot.recording_date,
        cot.instrument_number,
        cot.sequence_number,
        cot.is_gap,
        cot.gap_reason,
        da.file_name,
        da.confidence_score
      FROM chain_of_title cot
      JOIN document_analysis da ON cot.document_analysis_id = da.id
      WHERE cot.loan_id = $1
      ORDER BY cot.sequence_number ASC
    `;
    
    const assignmentAPIResult = await pool.query(assignmentAPIQuery, [loanId]);
    
    // Transform to API format
    const transformedAssignmentChain = assignmentAPIResult.rows.map(row => ({
      sequenceNumber: row.sequence_number,
      assignor: row.assignor,
      assignee: row.assignee,
      assignmentText: `${row.assignor} → ${row.assignee}`,
      recordingInfo: row.recording_date ? 
        `Recorded: ${row.recording_date.toLocaleDateString()}${row.instrument_number ? `, Instrument: ${row.instrument_number}` : ''}` : 
        null,
      isGap: row.is_gap,
      gapReason: row.gap_reason
    }));
    
    // Determine if chain ends with current investor
    const lastAssignment = transformedAssignmentChain[transformedAssignmentChain.length - 1];
    const assignmentEndsWithCurrentInvestor = lastAssignment?.assignee?.toLowerCase().includes('ns194') || false;
    
    const apiResponse = {
      success: true,
      loanId,
      timestamp: new Date().toISOString(),
      
      // Document presence
      documentPresence: {
        hasNote: parseInt(docCounts.note_count) > 0,
        hasSecurityInstrument: parseInt(docCounts.security_instrument_count) > 0,
        noteCount: parseInt(docCounts.note_count),
        securityInstrumentCount: parseInt(docCounts.security_instrument_count),
        assignmentCount: parseInt(docCounts.assignment_count)
      },
      
      // Endorsement chain analysis (empty for this test)
      endorsementChain: {
        hasEndorsements: false,
        endorsementCount: 0,
        endorsementChain: [],
        endsWithCurrentInvestor: false,
        endsInBlank: false,
        sourceDocument: null
      },
      
      // Assignment chain analysis
      assignmentChain: {
        hasAssignmentChain: assignmentAPIResult.rows.length > 0,
        assignmentCount: assignmentAPIResult.rows.length,
        assignmentChain: transformedAssignmentChain,
        assignmentEndsWithCurrentInvestor,
        sourceDocument: assignmentAPIResult.rows[0] ? {
          fileName: assignmentAPIResult.rows[0].file_name,
          confidence: assignmentAPIResult.rows[0].confidence_score
        } : null
      },
      
      // Legacy compatibility
      legacy: {
        assignmentChainComplete: assignmentAPIResult.rows.length > 0 && !assignmentAPIResult.rows.some(row => row.is_gap),
        chainGaps: assignmentAPIResult.rows.filter(row => row.is_gap).map(row => row.gap_reason || 'Unknown gap')
      }
    };
    
    console.log('\nAPI Response Preview:');
    console.log(JSON.stringify(apiResponse, null, 2));
    
    // Test 4: Check what the frontend would see
    console.log('\n4. Frontend interpretation:');
    
    if (!apiResponse.assignmentChain.hasAssignmentChain) {
      console.log('❌ Frontend would show: "No assignment chain found"');
    } else if (apiResponse.assignmentChain.assignmentEndsWithCurrentInvestor) {
      console.log('✅ Frontend would show: "Assignment Chain: Complete & Valid"');
    } else {
      console.log('⚠️  Frontend would show: "Assignment Chain: Incomplete"');
    }
    
    console.log(`Assignment chain details for frontend:`);
    apiResponse.assignmentChain.assignmentChain.forEach(assignment => {
      console.log(`  ${assignment.sequenceNumber}. ${assignment.assignmentText}`);
    });
    
    // Test 5: Verify data quality
    console.log('\n5. Data quality check:');
    
    const hasGarbageText = transformedAssignmentChain.some(assignment => {
      const text = assignment.assignmentText.toLowerCase();
      return text.includes('missing link') || text.includes('has duly executed') || text.length > 200;
    });
    
    if (hasGarbageText) {
      console.log('❌ Detected garbled/noisy text in assignment chain');
    } else {
      console.log('✅ Assignment chain text looks clean');
    }
    
    console.log('\n✅ Assignment chain workflow test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing workflow:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testChainAnalysisWorkflow();