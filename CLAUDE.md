# Xixero - Project Rules

## VERSION CONTROL — CRITICAL RULE

The file `VERSION` in the project root is the **single source of truth** for the release version.

### Rules for ALL AI agents:

1. **NEVER modify the `VERSION` file without explicit user confirmation.**
2. Before changing `VERSION`, you MUST:
   - Ask the user: "Do you want to bump the version from X.X.X to Y.Y.Y?"
   - Wait for explicit "yes" or approval
   - Only then write to the `VERSION` file
3. Changing `VERSION` triggers an **automatic GitHub Release** that:
   - Creates a git tag `vX.X.X`
   - Builds binaries for Windows, Linux, macOS
   - Publishes to GitHub Releases
   - Makes binaries available for user download
4. This is **irreversible** — once released, a version cannot be re-used.
5. Follow semantic versioning:
   - `MAJOR.MINOR.PATCH` (e.g., `1.0.0`)
   - PATCH: bug fixes (1.0.0 → 1.0.1)
   - MINOR: new features, backward compatible (1.0.0 → 1.1.0)
   - MAJOR: breaking changes (1.0.0 → 2.0.0)

### Current version: Read from `VERSION` file.

---

## Project Structure

- `cmd/xixero/` — CLI entry point (cobra commands)
- `internal/` — Core business logic (server, proxy, admin, license, store)
- `pkg/` — Shared utilities (crypto)
- `web-ui/` — React frontend (Vite + Tailwind CSS)
- `scripts/` — Install scripts
- `.github/workflows/` — CI/CD (release, deploy-ui, build)

## Architecture

- **User server** (port 7860): AI proxy gateway
- **Admin server** (port 7861): License management
- **Web UI** (port 5173): React SPA (user + admin)
- **GitHub Pages** (jinkaka98.github.io): Public landing page

## OpenWolf

@.wolf/OPENWOLF.md

This project uses OpenWolf for context management. Read and follow .wolf/OPENWOLF.md every session. Check .wolf/cerebrum.md before generating code. Check .wolf/anatomy.md before reading files.
