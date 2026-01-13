# Complete Backend Fix Script - Run this to diagnose and fix all issues

Write-Host "Plastic Surgeon Assistant - Backend Diagnostic and Fix" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Server reachability
Write-Host "1. Testing server reachability..." -ForegroundColor Yellow
$pingTest = Test-NetConnection -ComputerName 164.90.225.181 -InformationLevel Quiet
if ($pingTest) {
    Write-Host "   OK - Server is online" -ForegroundColor Green
} else {
    Write-Host "   FAIL - Server is offline or unreachable" -ForegroundColor Red
    exit 1
}

# Test 2: Port 3001 accessibility
Write-Host ""
Write-Host "2. Testing port 3001..." -ForegroundColor Yellow
$portTest = Test-NetConnection -ComputerName 164.90.225.181 -Port 3001 -InformationLevel Quiet
if ($portTest) {
    Write-Host "   OK - Port 3001 is accessible" -ForegroundColor Green
} else {
    Write-Host "   BLOCKED - Port 3001 is blocked/closed" -ForegroundColor Red
    Write-Host "   Will attempt to fix via SSH..." -ForegroundColor Yellow
}

# SSH Commands to fix backend
Write-Host ""
Write-Host "3. Connecting to server to diagnose and fix..." -ForegroundColor Yellow

Write-Host "Executing remote commands..." -ForegroundColor Cyan

# Execute on remote server using SSH with inline commands
try {
    ssh root@164.90.225.181 @'
echo ""
echo "DIAGNOSTIC REPORT"
echo "=================="

echo ""
echo "PM2 Status:"
pm2 status | grep plasticsurg-backend || echo "Backend not running in PM2"

echo ""
echo "Port 3001 Listening:"
netstat -tlnp 2>/dev/null | grep :3001 || ss -tlnp 2>/dev/null | grep :3001 || echo "Not listening on port 3001"

echo ""
echo "UFW Firewall Rules:"
ufw status 2>/dev/null | grep 3001 || echo "Port 3001 not in firewall rules"

echo ""
echo "APPLYING FIXES"
echo "==============="

echo ""
echo "1. Opening port 3001 in UFW..."
ufw allow 3001/tcp 2>/dev/null && echo "Firewall rule added" || echo "Could not add firewall rule"

echo ""
echo "2. Checking backend service..."
pm2 restart plasticsurg-backend 2>/dev/null && echo "Backend restarted" || echo "Could not restart backend"

echo ""
echo "3. Updating environment variables..."
cd /root/plasticsurg-backend 2>/dev/null && {
    cp .env .env.backup 2>/dev/null
    grep -q "FRONTEND_URL" .env 2>/dev/null && sed -i 's|FRONTEND_URL=.*|FRONTEND_URL=https://plasticsurgassisstant.vercel.app|' .env || echo "FRONTEND_URL=https://plasticsurgassisstant.vercel.app" >> .env
    grep -q "PRODUCTION_URL" .env 2>/dev/null && sed -i 's|PRODUCTION_URL=.*|PRODUCTION_URL=https://plasticsurgassisstant.vercel.app|' .env || echo "PRODUCTION_URL=https://plasticsurgassisstant.vercel.app" >> .env
    echo "Environment variables updated"
    pm2 restart plasticsurg-backend 2>/dev/null
}

echo ""
echo "FINAL STATUS"
echo "============="
pm2 status
echo ""
echo "Port Status:"
netstat -tlnp 2>/dev/null | grep :3001 || ss -tlnp 2>/dev/null | grep :3001 || echo "Port 3001 not listening"
echo ""
echo "Diagnostic and fix complete!"
'@
} catch {
    Write-Host "SSH connection failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run these commands manually:" -ForegroundColor Yellow
    Write-Host "  ssh root@164.90.225.181" -ForegroundColor White
    Write-Host "  sudo ufw allow 3001/tcp" -ForegroundColor White
    Write-Host "  pm2 restart plasticsurg-backend" -ForegroundColor White
}

# Test again after fixes
Write-Host ""
Write-Host "4. Re-testing port 3001..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
$portTest2 = Test-NetConnection -ComputerName 164.90.225.181 -Port 3001 -InformationLevel Quiet
if ($portTest2) {
    Write-Host "   OK - Port 3001 is now accessible!" -ForegroundColor Green
} else {
    Write-Host "   WARNING - Port 3001 still blocked" -ForegroundColor Yellow
    Write-Host "   This may require Digital Ocean cloud firewall configuration" -ForegroundColor Yellow
}

# Test HTTP endpoint
Write-Host ""
Write-Host "5. Testing HTTP endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://164.90.225.181:3001/api/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   OK - Backend API is responding (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "   FAIL - Backend API not responding" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Configure Vercel environment variable:" -ForegroundColor White
Write-Host "   - Go to: https://vercel.com/dashboard" -ForegroundColor Gray
Write-Host "   - Settings -> Environment Variables" -ForegroundColor Gray
Write-Host "   - Add: VITE_API_BASE_URL = http://164.90.225.181:3001/api" -ForegroundColor Gray
Write-Host ""
Write-Host "2. If port still blocked, check Digital Ocean firewall:" -ForegroundColor White
Write-Host "   - Go to: https://cloud.digitalocean.com/networking/firewalls" -ForegroundColor Gray
Write-Host "   - Add inbound rule: TCP port 3001" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Redeploy Vercel frontend" -ForegroundColor White
Write-Host ""
Write-Host "See QUICK_FIX.md for detailed instructions" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
