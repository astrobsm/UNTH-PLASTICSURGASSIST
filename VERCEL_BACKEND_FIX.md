# 🔧 API Configuration Fix - Vercel + Digital Ocean Backend

## Problem
Frontend deployed on Vercel was trying to call `/api/*` endpoints locally, but the backend is running on Digital Ocean (164.90.225.181:3001).

## Solution Applied

### 1. ✅ Created Production Environment File
Created [.env.production](.env.production) with:
```bash
VITE_API_BASE_URL=http://164.90.225.181:3001/api
```

### 2. ✅ Updated API Client
Modified [src/services/apiClient.ts](src/services/apiClient.ts) to:
- Check for `VITE_API_BASE_URL` environment variable first
- Fall back to relative paths if not set

### 3. ✅ Updated Offline Manager
Modified [src/services/offlineManager.ts](src/services/offlineManager.ts) to use the same logic.

## 📝 Required: Configure Vercel Environment Variables

### Steps to Fix Vercel Deployment:

1. **Go to Vercel Dashboard**
   - Navigate to: https://vercel.com/dashboard
   - Select your project: `plasticsurgassisstant`

2. **Add Environment Variable**
   - Go to **Settings** → **Environment Variables**
   - Add new variable:
     ```
     Name: VITE_API_BASE_URL
     Value: http://164.90.225.181:3001/api
     ```
   - Select environment: **Production**

3. **Redeploy**
   - Go to **Deployments** tab
   - Click ⋯ (three dots) on latest deployment
   - Select **Redeploy**
   - ✅ Check "Use existing Build Cache" (optional, faster)

## 🔒 SSL/HTTPS Considerations

### Current Setup (HTTP)
```
VITE_API_BASE_URL=http://164.90.225.181:3001/api
```

**Issue**: Vercel uses HTTPS (`https://plasticsurgassisstant.vercel.app`), calling HTTP backend will cause **Mixed Content** errors in browsers.

### ⚠️ Required: Enable HTTPS on Digital Ocean

#### Option 1: Use Nginx Reverse Proxy (Recommended)
1. Install Certbot on Digital Ocean:
   ```bash
   sudo apt update
   sudo apt install certbot python3-certbot-nginx
   ```

2. Get SSL certificate:
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

3. Update Nginx config to proxy `/api` to `:3001`

4. Update Vercel environment variable:
   ```
   VITE_API_BASE_URL=https://your-domain.com/api
   ```

#### Option 2: Use Cloudflare Tunnel (Free)
1. Install `cloudflared` on Digital Ocean
2. Create tunnel to port 3001
3. Get public HTTPS URL
4. Update Vercel environment variable

#### Option 3: Point Domain to Digital Ocean
1. Buy domain or use existing
2. Point A record to `164.90.225.181`
3. Setup Nginx with SSL
4. Update environment variable

## 🚀 Testing After Deployment

1. **Check Network Tab** in browser DevTools
2. **Verify API calls** are going to Digital Ocean backend
3. **Look for** successful responses (200/201 status codes)
4. **Test sync** by creating a patient record

## 📋 Verification Checklist

- [ ] `.env.production` file created
- [ ] `apiClient.ts` updated
- [ ] `offlineManager.ts` updated
- [ ] Vercel environment variable added
- [ ] Vercel redeployed
- [ ] HTTPS configured on backend (recommended)
- [ ] Mixed content warnings resolved
- [ ] Patient sync working
- [ ] Push notifications working

## 🆘 Troubleshooting

### Still Getting 500 Errors?
1. Check if Digital Ocean server is running:
   ```bash
   ssh root@164.90.225.181
   pm2 status
   pm2 logs plasticsurg-backend
   ```

2. Check backend logs for errors

3. Verify PostgreSQL database is accessible

### Mixed Content Errors?
Update to HTTPS backend URL as described above.

### CORS Errors?
Update backend CORS configuration to allow Vercel domain:
```javascript
app.use(cors({
  origin: ['https://plasticsurgassisstant.vercel.app', 'http://localhost:5173'],
  credentials: true
}));
```

## 📚 Related Files
- [src/services/apiClient.ts](src/services/apiClient.ts) - Main API client
- [src/services/offlineManager.ts](src/services/offlineManager.ts) - Offline sync
- [vercel.json](vercel.json) - Vercel configuration
- [.env.production](.env.production) - Production environment variables

## 🔗 Quick Links
- Vercel Dashboard: https://vercel.com/dashboard
- Digital Ocean Droplet: `ssh root@164.90.225.181`
- Frontend: https://plasticsurgassisstant.vercel.app
- Backend API: http://164.90.225.181:3001/api
