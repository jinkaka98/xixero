@echo off
setlocal
title Xixero Installer Builder
cd /d "%~dp0\.."

echo.
echo  Building Xixero Installer
echo  =========================
echo.

:: Read version
set /p VERSION=<VERSION
for /f "tokens=* delims= " %%a in ("%VERSION%") do set "VERSION=%%a"
echo  Version: v%VERSION%

:: Step 1: Build xixero.exe
echo.
echo  [1/3] Building xixero.exe...
set GOOS=windows
set GOARCH=amd64
set CGO_ENABLED=0
go build -ldflags "-s -w -X main.Version=%VERSION% -X main.Commit=local -X main.Date=%date:~6,4%-%date:~3,2%-%date:~0,2%" -o installer\xixero.exe .\cmd\xixero
if %errorlevel% neq 0 (
    echo  ERROR: Build failed!
    pause
    exit /b 1
)
echo  OK

:: Step 2: Gzip compress
echo  [2/3] Compressing binary...
powershell -NoProfile -Command "$in = [System.IO.File]::ReadAllBytes('installer\xixero.exe'); $ms = New-Object System.IO.MemoryStream; $gz = New-Object System.IO.Compression.GZipStream($ms, [System.IO.Compression.CompressionMode]::Compress); $gz.Write($in, 0, $in.Length); $gz.Close(); [System.IO.File]::WriteAllBytes('installer\xixero.exe.gz', $ms.ToArray()); Write-Host ('  Compressed: ' + [math]::Round($in.Length/1MB,1) + 'MB -> ' + [math]::Round($ms.Length/1MB,1) + 'MB')"
if %errorlevel% neq 0 (
    echo  ERROR: Compression failed!
    pause
    exit /b 1
)

:: Step 3: Build installer
echo  [3/3] Building installer exe...
cd installer
go build -ldflags "-s -w -X main.Version=%VERSION%" -o xixero-setup.exe .
if %errorlevel% neq 0 (
    echo  ERROR: Installer build failed!
    pause
    exit /b 1
)
cd ..

:: Cleanup temp files
del installer\xixero.exe 2>nul
del installer\xixero.exe.gz 2>nul

:: Show result
echo.
echo  =========================================
echo   BUILD COMPLETE
echo  =========================================
echo.
for %%f in (installer\xixero-setup.exe) do echo  Output: installer\xixero-setup.exe (%%~zf bytes)
echo.

pause
