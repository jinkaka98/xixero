# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-04-24T12:29:06.567Z
> Files: 75 tracked | Anatomy hits: 0 | Misses: 0

## ./

- `.gitignore` — Git ignore rules (~34 tok)
- `.goreleaser.yml` (~244 tok)
- `ADMIN-PLAN.md` — Xixero - Admin & License System Architecture (~4959 tok)
- `CLAUDE.md` — OpenWolf (~57 tok)
- `DEVELOPMENT.md` — Xixero - Development & Admin Architecture (~5620 tok)
- `go.mod` — Go module definition (~117 tok)
- `go.sum` — Go dependency checksums (~787 tok)
- `Makefile` — Make build targets (~136 tok)
- `PLANNER.md` — Xixero - Local AI Gateway Proxy (~6516 tok)
- `SECURITY.md` — Xixero - Security & Performance Architecture (~7394 tok)
- `start.bat` (~631 tok)
- `xixero-start.err.log` (~189 tok)
- `xixero-start.out.log` (~12 tok)

## .claude/

- `settings.json` (~441 tok)

## .claude/rules/

- `openwolf.md` (~313 tok)

## .github/workflows/

- `build.yml` — CI: Build & Test (~208 tok)
- `deploy-ui.yml` — CI: Deploy Web UI (~159 tok)
- `release.yml` — CI: Release (~136 tok)

## cmd/xixero/

- `main.go` (~3132 tok)

## docs/

- `.gitkeep` (~0 tok)

## internal/admin/

- `server.go` — HTTP handlers: writeJSON (~1698 tok)

## internal/api/

- `.gitkeep` (~0 tok)
- `handlers.go` — HTTP handlers: writeJSON (~3105 tok)

## internal/config/

- `config.go` — Config (64 fields); methods: Save (~980 tok)

## internal/license/

- `.gitkeep` (~0 tok)
- `enforcer.go` — Enforcer (51 fields); methods: IsValid, IsCacheExpired, Activate, StartPeriodicCheck (~1055 tok)
- `license.go` — Client (23 fields); methods: Validate (~399 tok)

## internal/models/

- `models.go` — ChatRequest (41 fields) (~563 tok)

## internal/provider/

- `.gitkeep` (~0 tok)
- `enowx.go` — EnowXProvider (12 fields); methods: TransformRequest, TransformResponse, TransformStreamChunk, TestConnection (~298 tok)
- `openai.go` — OpenAIProvider (13 fields); methods: TransformRequest, TransformResponse, TransformStreamChunk, TestConnection (~301 tok)
- `provider.go` — Interface: Provider (19 methods) (~738 tok)
- `registry.go` — Registry (35 fields); methods: Register, SetRules, ListRules, Resolve (~1043 tok)
- `trae.go` — TraeProvider (13 fields); methods: TransformRequest, TransformResponse, TransformStreamChunk, TestConnection (~296 tok)

## internal/proxy/

- `.gitkeep` (~0 tok)
- `proxy_test.go` — TestInjectRoutingMetadata, TestInjectRoutingMetadataReturnsOriginalPayloadWhenInvalidJSON (~544 tok)
- `proxy.go` — HTTP handlers: writeError (~1288 tok)

## internal/server/

- `middleware.go` — responseWriter (12 fields); methods: WriteHeader (~807 tok)
- `ratelimit.go` — rateLimiter (32 fields) (~594 tok)
- `server.go` — HTTP handlers: writeJSON (~1160 tok)

## internal/store/

- `license_store.go` — License (59 fields); methods: CreateLicense, GetLicense, ValidateLicense, RevokeLicense (~1121 tok)
- `store.go` — Store (13 fields); methods: Close (~267 tok)
- `usage_store.go` — UsageRecord (34 fields); methods: RecordUsage, GetUsage, GetTotalUsageToday, GetAdminCredentials (~782 tok)

## internal/tunnel/

- `cloudflare.go` — Tunnel (53 fields); methods: Stop, IsRunning (~1209 tok)
- `github_sync.go` — GitHubSync (30 fields); methods: PushTunnelURL, SetOffline (~968 tok)

## internal/update/

- `.gitkeep` (~0 tok)
- `update.go` — Updater (68 fields); methods: Check, Apply, Rollback (~1183 tok)

## pkg/logger/

- `.gitkeep` (~0 tok)

## pkg/utils/

- `.gitkeep` (~0 tok)
- `crypto.go` — Encrypt, Decrypt, IsEncrypted (~786 tok)

## scripts/

- `.gitkeep` (~0 tok)
- `install.ps1` (~550 tok)

## web-ui/

- `.gitignore` — Git ignore rules (~68 tok)
- `eslint.config.js` — ESLint flat configuration (~163 tok)
- `index.html` — web-ui (~96 tok)
- `package-lock.json` — npm lock file (~27585 tok)
- `package.json` — Node.js package manifest (~201 tok)
- `README.md` — Project documentation (~257 tok)
- `vite.config.js` — Vite build configuration (~59 tok)

## web-ui/src/

- `App.jsx` — ProtectedRoute — uses useState (~582 tok)
- `index.css` — Styles: 2 rules (~49 tok)
- `main.jsx` (~66 tok)

## web-ui/src/admin/components/

- `AdminLayout.jsx` — AdminLayout (~457 tok)

## web-ui/src/admin/lib/

- `adminApi.js` — Exports adminApi (~498 tok)

## web-ui/src/admin/pages/

- `AdminDashboard.jsx` — AdminDashboard — uses useState, useEffect (~497 tok)
- `AdminLicenses.jsx` — AdminLicenses — renders table — uses useState, useEffect (~2113 tok)
- `AdminLogin.jsx` — AdminLogin — renders form — uses useState (~701 tok)

## web-ui/src/components/

- `Layout.jsx` — Layout (~490 tok)

## web-ui/src/hooks/

- `useAuth.jsx` — AuthContext — uses useState, useEffect, useContext (~290 tok)

## web-ui/src/lib/

- `api.js` — Exports api (~737 tok)

## web-ui/src/pages/

- `Chat.jsx` — Chat — uses useState, useEffect, useMemo (~2856 tok)
- `Dashboard.jsx` — Dashboard — uses useState, useEffect (~861 tok)
- `Providers.jsx` — Providers — uses useState, useEffect (~2098 tok)
- `Routing.jsx` — Routing — uses useState, useEffect, useMemo (~3647 tok)
- `TokenInput.jsx` — TokenInput — renders form — uses useState, useNavigate (~661 tok)
