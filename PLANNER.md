# Xixero - Local AI Gateway Proxy

## 📋 Project Overview

**Xixero** adalah local AI gateway/proxy yang memungkinkan IDE (VSCode, Cursor, dll) untuk menggunakan berbagai AI provider (enowX AI, OpenAI, dll) melalui satu endpoint lokal. Sistem ini berfungsi sebagai reverse proxy yang dapat dikonfigurasi untuk mengarahkan request ke provider pilihan user.

---

## 🎯 Core Objectives

1. **Unified AI Gateway**: Satu endpoint lokal untuk semua AI provider
2. **Provider Flexibility**: Mudah switch/add provider tanpa ubah config IDE
3. **Remote UI Management**: Web interface yang selalu up-to-date tanpa reinstall
4. **Easy Installation**: One-command install via PowerShell
5. **Auto-Update**: Self-updating binary dari GitHub Releases
6. **License System**: Validasi license key untuk akses fitur premium
7. **Cross-Platform Ready**: Windows first, Linux/Mac compatible

---

## 🏗️ Tech Stack

### **Backend (Proxy Server)**
- **Language**: Go 1.21+
- **HTTP Framework**: `net/http` (stdlib) + `gorilla/mux` untuk routing
- **Proxy Library**: `httputil.ReverseProxy` (stdlib)
- **Config**: JSON-based dengan `encoding/json`
- **CLI**: `cobra` untuk command structure
- **Auto-Update**: Custom implementation dengan GitHub API
- **License**: JWT-based validation dengan `golang-jwt/jwt`

### **Frontend (Web UI)**
- **Framework**: React 18
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3
- **UI Components**: shadcn/ui (Radix UI primitives)
- **State Management**: React Context API + hooks
- **HTTP Client**: `fetch` API (native)
- **Routing**: React Router 6 (optional, untuk multi-page)

### **Deployment & Distribution**
- **Binary Build**: GoReleaser
- **CI/CD**: GitHub Actions
- **Web Hosting**: GitHub Pages (`jinkaka98.github.io`)
- **Release**: GitHub Releases (semver tagging)

---

## 🎨 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER MACHINE                             │
│                                                                   │
│  ┌──────────────┐                                                │
│  │   IDE/Client │  (VSCode, Cursor, etc)                         │
│  │              │                                                 │
│  │  API Config: │                                                │
│  │  localhost:  │                                                │
│  │  7860        │                                                │
│  └──────┬───────┘                                                │
│         │                                                         │
│         │ HTTP Request                                            │
│         │ POST /v1/chat/completions                              │
│         ↓                                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         Xixero Proxy Server (Go Binary)                  │   │
│  │         Running on localhost:7860                        │   │
│  │                                                           │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  1. Authentication Middleware                   │    │   │
│  │  │     - Check API token                           │    │   │
│  │  │     - Validate license key                      │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │                      ↓                                   │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  2. Router                                      │    │   │
│  │  │     - Match request path                        │    │   │
│  │  │     - Select provider based on config           │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │                      ↓                                   │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  3. Request Transformer                         │    │   │
│  │  │     - Convert OpenAI format → Provider format   │    │   │
│  │  │     - Inject provider API key                   │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │                      ↓                                   │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  4. Reverse Proxy                               │    │   │
│  │  │     - Forward to provider endpoint              │    │   │
│  │  │     - Stream response back                      │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │                      ↓                                   │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  5. Response Transformer                        │    │   │
│  │  │     - Convert Provider format → OpenAI format   │    │   │
│  │  │     - Log usage metrics                         │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │                                                           │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  Web UI Server (Embedded)                       │    │   │
│  │  │  - Serves index.html from GitHub Pages          │    │   │
│  │  │  - Proxies to https://jinkaka98.github.io/      │    │   │
│  │  │  - Opens browser on startup                     │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │                                                           │   │
│  └───────────────────────┬───────────────────────────────────┘   │
│                          │                                        │
│                          │ Forward Request                        │
│                          ↓                                        │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ HTTPS
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                             │
│                                                                   │
│  ┌──────────────────┐      ┌──────────────────┐                 │
│  │  enowX AI API    │      │  OpenAI API      │                 │
│  │  api.enowx.com   │      │  api.openai.com  │                 │
│  └──────────────────┘      └──────────────────┘                 │
│                                                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  GitHub Pages (Web UI)                               │       │
│  │  https://jinkaka98.github.io/                        │       │
│  │  - React SPA                                          │       │
│  │  - Auto-deployed on push                             │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  GitHub Releases                                      │       │
│  │  - Binary distribution (xixero.exe)                  │       │
│  │  - Version checking                                   │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  License Server (Optional)                            │       │
│  │  - Cloudflare Workers / Vercel Edge                  │       │
│  │  - License validation API                             │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 👤 User Journey - Installation & Usage

### **Phase 1: Installation (First Time)**

#### **Step 1: User menjalankan PowerShell command**
```powershell
irm https://raw.githubusercontent.com/jinkaka98/xixero/main/scripts/install.ps1 | iex
```

**What happens:**
1. Script download latest `xixero-windows-amd64.exe` dari GitHub Releases
2. Create directory: `%LOCALAPPDATA%\xixero\`
3. Save binary ke: `%LOCALAPPDATA%\xixero\xixero.exe`
4. Add `%LOCALAPPDATA%\xixero\` ke PATH environment variable
5. Generate default `config.json`:
   ```json
   {
     "version": "1.0.0",
     "server": {
       "port": 7860,
       "host": "127.0.0.1",
       "ui_url": "https://jinkaka98.github.io"
     },
     "api_token": "randomly-generated-token-here",
     "license": {
       "key": "",
       "validated_at": null
     },
     "providers": []
   }
   ```
6. Print ke console:
   ```
   ✅ Xixero installed successfully!
   
   📍 Location: C:\Users\<Username>\AppData\Local\xixero\
   🔑 API Token: abc123def456...
   
   🚀 Quick Start:
      1. Run: xixero start
      2. Browser will open automatically
      3. Enter your API token when prompted
   
   📚 Documentation: https://github.com/jinkaka98/xixero
   ```

#### **Step 2: User menjalankan `xixero start`**
```powershell
xixero start
```

**What happens:**
1. Binary load config dari `%LOCALAPPDATA%\xixero\config.json`
2. Start HTTP server di `localhost:7860`
3. Register routes:
   - `/v1/*` → AI provider proxy endpoints
   - `/api/*` → Management API (status, config, providers)
   - `/` → Redirect ke GitHub Pages UI
4. Print ke console:
   ```
   🚀 Xixero Proxy Server
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   
   ✅ Server running on http://localhost:7860
   🌐 Web UI: http://localhost:7860 (opens in browser)
   🔑 API Token: abc123def456...
   
   📊 Status:
      - Providers: 0 configured
      - License: Not activated
   
   Press Ctrl+C to stop
   ```
5. **Auto-open browser** ke `http://localhost:7860`

#### **Step 3: Browser terbuka, load UI dari GitHub Pages**

**Request Flow:**
```
Browser → http://localhost:7860
         ↓
Xixero Server detects root path "/"
         ↓
Return HTML yang fetch dari https://jinkaka98.github.io/
         ↓
Browser load React SPA
         ↓
React app detect running on localhost:7860
         ↓
Show "Welcome to Xixero" screen
```

**UI tampilan pertama kali:**
```
┌─────────────────────────────────────────────────────────┐
│  🎯 Xixero - Local AI Gateway                           │
│                                                          │
│  ⚠️  Setup Required                                     │
│                                                          │
│  To continue, please enter your API token:              │
│  (You can find it in the terminal where you ran         │
│   'xixero start')                                       │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ API Token: [____________________________]      │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  [ Connect ]                                            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### **Step 4: User input API token**

User copy token dari terminal, paste ke UI, klik "Connect".

**What happens:**
1. React app save token ke `localStorage`
2. Send test request ke `http://localhost:7860/api/status` dengan header:
   ```
   X-API-Token: abc123def456...
   ```
3. Server validate token, return:
   ```json
   {
     "status": "running",
     "version": "1.0.0",
     "providers": [],
     "license": {
       "active": false
     }
   }
   ```
4. UI redirect ke **Dashboard**

---

### **Phase 2: Configuration (Setup Providers)**

#### **Dashboard View:**
```
┌─────────────────────────────────────────────────────────────────┐
│  🎯 Xixero Dashboard                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                   │
│  📊 Server Status                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ✅ Running on http://localhost:7860                     │   │
│  │  📦 Version: 1.0.0                                       │   │
│  │  🔑 License: Not Activated                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  🔌 Providers (0 configured)                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  No providers configured yet.                            │   │
│  │                                                           │   │
│  │  [ + Add Provider ]                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  📝 Quick Start Guide                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  1. Add a provider (enowX AI, OpenAI, etc)              │   │
│  │  2. Configure your IDE to use http://localhost:7860     │   │
│  │  3. Start using AI features in your IDE!                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### **User klik "Add Provider":**

**Modal muncul:**
```
┌─────────────────────────────────────────────────────────┐
│  Add New Provider                                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                          │
│  Provider Type:                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ [v] enowX AI                                   │    │
│  │     OpenAI                                      │    │
│  │     Anthropic                                   │    │
│  │     Custom                                      │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  Provider Name:                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ My enowX AI                                    │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  API Key:                                                │
│  ┌────────────────────────────────────────────────┐    │
│  │ ENOWX-XXXXX-XXXXX-XXXXX-XXXXX                 │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  Endpoint (optional):                                    │
│  ┌────────────────────────────────────────────────┐    │
│  │ https://api.enowx.com/v1                       │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  [ Test Connection ]  [ Cancel ]  [ Save ]              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**User klik "Test Connection":**
1. UI send request ke `/api/providers/test`:
   ```json
   {
     "type": "enowx",
     "api_key": "ENOWX-...",
     "endpoint": "https://api.enowx.com/v1"
   }
   ```
2. Server test connection ke provider
3. Return result:
   ```json
   {
     "success": true,
     "message": "Connection successful",
     "models": ["claude-sonnet-4", "gpt-4"]
   }
   ```
4. UI show success message

**User klik "Save":**
1. UI send POST ke `/api/providers`:
   ```json
   {
     "id": "enowx-1",
     "name": "My enowX AI",
     "type": "enowx",
     "api_key": "ENOWX-...",
     "endpoint": "https://api.enowx.com/v1",
     "enabled": true
   }
   ```
2. Server save ke `config.json`
3. UI refresh, show provider di list

---

### **Phase 3: IDE Configuration**

#### **User configure IDE (contoh: VSCode dengan Continue extension)**

**VSCode settings.json:**
```json
{
  "continue.apiKey": "dummy-key-not-used",
  "continue.apiBase": "http://localhost:7860/v1",
  "continue.model": "claude-sonnet-4"
}
```

**Atau Cursor settings:**
```json
{
  "cursor.aiProvider": "openai",
  "cursor.openai.apiKey": "dummy",
  "cursor.openai.baseURL": "http://localhost:7860/v1"
}
```

---

### **Phase 4: Usage (Normal Operation)**

#### **Request Flow:**

```
1. User type di IDE: "Explain this code"
   ↓
2. IDE send request:
   POST http://localhost:7860/v1/chat/completions
   Headers:
     Authorization: Bearer dummy
   Body:
     {
       "model": "claude-sonnet-4",
       "messages": [{"role": "user", "content": "Explain this code"}]
     }
   ↓
3. Xixero Proxy receives request
   ↓
4. Middleware: Check API token (optional untuk /v1/* endpoints)
   ↓
5. Router: Match "/v1/chat/completions"
   ↓
6. Config: Find provider for model "claude-sonnet-4" → enowX AI
   ↓
7. Transformer: Convert request format (jika perlu)
   ↓
8. Proxy: Forward ke https://api.enowx.com/v1/chat/completions
   Headers:
     Authorization: Bearer ENOWX-XXXXX-XXXXX
   ↓
9. enowX AI process request
   ↓
10. Response stream back through proxy
   ↓
11. Transformer: Convert response format (jika perlu)
   ↓
12. IDE receives response, show to user
```

---

### **Phase 5: Monitoring (Web UI)**

**User buka dashboard, lihat real-time stats:**

```
┌─────────────────────────────────────────────────────────────────┐
│  🎯 Xixero Dashboard                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                   │
│  📊 Usage Statistics (Last 24h)                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Total Requests: 142                                     │   │
│  │  Success Rate: 98.6%                                     │   │
│  │  Avg Response Time: 1.2s                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  🔌 Active Providers                                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ✅ My enowX AI                                          │   │
│  │     Requests: 142 | Success: 140 | Failed: 2            │   │
│  │     Models: claude-sonnet-4, gpt-4                       │   │
│  │     [ Edit ] [ Disable ] [ Remove ]                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  📝 Recent Requests                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  10:23:45  POST /v1/chat/completions  200  1.2s         │   │
│  │  10:22:31  POST /v1/chat/completions  200  0.9s         │   │
│  │  10:21:18  POST /v1/chat/completions  500  0.1s         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

### **Phase 6: Update (Self-Update)**

#### **Scenario 1: Manual Update Check**

User jalankan:
```powershell
xixero update
```

**What happens:**
1. Binary check GitHub API:
   ```
   GET https://api.github.com/repos/jinkaka98/xixero/releases/latest
   ```
2. Compare version:
   - Current: v1.0.0
   - Latest: v1.1.0
3. Download new binary:
   ```
   GET https://github.com/jinkaka98/xixero/releases/download/v1.1.0/xixero-windows-amd64.exe
   ```
4. Replace binary:
   ```
   Backup: xixero.exe → xixero.exe.old
   Replace: xixero-new.exe → xixero.exe
   ```
5. Print:
   ```
   ✅ Updated to v1.1.0
   
   📝 Changelog:
      - Added support for Anthropic provider
      - Fixed streaming response bug
      - Improved error handling
   
   🚀 Restart xixero to apply changes:
      xixero restart
   ```

#### **Scenario 2: Auto-Update Notification (Web UI)**

**Dashboard show banner:**
```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  Update Available: v1.1.0                                    │
│  New features: Anthropic support, bug fixes                      │
│  [ Update Now ]  [ View Changelog ]  [ Dismiss ]                │
└─────────────────────────────────────────────────────────────────┘
```

User klik "Update Now":
1. UI send POST ke `/api/update`
2. Server download & replace binary
3. Server restart automatically
4. UI show "Updating... please wait"
5. After restart, UI reconnect & show success message

---

### **Phase 7: License Activation (Optional Premium Features)**

**User klik "Activate License" di dashboard:**

```
┌─────────────────────────────────────────────────────────┐
│  Activate License                                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                          │
│  Enter your license key:                                 │
│  ┌────────────────────────────────────────────────┐    │
│  │ XIXERO-XXXXX-XXXXX-XXXXX-XXXXX                │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  [ Validate ]  [ Cancel ]                               │
│                                                          │
│  Don't have a license?                                   │
│  [ Purchase License ]                                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**User klik "Validate":**
1. UI send POST ke `/api/license/validate`:
   ```json
   {
     "key": "XIXERO-XXXXX-XXXXX-XXXXX-XXXXX"
   }
   ```
2. Server validate dengan license server (Cloudflare Workers)
3. License server return:
   ```json
   {
     "valid": true,
     "features": ["unlimited_providers", "usage_analytics", "priority_support"],
     "expires_at": "2027-04-23T00:00:00Z"
   }
   ```
4. Server save ke config, encrypt license data
5. UI show success & unlock premium features

---

## 🔄 Data Flow Summary

### **Installation Flow:**
```
PowerShell Script → GitHub Releases → Download Binary → 
Install to %LOCALAPPDATA% → Generate Config → Add to PATH
```

### **Startup Flow:**
```
xixero start → Load Config → Start HTTP Server → 
Open Browser → Load UI from GitHub Pages → User Auth
```

### **Request Flow:**
```
IDE → localhost:7860 → Auth Middleware → Router → 
Transformer → Reverse Proxy → Provider API → 
Response Transform → IDE
```

### **Update Flow:**
```
xixero update → Check GitHub API → Download New Binary → 
Replace Old Binary → Restart Server
```

### **UI Update Flow:**
```
Developer Push to GitHub → GitHub Actions Build → 
Deploy to GitHub Pages → User Refresh Browser → 
New UI Loaded (No reinstall needed)
```

---

## 📁 File System Structure (User Machine)

```
%LOCALAPPDATA%\xixero\
├── xixero.exe              # Main binary
├── xixero.exe.old          # Backup (after update)
├── config.json             # User configuration
├── logs\
│   ├── xixero.log          # Application logs
│   └── requests.log        # Request/response logs
└── cache\
    └── license.enc         # Encrypted license cache
```

**Config.json Structure:**
```json
{
  "version": "1.0.0",
  "server": {
    "port": 7860,
    "host": "127.0.0.1",
    "ui_url": "https://jinkaka98.github.io",
    "auto_open_browser": true
  },
  "api_token": "abc123def456...",
  "license": {
    "key": "XIXERO-XXXXX-XXXXX-XXXXX-XXXXX",
    "validated_at": "2026-04-23T10:00:00Z",
    "expires_at": "2027-04-23T00:00:00Z",
    "features": ["unlimited_providers", "usage_analytics"]
  },
  "providers": [
    {
      "id": "enowx-1",
      "name": "My enowX AI",
      "type": "enowx",
      "endpoint": "https://api.enowx.com/v1",
      "api_key_encrypted": "...",
      "enabled": true,
      "models": ["claude-sonnet-4", "gpt-4"]
    }
  ],
  "routes": [
    {
      "path": "/v1/chat/completions",
      "provider_id": "enowx-1",
      "model_mapping": {
        "claude-sonnet-4": "claude-sonnet-4",
        "gpt-4": "gpt-4"
      }
    }
  ],
  "logging": {
    "level": "info",
    "log_requests": true,
    "log_responses": false
  }
}
```

---

## 🎯 User Experience Goals

### **Installation:**
- ✅ One-command install
- ✅ No manual PATH editing
- ✅ Auto-generate secure token
- ✅ Clear instructions in terminal

### **First Run:**
- ✅ Auto-open browser
- ✅ Simple token authentication
- ✅ Guided setup wizard
- ✅ Test connection before save

### **Daily Usage:**
- ✅ Invisible proxy (just works)
- ✅ Fast response times (<100ms overhead)
- ✅ Reliable streaming
- ✅ Clear error messages

### **Configuration:**
- ✅ Web UI (no config file editing)
- ✅ Real-time validation
- ✅ Import/export config
- ✅ Multiple provider support

### **Updates:**
- ✅ One-command update
- ✅ Auto-backup old version
- ✅ Changelog display
- ✅ Zero downtime (restart only)

### **Monitoring:**
- ✅ Real-time request logs
- ✅ Usage statistics
- ✅ Error tracking
- ✅ Performance metrics

---

## 🚀 Related Documents

| # | Document | Status | Description |
|---|----------|--------|-------------|
| 1 | [DEVELOPMENT.md](./DEVELOPMENT.md) | ✅ Complete | Admin/dev workflow, build process, testing, deployment pipeline |
| 2 | [IMPLEMENTATION.md](./IMPLEMENTATION.md) | ✅ Complete | Go backend, React frontend, API specs, data models, error handling |
| 3 | [SECURITY.md](./SECURITY.md) | ✅ Complete | Security architecture, performance optimization, DevOps patterns |
