# Xixero — Agent Instructions

## CRITICAL: Version Control

**The `VERSION` file is a release trigger. Modifying it causes a public release.**

### Before modifying `VERSION`:
1. STOP and ASK the user for confirmation
2. State: "Changing VERSION from X.X.X to Y.Y.Y will trigger a public release. Confirm?"
3. Only proceed after explicit approval
4. This rule applies to ALL agents, ALL tools, ALL contexts — no exceptions

### CHANGELOG is MANDATORY
- Every version bump MUST have a matching entry in `CHANGELOG.md`
- Update CHANGELOG.md BEFORE changing VERSION
- Format: `## [X.Y.Z] - YYYY-MM-DD` with Added/Changed/Fixed sections
- If no CHANGELOG entry exists for the new version, DO NOT bump VERSION

### Release Process (LOCAL ONLY)
1. Make code changes
2. Test locally (`go run ./cmd/xixero start`)
3. Update CHANGELOG.md with new version entry
4. Ask user for confirmation to release
5. Update VERSION file
6. Run `release.bat` to build + push binaries to jinkaka98.github.io
7. Source code (xixero repo) stays PRIVATE, only binaries go public

### Semantic Versioning
- PATCH (1.0.0 → 1.0.1): Bug fixes only
- MINOR (1.0.0 → 1.1.0): New features, backward compatible
- MAJOR (1.0.0 → 2.0.0): Breaking changes

---

## Project Overview

Xixero is a local AI gateway that proxies OpenAI-compatible requests to multiple AI providers.

### Tech Stack
- **Backend**: Go 1.26, gorilla/mux, cobra, bbolt, zerolog
- **Frontend**: React 19, Vite 8, Tailwind CSS 4, react-router-dom 7
- **CI/CD**: GitHub Actions, GoReleaser
- **Hosting**: GitHub Pages (landing page), GitHub Releases (binaries)

### Key Directories
- `cmd/xixero/main.go` — CLI entry point
- `internal/server/` — User proxy server (port 7860)
- `internal/admin/` — Admin server (port 7861)
- `internal/proxy/` — Reverse proxy core
- `internal/provider/` — Provider adapters (OpenAI, enowX, Trae)
- `internal/store/` — BoltDB persistence
- `internal/license/` — License enforcement
- `internal/tunnel/` — Cloudflare tunnel + GitHub sync
- `web-ui/src/` — React SPA
- `web-ui/src/admin/` — Admin panel (NOT deployed to GitHub Pages)

### API Endpoints
- User: `localhost:7860` — Proxy + management API
- Admin: `localhost:7861` — License CRUD + dashboard

### Design System
- User theme: Cyan/purple cyberpunk (Orbitron + monospace)
- Admin theme: Orange/red cyberpunk (Orbitron + monospace)
- Background: Animated grid, glass-morphism, glow effects
