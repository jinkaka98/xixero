# Xixero — Development Guide

## Prerequisites

| Tool                          | Version    | Notes                                         |
| ----------------------------- | ---------- | --------------------------------------------- |
| Node.js                       | >= 20      | LTS recommended                               |
| pnpm                          | >= 9       | `npm install -g pnpm`                         |
| Rust                          | stable     | Install via [rustup.rs](https://rustup.rs/)   |
| Visual Studio Build Tools     | 2022       | C++ build tools workload required              |
| WebView2                      | latest     | Pre-installed on Windows 10/11                 |
| Git                           | latest     | Version control                                |

### Windows-Specific Setup

1. **Visual Studio Build Tools 2022**: Download from [visualstudio.microsoft.com](https://visualstudio.microsoft.com/visual-cpp-build-tools/). During installation, select the **"Desktop development with C++"** workload.

2. **WebView2 Runtime**: Ships with Windows 10 (version 1803+) and Windows 11. If missing, download from [developer.microsoft.com](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

3. **Rust**: Install via rustup:
   ```powershell
   winget install Rustlang.Rustup
   rustup default stable
   ```

---

## Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/jinkaka98/xixero.git
cd xixero

# 2. Install Node.js dependencies
pnpm install

# 3. Copy environment variables
cp .env.example .env.local
# Edit .env.local with your Firebase credentials

# 4. Run in development mode
pnpm tauri dev
```

On first run, Cargo will download and compile all Rust dependencies. This may take 2-5 minutes.

---

## Development Workflow

### Frontend (React + Vite)

- Source files are in `src/`
- Vite provides **Hot Module Replacement (HMR)** — changes to React components reflect instantly in the app window
- Tailwind CSS v4 is configured for utility-first styling
- The dev server runs on `http://localhost:1420` (Vite default for Tauri)

### Backend (Rust / Tauri)

- Source files are in `src-tauri/src/`
- Tauri watches for Rust file changes and **automatically recompiles** when you save
- IPC commands are defined in `src-tauri/src/commands/`
- The proxy engine runs on `localhost:1445`

### Typical Dev Loop

1. Edit React components in `src/` → instant HMR update
2. Edit Rust code in `src-tauri/src/` → Tauri recompiles (~5-15s)
3. Test proxy by sending requests to `http://localhost:1445`
4. Check browser DevTools (right-click → Inspect) for frontend debugging
5. Check terminal output for Rust logs

---

## Build for Production

```bash
# Build optimized .exe
pnpm tauri build
```

Output location:
```
src-tauri/target/release/bundle/
├── nsis/
│   └── Xixero_x.x.x_x64-setup.exe    # NSIS installer
└── msi/
    └── Xixero_x.x.x_x64_en-US.msi    # MSI installer
```

The standalone `.exe` is at:
```
src-tauri/target/release/xixero.exe
```

---

## Environment Variables

Create a `.env.local` file in the project root (copy from `.env.example`):

| Variable                          | Description                    |
| --------------------------------- | ------------------------------ |
| `VITE_FIREBASE_API_KEY`           | Firebase API key               |
| `VITE_FIREBASE_AUTH_DOMAIN`       | Firebase auth domain           |
| `VITE_FIREBASE_PROJECT_ID`        | Firebase project ID            |
| `VITE_FIREBASE_STORAGE_BUCKET`    | Firebase storage bucket        |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID`           | Firebase app ID                |

All `VITE_` prefixed variables are exposed to the frontend at build time.

---

## Key Commands

| Command              | Description                                    |
| -------------------- | ---------------------------------------------- |
| `pnpm install`       | Install Node.js dependencies                   |
| `pnpm tauri dev`     | Start development mode (frontend + backend)    |
| `pnpm tauri build`   | Build production `.exe`                        |
| `pnpm dev`           | Start Vite dev server only (no Tauri)          |
| `pnpm build`         | Build frontend only                            |
| `pnpm lint`          | Run ESLint                                     |
| `cargo check`        | Check Rust code for errors (run in `src-tauri/`) |
| `cargo test`         | Run Rust tests (run in `src-tauri/`)           |
| `cargo clippy`       | Run Rust linter (run in `src-tauri/`)          |

---

## Troubleshooting

### `error: linker 'link.exe' not found`
Install Visual Studio Build Tools 2022 with the C++ workload.

### `WebView2 not found`
Download and install the WebView2 Runtime from Microsoft.

### `pnpm tauri dev` hangs on first run
First compilation downloads all Rust crates. Wait 2-5 minutes. Subsequent runs are much faster due to incremental compilation.

### Port 1445 already in use
Another instance of Xixero (or another app) is using the port. Kill the process or change the port in the proxy configuration.
