$ErrorActionPreference = "Stop"

$repo = "jinkaka98/xixero"
$installDir = "$env:LOCALAPPDATA\xixero"

Write-Host ""
Write-Host "  Xixero Installer" -ForegroundColor Cyan
Write-Host "  =================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/4] Checking latest version..." -ForegroundColor Yellow
try {
    $release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest"
    $version = $release.tag_name
    Write-Host "       Latest: $version" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Could not reach GitHub API" -ForegroundColor Red
    exit 1
}

Write-Host "[2/4] Downloading binary..." -ForegroundColor Yellow
$asset = $release.assets | Where-Object { $_.name -like "*windows-amd64*" }
if (-not $asset) {
    Write-Host "ERROR: No Windows binary found in release" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Path $installDir -Force | Out-Null
$exePath = "$installDir\xixero.exe"
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $exePath
Write-Host "       Downloaded to $exePath" -ForegroundColor Green

Write-Host "[3/4] Configuring PATH..." -ForegroundColor Yellow
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$installDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$installDir", "User")
    Write-Host "       Added to PATH" -ForegroundColor Green
} else {
    Write-Host "       Already in PATH" -ForegroundColor Green
}

Write-Host "[4/4] Generating config..." -ForegroundColor Yellow
& $exePath version 2>$null | Out-Null
Write-Host "       Done" -ForegroundColor Green

Write-Host ""
Write-Host "  Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Location: $installDir" -ForegroundColor White
Write-Host "  Version:  $version" -ForegroundColor White
Write-Host ""
Write-Host "  Quick Start:" -ForegroundColor Cyan
Write-Host "    1. Open a NEW terminal (to refresh PATH)"
Write-Host "    2. Run: xixero start"
Write-Host "    3. Browser will open automatically"
Write-Host ""
