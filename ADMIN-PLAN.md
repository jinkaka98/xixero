# Xixero - Admin & License System Architecture

## Overview

Sistem admin & license Xixero menggunakan **zero-cost infrastructure** dengan memanfaatkan:
- **trycloudflare tunnel** sebagai server gratis (admin & user)
- **GitHub repo** sebagai "service discovery" untuk admin tunnel URL
- **BoltDB** sebagai local database untuk license storage
- **Crypto-signed tokens** untuk offline validation cache

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ADMIN MACHINE                                │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Xixero Admin Mode                                           │   │
│  │  Command: xixero admin start                                 │   │
│  │                                                               │   │
│  │  ┌─────────────┐   ┌──────────────┐   ┌────────────────┐   │   │
│  │  │ Admin API    │   │ BoltDB       │   │ Tunnel Manager │   │   │
│  │  │ /admin/*     │   │ licenses.db  │   │ trycloudflare  │   │   │
│  │  │              │   │              │   │                │   │   │
│  │  │ - Generate   │   │ - Licenses   │   │ Auto-start     │   │   │
│  │  │   license    │   │ - Users      │   │ tunnel on boot │   │   │
│  │  │ - Revoke     │   │ - Usage logs │   │                │   │   │
│  │  │ - List users │   │              │   │ Get random URL │   │   │
│  │  │ - Dashboard  │   │              │   │ abc.tryclf.com │   │   │
│  │  └──────┬───────┘   └──────────────┘   └───────┬────────┘   │   │
│  │         │                                       │             │   │
│  │         │              ┌────────────────────────┘             │   │
│  │         │              │                                      │   │
│  │         │              ▼                                      │   │
│  │         │   ┌──────────────────────┐                         │   │
│  │         │   │ GitHub Sync          │                         │   │
│  │         │   │                      │                         │   │
│  │         │   │ Push tunnel URL to:  │                         │   │
│  │         │   │ jinkaka98/xixero     │                         │   │
│  │         │   │ /tunnel-config.json  │                         │   │
│  │         │   └──────────────────────┘                         │   │
│  │         │                                                     │   │
│  │         ▼                                                     │   │
│  │  ┌──────────────────────┐                                    │   │
│  │  │ Admin Web UI         │                                    │   │
│  │  │ localhost:7861/admin │                                    │   │
│  │  │                      │                                    │   │
│  │  │ - Dashboard          │                                    │   │
│  │  │ - License Manager    │                                    │   │
│  │  │ - User Monitor       │                                    │   │
│  │  │ - Tunnel Status      │                                    │   │
│  │  └──────────────────────┘                                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ GitHub (public repo)
                                    │ tunnel-config.json
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    GITHUB REPO (jinkaka98/xixero)                    │
│                                                                       │
│  tunnel-config.json:                                                 │
│  {                                                                    │
│    "admin_tunnel_url": "https://abc-random.trycloudflare.com",      │
│    "updated_at": "2026-04-23T10:00:00Z",                            │
│    "status": "online"                                                │
│  }                                                                    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ User fetch tunnel URL
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         USER MACHINE                                 │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Xixero User Mode                                            │   │
│  │  Command: xixero start                                       │   │
│  │                                                               │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │  Startup Sequence                                     │   │   │
│  │  │                                                        │   │   │
│  │  │  1. Load config                                       │   │   │
│  │  │  2. Check license cache                               │   │   │
│  │  │     ├─ Cache valid & not expired → SKIP validation    │   │   │
│  │  │     └─ No cache / expired → MUST validate online      │   │   │
│  │  │  3. Fetch tunnel-config.json from GitHub              │   │   │
│  │  │  4. Get admin tunnel URL                              │   │   │
│  │  │  5. Send license key to admin tunnel                  │   │   │
│  │  │     POST https://abc.tryclf.com/api/license/validate  │   │   │
│  │  │  6. Admin validates → returns signed token            │   │   │
│  │  │  7. Cache signed token locally                        │   │   │
│  │  │  8. Start proxy server (UNLOCKED)                     │   │   │
│  │  │                                                        │   │   │
│  │  │  If admin offline:                                    │   │   │
│  │  │  - Has valid cache → proxy works (until cache expire) │   │   │
│  │  │  - No cache → BLOCKED, show error                     │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  │                                                               │   │
│  │  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐   │   │
│  │  │ Proxy Server │   │ License      │   │ User Tunnel    │   │   │
│  │  │ localhost:   │   │ Enforcer     │   │ (optional)     │   │   │
│  │  │ 7860         │   │              │   │ trycloudflare  │   │   │
│  │  │              │   │ Check every  │   │                │   │   │
│  │  │ BLOCKED if   │   │ request:     │   │ For remote     │   │   │
│  │  │ no valid     │   │ license OK?  │   │ IDE access     │   │   │
│  │  │ license      │   │              │   │                │   │   │
│  │  └──────────────┘   └──────────────┘   └────────────────┘   │   │
│  │                                                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## User Journey

### First Time User

```
1. User install xixero via PowerShell
   irm https://raw.githubusercontent.com/jinkaka98/xixero/main/scripts/install.ps1 | iex

2. User jalankan: xixero start
   Console output:
   ┌─────────────────────────────────────────────┐
   │  Xixero - Local AI Gateway                   │
   │                                               │
   │  ⚠️  License Required                        │
   │                                               │
   │  Enter your license key:                     │
   │  > XIXERO-XXXXX-XXXXX-XXXXX-XXXXX           │
   │                                               │
   │  Validating...                                │
   │  ✅ License valid! Expires: 2027-04-23       │
   │                                               │
   │  🚀 Server running on http://localhost:7860  │
   │  🔑 API Token: abc123...                     │
   └─────────────────────────────────────────────┘

3. Kalau admin OFFLINE dan user belum punya cache:
   ┌─────────────────────────────────────────────┐
   │  ❌ Cannot validate license                  │
   │  Admin server is offline.                    │
   │  Please try again later.                     │
   └─────────────────────────────────────────────┘

4. Kalau license INVALID:
   ┌─────────────────────────────────────────────┐
   │  ❌ Invalid license key                      │
   │  Contact admin for a valid license.          │
   └─────────────────────────────────────────────┘
```

### Returning User (Cache Valid)

```
1. User jalankan: xixero start
2. Xixero check cache → valid, not expired
3. Skip online validation
4. Server starts immediately
5. Background: periodic re-validation (every 7 days)
```

### License Expired / Revoked

```
1. User jalankan: xixero start
2. Cache expired → try online validation
3. Admin server responds: license revoked
4. Proxy BLOCKED
5. User harus contact admin untuk license baru
```

---

## Admin Journey

### First Time Admin Setup

```
1. Admin (Bos) clone repo, build xixero
2. Admin jalankan: xixero admin init
   - Generate admin credentials (username/password)
   - Create BoltDB database
   - Generate admin secret key (for signing license tokens)
   - Save to %LOCALAPPDATA%\xixero\admin.json

3. Admin jalankan: xixero admin start
   Console output:
   ┌─────────────────────────────────────────────────┐
   │  Xixero Admin Panel                              │
   │                                                   │
   │  ✅ Admin API running on http://localhost:7861   │
   │  🌐 Tunnel: https://abc-xyz.trycloudflare.com   │
   │  📡 GitHub sync: tunnel URL pushed               │
   │                                                   │
   │  Admin UI: http://localhost:7861/admin            │
   │  Username: admin                                  │
   │  Password: (set during init)                      │
   │                                                   │
   │  Press Ctrl+C to stop                             │
   └─────────────────────────────────────────────────┘
```

### Generate License Key

```
Via CLI:
  xixero admin generate-license --name "User A" --expires 365d
  Output: XIXERO-A8K2M-F9X3N-P4Q7R-B2C5D

Via Web UI:
  http://localhost:7861/admin → License Manager → Generate
```

### Revoke License

```
Via CLI:
  xixero admin revoke-license XIXERO-A8K2M-F9X3N-P4Q7R-B2C5D

Via Web UI:
  http://localhost:7861/admin → License Manager → Revoke
```

---

## Technical Implementation

### Phase 8: BoltDB + License Storage

**New files:**
```
internal/
├── store/
│   ├── store.go          # BoltDB wrapper
│   ├── license_store.go  # License CRUD
│   └── usage_store.go    # Usage tracking
```

**BoltDB Buckets:**
```
licenses:
  key: "XIXERO-A8K2M-..."
  value: {
    "key": "XIXERO-A8K2M-...",
    "name": "User A",
    "created_at": "2026-04-23T10:00:00Z",
    "expires_at": "2027-04-23T10:00:00Z",
    "revoked": false,
    "last_validated": "2026-04-23T10:00:00Z",
    "machine_id": "abc123"
  }

usage:
  key: "XIXERO-A8K2M-...:2026-04-23"
  value: {
    "license_key": "XIXERO-A8K2M-...",
    "date": "2026-04-23",
    "requests": 142,
    "last_request": "2026-04-23T15:30:00Z"
  }

admin:
  key: "credentials"
  value: {
    "username": "admin",
    "password_hash": "bcrypt:...",
    "secret_key": "base64:..."  // For signing license tokens
  }
```

### Phase 9: Tunnel Integration

**New files:**
```
internal/
├── tunnel/
│   ├── cloudflare.go     # trycloudflare tunnel manager
│   └── github_sync.go    # Push tunnel URL to GitHub
```

**trycloudflare Integration:**
```go
// Start tunnel menggunakan cloudflared binary
// Download cloudflared jika belum ada
// Run: cloudflared tunnel --url http://localhost:7861
// Parse output untuk dapat tunnel URL
// Return URL: https://abc-random.trycloudflare.com
```

**GitHub Sync:**
```go
// Push tunnel URL ke GitHub repo
// File: tunnel-config.json di root repo
// Menggunakan GitHub API + personal access token
// Admin set token saat xixero admin init
//
// tunnel-config.json:
// {
//   "admin_tunnel_url": "https://abc.trycloudflare.com",
//   "updated_at": "2026-04-23T10:00:00Z",
//   "status": "online"
// }
```

**User Side - Fetch Admin URL:**
```go
// Fetch tunnel-config.json dari GitHub raw URL
// https://raw.githubusercontent.com/jinkaka98/xixero/main/tunnel-config.json
// Parse JSON, get admin_tunnel_url
// Use URL untuk license validation
```

### Phase 10: Admin API & UI

**Admin API Endpoints (port 7861):**
```
POST   /admin/auth/login          # Admin login → JWT token
GET    /admin/api/dashboard       # Stats overview
GET    /admin/api/licenses        # List all licenses
POST   /admin/api/licenses        # Generate new license
DELETE /admin/api/licenses/{key}  # Revoke license
GET    /admin/api/users           # List active users (by license)
GET    /admin/api/usage           # Usage statistics
GET    /admin/api/tunnel          # Tunnel status

# License validation (exposed via tunnel)
POST   /api/license/validate      # User sends license key → get signed token
```

**Admin CLI Commands:**
```
xixero admin init                              # First-time setup
xixero admin start                             # Start admin server + tunnel
xixero admin generate-license --name "X" --expires 365d
xixero admin revoke-license XIXERO-XXXXX
xixero admin list-licenses
xixero admin list-users
```

**Admin Web UI Pages (React):**
```
/admin/login        # Admin login form
/admin              # Dashboard (total users, active licenses, requests today)
/admin/licenses     # License table: key, name, status, expires, actions
/admin/users        # User list: license, last seen, requests, machine
/admin/tunnel       # Tunnel status: URL, uptime, connected users
```

### Phase 11: License Enforcement in Proxy

**Enforcement Flow:**
```go
// Di proxy middleware, SEBELUM forward request:
func (s *Server) licenseMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // 1. Check license cache
        if !s.licenseValid() {
            writeJSON(w, 403, map[string]string{
                "error": "license required",
                "message": "Please activate your license. Run: xixero activate",
            })
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

**License Cache Structure:**
```json
// %LOCALAPPDATA%\xixero\license-cache.json
{
  "license_key": "XIXERO-A8K2M-...",
  "signed_token": "eyJhbGciOiJSUzI1NiIs...",
  "validated_at": "2026-04-23T10:00:00Z",
  "expires_at": "2027-04-23T00:00:00Z",
  "cache_expires_at": "2026-04-30T10:00:00Z",
  "features": ["proxy", "streaming", "multi_provider"]
}
```

**Signed Token (JWT):**
```
Header: { "alg": "RS256" }
Payload: {
  "license_key": "XIXERO-A8K2M-...",
  "name": "User A",
  "expires_at": "2027-04-23T00:00:00Z",
  "features": ["proxy", "streaming"],
  "machine_id": "abc123",
  "issued_at": "2026-04-23T10:00:00Z"
}
Signature: signed with admin's RSA private key
```

User verify token menggunakan admin's RSA public key (embedded di binary atau fetched dari GitHub).

---

## License Key Format

```
Format: XIXERO-XXXXX-XXXXX-XXXXX-XXXXX
        prefix  seg1   seg2   seg3   checksum

Segments: 5 chars each, Base32 (A-Z, 2-7)
Checksum: CRC32 of seg1+seg2+seg3, encoded Base32, first 5 chars

Generation:
  1. Generate 15 random bytes
  2. Encode Base32 → 24 chars
  3. Split into 3 segments of 5 chars
  4. Compute CRC32 checksum
  5. Format: XIXERO-{seg1}-{seg2}-{seg3}-{checksum}

Example: XIXERO-A8K2M-F9X3N-P4Q7R-B2C5D
```

---

## Security Model

### License Token Chain of Trust

```
Admin generates RSA key pair (during xixero admin init)
  ├── Private key: stored in admin's BoltDB (never leaves admin machine)
  └── Public key: embedded in xixero binary OR fetched from GitHub

Admin signs license token with private key
User verifies token with public key
  → If valid: proxy UNLOCKED
  → If invalid/expired: proxy BLOCKED
```

### Anti-Tampering

1. **License cache is signed JWT** — user can't modify expiry/features
2. **Machine binding** — license tied to machine ID, can't copy to another machine
3. **Cache expiry** — even valid licenses must re-validate periodically (7 days)
4. **Revocation** — admin revokes → next re-validation fails → proxy blocked

### Admin Authentication

```
Admin login: username + password (bcrypt hashed)
Admin API: JWT session token (expires 24h)
Admin tunnel: only exposes /api/license/validate (not admin panel)
Admin panel: only accessible on localhost:7861 (not via tunnel)
```

---

## Dependency Requirements

### Admin Side
- **cloudflared** binary (auto-download on first run)
- **GitHub Personal Access Token** (for pushing tunnel-config.json)
- **BoltDB** (embedded, no external DB)

### User Side
- **No additional dependencies** (all built into xixero binary)
- Fetch tunnel URL from GitHub (public, no auth needed)
- Validate license via admin tunnel (HTTPS)

---

## Config Changes

### Admin Config: %LOCALAPPDATA%\xixero\admin.json
```json
{
  "admin": {
    "username": "admin",
    "password_hash": "$2a$10$...",
    "secret_key_path": "admin-keys/",
    "port": 7861
  },
  "tunnel": {
    "enabled": true,
    "github_token": "ghp_xxxx",
    "github_repo": "jinkaka98/xixero",
    "config_file": "tunnel-config.json"
  },
  "database": {
    "path": "xixero-admin.db"
  }
}
```

### User Config Addition: %LOCALAPPDATA%\xixero\config.json
```json
{
  "license": {
    "key": "XIXERO-A8K2M-F9X3N-P4Q7R-B2C5D",
    "cache_path": "license-cache.json",
    "validation_url_source": "https://raw.githubusercontent.com/jinkaka98/xixero/main/tunnel-config.json",
    "revalidation_interval_days": 7
  }
}
```

---

## Implementation Phases

### Phase 8: BoltDB + License Storage
- [ ] Install BoltDB dependency
- [ ] Create store package (store.go, license_store.go, usage_store.go)
- [ ] License CRUD operations
- [ ] License key generation (format + crypto)
- [ ] Admin config structure
- [ ] `go build` passes

### Phase 9: Tunnel Integration
- [ ] Cloudflared auto-download
- [ ] Tunnel start/stop manager
- [ ] Parse tunnel URL from cloudflared output
- [ ] GitHub sync (push tunnel-config.json)
- [ ] User-side: fetch tunnel URL from GitHub
- [ ] `go build` passes

### Phase 10: Admin API & CLI
- [ ] Admin init command (generate credentials + RSA keys)
- [ ] Admin start command (server + tunnel + GitHub sync)
- [ ] Admin generate-license command
- [ ] Admin revoke-license command
- [ ] Admin list-licenses command
- [ ] Admin API endpoints (REST)
- [ ] Admin Web UI (React pages at /admin/*)
- [ ] `go build` passes

### Phase 11: License Enforcement
- [ ] License middleware in proxy
- [ ] Startup license check (validate or use cache)
- [ ] CLI: xixero activate (input license key)
- [ ] Periodic re-validation (background goroutine)
- [ ] Blocked state UI (show "license required" in web UI)
- [ ] `go build` passes

### Phase 12: Testing & Polish
- [ ] End-to-end test: admin generate → user activate → proxy works
- [ ] Test: admin offline + user has cache → proxy works
- [ ] Test: admin revoke → user re-validate → proxy blocked
- [ ] Test: license expired → proxy blocked
- [ ] Error messages clear and helpful

---

**Document Version:** 1.0.0
**Last Updated:** 2026-04-23
**Next:** Implement Phase 8 (BoltDB + License Storage)
