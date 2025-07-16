const { io } = require('socket.io-client');

// Simple WebSocket connection test to see if the server accepts connections
console.log('Testing basic WebSocket connection...');

const socket = io('http://localhost:3000', {
  path: '/ws',
  auth: { token: 'invalid-token' }, // Use invalid token to see what error we get
  reconnection: false,
  timeout: 5000,
});

socket.on('connect', () => {
  console.log('✅ WebSocket connected (this should not happen with invalid token)');
});

socket.on('disconnect', (reason) => {
  console.log('❌ WebSocket disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.log('🔥 Connection error (expected with invalid token):', error.message);
});

// Close after 5 seconds
setTimeout(() => {
  console.log('Test completed');
  socket.close();
  process.exit(0);
}, 5000);