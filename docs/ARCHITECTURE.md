# Xixero — Architecture Document

## Overview

Xixero is a **local AI reverse proxy** desktop application for Windows, distributed as a single `.exe` file. It is conceptually similar to [LiteLLM Proxy](https://github.com/BerriAI/litellm) or [OpenRouter](https://openrouter.ai/), but packaged as a native desktop app with a UI dashboard and license key system.

**Core use case:**

1. User runs Xixero locally.
2. IDE (e.g., Trae.ai, Cursor, VS Code + Continue) points to `http://localhost:1445`.
3. Xixero routes requests to any configured AI provider (OpenAI, Anthropic, custom endpoints).
4. Responses — including SSE streams — are proxied back transparently.

---

## Tech Stack

| Layer               | Technology                          | Notes                                      |
| ------------------- | ----------------------------------- | ------------------------------------------ |
| Shell / Desktop     | Tauri v2                            | Single `.exe`, ~5 MB, native Windows       |
| Frontend / UI       | React + TypeScript + Vite           | Dashboard, settings, route manager         |
| Styling             | Tailwind CSS v4                     | Utility-first, dark mode by default        |
| Backend / Core      | Rust (Tauri core)                   | Commands, state, IPC bridge                |
| Proxy Engine        | Rust (hyper + tokio)                | HTTP/1.1 reverse proxy with SSE streaming  |
| License Validation  | Firebase JS SDK (Firestore)         | Cloud-based license check                  |
| HWID Binding        | Rust (machine-uid)                  | Hardware ID for device-locked licenses     |
| State Management    | Zustand                             | Lightweight React state                    |
| Icons               | Lucide React                        | Consistent icon set                        |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Tauri v2 Shell                           │
│                      (Single .exe ~5MB)                         │
│                                                                 │
│  ┌───────────────────────┐    ┌──────────────────────────────┐  │
│  │    React Frontend     │    │       Rust Backend           │  │
│  │  (WebView2 / Vite)    │    │      (Tauri Core)            │  │
│  │                       │    │                              │  │
│  │  ┌─────────────────┐  │    │  ┌────────────────────────┐  │  │
│  │  │  Lock Screen    │  │◄──►│  │  License Validator     │  │  │
│  │  │  (License Key)  │  │IPC │  │  (HWID + Firebase)     │  │  │
│  │  └─────────────────┘  │    │  └──────────┬─────────────┘  │  │
│  │                       │    │             │                │  │
│  │  ┌─────────────────┐  │    │  ┌──────────▼─────────────┐  │  │
│  │  │  Dashboard      │  │◄──►│  │  Proxy Engine          │  │  │
│  │  │  - Routes       │  │IPC │  │  (hyper + tokio)       │  │  │
│  │  │  - Providers    │  │    │  │  localhost:1445         │  │  │
│  │  │  - Traffic      │  │    │  └──────────┬─────────────┘  │  │
│  │  └─────────────────┘  │    │             │                │  │
│  │                       │    │  ┌──────────▼─────────────┐  │  │
│  │  ┌─────────────────┐  │    │  │  System Tray           │  │  │
│  │  │  Zustand Store  │  │    │  │  (minimize to tray)    │  │  │
│  │  └─────────────────┘  │    │  └────────────────────────┘  │  │
│  └───────────────────────┘    └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                                    │
         │ Firebase JS SDK                    │ HTTP/HTTPS
         ▼                                    ▼
┌─────────────────┐              ┌──────────────────────────┐
│  Firebase        │              │  AI Providers            │
│  Firestore       │              │                          │
│  (licenses)      │              │  ┌────────────────────┐  │
│                  │              │  │  OpenAI API         │  │
│  ┌────────────┐  │              │  ├────────────────────┤  │
│  │ licenses/  │  │              │  │  Anthropic API      │  │
│  │  {key}     │  │              │  ├────────────────────┤  │
│  └────────────┘  │              │  │  Custom Endpoints   │  │
└─────────────────┘              │  └────────────────────┘  │
                                 └──────────────────────────┘
```

---

## Application Flow

### Startup & License Validation

```
App Launch
    │
    ▼
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Generate HWID│────►│ Check local cache │────►│ Cache valid?    │
│ (machine-uid)│     │ (encrypted store) │     │                 │
└──────────────┘     └──────────────────┘     └───────┬─────────┘
                                                      │
                                          Yes ┌───────┴───────┐ No
                                              ▼               ▼
                                     ┌──────────────┐  ┌──────────────┐
                                     │ Unlock        │  │ Show Lock    │
                                     │ Dashboard     │  │ Screen       │
                                     └──────────────┘  └──────┬───────┘
                                                              │
                                                    User enters license key
                                                              │
                                                              ▼
                                                   ┌──────────────────┐
                                                   │ Query Firestore  │
                                                   │ licenses/{key}   │
                                                   └────────┬─────────┘
                                                            │
                                                ┌───────────┴───────────┐
                                                ▼                       ▼
                                         Key valid &             Key invalid /
                                         HWID matches            expired
                                                │                       │
                                                ▼                       ▼
                                       ┌──────────────┐       ┌──────────────┐
                                       │ Cache license │       │ Show error   │
                                       │ Unlock app    │       │ message      │
                                       └──────────────┘       └──────────────┘
```

### Proxy Request Flow

```
IDE (Trae.ai / Cursor / etc.)
    │
    │  POST http://localhost:1445/v1/chat/completions
    │  Authorization: Bearer sk-xixero-...
    │  {"model": "gpt-4o", "messages": [...], "stream": true}
    │
    ▼
┌──────────────────────────────────────────────┐
│  Xixero Proxy Engine (hyper + tokio)         │
│                                              │
│  1. Parse incoming request                   │
│  2. Match route (model → provider mapping)   │
│  3. Rewrite headers (inject provider API key)│
│  4. Transform request body if needed         │
│  5. Forward to upstream provider             │
│  6. Stream SSE response back to IDE          │
└──────────────────────────────────────────────┘
    │
    │  POST https://api.openai.com/v1/chat/completions
    │  Authorization: Bearer sk-real-openai-key
    │
    ▼
┌──────────────────┐
│  OpenAI API      │
│  (or any target) │
└──────────────────┘
```

---

## Firebase Firestore Schema

### Collection: `licenses`

| Field            | Type      | Description                                |
| ---------------- | --------- | ------------------------------------------ |
| `key`            | string    | License key (document ID)                  |
| `active`         | boolean   | Whether the license is currently active    |
| `hwid`           | string    | Bound hardware ID (empty = unbound)        |
| `expires_at`     | timestamp | License expiration date                    |
| `plan`           | string    | Plan tier: `"starter"`, `"pro"`, `"team"`  |
| `max_devices`    | number    | Maximum devices allowed (default: 1)       |
| `features`       | array     | Enabled feature flags                      |
| `last_validated` | timestamp | Last successful validation timestamp       |

Example document:

```json
{
  "key": "XIXERO-ABCD-1234-EFGH",
  "active": true,
  "hwid": "a1b2c3d4e5f6",
  "expires_at": "2026-12-31T23:59:59Z",
  "plan": "pro",
  "max_devices": 1,
  "features": ["streaming", "multi-provider", "traffic-monitor"],
  "last_validated": "2026-04-26T10:00:00Z"
}
```

---

## Project Structure

```
xixero/
├── docs/
│   ├── ARCHITECTURE.md          # This file
│   ├── DEVELOPMENT.md           # Dev setup guide
│   └── PROJECT_PLAN.md          # Milestones & tasks
├── public/
│   └── xixero.svg               # App icon
├── src/                         # React frontend
│   ├── assets/                  # Static assets
│   ├── components/              # React components
│   │   ├── ui/                  # Reusable UI primitives
│   │   ├── LockScreen.tsx       # License key entry
│   │   ├── Dashboard.tsx        # Main dashboard
│   │   ├── RouteManager.tsx     # Proxy route configuration
│   │   ├── ProviderConfig.tsx   # AI provider settings
│   │   └── TrafficMonitor.tsx   # Request/response log
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # Utilities
│   │   ├── firebase.ts          # Firebase initialization
│   │   └── license.ts           # License validation logic
│   ├── stores/                  # Zustand stores
│   │   ├── licenseStore.ts      # License state
│   │   ├── proxyStore.ts        # Proxy config state
│   │   └── trafficStore.ts      # Traffic log state
│   ├── App.tsx                  # Root component
│   ├── App.css                  # Global styles
│   ├── main.tsx                 # Entry point
│   └── vite-env.d.ts            # Vite type declarations
├── src-tauri/                   # Rust backend
│   ├── src/
│   │   ├── main.rs              # Tauri entry point
│   │   ├── lib.rs               # Library root
│   │   ├── commands/            # Tauri IPC commands
│   │   │   ├── mod.rs
│   │   │   ├── license.rs       # License commands
│   │   │   └── proxy.rs         # Proxy commands
│   │   ├── proxy/               # Reverse proxy engine
│   │   │   ├── mod.rs
│   │   │   ├── server.rs        # hyper HTTP server
│   │   │   ├── router.rs        # Route matching
│   │   │   ├── transform.rs     # Request/response transforms
│   │   │   └── streaming.rs     # SSE streaming handler
│   │   └── license/             # License validation
│   │       ├── mod.rs
│   │       └── hwid.rs          # Hardware ID generation
│   ├── Cargo.toml               # Rust dependencies
│   ├── tauri.conf.json          # Tauri configuration
│   ├── capabilities/            # Tauri v2 permissions
│   └── icons/                   # App icons (various sizes)
├── .env.example                 # Environment variable template
├── .gitignore                   # Git ignore rules
├── index.html                   # HTML entry point
├── package.json                 # Node.js dependencies
├── pnpm-lock.yaml               # pnpm lockfile
├── tsconfig.json                # TypeScript config
├── tsconfig.app.json            # App-specific TS config
├── tsconfig.node.json           # Node-specific TS config
├── vite.config.ts               # Vite configuration
├── eslint.config.js             # ESLint configuration
└── README.md                    # Project README
```

---

## Key Features

### License System
- Firebase Firestore-backed license validation
- Hardware ID (HWID) binding via `machine-uid` crate
- Offline grace period with encrypted local cache
- Lock screen UI blocks access until valid license is provided
- Plan-based feature gating

### Reverse Proxy Engine
- Built with `hyper` + `tokio` for async, high-performance HTTP handling
- Listens on `localhost:1445` (configurable)
- Full SSE (Server-Sent Events) streaming support
- Route-based model mapping (e.g., `gpt-4o` → OpenAI, `claude-sonnet` → Anthropic)
- Header rewriting (inject provider API keys)
- Request/response body transformation

### Dashboard UI
- Route manager: add/edit/delete proxy routes
- Provider configuration: API keys, base URLs, custom headers
- Traffic monitor: live request/response log with latency, tokens, status
- Dark mode by default

### System Tray
- Minimize to system tray
- Tray icon with status indicator (running/stopped)
- Quick actions: start/stop proxy, open dashboard, quit

---

## Rust Dependencies

Key crates used in `src-tauri/Cargo.toml`:

| Crate          | Purpose                                    |
| -------------- | ------------------------------------------ |
| `tauri`        | Desktop app framework (v2)                 |
| `hyper`        | HTTP server for reverse proxy              |
| `tokio`        | Async runtime                              |
| `reqwest`      | HTTP client for upstream requests          |
| `machine-uid`  | Hardware ID generation                     |
| `serde`        | Serialization/deserialization              |
| `serde_json`   | JSON handling                              |
| `uuid`         | Unique ID generation                       |
| `chrono`       | Date/time handling                         |
| `tracing`      | Structured logging                         |
| `aes-gcm`      | API key encryption at rest                 |

---

## Security Considerations

### API Key Encryption
- Provider API keys are encrypted at rest using AES-256-GCM
- Keys are decrypted only in memory when needed for proxying
- Encryption key derived from HWID + user secret

### License Bypass Prevention
- HWID binding prevents license sharing across machines
- License validation happens both at startup and periodically
- Compiled Rust binary makes reverse engineering significantly harder than JS/Python alternatives

### HTTPS Upstream
- All upstream requests to AI providers use HTTPS
- TLS certificate validation is enforced
- No sensitive data is sent over unencrypted connections

### Rust Binary Security
- Memory-safe language eliminates buffer overflow vulnerabilities
- No garbage collector — deterministic resource cleanup
- Single static binary with no external runtime dependencies
