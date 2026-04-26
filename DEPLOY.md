# Xixero - Release, Changelog & Deploy Guide

## Architecture Overview

```
xixero/ (PRIVATE repo - source code)
├── cmd/xixero/main.go       CLI entry point
├── internal/                 Go backend (server, proxy, license, config)
├── web-ui/                   Admin panel (React, dev mode only, NEVER public)
├── web-user/                 User web UI (Astro, embedded in Go binary)
├── installer/                Installer exe builder
├── VERSION                   Single source of truth for version
├── CHANGELOG.md              Required for every release
└── AGENTS.md                 Rules for AI agents

jinkaka98.github.io/ (PUBLIC repo - user-facing)
├── index.html                Landing page
├── style.css                 Landing page styles
├── app.js                    Landing page logic
├── install.ps1               PowerShell installer
├── releases/
│   ├── latest.json           Version info + changelog
│   └── xixero-setup.exe     Installer binary
└── ui/                       Built user web UI assets (loaded by Go server)
```

## Version Control

### VERSION file
- Location: `xixero/VERSION`
- Format: `MAJOR.MINOR.PATCH` (e.g., `1.0.3`)
- This is the ONLY place version is defined
- Changing this file = declaring a new release

### Semantic Versioning
- PATCH (1.0.3 → 1.0.4): Bug fixes
- MINOR (1.0.3 → 1.1.0): New features, backward compatible
- MAJOR (1.0.3 → 2.0.0): Breaking changes

### AI Agent Rules
- NEVER modify VERSION without explicit user confirmation
- ALWAYS update CHANGELOG.md BEFORE bumping VERSION
- Ask: "Changing VERSION from X to Y will trigger release. Confirm?"

## Changelog

### Format
File: `xixero/CHANGELOG.md`

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing features

### Fixed
- Bug fixes

### Removed
- Removed features
```

### Rules
1. Every version bump MUST have a CHANGELOG entry
2. Write changelog BEFORE bumping VERSION
3. Be specific - list actual changes, not vague descriptions
4. Group by Added/Changed/Fixed/Removed

### Changelog in latest.json
The `notes` field in `jinkaka98.github.io/releases/latest.json` must also contain
the changelog for the current version. This is displayed on the landing page.

## Release Process

### Prerequisites
- Go compiler installed
- Node.js installed (for web UI build)
- Both repos cloned locally:
  - `C:\Users\POWER-OF-MAGIC\Documents\GitHub\xixero`
  - `C:\Users\POWER-OF-MAGIC\Documents\GitHub\jinkaka98.github.io`

### Step-by-Step Release

#### 1. Make code changes
```bash
cd C:\Users\POWER-OF-MAGIC\Documents\GitHub\xixero
# ... edit code ...
```

#### 2. Test locally
```bash
# Build and test
go build -o bin\xixero.exe .\cmd\xixero
bin\xixero.exe version
bin\xixero.exe license XIXERO-TEST-KEY
bin\xixero.exe start
# Test in browser: http://localhost:7860
```

#### 3. Update CHANGELOG.md
Add new entry at the top with all changes.

#### 4. Bump VERSION
```bash
# Edit VERSION file to new version number
# e.g., 1.0.3 → 1.0.4
```

#### 5. Build user web UI (if changed)
```bash
cd web-user
npm run build
# Output goes to web-user/dist/
```

#### 6. Build installer
```bash
cd installer

# Build xixero.exe
set GOOS=windows
set GOARCH=amd64
set CGO_ENABLED=0
go build -ldflags "-s -w -X main.Version=X.Y.Z -X main.Commit=local -X main.Date=YYYY-MM-DD" -o xixero.exe ..\cmd\xixero

# Compress
powershell -Command "$b=[IO.File]::ReadAllBytes('xixero.exe');$m=New-Object IO.MemoryStream;$g=New-Object IO.Compression.GZipStream($m,[IO.Compression.CompressionMode]::Compress);$g.Write($b,0,$b.Length);$g.Close();[IO.File]::WriteAllBytes('xixero.exe.gz',$m.ToArray())"

# Build installer (GUI, no console window)
go build -ldflags "-s -w -H windowsgui -X main.Version=X.Y.Z" -o xixero-setup.exe .

# Cleanup
del xixero.exe xixero.exe.gz
```

Or use the automated script:
```bash
cd C:\Users\POWER-OF-MAGIC\Documents\GitHub\xixero
release.bat
```

#### 7. Copy to public repo
```bash
# Copy installer
copy installer\xixero-setup.exe ..\jinkaka98.github.io\releases\

# Copy web UI assets (if rebuilt)
xcopy /E /Y web-user\dist\* ..\jinkaka98.github.io\ui\
```

#### 8. Update latest.json
Edit `jinkaka98.github.io/releases/latest.json`:
```json
{
  "version": "X.Y.Z",
  "tag": "vX.Y.Z",
  "date": "YYYY-MM-DD",
  "notes": "vX.Y.Z\n\nAdded:\n- ...\n\nChanged:\n- ...\n\nFixed:\n- ...",
  "installer": {
    "file": "xixero-setup.exe",
    "url": "https://jinkaka98.github.io/releases/xixero-setup.exe",
    "size": <file_size_in_bytes>
  }
}
```

#### 9. Commit and push xixero (private)
```bash
cd C:\Users\POWER-OF-MAGIC\Documents\GitHub\xixero
git add -A
git commit -m "vX.Y.Z: <summary of changes>"
git push origin main
```

#### 10. Commit and push jinkaka98.github.io (public)
```bash
cd C:\Users\POWER-OF-MAGIC\Documents\GitHub\jinkaka98.github.io
git add -A
git commit -m "vX.Y.Z: <summary>"
git push origin main
```

#### 11. Verify
- Wait 1-2 min for GitHub Pages deploy
- Check: https://jinkaka98.github.io (landing page + changelog)
- Test: `irm https://jinkaka98.github.io/install.ps1 | iex`
- Test: `xixero update`

## Deploy Targets

### What goes WHERE

| File | Repo | Public? | Notes |
|------|------|---------|-------|
| Go source code | xixero | NO | Never exposed |
| Admin web UI (web-ui/) | xixero | NO | Dev mode only, localhost:5173/admin |
| User web UI (web-user/) | xixero (source) + jinkaka98 (built) | Built assets only | Embedded in Go binary OR loaded from GitHub Pages |
| Installer exe | jinkaka98 | YES | releases/xixero-setup.exe |
| Landing page | jinkaka98 | YES | index.html, style.css, app.js |
| install.ps1 | jinkaka98 | YES | PowerShell installer |
| latest.json | jinkaka98 | YES | Version + changelog + download URL |
| Firebase config | xixero | NO | Service account key NEVER committed |

### Admin Panel Access
Admin panel runs ONLY in local dev mode:
```bash
cd xixero/web-ui
npm run dev
# Open http://localhost:5173/admin
# Login: admin / admin123
```
Admin panel is NEVER deployed to public repos.

## Firebase

### Project
- ID: `ixero-95d56`
- Account: `federalcorp27@gmail.com`
- Firestore: Active (asia-southeast1)
- Rules: Allow read/write (test mode)

### Service Account Key
- Location: `C:\Users\POWER-OF-MAGIC\.firebase\serviceAccountKey.json`
- NEVER commit this file to any repo

### MCP (OpenCode)
Firebase MCP configured in `~/.config/opencode/opencode.json`
Tools: firestore_add_document, firestore_list_documents, etc.

### Firestore Collections
- `licenses` - License keys (key, name, expires_at, revoked, status, etc.)
- `admin` - Admin config
- `usage` - Usage tracking

### License Validation Flow
```
User: xixero license <KEY>
  → Go binary queries Firestore REST API
  → Firestore returns license data
  → Binary caches to license-cache.json (7 days)
  → Binary can work offline with cache

User: xixero start
  → Check license-cache.json
  → Valid? Start server
  → Invalid/missing? Block + show instructions
```

## CLI Commands

```
xixero                  Start gateway (= xixero start)
xixero start            Start gateway server
xixero license <KEY>    Activate license key
xixero license view     View current license info
xixero license remove   Remove license from machine
xixero stop             Stop running server
xixero status           Check server + license status
xixero update           Check and install updates
xixero uninstall        Remove from computer
xixero version          Show version info
xixero -h               Show all commands
```

## Install Folder
- Path: `%LOCALAPPDATA%\xixero1445\`
- Binary: `xixero.exe`
- Config: `config.json`
- License cache: `license-cache.json`
- Logs: `server.log`

## Current State (as of v1.0.3)

### Working
- CLI with all commands (start, license, stop, update, uninstall, status, version)
- Firebase Firestore license validation
- License cache (7 days offline)
- Go server serves HTML shell at localhost:7860
- HTML shell loads React UI from jinkaka98.github.io/ui/
- Auto-open browser on xixero start
- Silent logging (to file)
- One-click installer exe
- Landing page with changelog

### Known Issues / TODO
- Web UI user has bugs (auth page remnants, navigation issues)
- Need to rebuild web UI user as separate Astro project (web-user/)
- Web UI should be embedded in Go binary (go:embed) not loaded from GitHub Pages
- Admin panel works but only in dev mode (web-ui/ with npm run dev)
