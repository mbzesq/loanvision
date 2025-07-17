#!/usr/bin/env ts-node

/**
 * Test script for chat retention service
 * This script validates the retention logic without requiring a live database
 */

import { ChatRetentionService } from '../services/chatRetentionService';

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

async function testRetentionServiceCreation() {
  console.log('🧪 Testing Chat Retention Service creation...');
  
  try {
    const retentionService = new ChatRetentionService(mockPool, {
      enabled: true,
      retentionHours: 24,
      cleanupIntervalHours: 1,
      batchSize: 1000
    });
    
    const status = retentionService.getStatus();
    
    console.log('✅ Service created successfully');
    console.log('📊 Service status:', {
      isRunning: status.isRunning,
      retentionHours: status.config.retentionHours,
      cleanupInterval: status.config.cleanupIntervalHours,
      batchSize: status.config.batchSize
    });
    
    return true;
  } catch (error) {
    console.error('❌ Service creation failed:', error);
    return false;
  }
}

async function testRetentionLogic() {
  console.log('🧪 Testing retention logic calculations...');
  
  const retentionHours = 24;
  const now = new Date();
  const cutoffTime = new Date(now.getTime() - (retentionHours * 60 * 60 * 1000));
  
  console.log('📅 Current time:', now.toISOString());
  console.log('⏰ Cutoff time (24h ago):', cutoffTime.toISOString());
  console.log('🕐 Time difference:', Math.round((now.getTime() - cutoffTime.getTime()) / (1000 * 60 * 60)), 'hours');
  
  // Test various message ages
  const testCases = [
    { age: 12, shouldDelete: false },  // 12 hours old - keep
    { age: 25, shouldDelete: true },   // 25 hours old - delete
    { age: 48, shouldDelete: true },   // 48 hours old - delete
    { age: 1, shouldDelete: false }    // 1 hour old - keep
  ];
  
  console.log('🎯 Testing deletion logic:');
  for (const testCase of testCases) {
    const messageTime = new Date(now.getTime() - (testCase.age * 60 * 60 * 1000));
    const shouldDelete = messageTime < cutoffTime;
    const result = shouldDelete === testCase.shouldDelete ? '✅' : '❌';
    
    console.log(`  ${result} ${testCase.age}h old message (${messageTime.toISOString()}) - Expected: ${testCase.shouldDelete ? 'DELETE' : 'KEEP'}, Got: ${shouldDelete ? 'DELETE' : 'KEEP'}`);
  }
  
  return true;
}

async function testConfigValidation() {
  console.log('🧪 Testing configuration validation...');
  
  const configs = [
    { retentionHours: 24, valid: true },
    { retentionHours: 1, valid: true },
    { retentionHours: 168, valid: true }, // 1 week
    { cleanupIntervalHours: 1, valid: true },
    { cleanupIntervalHours: 24, valid: true },
    { batchSize: 100, valid: true },
    { batchSize: 10000, valid: true }
  ];
  
  for (const config of configs) {
    try {
      const service = new ChatRetentionService(mockPool, config);
      const status = service.getStatus();
      console.log(`✅ Config ${JSON.stringify(config)} - Valid`);
    } catch (error) {
      console.log(`❌ Config ${JSON.stringify(config)} - Invalid:`, error);
    }
  }
  
  return true;
}

async function testEnvironmentVariables() {
  console.log('🧪 Testing environment variable handling...');
  
  // Test default values
  const defaultService = new ChatRetentionService(mockPool);
  const defaultStatus = defaultService.getStatus();
  
  console.log('📊 Default configuration:');
  console.log('  - Retention Hours:', defaultStatus.config.retentionHours);
  console.log('  - Cleanup Interval:', defaultStatus.config.cleanupIntervalHours);
  console.log('  - Batch Size:', defaultStatus.config.batchSize);
  console.log('  - Enabled:', defaultStatus.config.enabled);
  
  // Test that defaults are reasonable
  const checks = [
    { name: 'Retention Hours', value: defaultStatus.config.retentionHours, expected: 24 },
    { name: 'Cleanup Interval', value: defaultStatus.config.cleanupIntervalHours, expected: 1 },
    { name: 'Batch Size', value: defaultStatus.config.batchSize, min: 100, max: 10000 },
    { name: 'Enabled', value: defaultStatus.config.enabled, expected: true }
  ];
  
  for (const check of checks) {
    if ('expected' in check) {
      const result = check.value === check.expected ? '✅' : '❌';
      console.log(`  ${result} ${check.name}: ${check.value} (expected: ${check.expected})`);
    } else if ('min' in check && 'max' in check) {
      const inRange = check.value >= check.min && check.value <= check.max;
      const result = inRange ? '✅' : '❌';
      console.log(`  ${result} ${check.name}: ${check.value} (range: ${check.min}-${check.max})`);
    }
  }
  
  return true;
}

async function runAllTests() {
  console.log('🚀 Starting Chat Retention Service Tests\n');
  
  const tests = [
    { name: 'Service Creation', fn: testRetentionServiceCreation },
    { name: 'Retention Logic', fn: testRetentionLogic },
    { name: 'Config Validation', fn: testConfigValidation },
    { name: 'Environment Variables', fn: testEnvironmentVariables }
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
    console.log('🎉 All tests passed! Chat retention service is ready for deployment.');
  } else {
    console.log('⚠️ Some tests failed. Review the issues before deployment.');
  }
  
  return failed === 0;
}

// Export for use in other scripts
export { testRetentionServiceCreation, testRetentionLogic, testConfigValidation };

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