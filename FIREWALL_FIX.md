# 🔥 CRITICAL: Backend Port Not Accessible

## Problem Detected
The backend server on Digital Ocean (164.90.225.181:3001) is **NOT accessible** from the internet.

### Test Results
```powershell
Test-NetConnection -ComputerName 164.90.225.181 -Port 3001
# Result: TcpTestSucceeded = False
```

**Ping**: ✅ Successful (server is online)  
**Port 3001**: ❌ Blocked/Closed

## Possible Causes

### 1. Firewall (UFW) Blocking Port 3001
Digital Ocean droplets have UFW firewall enabled by default.

**Fix:**
```bash
ssh root@164.90.225.181

# Check firewall status
sudo ufw status

# Allow port 3001
sudo ufw allow 3001/tcp

# Verify
sudo ufw status
```

### 2. Application Not Listening on 0.0.0.0
The backend might be listening only on `localhost` (127.0.0.1) instead of all interfaces (0.0.0.0).

**Check:**
```bash
ssh root@164.90.225.181

# Check what's listening on port 3001
sudo netstat -tlnp | grep 3001

# Or
sudo ss -tlnp | grep 3001
```

**Expected output:**
```
tcp  0  0  0.0.0.0:3001  0.0.0.0:*  LISTEN  12345/node
```

**If shows `127.0.0.1:3001`, fix it:**

Edit backend server file:
```bash
cd /root/plasticsurg-backend
nano server/index-postgres.js
```

Find:
```javascript
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

Change to:
```javascript
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
```

Then restart:
```bash
pm2 restart plasticsurg-backend
```

### 3. Digital Ocean Cloud Firewall
Check Digital Ocean dashboard for cloud firewall rules.

**Fix:**
1. Login to Digital Ocean: https://cloud.digitalocean.com
2. Go to **Networking** → **Firewalls**
3. Select firewall attached to your droplet
4. Add **Inbound Rule**:
   - Type: Custom
   - Protocol: TCP
   - Port Range: 3001
   - Sources: All IPv4, All IPv6

### 4. Backend Not Running
**Check:**
```bash
ssh root@164.90.225.181
pm2 status
pm2 logs plasticsurg-backend
```

## ⚡ Quick Fix Script

Run this on your local machine:

```powershell
# Quick diagnostic and fix
ssh root@164.90.225.181 @"
echo '🔍 Checking backend status...'
echo ''

echo '1️⃣ PM2 Status:'
pm2 status

echo ''
echo '2️⃣ Port 3001 Listening Status:'
sudo netstat -tlnp | grep 3001 || echo 'Not listening on 3001'

echo ''
echo '3️⃣ UFW Firewall Status:'
sudo ufw status | grep 3001 || echo 'Port 3001 not in firewall rules'

echo ''
echo '4️⃣ Fixing firewall...'
sudo ufw allow 3001/tcp
sudo ufw status

echo ''
echo '5️⃣ Backend logs (last 20 lines):'
pm2 logs plasticsurg-backend --lines 20 --nostream

echo ''
echo '✅ Diagnostic complete'
"@
```

## 🎯 Recommended Solution: Use Nginx Reverse Proxy

Instead of exposing port 3001, use Nginx on port 80/443:

### Benefits:
- ✅ Standard HTTP/HTTPS ports (no firewall issues)
- ✅ SSL/TLS encryption built-in
- ✅ Better security
- ✅ Load balancing support

### Setup:
```bash
ssh root@164.90.225.181

# Install Nginx
sudo apt update
sudo apt install nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/plasticsurg-api

# Add configuration:
server {
    listen 80;
    server_name 164.90.225.181;  # or your domain

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/plasticsurg-api /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Open firewall for HTTP
sudo ufw allow 'Nginx Full'
```

Then update Vercel environment variable:
```
VITE_API_BASE_URL=http://164.90.225.181/api
```

### Add SSL (Recommended):
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate (requires domain)
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

Update Vercel to:
```
VITE_API_BASE_URL=https://yourdomain.com/api
```

## 📋 Action Items (Priority Order)

1. **[ ] CRITICAL**: Fix firewall to allow port 3001
   ```bash
   ssh root@164.90.225.181
   sudo ufw allow 3001/tcp
   ```

2. **[ ] HIGH**: Verify backend listens on 0.0.0.0
   ```bash
   sudo netstat -tlnp | grep 3001
   ```

3. **[ ] MEDIUM**: Setup Nginx reverse proxy (better long-term solution)

4. **[ ] LOW**: Add SSL certificate for HTTPS

## 🧪 Test After Fix
```powershell
# Test from your machine
Test-NetConnection -ComputerName 164.90.225.181 -Port 3001

# Or use curl
curl http://164.90.225.181:3001/api/health
```

Expected: Connection successful, HTTP 200 response

## 📚 Related Guides
- [QUICK_FIX.md](QUICK_FIX.md) - Vercel deployment steps
- [VERCEL_BACKEND_FIX.md](VERCEL_BACKEND_FIX.md) - Detailed backend config
- [DIGITAL_OCEAN_DEPLOYMENT_GUIDE.md](DIGITAL_OCEAN_DEPLOYMENT_GUIDE.md) - Server setup
