# 🚀 Quick Fix: Vercel Frontend → Digital Ocean Backend

## Problem Summary
- Frontend on Vercel: ✅ Working
- Backend on Digital Ocean: ✅ Running
- **Connection**: ❌ Not configured properly
- **Result**: All API calls fail with 500 errors

## ⚡ Quick Fix (3 Steps)

### Step 1: Configure Vercel Environment Variable
1. Go to: https://vercel.com/dashboard
2. Select your project: `plasticsurgassisstant`
3. Go to: **Settings** → **Environment Variables**
4. Add:
   ```
   Name: VITE_API_BASE_URL
   Value: http://164.90.225.181:3001/api
   ```
5. Click **Save**

### Step 2: Update Backend CORS
Run this command on your local machine:
```powershell
.\Update-Backend-CORS.ps1
```

Or manually SSH and add to backend `.env`:
```bash
ssh root@164.90.225.181
cd /root/plasticsurg-backend
nano .env
```

Add these lines:
```env
FRONTEND_URL=https://plasticsurgassisstant.vercel.app
PRODUCTION_URL=https://plasticsurgassisstant.vercel.app
```

Then restart:
```bash
pm2 restart plasticsurg-backend
pm2 logs plasticsurg-backend
```

### Step 3: Redeploy Vercel
1. Go to Vercel **Deployments** tab
2. Click ⋯ on latest deployment
3. Select **Redeploy**
4. Wait for deployment to complete

## ✅ Verification
After deployment, check:
1. Open: https://plasticsurgassisstant.vercel.app
2. Open DevTools (F12) → Network tab
3. Login or register
4. Check API calls go to: `164.90.225.181:3001`
5. Verify 200/201 responses (not 500)

## ⚠️ Known Issue: Mixed Content
**Current**: HTTP backend + HTTPS frontend = Browser blocks requests

**Symptoms**: 
- Console error: "Mixed Content: The page at 'https://...' was loaded over HTTPS, but requested an insecure resource 'http://...'."
- API calls fail silently

**Solution**: Enable HTTPS on backend (see below)

## 🔒 Enable HTTPS on Backend (Recommended)

### Option A: Use Cloudflare Tunnel (Easiest, Free)
```bash
# On Digital Ocean server
ssh root@164.90.225.181

# Install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create plasticsurg-backend

# Route tunnel
cloudflared tunnel route dns plasticsurg-backend api.yourdomain.com

# Run tunnel
cloudflared tunnel run --url localhost:3001 plasticsurg-backend
```

Then update Vercel env to:
```
VITE_API_BASE_URL=https://api.yourdomain.com
```

### Option B: Use Nginx + Let's Encrypt (Free SSL)
```bash
ssh root@164.90.225.181

# Install Nginx
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx

# Get domain pointing to 164.90.225.181
# Then get SSL certificate
sudo certbot --nginx -d api.yourdomain.com

# Configure Nginx to proxy to :3001
sudo nano /etc/nginx/sites-available/plasticsurg-api

# Restart Nginx
sudo systemctl restart nginx
```

Then update Vercel env to:
```
VITE_API_BASE_URL=https://api.yourdomain.com
```

## 🧪 Testing Checklist
- [ ] Vercel environment variable added
- [ ] Backend CORS updated
- [ ] Vercel redeployed
- [ ] Can login to frontend
- [ ] Can create patient record
- [ ] Patient sync works
- [ ] No 500 errors in console
- [ ] Push notifications work

## 📚 Files Modified
1. [.env.production](.env.production) - Production env vars
2. [src/services/apiClient.ts](src/services/apiClient.ts) - API client
3. [src/services/offlineManager.ts](src/services/offlineManager.ts) - Offline sync
4. [Update-Backend-CORS.ps1](Update-Backend-CORS.ps1) - CORS update script

## 🆘 Still Not Working?

### Check Backend Status
```bash
ssh root@164.90.225.181
pm2 status
pm2 logs plasticsurg-backend
```

### Check Backend Logs for Errors
```bash
pm2 logs plasticsurg-backend --lines 100
```

### Verify Database Connection
```bash
ssh root@164.90.225.181
cd /root/plasticsurg-backend
node -e "console.log(process.env.DATABASE_URL ? 'Database URL set' : 'Database URL missing')"
```

### Test API Directly
```powershell
curl http://164.90.225.181:3001/api/health
```

## 📞 Need Help?
See [VERCEL_BACKEND_FIX.md](VERCEL_BACKEND_FIX.md) for detailed troubleshooting.
