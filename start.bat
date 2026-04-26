@echo off
title Xixero - Local AI Gateway
color 0A

echo.
echo  ========================================
echo   Xixero - Local AI Gateway
echo  ========================================
echo.

:: Kill existing processes
echo [1/6] Cleaning up old processes...
taskkill /F /IM xixero.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :7860 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :7861 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul
echo  OK

:: Build
echo [2/6] Building...
cd /d "%~dp0"
go build -o bin\xixero.exe .\cmd\xixero 2>nul
if %errorlevel% neq 0 (
    echo  ERROR: Build failed!
    pause
    exit /b 1
)
echo  OK

:: Fixed secret key
set SECRET_KEY=xixero_admin_secret_key_2026_do_not_share

:: Check if admin already initialized
if not exist "%LOCALAPPDATA%\xixero\xixero-admin.db" (
    echo.
    echo [3/6] First run - initializing admin...
    bin\xixero.exe admin init --password admin123
    echo.
    echo  DEFAULT ADMIN: admin / admin123
    echo.
) else (
    echo [3/6] Admin DB exists - OK
)

:: Start admin server
echo [4/6] Starting admin server (port 7861)...
start "" /b bin\xixero.exe admin start --secret %SECRET_KEY% --port 7861
timeout /t 3 /nobreak >nul
echo  OK

:: Start user proxy server
echo [5/6] Starting proxy server (port 7860)...
start "" /b bin\xixero.exe start
timeout /t 2 /nobreak >nul
echo  OK

:: Start frontend
echo [6/6] Starting Web UI (port 5173)...
cd web-ui
start "" /b cmd /c "npx vite --port 5173 2>nul"
cd ..
timeout /t 4 /nobreak >nul
echo  OK

echo.
echo  ========================================
echo   ALL SERVICES RUNNING
echo  ========================================
echo.
echo   User UI:   http://localhost:5173
echo   Admin UI:  http://localhost:5173/admin
echo.
echo   Admin Login: admin / admin123
echo.
echo  ========================================
echo   Press any key to STOP everything...
echo  ========================================
pause >nul

echo.
echo  Stopping...
taskkill /F /IM xixero.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
echo  Done!
timeout /t 2 /nobreak >nul