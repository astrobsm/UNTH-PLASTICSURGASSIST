# ============================================
# PLASTIC SURGEON ASSISTANT - AUTOMATED DEPLOYMENT
# Digital Ocean Droplet: 164.90.225.181
# ============================================

param(
    [string]$DropletIP = "164.90.225.181",
    [string]$SSHUser = "root",
    [Parameter(Mandatory=$true)]
    [string]$Password
)

$ErrorActionPreference = "Continue"

# Colors for output
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Warn { param($msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host $msg -ForegroundColor Red }

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "PLASTIC SURGEON ASSISTANT - AUTO DEPLOYMENT" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Info "Droplet IP: $DropletIP"
Write-Info "SSH User: $SSHUser"
Write-Host ""

# Install sshpass equivalent for Windows (using plink or native ssh with expect-like behavior)
# For Windows, we'll use a password file approach

# Step 1: Check if SSH is available
Write-Info "Step 1: Checking SSH connectivity..."
try {
    $null = Get-Command ssh -ErrorAction Stop
    Write-Success "[OK] SSH command found"
} catch {
    Write-Err "[ERROR] SSH not found. Please install OpenSSH."
    Write-Info "Install via: Settings > Apps > Optional Features > Add OpenSSH Client"
    exit 1
}

# Step 2: Create temporary password file for scp/ssh
Write-Info "`nStep 2: Preparing secure connection..."
$tempPassFile = [System.IO.Path]::GetTempFileName()
Set-Content -Path $tempPassFile -Value $Password -NoNewline

# Step 3: Copy deployment script
Write-Info "`nStep 3: Copying deployment script to droplet..."

# Convert line endings to Unix (LF) before copying
$scriptContent = Get-Content -Path "deploy-to-droplet.sh" -Raw
$scriptContent = $scriptContent -replace "`r`n", "`n"
$tempFile = "deploy-to-droplet-unix.sh"
[System.IO.File]::WriteAllText($tempFile, $scriptContent, [System.Text.UTF8Encoding]::new($false))

# Use plink for automated password input (if available) or manual scp
Write-Info "Uploading deployment script..."

# Try using echo password approach (works on some systems)
$scpCommand = "scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $tempFile ${SSHUser}@${DropletIP}:~/deploy-to-droplet.sh"

# Use expect-like behavior with PowerShell
$processInfo = New-Object System.Diagnostics.ProcessStartInfo
$processInfo.FileName = "scp"
$processInfo.Arguments = "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $tempFile ${SSHUser}@${DropletIP}:~/deploy-to-droplet.sh"
$processInfo.UseShellExecute = $false
$processInfo.RedirectStandardInput = $true
$processInfo.RedirectStandardOutput = $true
$processInfo.RedirectStandardError = $true

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $processInfo

try {
    $process.Start() | Out-Null
    Start-Sleep -Milliseconds 500
    $process.StandardInput.WriteLine($Password)
    $process.StandardInput.Close()
    $process.WaitForExit(30000) # 30 second timeout
    
    if ($process.ExitCode -ne 0) {
        throw "SCP failed with exit code: $($process.ExitCode)"
    }
    Write-Success "[OK] Deployment script copied"
} catch {
    Write-Warn "[WARNING] Automated upload failed, trying interactive mode..."
    Write-Info "Please enter password when prompted: 289e3de323931fad90f44ea7f8"
    & scp -o StrictHostKeyChecking=no $tempFile ${SSHUser}@${DropletIP}:~/deploy-to-droplet.sh
    
    if ($LASTEXITCODE -ne 0) {
        Write-Err "[ERROR] Failed to copy deployment script"
        Remove-Item -Path $tempFile -ErrorAction SilentlyContinue
        Remove-Item -Path $tempPassFile -ErrorAction SilentlyContinue
        exit 1
    }
    Write-Success "[OK] Deployment script copied"
}

# Clean up temp file
Remove-Item -Path $tempFile -ErrorAction SilentlyContinue

# Step 4: Execute deployment
Write-Info "`nStep 4: Executing deployment on droplet..."
Write-Warn "This will take 3-5 minutes. Please wait..."
Write-Host ""

# Execute SSH command with password
$sshProcessInfo = New-Object System.Diagnostics.ProcessStartInfo
$sshProcessInfo.FileName = "ssh"
$sshProcessInfo.Arguments = "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $SSHUser@$DropletIP 'chmod +x ~/deploy-to-droplet.sh && bash ~/deploy-to-droplet.sh'"
$sshProcessInfo.UseShellExecute = $false
$sshProcessInfo.RedirectStandardInput = $true
$sshProcessInfo.RedirectStandardOutput = $true
$sshProcessInfo.RedirectStandardError = $true

$sshProcess = New-Object System.Diagnostics.Process
$sshProcess.StartInfo = $sshProcessInfo

try {
    $sshProcess.Start() | Out-Null
    Start-Sleep -Milliseconds 500
    $sshProcess.StandardInput.WriteLine($Password)
    $sshProcess.StandardInput.Close()
    
    # Read output in real-time
    while (-not $sshProcess.HasExited) {
        $output = $sshProcess.StandardOutput.ReadLine()
        $error = $sshProcess.StandardError.ReadLine()
        if ($output) { Write-Host $output }
        if ($error) { Write-Host $error -ForegroundColor Yellow }
    }
    
    # Read remaining output
    $output = $sshProcess.StandardOutput.ReadToEnd()
    $error = $sshProcess.StandardError.ReadToEnd()
    if ($output) { Write-Host $output }
    if ($error) { Write-Host $error -ForegroundColor Yellow }
    
    if ($sshProcess.ExitCode -ne 0) {
        throw "Deployment failed with exit code: $($sshProcess.ExitCode)"
    }
} catch {
    Write-Warn "[WARNING] Automated execution failed, trying interactive mode..."
    Write-Info "Please enter password when prompted: 289e3de323931fad90f44ea7f8"
    & ssh -o StrictHostKeyChecking=no $SSHUser@$DropletIP "chmod +x ~/deploy-to-droplet.sh && bash ~/deploy-to-droplet.sh"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Err "[ERROR] Deployment script failed"
        Write-Info "Check the logs above for errors"
        Remove-Item -Path $tempPassFile -ErrorAction SilentlyContinue
        exit 1
    }
}

# Clean up password file
Remove-Item -Path $tempPassFile -ErrorAction SilentlyContinue

# Step 5: Verify deployment
Write-Info "`nStep 5: Verifying deployment..."
Start-Sleep -Seconds 5

try {
    $response = Invoke-WebRequest -Uri "http://$DropletIP" -TimeoutSec 10 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Success "[OK] Application is running!"
    }
} catch {
    Write-Warn "[WARNING] Could not verify application (might still be starting)"
}

# Final summary
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "DEPLOYMENT COMPLETED!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Success "Application URL: http://$DropletIP"
Write-Host ""
Write-Info "Default Login Credentials:"
Write-Info "  Admin: admin@unth.edu.ng / admin123"
Write-Info "  Doctor: doctor@unth.edu.ng / doctor123"
Write-Host ""
Write-Info "Next Steps:"
Write-Info "  1. Open browser: http://$DropletIP"
Write-Info "  2. Login with credentials above"
Write-Info "  3. Test all features"
Write-Info "  4. Set up SSL if you have a domain"
Write-Host ""
Write-Success "Your Plastic Surgeon Assistant is now LIVE!"
Write-Host "============================================" -ForegroundColor Green
