# Changelog

All notable changes to Xixero will be documented in this file.

Format: [Semantic Versioning](https://semver.org/)

**RULE: Every version bump in `VERSION` MUST have a corresponding entry here.**

---

## [1.0.3] - 2026-04-26

### Added
- New CLI commands: `xixero license <KEY>`, `xixero stop`, `xixero status`
- Running `xixero` without subcommand now starts the server (same as `xixero start`)
- Firebase Firestore license validation (replaces admin server + tunnel)
- One-click installer exe (xixero-setup.exe) - no terminal needed
- API token auto-injected into web UI by Go server
- Silent logging (all logs to file, clean terminal)

### Changed
- License activation moved to terminal only (`xixero license <KEY>`)
- Web UI no longer has login/auth page - opens directly to dashboard
- Server blocked from starting without valid license
- Banner shows Discord contact (@xixero1445) for license keys
- Installer runs hidden, auto-starts server, auto-opens browser

### Removed
- Auth/login page from web UI (TokenInput, useAuth)
- Disconnect button from sidebar
- Admin server dependency (port 7861)
- Cloudflare tunnel requirement
- BoltDB local database dependency

---

## [1.0.2] - 2026-04-26

### Added
- One-click installer exe with embedded binary
- Firebase Firestore integration for license validation
- Silent logging to file

### Changed
- Install via single exe instead of PowerShell script
- License validation via Firebase REST API

---

## [1.0.1] - 2026-04-26

### Added
- Auto-open browser when `xixero start` runs
- HTML shell at localhost:7860 that loads UI from GitHub Pages
- PATH conflict detection in installer

### Changed
- Install folder renamed from `xixero` to `xixero1445` (avoid conflicts)
- Installer uses pure ASCII (no unicode box characters)
- Download page shows Windows only (single direct download button)

### Fixed
- PowerShell installer encoding issues (garbled characters)
- Old `xixero.bat` (Python) overriding new Go binary in PATH

---

## [1.0.0] - 2026-04-26

### Added
- Initial release
- Multi-provider AI proxy (OpenAI, enowX, Trae)
- OpenAI-compatible API endpoint at localhost:7860
- SSE streaming support
- Priority-based routing rules engine
- License management system with offline caching
- Admin panel (Dashboard, License CRUD)
- Web UI with cyberpunk theme (user: cyan, admin: orange)
- AES-256-GCM encrypted API keys (machine-bound)
- Auto-update from GitHub Releases
- PowerShell installer
- Landing page at jinkaka98.github.io
