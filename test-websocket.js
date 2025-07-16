const { io } = require('socket.io-client');

// Test WebSocket connection with valid JWT token
async function testWebSocket() {
  console.log('Testing WebSocket connection...');
  
  // First, let's try to get a valid JWT token by logging in
  const fetch = (await import('node-fetch')).default;
  
  try {
    // Get a test token (you'll need to use actual login credentials)
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@loanvision.com',
        password: 'SuperSecure2025!',
      }),
    });
    
    const loginData = await loginResponse.json();
    
    if (!loginData.token) {
      console.error('Failed to get auth token:', loginData);
      return;
    }
    
    console.log('Got auth token, connecting to WebSocket...');
    
    // Connect to WebSocket with the token
    const socket = io('http://localhost:3000', {
      path: '/ws',
      auth: { token: loginData.token },
      reconnection: false, // Disable reconnection for this test
    });
    
    socket.on('connect', () => {
      console.log('✅ WebSocket connected successfully!');
      console.log('Socket ID:', socket.id);
      
      // Test some events
      socket.emit('notifications:fetch');
      socket.emit('inbox:fetch_stats');
    });
    
    socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
    });
    
    socket.on('notifications:initial', (data) => {
      console.log('📢 Received initial notifications:', data);
    });
    
    socket.on('inbox:stats', (data) => {
      console.log('📊 Received inbox stats:', data);
    });
    
    socket.on('error', (error) => {
      console.error('🔥 WebSocket error:', error);
    });
    
    socket.on('connect_error', (error) => {
      console.error('🔥 Connection error:', error.message);
    });
    
    // Keep the test running for 10 seconds
    setTimeout(() => {
      console.log('Test completed, closing connection...');
      socket.close();
      process.exit(0);
    }, 10000);
    
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

testWebSocket();