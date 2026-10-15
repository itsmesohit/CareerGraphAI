# 🤖 Chatbot Fix - Session Expired Issue

## Problem
The AI Copilot chatbot shows error:
```
Sorry — I couldn't reach the AI service (Your session has been terminated or expired. Please sign in again.)
```

## Root Cause
Your browser session has expired or been revoked in the database. The copilot endpoint requires a valid JWT token with an active database session.

**Auth flow:**
1. Frontend sends request with `Authorization: Bearer <token>`
2. Backend middleware (`requireAuth`) verifies the token
3. Checks if session exists in database and is not revoked
4. **Your session is either expired or revoked** ❌

## Solution: Sign Out and Sign In Again

### Option 1: Quick Fix (Browser Console)
Open browser DevTools console and run:
```javascript
localStorage.clear();
window.location.href = '/login';
```

### Option 2: Manual Fix
1. Click on your profile/avatar
2. Click "Sign Out"
3. Sign in again with your credentials
4. Try the chatbot again

### Option 3: Clear Sessions in Database
If you're a developer and want to clean all sessions:

```bash
cd /Users/sohitkushwaha/carrer_Graph/apps/api
pnpm prisma studio
```

Then in Prisma Studio:
1. Open `Session` table
2. Delete expired sessions or set `isRevoked = true` to `false`

## Technical Details

### Auth Middleware Check
```typescript
// apps/api/src/middleware/authMiddleware.ts:44-52
const session = await prisma.session.findUnique({
  where: { id: payload.sessionId },
});

if (!session || session.isRevoked || session.expiresAt < new Date()) {
  return res.status(401).json({
    code: 'SESSION_REVOKED',
    message: 'Your session has been terminated or expired. Please sign in again.',
  });
}
```

### Session Expiry Settings
```env
JWT_ACCESS_EXPIRY="15m"   # Access token expires in 15 minutes
JWT_REFRESH_EXPIRY="7d"   # Refresh token expires in 7 days
```

## Prevention

To avoid this in the future, implement token refresh logic:

### Add Token Refresh Interceptor (Recommended)

Create `/apps/web/src/api/authInterceptor.ts`:
```typescript
export async function refreshTokenIfNeeded() {
  const token = localStorage.getItem('cg_access_token');
  const refreshToken = localStorage.getItem('cg_refresh_token');
  
  if (!token || !refreshToken) return false;
  
  try {
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      credentials: 'include',
    });
    
    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('cg_access_token', data.data.accessToken);
      return true;
    }
  } catch (err) {
    console.error('Token refresh failed:', err);
  }
  
  return false;
}
```

Then update `client.ts` to retry with refresh on 401:
```typescript
if (!response.ok && response.status === 401) {
  const refreshed = await refreshTokenIfNeeded();
  if (refreshed) {
    // Retry the original request
    return request(path, options);
  }
}
```

## Verify Fix

After signing in again, test the chatbot:
1. Open AI Copilot widget
2. Type "hi" and send
3. Should get a response from the AI

## Check Session Status

```bash
# Check if user has active sessions
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/v1/auth/sessions | jq .
```

---

**Quick Fix:** Just sign out and sign back in! 🚀
