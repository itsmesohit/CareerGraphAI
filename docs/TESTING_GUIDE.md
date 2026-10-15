# Testing Guide: Backend & Frontend

## ✅ Servers Running

| Service | URL | Status |
|---------|-----|--------|
| **API Backend** | http://localhost:3001 | ✅ Running (PID 37527) |
| **Web Frontend** | http://localhost:5173 | ✅ Running (PID 37757) |
| **Swagger Docs** | http://localhost:3001/api/docs | ✅ Available |

## Quick Start Testing

### 1. Open in Browser
```
http://localhost:5173
```

### 2. Test the New Dark UI
- Dark background (#05070C)
- Cyan gradient logo with glow
- Clean navigation tabs
- Fixed logout button (rose accent)
- Glassmorphic panels
- Gradient CTA buttons

### 3. Test Authentication Flow

**In Browser:**
1. Click "Create Free Account"
2. Fill: email, name, password
3. Submit registration
4. Click "Sign In with Email OTP"
5. Request OTP (check API logs for code)
6. Enter code and login
7. Navigate dashboard

**API Logs (check OTP codes):**
```bash
tail -f /tmp/cg_api.log
```

### 4. Test API Endpoints

**Health Check:**
```bash
curl http://localhost:3001/api/health
```

**Register:**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test","password":"Pass123!","role":"CANDIDATE"}'
```

**OTP Request:**
```bash
curl -X POST http://localhost:3001/api/auth/login/otp-request \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

## Stop Servers
```bash
kill 37527 37757
# or
pkill -f 'tsx watch'
pkill -f 'vite'
```

## Restart Servers
```bash
cd /Users/sohitkushwaha/carrer_Graph
pnpm dev:api > /tmp/cg_api.log 2>&1 &
pnpm dev:web > /tmp/cg_web.log 2>&1 &
```
