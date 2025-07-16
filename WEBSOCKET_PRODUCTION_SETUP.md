# WebSocket Production Setup Guide

## Issue
The WebSocket connection was failing in production with "bad response from server" when trying to connect to `wss://nplvision.com/ws/`.

## Root Causes Identified

1. **CORS Configuration**: The WebSocket server was only allowing `http://localhost:5173` as origin due to missing `FRONTEND_URL` environment variable
2. **Inconsistent URL Logic**: Frontend components used different logic for determining WebSocket URLs
3. **Missing Production Origins**: Production domains weren't included in allowed origins

## Fixes Implemented

### 1. Backend WebSocket CORS Fix
**File:** `src/backend/src/services/websocketServer.ts`

- Replaced single `process.env.FRONTEND_URL` with comprehensive allowed origins list
- Added both production and development URLs:
  - `https://nplvision.com`
  - `https://loanvision-frontend.onrender.com`  
  - Development URLs for local testing

### 2. Frontend URL Logic Standardization
**File:** `src/frontend/src/hooks/useInboxNotifications.ts`

- Standardized WebSocket URL logic to match `useChatWebSocket.ts`
- In production (`import.meta.env.PROD`): Uses `window.location.origin`
- In development: Uses `VITE_WS_URL` or fallback to `http://localhost:3000`

### 3. Enhanced Logging
Added detailed logging for:
- WebSocket server initialization with allowed origins
- Connection attempts with origin, user agent, and address
- Authentication failures

### 4. Startup Messages
Added clear startup message showing WebSocket endpoint availability.

## Environment Variables for Production

### Backend (Render Service)
No additional environment variables needed - the fix uses hardcoded production URLs.

Optional for additional debugging:
```
LOG_LEVEL=debug
```

### Frontend (Render Static Site)
No changes needed - uses `window.location.origin` in production automatically.

## Deployment Steps

1. **Deploy Backend First**: 
   ```bash
   cd src/backend
   npm run build
   # Deploy to Render backend service
   ```

2. **Deploy Frontend**:
   ```bash
   cd src/frontend  
   npm run build
   # Deploy to Render static site
   ```

3. **Verify WebSocket Connection**:
   - Check browser developer console for "Connecting to WebSocket at: https://nplvision.com"
   - Look for successful WebSocket connection messages
   - Check for authentication and initial data reception

## Testing WebSocket Connection

### In Browser Console:
```javascript
// Check if WebSocket is connecting properly
console.log('Testing WebSocket...');
```

### Backend Logs to Monitor:
- `WebSocket server initialized`
- `WebSocket connection attempt`
- `User [email] connected via WebSocket`

### Frontend Logs to Monitor:
- `Connecting to WebSocket at: https://nplvision.com`
- `WebSocket connected` or `Chat WebSocket connected`

## Troubleshooting

### If Still Getting "bad response from server":

1. **Check Render Logs**: 
   - Backend service logs should show WebSocket initialization
   - Look for CORS errors or authentication failures

2. **Verify Render Configuration**:
   - Ensure backend service supports WebSocket connections
   - Check if there are any proxy/load balancer issues

3. **Test Authentication**:
   - Verify JWT token is being passed correctly
   - Check token expiration

### Common Issues:

1. **Mixed Content**: Ensure production uses WSS (secure WebSocket)
2. **Firewall/Proxy**: Render should handle this automatically
3. **Token Issues**: Check browser storage for valid JWT token

## Files Modified

- `src/backend/src/services/websocketServer.ts`
- `src/frontend/src/hooks/useInboxNotifications.ts` 
- `src/backend/src/index.ts`

## Next Steps

After deployment:
1. Monitor Render logs for any WebSocket-related errors
2. Test chat functionality and inbox notifications
3. Verify real-time updates are working properly