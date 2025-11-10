@echo off
echo ============================================
echo PLASTIC SURGEON ASSISTANT - AUTO DEPLOYMENT
echo ============================================
echo.
echo This will deploy your app to:
echo IP: 164.90.225.181
echo.
echo When prompted for password, use:
echo 289e3de323931fad90f44ea7f8
echo.
echo (You may need to enter it 2-3 times)
echo.
pause

echo Starting automated deployment...
powershell.exe -ExecutionPolicy Bypass -File Deploy-ToDroplet.ps1

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo DEPLOYMENT SUCCESSFUL!
    echo ============================================
    echo.
    echo Your app is now live at: http://164.90.225.181
    echo.
    echo Login Credentials:
    echo   Admin: admin@unth.edu.ng / admin123
    echo   Doctor: doctor@unth.edu.ng / doctor123
    echo.
) else (
    echo.
    echo ============================================
    echo DEPLOYMENT FAILED!
    echo ============================================
    echo.
    echo Please check the errors above
    echo.
)

pause
