@echo off
echo ============================================
echo SSH KEY SETUP FOR PASSWORDLESS DEPLOYMENT
echo ============================================
echo.
echo This will set up SSH keys so you don't need to enter
echo the password multiple times during deployment.
echo.
echo Step 1: Generate SSH Key (if you don't have one)
echo ------------------------------------------------
echo.

if not exist "%USERPROFILE%\.ssh\id_rsa.pub" (
    echo No SSH key found. Generating new SSH key...
    echo.
    echo Press ENTER when prompted (accept all defaults^)
    echo.
    pause
    ssh-keygen -t rsa -b 4096 -C "plasticsurg_deployment"
) else (
    echo SSH key already exists: %USERPROFILE%\.ssh\id_rsa.pub
)

echo.
echo Step 2: Copy SSH Key to Droplet
echo --------------------------------
echo.
echo You will need to enter your droplet password ONE TIME:
echo Password: 289e3de323931fad90f44ea7f8
echo.
pause

type "%USERPROFILE%\.ssh\id_rsa.pub" | ssh root@164.90.225.181 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && chmod 700 ~/.ssh"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo SUCCESS! SSH KEYS CONFIGURED
    echo ============================================
    echo.
    echo You can now deploy WITHOUT entering password!
    echo Just double-click DEPLOY.bat
    echo.
) else (
    echo.
    echo ============================================
    echo SETUP FAILED
    echo ============================================
    echo.
    echo Please try manually:
    echo 1. Run: ssh-copy-id root@164.90.225.181
    echo 2. Enter password: 289e3de323931fad90f44ea7f8
    echo.
)

pause
