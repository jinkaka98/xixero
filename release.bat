@echo off
setlocal enabledelayedexpansion
title Xixero Release Builder
color 0E

:: ═══════════════════════════════════════════
::  Xixero Release Builder
::  Builds binaries and pushes to public repo
:: ═══════════════════════════════════════════

set "XIXERO_DIR=%~dp0"
set "PUBLIC_DIR=%USERPROFILE%\Documents\GitHub\jinkaka98.github.io"
set "RELEASES_DIR=%PUBLIC_DIR%\releases"

echo.
echo  ╔═══════════════════════════════════╗
echo  ║   XIXERO RELEASE BUILDER         ║
echo  ╚═══════════════════════════════════╝
echo.

:: ─── Step 1: Read VERSION ───
echo [1/7] Reading version...
set /p VERSION=<"%XIXERO_DIR%VERSION"
:: Trim whitespace
for /f "tokens=* delims= " %%a in ("%VERSION%") do set "VERSION=%%a"
echo        Version: v%VERSION%

:: ─── Step 2: Confirm ───
echo.
echo  WARNING: This will build and publish v%VERSION%
echo  Binaries will be uploaded to jinkaka98.github.io/releases/
echo.
set /p CONFIRM="  Continue? (y/n): "
if /i not "%CONFIRM%"=="y" (
    echo  Cancelled.
    exit /b 0
)
echo.

:: ─── Step 3: Check Go ───
echo [2/7] Checking Go compiler...
where go >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Go not found. Install from https://go.dev
    exit /b 1
)
for /f "tokens=3" %%v in ('go version') do echo        %%v
echo.

:: ─── Step 4: Build all platforms ───
echo [3/7] Building binaries...

if not exist "%RELEASES_DIR%" mkdir "%RELEASES_DIR%"

:: Windows amd64
echo        Building windows/amd64...
set GOOS=windows
set GOARCH=amd64
set CGO_ENABLED=0
go build -ldflags "-s -w -X main.Version=%VERSION% -X main.Commit=local -X main.Date=%date:~6,4%-%date:~3,2%-%date:~0,2%" -o "%RELEASES_DIR%\xixero-windows-amd64.exe" .\cmd\xixero
if %errorlevel% neq 0 (
    echo  ERROR: Windows build failed!
    exit /b 1
)
echo        OK

:: Linux amd64
echo        Building linux/amd64...
set GOOS=linux
set GOARCH=amd64
go build -ldflags "-s -w -X main.Version=%VERSION% -X main.Commit=local -X main.Date=%date:~6,4%-%date:~3,2%-%date:~0,2%" -o "%RELEASES_DIR%\xixero-linux-amd64" .\cmd\xixero
if %errorlevel% neq 0 (
    echo  ERROR: Linux amd64 build failed!
    exit /b 1
)
echo        OK

:: Linux arm64
echo        Building linux/arm64...
set GOOS=linux
set GOARCH=arm64
go build -ldflags "-s -w -X main.Version=%VERSION% -X main.Commit=local -X main.Date=%date:~6,4%-%date:~3,2%-%date:~0,2%" -o "%RELEASES_DIR%\xixero-linux-arm64" .\cmd\xixero
if %errorlevel% neq 0 (
    echo  ERROR: Linux arm64 build failed!
    exit /b 1
)
echo        OK

:: macOS amd64
echo        Building darwin/amd64...
set GOOS=darwin
set GOARCH=amd64
go build -ldflags "-s -w -X main.Version=%VERSION% -X main.Commit=local -X main.Date=%date:~6,4%-%date:~3,2%-%date:~0,2%" -o "%RELEASES_DIR%\xixero-darwin-amd64" .\cmd\xixero
if %errorlevel% neq 0 (
    echo  ERROR: macOS amd64 build failed!
    exit /b 1
)
echo        OK

:: macOS arm64
echo        Building darwin/arm64...
set GOOS=darwin
set GOARCH=arm64
go build -ldflags "-s -w -X main.Version=%VERSION% -X main.Commit=local -X main.Date=%date:~6,4%-%date:~3,2%-%date:~0,2%" -o "%RELEASES_DIR%\xixero-darwin-arm64" .\cmd\xixero
if %errorlevel% neq 0 (
    echo  ERROR: macOS arm64 build failed!
    exit /b 1
)
echo        OK
echo.

:: ─── Step 5: Generate checksums ───
echo [4/7] Generating checksums...
cd /d "%RELEASES_DIR%"
(
    for %%f in (xixero-*) do (
        certutil -hashfile "%%f" SHA256 | findstr /v ":" | findstr /v "CertUtil"
        echo   %%f
    )
) > checksums.txt
echo        checksums.txt generated
echo.

:: ─── Step 6: Generate latest.json ───
echo [5/7] Generating release metadata...

:: Get file sizes
for %%f in (xixero-windows-amd64.exe) do set "SIZE_WIN=%%~zf"
for %%f in (xixero-linux-amd64) do set "SIZE_LIN=%%~zf"
for %%f in (xixero-darwin-amd64) do set "SIZE_MAC=%%~zf"

:: Write latest.json
(
echo {
echo   "version": "%VERSION%",
echo   "tag": "v%VERSION%",
echo   "date": "%date:~6,4%-%date:~3,2%-%date:~0,2%",
echo   "binaries": {
echo     "windows-amd64": {
echo       "file": "xixero-windows-amd64.exe",
echo       "url": "https://jinkaka98.github.io/releases/xixero-windows-amd64.exe",
echo       "size": %SIZE_WIN%
echo     },
echo     "linux-amd64": {
echo       "file": "xixero-linux-amd64",
echo       "url": "https://jinkaka98.github.io/releases/xixero-linux-amd64",
echo       "size": %SIZE_LIN%
echo     },
echo     "linux-arm64": {
echo       "file": "xixero-linux-arm64",
echo       "url": "https://jinkaka98.github.io/releases/xixero-linux-arm64"
echo     },
echo     "darwin-amd64": {
echo       "file": "xixero-darwin-amd64",
echo       "url": "https://jinkaka98.github.io/releases/xixero-darwin-amd64",
echo       "size": %SIZE_MAC%
echo     },
echo     "darwin-arm64": {
echo       "file": "xixero-darwin-arm64",
echo       "url": "https://jinkaka98.github.io/releases/xixero-darwin-arm64"
echo     }
echo   }
echo }
) > latest.json
echo        latest.json generated
echo.

:: ─── Step 7: Push to public repo ───
echo [6/7] Pushing to jinkaka98.github.io...
cd /d "%PUBLIC_DIR%"
git add releases\
git commit -m "release: v%VERSION% binaries"
if %errorlevel% neq 0 (
    echo        No changes to commit
) else (
    git push origin main
    if %errorlevel% neq 0 (
        echo  ERROR: Git push failed!
        exit /b 1
    )
)
echo        Pushed!
echo.

:: ─── Done ───
echo [7/7] Verifying...
echo.
echo  ╔═══════════════════════════════════════════╗
echo  ║                                           ║
echo  ║   RELEASE v%VERSION% PUBLISHED!               ║
echo  ║                                           ║
echo  ╚═══════════════════════════════════════════╝
echo.
echo  Files published:
echo    releases/xixero-windows-amd64.exe
echo    releases/xixero-linux-amd64
echo    releases/xixero-linux-arm64
echo    releases/xixero-darwin-amd64
echo    releases/xixero-darwin-arm64
echo    releases/checksums.txt
echo    releases/latest.json
echo.
echo  Download URL:
echo    https://jinkaka98.github.io/releases/xixero-windows-amd64.exe
echo.
echo  Install command:
echo    irm https://jinkaka98.github.io/install.ps1 ^| iex
echo.
pause
