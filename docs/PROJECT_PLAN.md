# Xixero — Project Plan

## Execution Order

```
M1 (Scaffolding) → M2 (License) → M3 (Proxy Engine) → M4 (Dashboard UI) → M7 (Providers) → M5 (Tray & Polish) → M6 (Build & Distribution)
```

---

## M1: Project Scaffolding — COMPLETED

> Initialize the project, set up tooling, and establish the directory structure.

| #   | Task                                          | Priority | Status    |
| --- | --------------------------------------------- | -------- | --------- |
| 1.1 | Initialize Tauri v2 project with React + TS   | High     | Completed |
| 1.2 | Configure Vite + Tailwind CSS v4              | High     | Completed |
| 1.3 | Set up ESLint and TypeScript configs           | Medium   | Completed |
| 1.4 | Create project directory structure              | High     | Completed |
| 1.5 | Set up pnpm workspace and lockfile             | High     | Completed |
| 1.6 | Add .gitignore, .env.example, README           | Medium   | Completed |
| 1.7 | Write architecture and project documentation   | Medium   | Completed |
| 1.8 | Initialize Git repository and first commit     | High     | Completed |

---

## M2: License System

> Implement Firebase-backed license validation with HWID binding and lock screen UI.

| #   | Task                                                        | Priority | Status  |
| --- | ----------------------------------------------------------- | -------- | ------- |
| 2.1 | Set up Firebase project and Firestore `licenses` collection | High     | Pending |
| 2.2 | Initialize Firebase JS SDK in frontend                      | High     | Pending |
| 2.3 | Implement HWID generation in Rust (`machine-uid`)           | High     | Pending |
| 2.4 | Create Tauri IPC command to expose HWID to frontend         | High     | Pending |
| 2.5 | Build Lock Screen UI component                              | High     | Pending |
| 2.6 | Implement license validation logic (key + HWID + expiry)    | High     | Pending |
| 2.7 | Add encrypted local license cache for offline grace period  | Medium   | Pending |
| 2.8 | Implement periodic re-validation (background check)         | Medium   | Pending |
| 2.9 | Handle edge cases: expired, revoked, HWID mismatch          | Medium   | Pending |
| 2.10| Add Zustand store for license state                         | Medium   | Pending |

---

## M3: Reverse Proxy Engine

> Build the core Rust-based reverse proxy with SSE streaming support.

| #   | Task                                                        | Priority | Status  |
| --- | ----------------------------------------------------------- | -------- | ------- |
| 3.1 | Set up `hyper` HTTP server on `localhost:1445`              | High     | Pending |
| 3.2 | Implement basic request forwarding (non-streaming)          | High     | Pending |
| 3.3 | Add route matching logic (model → provider mapping)         | High     | Pending |
| 3.4 | Implement header rewriting (inject provider API keys)       | High     | Pending |
| 3.5 | Add SSE streaming support (chunked transfer)                | High     | Pending |
| 3.6 | Implement request body transformation                       | Medium   | Pending |
| 3.7 | Add response body transformation                            | Medium   | Pending |
| 3.8 | Implement error handling and upstream timeout                | High     | Pending |
| 3.9 | Add request/response logging for traffic monitor            | Medium   | Pending |
| 3.10| Create Tauri IPC commands for proxy start/stop/status       | High     | Pending |
| 3.11| Add configurable port and bind address                      | Low      | Pending |
| 3.12| Write unit tests for router and transforms                  | Medium   | Pending |

---

## M4: Dashboard UI

> Build the main dashboard with route manager, provider configuration, and traffic monitor.

| #   | Task                                                        | Priority | Status  |
| --- | ----------------------------------------------------------- | -------- | ------- |
| 4.1 | Design and implement main dashboard layout                  | High     | Pending |
| 4.2 | Build Route Manager component (CRUD for proxy routes)       | High     | Pending |
| 4.3 | Build Provider Config component (API keys, base URLs)       | High     | Pending |
| 4.4 | Build Traffic Monitor component (live request log)          | High     | Pending |
| 4.5 | Add Zustand stores for proxy config and traffic state       | Medium   | Pending |
| 4.6 | Implement proxy status indicator (running/stopped)          | Medium   | Pending |
| 4.7 | Add start/stop proxy controls                               | High     | Pending |
| 4.8 | Implement settings page (port, theme, general config)       | Medium   | Pending |
| 4.9 | Add dark mode toggle (default: dark)                        | Low      | Pending |
| 4.10| Polish UI with animations and transitions                   | Low      | Pending |

---

## M5: System Tray & Polish

> Add system tray support, minimize-to-tray, and overall UX polish.

| #   | Task                                                        | Priority | Status  |
| --- | ----------------------------------------------------------- | -------- | ------- |
| 5.1 | Implement system tray icon with Tauri v2 tray API           | High     | Pending |
| 5.2 | Add tray menu (Open Dashboard, Start/Stop Proxy, Quit)      | High     | Pending |
| 5.3 | Implement minimize-to-tray on window close                  | High     | Pending |
| 5.4 | Add tray icon status indicator (green=running, gray=stopped)| Medium   | Pending |
| 5.5 | Add startup-on-boot option (Windows registry)               | Low      | Pending |
| 5.6 | Implement notification toasts for key events                | Medium   | Pending |
| 5.7 | Add keyboard shortcuts                                      | Low      | Pending |
| 5.8 | Final UI/UX review and polish pass                          | Medium   | Pending |

---

## M6: Build & Distribution

> Set up CI/CD, automated builds, and distribution pipeline.

| #   | Task                                                        | Priority | Status  |
| --- | ----------------------------------------------------------- | -------- | ------- |
| 6.1 | Configure GitHub Actions for automated builds               | High     | Pending |
| 6.2 | Set up code signing for Windows `.exe`                      | High     | Pending |
| 6.3 | Configure NSIS and MSI installer options                    | Medium   | Pending |
| 6.4 | Implement auto-update mechanism (Tauri updater)             | Medium   | Pending |
| 6.5 | Create download/landing page                                | Medium   | Pending |
| 6.6 | Set up GitHub Releases for versioned builds                 | High     | Pending |
| 6.7 | Add version bumping workflow                                | Low      | Pending |
| 6.8 | Write installation and usage documentation                  | Medium   | Pending |

---

## M7: Provider-Specific Logic

> Add provider-specific request/response transformations and model mappings.

| #   | Task                                                        | Priority | Status  |
| --- | ----------------------------------------------------------- | -------- | ------- |
| 7.1 | Implement OpenAI provider adapter                           | High     | Pending |
| 7.2 | Implement Anthropic provider adapter                        | High     | Pending |
| 7.3 | Add model name mapping system (configurable aliases)        | High     | Pending |
| 7.4 | Handle provider-specific auth header formats                | High     | Pending |
| 7.5 | Implement provider-specific error response normalization    | Medium   | Pending |
| 7.6 | Add custom/generic provider support (user-defined endpoints)| Medium   | Pending |
| 7.7 | Implement provider health checks                            | Low      | Pending |
| 7.8 | Add provider-specific rate limit handling                   | Low      | Pending |
| 7.9 | Write integration tests per provider                        | Medium   | Pending |

---

## Summary

| Milestone | Name                    | Tasks | Status    |
| --------- | ----------------------- | ----- | --------- |
| M1        | Project Scaffolding     | 8     | Completed |
| M2        | License System          | 10    | Pending   |
| M3        | Reverse Proxy Engine    | 12    | Pending   |
| M4        | Dashboard UI            | 10    | Pending   |
| M5        | System Tray & Polish    | 8     | Pending   |
| M6        | Build & Distribution    | 8     | Pending   |
| M7        | Provider-Specific Logic | 9     | Pending   |
| **Total** |                         | **65**|           |
