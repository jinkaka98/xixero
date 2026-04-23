# Xixero - Development & Admin Architecture

## 📋 Document Purpose

Dokumen ini menjelaskan **workflow development**, **build process**, **testing strategy**, dan **deployment pipeline** untuk developer dan admin yang maintain project Xixero.

---

## 👥 Target Audience

- **Core Developers**: Yang develop fitur baru
- **Contributors**: Yang submit PR
- **DevOps/Admin**: Yang manage release & deployment
- **Maintainers**: Yang review code & merge PR

---

## 🏗️ Project Structure (Repository Layout)

```
xixero/
├── .github/
│   ├── workflows/
│   │   ├── build.yml           # Build & test on PR
│   │   ├── release.yml         # Auto-release on tag
│   │   └── deploy-ui.yml       # Deploy web UI to GitHub Pages
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
│
├── cmd/
│   └── xixero/
│       └── main.go             # Entry point
│
├── internal/
│   ├── server/
│   │   ├── server.go           # HTTP server setup
│   │   ├── routes.go           # Route registration
│   │   └── middleware.go       # Auth, CORS, logging
│   │
│   ├── proxy/
│   │   ├── proxy.go            # Reverse proxy core
│   │   ├── transformer.go      # Request/response transform
│   │   └── streamer.go         # SSE streaming handler
│   │
│   ├── provider/
│   │   ├── provider.go         # Provider interface
│   │   ├── registry.go         # Provider registry
│   │   ├── enowx.go            # enowX AI adapter
│   │   ├── openai.go           # OpenAI adapter
│   │   └── anthropic.go        # Anthropic adapter
│   │
│   ├── config/
│   │   ├── config.go           # Config loader/saver
│   │   ├── schema.go           # Config validation
│   │   └── migration.go        # Config version migration
│   │
│   ├── license/
│   │   ├── license.go          # License validation
│   │   ├── crypto.go           # Encryption/decryption
│   │   └── client.go           # License server client
│   │
│   ├── update/
│   │   ├── update.go           # Auto-update logic
│   │   ├── github.go           # GitHub API client
│   │   └── installer.go        # Binary replacement
│   │
│   └── api/
│       ├── handlers.go         # API endpoint handlers
│       ├── status.go           # Status endpoints
│       ├── providers.go        # Provider management
│       └── config.go           # Config management
│
├── pkg/
│   ├── logger/
│   │   └── logger.go           # Structured logging
│   └── utils/
│       ├── crypto.go           # Crypto utilities
│       └── http.go             # HTTP utilities
│
├── web-ui/                     # React frontend (separate concern)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── ProviderList.jsx
│   │   │   ├── ProviderForm.jsx
│   │   │   ├── ConfigEditor.jsx
│   │   │   ├── LicenseForm.jsx
│   │   │   ├── StatusCard.jsx
│   │   │   └── RequestLog.jsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAPI.js       # API client hook
│   │   │   ├── useAuth.js      # Auth state hook
│   │   │   └── useWebSocket.js # Real-time updates
│   │   │
│   │   ├── lib/
│   │   │   ├── api.js          # API client
│   │   │   └── utils.js        # Utilities
│   │   │
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── scripts/
│   ├── install.ps1             # Windows installer
│   ├── install.sh              # Linux installer (future)
│   ├── build.sh                # Local build script
│   └── test.sh                 # Run all tests
│
├── test/
│   ├── integration/
│   │   ├── proxy_test.go
│   │   └── api_test.go
│   └── fixtures/
│       └── config.json
│
├── docs/
│   ├── API.md                  # API documentation
│   ├── PROVIDERS.md            # How to add new provider
│   └── CONTRIBUTING.md         # Contribution guide
│
├── .goreleaser.yml             # Release automation config
├── go.mod
├── go.sum
├── Makefile                    # Build commands
├── README.md
├── LICENSE
├── PLANNER.md                  # User journey & architecture
├── DEVELOPMENT.md              # This file
├── IMPLEMENTATION.md           # Technical implementation (next)
└── SECURITY.md                 # Security & performance (next)
```

---

## 🔄 Development Workflow

### **1. Local Development Setup**

#### **Prerequisites:**
- Go 1.21+
- Node.js 18+ (untuk web UI)
- Git
- Make (optional, tapi recommended)

#### **Clone & Setup:**
```bash
# Clone repository
git clone https://github.com/jinkaka98/xixero.git
cd xixero

# Install Go dependencies
go mod download

# Install web UI dependencies
cd web-ui
npm install
cd ..

# Build binary
make build

# Run locally
./bin/xixero start --dev
```

#### **Development Mode:**
```bash
# Terminal 1: Run Go server dengan hot reload
make dev

# Terminal 2: Run React dev server
cd web-ui
npm run dev
```

**Dev mode features:**
- Hot reload untuk Go code (via `air` atau `reflex`)
- Vite HMR untuk React
- CORS enabled untuk localhost:5173
- Debug logging enabled
- No license check

---

### **2. Branch Strategy (Git Flow)**

```
main (production)
  ↑
  └── release/v1.x (release candidates)
        ↑
        └── develop (integration branch)
              ↑
              ├── feature/add-anthropic-provider
              ├── feature/usage-analytics
              ├── bugfix/streaming-timeout
              └── hotfix/license-validation
```

#### **Branch Naming Convention:**
- `feature/[feature-name]` - New features
- `bugfix/[bug-name]` - Bug fixes
- `hotfix/[critical-bug]` - Critical production fixes
- `refactor/[component]` - Code refactoring
- `docs/[topic]` - Documentation updates

#### **Workflow:**
1. Create branch dari `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/add-anthropic-provider
   ```

2. Develop & commit:
   ```bash
   git add .
   git commit -m "feat(provider): add Anthropic adapter"
   ```

3. Push & create PR:
   ```bash
   git push origin feature/add-anthropic-provider
   # Create PR on GitHub: feature/add-anthropic-provider → develop
   ```

4. After review & approval → merge ke `develop`

5. Periodic release:
   ```bash
   # Create release branch
   git checkout -b release/v1.1.0 develop
   
   # Bump version, update changelog
   # Test thoroughly
   
   # Merge to main
   git checkout main
   git merge release/v1.1.0
   git tag v1.1.0
   git push origin main --tags
   
   # Merge back to develop
   git checkout develop
   git merge release/v1.1.0
   ```

---

### **3. Commit Convention (Conventional Commits)**

Format:
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Add/update tests
- `chore`: Build process, dependencies

**Examples:**
```bash
feat(provider): add Anthropic Claude support

- Implement Anthropic adapter
- Add request/response transformer
- Update provider registry

Closes #42

---

fix(proxy): handle streaming timeout correctly

Previously, streaming requests would hang indefinitely
if provider didn't send data. Now timeout after 30s.

Fixes #38

---

docs(api): add provider management endpoints

Document POST /api/providers and DELETE /api/providers/:id
```

---

### **4. Code Review Process**

#### **PR Requirements:**
- [ ] All tests pass (`make test`)
- [ ] No linting errors (`make lint`)
- [ ] Code coverage ≥ 80% for new code
- [ ] Documentation updated (if API changes)
- [ ] Changelog entry added
- [ ] Self-review completed (check diff)

#### **Review Checklist (for Reviewers):**
- [ ] Code follows project conventions
- [ ] No security vulnerabilities
- [ ] Error handling is proper
- [ ] Logging is appropriate
- [ ] Tests cover edge cases
- [ ] Performance impact considered
- [ ] Breaking changes documented

#### **PR Labels:**
- `type: feature` - New feature
- `type: bugfix` - Bug fix
- `type: breaking` - Breaking change
- `priority: high` - High priority
- `status: needs-review` - Awaiting review
- `status: changes-requested` - Changes needed
- `status: approved` - Ready to merge

---

## 🧪 Testing Strategy

### **1. Unit Tests (Go)**

**Location:** `*_test.go` files next to source

**Run:**
```bash
make test
# Or
go test ./...
```

**Example:**
```go
// internal/provider/enowx_test.go
package provider

import (
    "testing"
    "github.com/stretchr/testify/assert"
)

func TestEnowXAdapter_Transform(t *testing.T) {
    adapter := NewEnowXAdapter("test-key")
    
    input := OpenAIRequest{
        Model: "gpt-4",
        Messages: []Message{{Role: "user", Content: "Hello"}},
    }
    
    output, err := adapter.TransformRequest(input)
    
    assert.NoError(t, err)
    assert.Equal(t, "claude-sonnet-4", output.Model)
}
```

**Coverage Target:** ≥ 80%

```bash
make coverage
# Generates coverage.html
```

---

### **2. Integration Tests**

**Location:** `test/integration/`

**Run:**
```bash
make test-integration
```

**Example:**
```go
// test/integration/proxy_test.go
func TestProxyFlow(t *testing.T) {
    // Start test server
    server := startTestServer(t)
    defer server.Close()
    
    // Mock provider
    mockProvider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(200)
        json.NewEncoder(w).Encode(map[string]string{"response": "ok"})
    }))
    defer mockProvider.Close()
    
    // Configure proxy
    config := &Config{
        Providers: []Provider{{
            ID: "test",
            Endpoint: mockProvider.URL,
        }},
    }
    server.LoadConfig(config)
    
    // Send request
    resp, err := http.Post(
        server.URL+"/v1/chat/completions",
        "application/json",
        strings.NewReader(`{"model":"gpt-4","messages":[]}`),
    )
    
    assert.NoError(t, err)
    assert.Equal(t, 200, resp.StatusCode)
}
```

---

### **3. E2E Tests (Web UI)**

**Location:** `web-ui/tests/`

**Framework:** Playwright

**Run:**
```bash
cd web-ui
npm run test:e2e
```

**Example:**
```javascript
// web-ui/tests/provider-management.spec.js
import { test, expect } from '@playwright/test';

test('add new provider', async ({ page }) => {
  await page.goto('http://localhost:7860');
  
  // Enter API token
  await page.fill('[data-testid="api-token-input"]', 'test-token');
  await page.click('[data-testid="connect-button"]');
  
  // Add provider
  await page.click('[data-testid="add-provider-button"]');
  await page.selectOption('[data-testid="provider-type"]', 'enowx');
  await page.fill('[data-testid="provider-name"]', 'Test Provider');
  await page.fill('[data-testid="api-key"]', 'ENOWX-TEST-KEY');
  await page.click('[data-testid="save-button"]');
  
  // Verify
  await expect(page.locator('[data-testid="provider-list"]')).toContainText('Test Provider');
});
```

---

### **4. Manual Testing Checklist**

Before release, manually test:

**Installation:**
- [ ] Fresh install via PowerShell script
- [ ] Binary runs without errors
- [ ] Config file generated correctly
- [ ] PATH updated successfully

**Core Functionality:**
- [ ] Proxy forwards requests correctly
- [ ] Streaming responses work
- [ ] Error handling is graceful
- [ ] Multiple providers work simultaneously

**Web UI:**
- [ ] Dashboard loads correctly
- [ ] Add/edit/delete provider works
- [ ] License activation works
- [ ] Real-time logs update
- [ ] Dark mode toggle works

**Update:**
- [ ] `xixero update` downloads new version
- [ ] Binary replacement works
- [ ] Config preserved after update
- [ ] Old version backed up

---

## 🏗️ Build Process

### **1. Local Build**

```bash
# Build for current platform
make build

# Output: ./bin/xixero (or xixero.exe on Windows)
```

**Makefile:**
```makefile
.PHONY: build
build:
	go build -o bin/xixero ./cmd/xixero

.PHONY: build-all
build-all:
	GOOS=windows GOARCH=amd64 go build -o bin/xixero-windows-amd64.exe ./cmd/xixero
	GOOS=linux GOARCH=amd64 go build -o bin/xixero-linux-amd64 ./cmd/xixero
	GOOS=darwin GOARCH=amd64 go build -o bin/xixero-darwin-amd64 ./cmd/xixero
	GOOS=darwin GOARCH=arm64 go build -o bin/xixero-darwin-arm64 ./cmd/xixero

.PHONY: test
test:
	go test -v ./...

.PHONY: lint
lint:
	golangci-lint run

.PHONY: coverage
coverage:
	go test -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
```

---

### **2. Release Build (GoReleaser)**

**Config:** `.goreleaser.yml`

```yaml
project_name: xixero

before:
  hooks:
    - go mod tidy
    - go test ./...

builds:
  - id: xixero
    binary: xixero
    main: ./cmd/xixero
    goos:
      - windows
      - linux
      - darwin
    goarch:
      - amd64
      - arm64
    env:
      - CGO_ENABLED=0
    ldflags:
      - -s -w
      - -X main.Version={{.Version}}
      - -X main.Commit={{.ShortCommit}}
      - -X main.Date={{.Date}}
    ignore:
      - goos: windows
        goarch: arm64

archives:
  - id: xixero
    format: binary
    name_template: "{{ .ProjectName }}-{{ .Os }}-{{ .Arch }}"

checksum:
  name_template: 'checksums.txt'
  algorithm: sha256

changelog:
  sort: asc
  filters:
    exclude:
      - '^docs:'
      - '^test:'
      - '^chore:'
  groups:
    - title: Features
      regexp: "^feat"
      order: 0
    - title: Bug Fixes
      regexp: "^fix"
      order: 1
    - title: Others
      order: 999

release:
  github:
    owner: jinkaka98
    name: xixero
  draft: false
  prerelease: auto
  name_template: "v{{.Version}}"
```

**Trigger Release:**
```bash
# Create and push tag
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions will automatically:
# 1. Run tests
# 2. Build binaries for all platforms
# 3. Create GitHub Release
# 4. Upload binaries
# 5. Generate changelog
```

---

### **3. Web UI Build**

**Build Command:**
```bash
cd web-ui
npm run build
# Output: web-ui/dist/
```

**Vite Config:**
```javascript
// web-ui/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
```

---

## 🚀 Deployment Pipeline

### **1. CI/CD Workflow (GitHub Actions)**

#### **Build & Test (on PR)**

```yaml
# .github/workflows/build.yml
name: Build & Test

on:
  pull_request:
    branches: [develop, main]
  push:
    branches: [develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      
      - name: Run tests
        run: |
          go test -v -race -coverprofile=coverage.out ./...
          go tool cover -func=coverage.out
      
      - name: Lint
        uses: golangci/golangci-lint-action@v3
        with:
          version: latest
  
  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      
      - name: Build
        run: make build-all
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: binaries
          path: bin/*
```

---

#### **Release (on tag push)**

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      
      - name: Run GoReleaser
        uses: goreleaser/goreleaser-action@v5
        with:
          version: latest
          args: release --clean
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

#### **Deploy Web UI (on push to main)**

```yaml
# .github/workflows/deploy-ui.yml
name: Deploy Web UI

on:
  push:
    branches: [main]
    paths:
      - 'web-ui/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install & Build
        run: |
          cd web-ui
          npm ci
          npm run build
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./web-ui/dist
          cname: xixero.dev  # Optional: custom domain
```

---

### **2. Release Checklist**

Before creating a release:

- [ ] All tests pass on `develop` branch
- [ ] Version bumped in code (`main.go`)
- [ ] CHANGELOG.md updated
- [ ] Documentation updated (if needed)
- [ ] Breaking changes documented
- [ ] Migration guide written (if breaking)
- [ ] Manual testing completed
- [ ] Security audit passed (for major releases)

**Create Release:**
```bash
# 1. Merge develop to main
git checkout main
git merge develop

# 2. Create tag
git tag -a v1.0.0 -m "Release v1.0.0"

# 3. Push
git push origin main --tags

# 4. GitHub Actions will handle the rest
```

---

### **3. Hotfix Process**

For critical production bugs:

```bash
# 1. Create hotfix branch from main
git checkout main
git checkout -b hotfix/critical-bug

# 2. Fix bug
# ... make changes ...

# 3. Test thoroughly
make test

# 4. Commit
git commit -m "fix: critical bug in license validation"

# 5. Merge to main
git checkout main
git merge hotfix/critical-bug

# 6. Tag new patch version
git tag v1.0.1
git push origin main --tags

# 7. Merge back to develop
git checkout develop
git merge hotfix/critical-bug
git push origin develop
```

---

## 📊 Monitoring & Observability

### **1. Logging**

**Structured Logging (zerolog):**
```go
// pkg/logger/logger.go
package logger

import (
    "github.com/rs/zerolog"
    "github.com/rs/zerolog/log"
)

func Init(level string) {
    zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
    
    switch level {
    case "debug":
        zerolog.SetGlobalLevel(zerolog.DebugLevel)
    case "info":
        zerolog.SetGlobalLevel(zerolog.InfoLevel)
    case "warn":
        zerolog.SetGlobalLevel(zerolog.WarnLevel)
    case "error":
        zerolog.SetGlobalLevel(zerolog.ErrorLevel)
    }
}

// Usage
log.Info().
    Str("provider", "enowx").
    Int("status", 200).
    Dur("duration", elapsed).
    Msg("Request completed")
```

**Log Levels:**
- `DEBUG`: Detailed debugging info
- `INFO`: General informational messages
- `WARN`: Warning messages (non-critical)
- `ERROR`: Error messages (requires attention)

---

### **2. Metrics (Future)**

**Prometheus Integration (optional):**
```go
// internal/metrics/metrics.go
package metrics

import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    RequestsTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "xixero_requests_total",
            Help: "Total number of requests",
        },
        []string{"provider", "status"},
    )
    
    RequestDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "xixero_request_duration_seconds",
            Help: "Request duration in seconds",
        },
        []string{"provider"},
    )
)
```

**Expose Metrics:**
```go
// Endpoint: GET /metrics
http.Handle("/metrics", promhttp.Handler())
```

---

### **3. Error Tracking (Future)**

**Sentry Integration (optional):**
```go
import "github.com/getsentry/sentry-go"

sentry.Init(sentry.ClientOptions{
    Dsn: os.Getenv("SENTRY_DSN"),
    Environment: "production",
})

// Capture errors
sentry.CaptureException(err)
```

---

## 🔧 Development Tools

### **Recommended Tools:**

**Go:**
- `golangci-lint` - Linting
- `air` or `reflex` - Hot reload
- `delve` - Debugging
- `go-mockgen` - Mock generation

**Install:**
```bash
# golangci-lint
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# air (hot reload)
go install github.com/cosmtrek/air@latest

# delve (debugger)
go install github.com/go-delve/delve/cmd/dlv@latest
```

**React:**
- ESLint + Prettier - Code formatting
- React DevTools - Browser extension
- Vite DevTools - Performance profiling

---

### **IDE Setup:**

**VSCode Extensions:**
- Go (official)
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Error Lens
- GitLens

**VSCode Settings:**
```json
{
  "go.lintTool": "golangci-lint",
  "go.lintOnSave": "workspace",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

---

## 📚 Documentation

### **Required Documentation:**

1. **README.md** - Project overview, quick start
2. **API.md** - API endpoint documentation
3. **PROVIDERS.md** - How to add new provider adapter
4. **CONTRIBUTING.md** - Contribution guidelines
5. **CHANGELOG.md** - Version history
6. **PLANNER.md** - Architecture & user journey
7. **DEVELOPMENT.md** - This file
8. **IMPLEMENTATION.md** - Technical implementation details
9. **SECURITY.md** - Security & performance considerations

---

## 🎯 Admin Tasks

### **1. Release Management**

**Minor Release (v1.x.0):**
- New features
- Non-breaking changes
- Release every 2-4 weeks

**Patch Release (v1.0.x):**
- Bug fixes only
- Release as needed (hotfixes)

**Major Release (vX.0.0):**
- Breaking changes
- Major refactoring
- Release every 6-12 months

---

### **2. Issue Triage**

**Labels:**
- `bug` - Something isn't working
- `enhancement` - New feature request
- `documentation` - Documentation improvements
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `wontfix` - Will not be fixed
- `duplicate` - Duplicate issue

**Priority:**
- `P0` - Critical (hotfix needed)
- `P1` - High (next release)
- `P2` - Medium (backlog)
- `P3` - Low (nice to have)

---

### **3. Community Management**

**Response Time Targets:**
- Critical bugs: < 24 hours
- Feature requests: < 1 week
- Questions: < 3 days
- PRs: < 1 week for initial review

---

## 🚀 Next Steps

Setelah development workflow ini clear, lanjut ke:

1. ✅ **DEVELOPMENT.md** (this file) - Complete
2. ⏭️ **IMPLEMENTATION.md** - Technical implementation details
3. ⏭️ **SECURITY.md** - Security & performance considerations

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-04-23  
**Maintainer:** @jinkaka98
