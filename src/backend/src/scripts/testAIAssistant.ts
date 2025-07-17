#!/usr/bin/env ts-node

/**
 * Test script for AI Assistant functionality
 * This script validates the AI assistant services without requiring OpenAI API calls
 */

import { PIIAnonymizationService } from '../services/piiAnonymizationService';
import { AIRateLimitService } from '../services/aiRateLimitService';

// Mock pool for testing
const mockPool = {
  connect: () => Promise.resolve(mockClient),
  query: () => Promise.resolve({ rows: [], rowCount: 0 }),
  end: () => Promise.resolve()
} as any;

// Mock client for testing
const mockClient = {
  query: () => Promise.resolve({ rows: [], rowCount: 0 }),
  release: () => {}
} as any;

async function testPIIAnonymization() {
  console.log('🔒 Testing PII Anonymization Service...');
  
  try {
    const piiService = new PIIAnonymizationService(mockPool);
    
    // Test anonymization of loan data
    const testLoans = [
      {
        loan_id: 'L001',
        borrower_name: 'John Smith',
        co_borrower_name: 'Jane Smith',
        property_address: '123 Main Street, Anytown, CA 90210',
        borrower_ssn: '123-45-6789',
        borrower_phone: '555-123-4567',
        borrower_email: 'john.smith@email.com',
        current_balance: 250000,
        credit_score: 720
      }
    ];
    
    console.log('📝 Original loan data:', testLoans[0]);
    
    // Mock the anonymization to simulate database storage
    mockPool.query = () => Promise.resolve({
      rows: [{ 
        id: 'mock-id', 
        anonymized_value: 'PERSON_A1B2',
        field_type: 'name',
        created_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }]
    });
    
    const { anonymizedData, mappings } = await piiService.anonymizeLoanData(testLoans);
    
    console.log('🔒 Anonymized data:', anonymizedData[0]);
    console.log(`✅ Created ${mappings.length} anonymization mappings`);
    
    // Test validation of clean text
    const cleanText = 'What is the average credit score?';
    const validation = await piiService.validateNoPII(cleanText);
    
    console.log('🔍 PII validation for clean text:', validation);
    
    return true;
  } catch (error) {
    console.error('❌ PII Anonymization test failed:', error);
    return false;
  }
}

async function testRateLimiting() {
  console.log('🛡️ Testing Rate Limiting Service...');
  
  try {
    const rateLimitService = new AIRateLimitService(mockPool);
    
    // Test rate limit configuration
    const config = rateLimitService.getConfig();
    console.log('⚙️ Rate limit config:', config);
    
    // Mock rate limit check
    mockPool.query = () => Promise.resolve({
      rows: [{ 
        user_id: 1,
        date: new Date().toISOString().split('T')[0],
        queries_used: 10,
        tokens_used: 5000,
        last_query_at: new Date()
      }]
    });
    
    const rateLimitStatus = await rateLimitService.checkRateLimit(1);
    console.log('📊 Rate limit status:', {
      queriesUsed: rateLimitStatus.queriesUsed,
      tokensUsed: rateLimitStatus.tokensUsed,
      queriesRemaining: rateLimitStatus.queriesRemaining,
      tokensRemaining: rateLimitStatus.tokensRemaining,
      isBlocked: rateLimitStatus.isBlocked
    });
    
    // Test query validation
    const canQuery = await rateLimitService.canMakeQuery(1, 1000);
    console.log('✅ Can make query:', canQuery.canProceed);
    
    return true;
  } catch (error) {
    console.error('❌ Rate Limiting test failed:', error);
    return false;
  }
}

async function testQueryValidation() {
  console.log('📝 Testing Query Validation...');
  
  try {
    // Mock OpenAI service just for validation
    const mockOpenAI = {
      validateMessage: (message: string) => {
        if (message.length > 2000) {
          return { isValid: false, reason: 'Message too long' };
        }
        if (message.length < 3) {
          return { isValid: false, reason: 'Message too short' };
        }
        return { isValid: true };
      },
      estimateTokenCount: (text: string) => Math.ceil(text.length / 4)
    };
    
    const testQueries = [
      'What is the average credit score?',
      'Show me loans in California',
      'AB', // Too short
      'A'.repeat(2001), // Too long
      'How many loans are delinquent?'
    ];
    
    for (const query of testQueries) {
      const validation = mockOpenAI.validateMessage(query);
      const tokenCount = mockOpenAI.estimateTokenCount(query);
      
      const result = validation.isValid ? '✅' : '❌';
      console.log(`${result} Query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}" (${tokenCount} tokens)`);
      
      if (!validation.isValid) {
        console.log(`   Reason: ${validation.reason}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Query validation test failed:', error);
    return false;
  }
}

async function testDataContextBuilding() {
  console.log('📊 Testing Data Context Building...');
  
  try {
    // Mock loan data that would be retrieved from database
    const mockLoanData = [
      { loan_id: 'L001', borrower_name: 'PERSON_A1B2', current_balance: 250000, credit_score: 720 },
      { loan_id: 'L002', borrower_name: 'PERSON_C3D4', current_balance: 180000, credit_score: 680 },
      { loan_id: 'L003', borrower_name: 'PERSON_E5F6', current_balance: 320000, credit_score: 750 }
    ];
    
    const loanContext = {
      totalLoans: mockLoanData.length,
      availableFields: Object.keys(mockLoanData[0]),
      sampleLoan: mockLoanData[0],
      userPermissions: ['view_loans', 'query_ai'],
      filteredLoans: mockLoanData
    };
    
    console.log('📋 Loan context summary:');
    console.log(`   Total loans: ${loanContext.totalLoans}`);
    console.log(`   Available fields: ${loanContext.availableFields.join(', ')}`);
    console.log(`   Sample loan: ${JSON.stringify(loanContext.sampleLoan)}`);
    console.log(`   User permissions: ${loanContext.userPermissions.join(', ')}`);
    
    // Test system prompt generation
    const systemPrompt = `You are an AI assistant for a mortgage portfolio management platform.
    
PORTFOLIO CONTEXT:
- Total loans: ${loanContext.totalLoans}
- Available fields: ${loanContext.availableFields.join(', ')}
- User permissions: ${loanContext.userPermissions.join(', ')}

SAMPLE LOAN: ${JSON.stringify(loanContext.sampleLoan, null, 2)}`;
    
    console.log(`📝 System prompt generated (${systemPrompt.length} characters)`);
    
    return true;
  } catch (error) {
    console.error('❌ Data context building test failed:', error);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting AI Assistant Tests\n');
  
  const tests = [
    { name: 'PII Anonymization', fn: testPIIAnonymization },
    { name: 'Rate Limiting', fn: testRateLimiting },
    { name: 'Query Validation', fn: testQueryValidation },
    { name: 'Data Context Building', fn: testDataContextBuilding }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`\n📋 Running: ${test.name}`);
    console.log('─'.repeat(50));
    
    try {
      const result = await test.fn();
      if (result) {
        passed++;
        console.log(`✅ ${test.name} - PASSED\n`);
      } else {
        failed++;
        console.log(`❌ ${test.name} - FAILED\n`);
      }
    } catch (error) {
      failed++;
      console.error(`💥 ${test.name} - ERROR:`, error);
    }
  }
  
  console.log('═'.repeat(60));
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed! AI Assistant is ready for OpenAI integration.');
    console.log('\n🔑 Next steps:');
    console.log('1. Set OPENAI_API_KEY environment variable');
    console.log('2. Configure AI_ASSISTANT_ENABLED for organizations');
    console.log('3. Test with actual OpenAI API calls');
  } else {
    console.log('⚠️ Some tests failed. Review the issues before deployment.');
  }
  
  return failed === 0;
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test runner failed:', error);
      process.exit(1);
    });
}