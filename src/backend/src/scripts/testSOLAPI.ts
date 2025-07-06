import axios from 'axios';

// Test the SOL API endpoints
async function testSOLAPI() {
  console.log('🌐 Testing SOL API Endpoints...\n');

  // You'll need to replace this with your actual API URL and auth token
  const API_BASE = process.env.API_URL || 'http://localhost:3000';
  const AUTH_TOKEN = process.env.TEST_TOKEN; // You'd get this from login

  if (!AUTH_TOKEN) {
    console.log('⚠️  No AUTH_TOKEN provided. Set TEST_TOKEN environment variable to test authenticated endpoints.');
    return;
  }

  const headers = {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    // Test 1: Portfolio Summary
    console.log('📊 Testing GET /api/sol/portfolio-summary...');
    const summaryResponse = await axios.get(`${API_BASE}/api/sol/portfolio-summary`, { headers });
    console.log('✅ Portfolio Summary:', summaryResponse.data.data.summary);
    console.log();

    // Test 2: Dashboard Data
    console.log('📈 Testing GET /api/sol/dashboard-data...');
    const dashboardResponse = await axios.get(`${API_BASE}/api/sol/dashboard-data`, { headers });
    console.log('✅ Dashboard Data:', dashboardResponse.data.data);
    console.log();

    // Test 3: Alerts
    console.log('⚠️  Testing GET /api/sol/alerts...');
    const alertsResponse = await axios.get(`${API_BASE}/api/sol/alerts`, { headers });
    console.log(`✅ Found ${alertsResponse.data.count} alerts`);
    alertsResponse.data.data.slice(0, 3).forEach((alert: string) => console.log(`   ${alert}`));
    console.log();

    // Test 4: High Risk Loans
    console.log('🚨 Testing GET /api/sol/loans?risk_level=HIGH...');
    const highRiskResponse = await axios.get(`${API_BASE}/api/sol/loans?risk_level=HIGH&limit=5`, { headers });
    console.log(`✅ Found ${highRiskResponse.data.data.length} high-risk loans`);
    if (highRiskResponse.data.data.length > 0) {
      console.log('   Sample high-risk loan:', {
        loan_id: highRiskResponse.data.data[0].loan_number,
        state: highRiskResponse.data.data[0].property_state,
        days_until_expiration: highRiskResponse.data.data[0].days_until_expiration,
        risk_score: highRiskResponse.data.data[0].sol_risk_score
      });
    }
    console.log();

    // Test 5: Scheduler Status
    console.log('⏰ Testing GET /api/sol/scheduler/status...');
    const schedulerResponse = await axios.get(`${API_BASE}/api/sol/scheduler/status`, { headers });
    console.log('✅ Scheduler Status:', schedulerResponse.data.data);
    console.log();

    // Test 6: Trigger Manual Update
    console.log('🔄 Testing POST /api/sol/daily-update...');
    const updateResponse = await axios.post(`${API_BASE}/api/sol/daily-update`, {}, { headers });
    console.log('✅ Manual Update Result:', updateResponse.data.data);

    console.log('\n🎉 All API tests completed successfully!');

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('❌ API Test failed:', {
        status: error.response?.status,
        message: error.response?.data?.error || error.message,
        url: error.config?.url
      });
    } else {
      console.error('❌ Test failed:', error);
    }
  }
}

// Usage instructions
console.log('📋 SOL API Test Instructions:');
console.log('1. Make sure your backend is running');
console.log('2. Set API_URL if not using localhost:3000');
console.log('3. Set TEST_TOKEN with a valid JWT token');
console.log('4. Run: npm run test:sol-api\n');

testSOLAPI().catch(console.error);