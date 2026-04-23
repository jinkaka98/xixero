# Xixero - Technical Implementation Guide

> Ref: PLANNER.md (architecture), DEVELOPMENT.md (workflow)

---

## 1. Backend Implementation (Go)

### 1.1 Entry Point

```go
// cmd/xixero/main.go
package main

import (
    "fmt"
    "os"
    "github.com/spf13/cobra"
)

var (
    Version = "dev"
    Commit  = "none"
    Date    = "unknown"
)

func main() {
    root := &cobra.Command{
        Use:   "xixero",
        Short: "Local AI Gateway Proxy",
    }

    root.AddCommand(
        startCmd(),    // xixero start
        configCmd(),   // xixero config
        updateCmd(),   // xixero update
        versionCmd(),  // xixero version
        uninstallCmd(),// xixero uninstall
    )

    if err := root.Execute(); err != nil {
        fmt.Fprintln(os.Stderr, err)
        os.Exit(1)
    }
}

func startCmd() *cobra.Command {
    cmd := &cobra.Command{
        Use:   "start",
        Short: "Start proxy server",
        RunE: func(cmd *cobra.Command, args []string) error {
            cfg, err := config.Load()
            if err != nil {
                return fmt.Errorf("load config: %w", err)
            }

            srv := server.New(cfg)

            // Auto-open browser
            if cfg.Server.AutoOpenBrowser {
                openBrowser(fmt.Sprintf("http://localhost:%d", cfg.Server.Port))
            }

            // Graceful shutdown
            ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
            defer stop()

            go func() {
                if err := srv.Start(); err != nil && err != http.ErrServerClosed {
                    log.Fatal().Err(err).Msg("Server failed")
                }
            }()

            <-ctx.Done()
            return srv.Shutdown(context.Background())
        },
    }
    return cmd
}
```

### 1.2 Server & Routes

```go
// internal/server/server.go
package server

type Server struct {
    router     *mux.Router
    httpServer *http.Server
    config     *config.Config
    proxy      *proxy.Proxy
    registry   *provider.Registry
}

func New(cfg *config.Config) *Server {
    reg := provider.NewRegistry(cfg.Providers)
    prx := proxy.New(reg, cfg)

    s := &Server{
        router:   mux.NewRouter(),
        config:   cfg,
        proxy:    prx,
        registry: reg,
    }
    s.setupMiddleware()
    s.setupRoutes()
    return s
}
```

```go
// internal/server/routes.go
func (s *Server) setupRoutes() {
    // === Proxy Endpoints (IDE → Provider) ===
    s.router.HandleFunc("/v1/chat/completions", s.proxy.HandleChatCompletions).Methods("POST")
    s.router.HandleFunc("/v1/completions", s.proxy.HandleCompletions).Methods("POST")
    s.router.HandleFunc("/v1/models", s.proxy.HandleModels).Methods("GET")
    s.router.HandleFunc("/v1/embeddings", s.proxy.HandleEmbeddings).Methods("POST")

    // === Management API ===
    api := s.router.PathPrefix("/api").Subrouter()
    api.Use(s.authMiddleware) // Require API token

    // Status
    api.HandleFunc("/status", s.handleStatus).Methods("GET")

    // Providers CRUD
    api.HandleFunc("/providers", s.handleListProviders).Methods("GET")
    api.HandleFunc("/providers", s.handleAddProvider).Methods("POST")
    api.HandleFunc("/providers/{id}", s.handleGetProvider).Methods("GET")
    api.HandleFunc("/providers/{id}", s.handleUpdateProvider).Methods("PUT")
    api.HandleFunc("/providers/{id}", s.handleDeleteProvider).Methods("DELETE")
    api.HandleFunc("/providers/test", s.handleTestProvider).Methods("POST")

    // Config
    api.HandleFunc("/config", s.handleGetConfig).Methods("GET")
    api.HandleFunc("/config", s.handleUpdateConfig).Methods("PUT")

    // License
    api.HandleFunc("/license/validate", s.handleValidateLicense).Methods("POST")
    api.HandleFunc("/license/status", s.handleLicenseStatus).Methods("GET")

    // Update
    api.HandleFunc("/update/check", s.handleCheckUpdate).Methods("GET")
    api.HandleFunc("/update/apply", s.handleApplyUpdate).Methods("POST")

    // Logs
    api.HandleFunc("/logs", s.handleGetLogs).Methods("GET")
    api.HandleFunc("/logs/stream", s.handleStreamLogs).Methods("GET") // WebSocket

    // === Web UI ===
    s.router.HandleFunc("/", s.handleUI).Methods("GET")
}
```

### 1.3 Middleware

```go
// internal/server/middleware.go
func (s *Server) setupMiddleware() {
    s.router.Use(s.corsMiddleware)
    s.router.Use(s.loggingMiddleware)
    s.router.Use(s.recoveryMiddleware)
}

func (s *Server) corsMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        origin := r.Header.Get("Origin")
        allowed := []string{
            "https://jinkaka98.github.io",
            fmt.Sprintf("http://localhost:%d", s.config.Server.Port),
            "http://localhost:5173", // Vite dev
        }

        for _, a := range allowed {
            if origin == a {
                w.Header().Set("Access-Control-Allow-Origin", origin)
                break
            }
        }
        w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Token, Authorization")

        if r.Method == "OPTIONS" {
            w.WriteHeader(http.StatusNoContent)
            return
        }
        next.ServeHTTP(w, r)
    })
}

func (s *Server) authMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := r.Header.Get("X-API-Token")
        if token != s.config.APIToken {
            http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
            return
        }
        next.ServeHTTP(w, r)
    })
}

func (s *Server) loggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        wrapped := &responseWriter{ResponseWriter: w, statusCode: 200}
        next.ServeHTTP(wrapped, r)

        log.Info().
            Str("method", r.Method).
            Str("path", r.URL.Path).
            Int("status", wrapped.statusCode).
            Dur("duration", time.Since(start)).
            Msg("request")
    })
}
```

### 1.4 Proxy Core

```go
// internal/proxy/proxy.go
package proxy

type Proxy struct {
    registry *provider.Registry
    config   *config.Config
}

func New(reg *provider.Registry, cfg *config.Config) *Proxy {
    return &Proxy{registry: reg, config: cfg}
}

func (p *Proxy) HandleChatCompletions(w http.ResponseWriter, r *http.Request) {
    // 1. Parse incoming request (OpenAI format)
    var req OpenAIChatRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request body")
        return
    }

    // 2. Find provider for requested model
    prov, err := p.registry.FindByModel(req.Model)
    if err != nil {
        writeError(w, http.StatusBadRequest, fmt.Sprintf("no provider for model: %s", req.Model))
        return
    }

    // 3. Transform request to provider format
    provReq, err := prov.TransformRequest(req)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "request transform failed")
        return
    }

    // 4. Forward to provider
    if req.Stream {
        p.handleStreaming(w, r, prov, provReq)
    } else {
        p.handleNonStreaming(w, r, prov, provReq)
    }
}

func (p *Proxy) handleStreaming(w http.ResponseWriter, r *http.Request, prov provider.Provider, body []byte) {
    // Set SSE headers
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")

    flusher, ok := w.(http.Flusher)
    if !ok {
        writeError(w, http.StatusInternalServerError, "streaming not supported")
        return
    }

    // Forward request to provider
    resp, err := prov.Send(r.Context(), body)
    if err != nil {
        writeError(w, http.StatusBadGateway, "provider request failed")
        return
    }
    defer resp.Body.Close()

    // Stream response back to client
    scanner := bufio.NewScanner(resp.Body)
    for scanner.Scan() {
        line := scanner.Text()

        // Transform provider SSE → OpenAI SSE format
        transformed, err := prov.TransformStreamChunk(line)
        if err != nil {
            continue
        }

        fmt.Fprintf(w, "%s\n", transformed)
        flusher.Flush()
    }
}

func (p *Proxy) handleNonStreaming(w http.ResponseWriter, r *http.Request, prov provider.Provider, body []byte) {
    resp, err := prov.Send(r.Context(), body)
    if err != nil {
        writeError(w, http.StatusBadGateway, "provider request failed")
        return
    }
    defer resp.Body.Close()

    // Read provider response
    respBody, _ := io.ReadAll(resp.Body)

    // Transform to OpenAI format
    transformed, err := prov.TransformResponse(respBody)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "response transform failed")
        return
    }

    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(resp.StatusCode)
    w.Write(transformed)
}
```

### 1.5 Provider Adapter Pattern

```go
// internal/provider/provider.go
package provider

// Provider interface - semua provider HARUS implement ini
type Provider interface {
    // Identity
    ID() string
    Name() string
    Type() string

    // Capabilities
    Models() []string
    SupportsStreaming() bool

    // Request lifecycle
    TransformRequest(req OpenAIChatRequest) ([]byte, error)
    Send(ctx context.Context, body []byte) (*http.Response, error)
    TransformResponse(body []byte) ([]byte, error)
    TransformStreamChunk(line string) (string, error)

    // Health
    TestConnection(ctx context.Context) error
}

// BaseProvider - shared logic untuk semua providers
type BaseProvider struct {
    id       string
    name     string
    endpoint string
    apiKey   string
    client   *http.Client
}

func (b *BaseProvider) Send(ctx context.Context, body []byte) (*http.Response, error) {
    req, err := http.NewRequestWithContext(ctx, "POST", b.endpoint+"/chat/completions", bytes.NewReader(body))
    if err != nil {
        return nil, err
    }
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+b.apiKey)
    return b.client.Do(req)
}
```

```go
// internal/provider/enowx.go
package provider

type EnowXProvider struct {
    BaseProvider
    models []string
}

func NewEnowX(cfg ProviderConfig) *EnowXProvider {
    return &EnowXProvider{
        BaseProvider: BaseProvider{
            id:       cfg.ID,
            name:     cfg.Name,
            endpoint: cfg.Endpoint, // https://api.enowx.com/v1
            apiKey:   cfg.APIKey,
            client:   &http.Client{Timeout: 120 * time.Second},
        },
        models: cfg.Models,
    }
}

func (e *EnowXProvider) TransformRequest(req OpenAIChatRequest) ([]byte, error) {
    // enowX uses OpenAI-compatible format, minimal transform needed
    return json.Marshal(req)
}

func (e *EnowXProvider) TransformResponse(body []byte) ([]byte, error) {
    // Already OpenAI-compatible, pass through
    return body, nil
}

func (e *EnowXProvider) TransformStreamChunk(line string) (string, error) {
    // Pass through SSE format
    return line, nil
}

func (e *EnowXProvider) TestConnection(ctx context.Context) error {
    req, _ := http.NewRequestWithContext(ctx, "GET", e.endpoint+"/models", nil)
    req.Header.Set("Authorization", "Bearer "+e.apiKey)
    resp, err := e.client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    if resp.StatusCode != 200 {
        return fmt.Errorf("connection test failed: status %d", resp.StatusCode)
    }
    return nil
}
```

```go
// internal/provider/registry.go
package provider

type Registry struct {
    providers map[string]Provider
    modelMap  map[string]string // model → provider_id
}

func NewRegistry(configs []ProviderConfig) *Registry {
    r := &Registry{
        providers: make(map[string]Provider),
        modelMap:  make(map[string]string),
    }
    for _, cfg := range configs {
        r.Register(cfg)
    }
    return r
}

func (r *Registry) Register(cfg ProviderConfig) error {
    var prov Provider
    switch cfg.Type {
    case "enowx":
        prov = NewEnowX(cfg)
    case "openai":
        prov = NewOpenAI(cfg)
    default:
        return fmt.Errorf("unknown provider type: %s", cfg.Type)
    }

    r.providers[cfg.ID] = prov
    for _, model := range cfg.Models {
        r.modelMap[model] = cfg.ID
    }
    return nil
}

func (r *Registry) FindByModel(model string) (Provider, error) {
    provID, ok := r.modelMap[model]
    if !ok {
        return nil, fmt.Errorf("no provider for model: %s", model)
    }
    return r.providers[provID], nil
}
```

### 1.6 Configuration Management

```go
// internal/config/config.go
package config

import (
    "crypto/rand"
    "encoding/hex"
    "encoding/json"
    "os"
    "path/filepath"
)

type Config struct {
    Version  string        `json:"version"`
    Server   ServerConfig  `json:"server"`
    APIToken string        `json:"api_token"`
    License  LicenseConfig `json:"license"`
    Providers []ProviderConfig `json:"providers"`
    Routes   []RouteConfig `json:"routes"`
    Logging  LogConfig     `json:"logging"`
}

type ServerConfig struct {
    Port            int    `json:"port"`
    Host            string `json:"host"`
    UIURL           string `json:"ui_url"`
    AutoOpenBrowser bool   `json:"auto_open_browser"`
}

type ProviderConfig struct {
    ID       string   `json:"id"`
    Name     string   `json:"name"`
    Type     string   `json:"type"`     // enowx, openai, anthropic, custom
    Endpoint string   `json:"endpoint"`
    APIKey   string   `json:"api_key"`
    Enabled  bool     `json:"enabled"`
    Models   []string `json:"models"`
}

type LicenseConfig struct {
    Key         string `json:"key"`
    ValidatedAt string `json:"validated_at"`
    ExpiresAt   string `json:"expires_at"`
    Features    []string `json:"features"`
}

type RouteConfig struct {
    Path         string            `json:"path"`
    ProviderID   string            `json:"provider_id"`
    ModelMapping map[string]string `json:"model_mapping"`
}

type LogConfig struct {
    Level        string `json:"level"`
    LogRequests  bool   `json:"log_requests"`
    LogResponses bool   `json:"log_responses"`
}

// ConfigDir returns %LOCALAPPDATA%\xixero\ on Windows
func ConfigDir() string {
    return filepath.Join(os.Getenv("LOCALAPPDATA"), "xixero")
}

func ConfigPath() string {
    return filepath.Join(ConfigDir(), "config.json")
}

func Load() (*Config, error) {
    data, err := os.ReadFile(ConfigPath())
    if err != nil {
        if os.IsNotExist(err) {
            return CreateDefault()
        }
        return nil, err
    }

    var cfg Config
    if err := json.Unmarshal(data, &cfg); err != nil {
        return nil, fmt.Errorf("parse config: %w", err)
    }
    return &cfg, nil
}

func (c *Config) Save() error {
    data, err := json.MarshalIndent(c, "", "  ")
    if err != nil {
        return err
    }
    os.MkdirAll(ConfigDir(), 0755)
    return os.WriteFile(ConfigPath(), data, 0644)
}

func CreateDefault() (*Config, error) {
    token := make([]byte, 32)
    rand.Read(token)

    cfg := &Config{
        Version: "1.0.0",
        Server: ServerConfig{
            Port:            7860,
            Host:            "127.0.0.1",
            UIURL:           "https://jinkaka98.github.io",
            AutoOpenBrowser: true,
        },
        APIToken:  hex.EncodeToString(token),
        Providers: []ProviderConfig{},
        Logging: LogConfig{
            Level:       "info",
            LogRequests: true,
        },
    }

    if err := cfg.Save(); err != nil {
        return nil, err
    }
    return cfg, nil
}
```

### 1.7 License Validation

```go
// internal/license/license.go
package license

type LicenseClient struct {
    serverURL string
    httpClient *http.Client
}

type ValidationResult struct {
    Valid     bool     `json:"valid"`
    Features []string `json:"features"`
    ExpiresAt string  `json:"expires_at"`
    Message  string   `json:"message"`
}

func NewClient(serverURL string) *LicenseClient {
    return &LicenseClient{
        serverURL:  serverURL,
        httpClient: &http.Client{Timeout: 10 * time.Second},
    }
}

func (c *LicenseClient) Validate(key string) (*ValidationResult, error) {
    body, _ := json.Marshal(map[string]string{"key": key})
    resp, err := c.httpClient.Post(c.serverURL+"/validate", "application/json", bytes.NewReader(body))
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result ValidationResult
    json.NewDecoder(resp.Body).Decode(&result)
    return &result, nil
}

// Offline validation (cached license)
func ValidateOffline(cfg *config.LicenseConfig) bool {
    if cfg.Key == "" {
        return false
    }
    if cfg.ExpiresAt == "" {
        return false
    }
    expires, err := time.Parse(time.RFC3339, cfg.ExpiresAt)
    if err != nil {
        return false
    }
    return time.Now().Before(expires)
}
```

### 1.8 Auto-Update

```go
// internal/update/update.go
package update

type Updater struct {
    owner   string // "jinkaka98"
    repo    string // "xixero"
    current string // current version
    client  *http.Client
}

type Release struct {
    TagName string  `json:"tag_name"`
    Body    string  `json:"body"` // changelog
    Assets  []Asset `json:"assets"`
}

type Asset struct {
    Name               string `json:"name"`
    BrowserDownloadURL string `json:"browser_download_url"`
}

func New(currentVersion string) *Updater {
    return &Updater{
        owner:   "jinkaka98",
        repo:    "xixero",
        current: currentVersion,
        client:  &http.Client{Timeout: 30 * time.Second},
    }
}

func (u *Updater) Check() (*Release, bool, error) {
    url := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", u.owner, u.repo)
    resp, err := u.client.Get(url)
    if err != nil {
        return nil, false, err
    }
    defer resp.Body.Close()

    var release Release
    json.NewDecoder(resp.Body).Decode(&release)

    latest := strings.TrimPrefix(release.TagName, "v")
    hasUpdate := semver.Compare("v"+latest, "v"+u.current) > 0

    return &release, hasUpdate, nil
}

func (u *Updater) Apply(release *Release) error {
    // 1. Find correct asset for current OS/arch
    assetName := fmt.Sprintf("xixero-%s-%s", runtime.GOOS, runtime.GOARCH)
    if runtime.GOOS == "windows" {
        assetName += ".exe"
    }

    var downloadURL string
    for _, asset := range release.Assets {
        if asset.Name == assetName {
            downloadURL = asset.BrowserDownloadURL
            break
        }
    }
    if downloadURL == "" {
        return fmt.Errorf("no binary found for %s/%s", runtime.GOOS, runtime.GOARCH)
    }

    // 2. Download to temp
    tmpFile, _ := os.CreateTemp("", "xixero-update-*")
    defer os.Remove(tmpFile.Name())

    resp, _ := u.client.Get(downloadURL)
    defer resp.Body.Close()
    io.Copy(tmpFile, resp.Body)
    tmpFile.Close()

    // 3. Replace current binary
    currentExe, _ := os.Executable()
    backupExe := currentExe + ".old"

    os.Rename(currentExe, backupExe)
    os.Rename(tmpFile.Name(), currentExe)
    os.Chmod(currentExe, 0755)

    return nil
}
```

### 1.9 Web UI Handler

```go
// internal/server/ui.go
func (s *Server) handleUI(w http.ResponseWriter, r *http.Request) {
    // Serve HTML that loads React app from GitHub Pages
    html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Xixero - AI Gateway</title>
    <script>
        window.XIXERO_CONFIG = {
            apiBase: "http://localhost:%d",
            uiBase: "%s",
            version: "%s"
        };
    </script>
    <script type="module" crossorigin src="%s/assets/main.js"></script>
    <link rel="stylesheet" crossorigin href="%s/assets/main.css">
</head>
<body>
    <div id="root"></div>
</body>
</html>`,
        s.config.Server.Port,
        s.config.Server.UIURL,
        s.config.Version,
        s.config.Server.UIURL,
        s.config.Server.UIURL,
    )

    w.Header().Set("Content-Type", "text/html")
    w.Write([]byte(html))
}
```

---

## 2. Frontend Implementation (React)

### 2.1 Project Setup

```bash
npm create vite@latest web-ui -- --template react
cd web-ui
npm install react-router-dom
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input select dialog badge
npm install tailwindcss @tailwindcss/vite
```

### 2.2 Component Architecture

```
web-ui/src/
├── components/
│   ├── layout/
│   │   ├── Header.jsx          # Top nav bar
│   │   ├── Sidebar.jsx         # Side navigation
│   │   └── Layout.jsx          # Main layout wrapper
│   │
│   ├── dashboard/
│   │   ├── Dashboard.jsx       # Main dashboard page
│   │   ├── StatusCard.jsx      # Server status widget
│   │   └── StatsCard.jsx       # Usage statistics
│   │
│   ├── providers/
│   │   ├── ProviderList.jsx    # Provider list page
│   │   ├── ProviderCard.jsx    # Single provider card
│   │   └── ProviderForm.jsx    # Add/edit provider modal
│   │
│   ├── config/
│   │   └── ConfigEditor.jsx    # Config editor page
│   │
│   ├── license/
│   │   └── LicenseForm.jsx     # License activation
│   │
│   ├── logs/
│   │   └── RequestLog.jsx      # Real-time request logs
│   │
│   └── auth/
│       └── TokenInput.jsx      # API token input (first run)
│
├── hooks/
│   ├── useAPI.js               # API client hook
│   ├── useAuth.js              # Auth state management
│   └── useWebSocket.js         # Real-time log streaming
│
├── lib/
│   ├── api.js                  # API client singleton
│   └── utils.js                # Utility functions
│
├── App.jsx                     # Root component + router
└── main.jsx                    # Entry point
```

### 2.3 API Client

```javascript
// web-ui/src/lib/api.js
const API_BASE = window.XIXERO_CONFIG?.apiBase || 'http://localhost:7860';

class XixeroAPI {
    constructor() {
        this.token = localStorage.getItem('xixero_token') || '';
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('xixero_token', token);
    }

    async request(endpoint, options = {}) {
        const resp = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Token': this.token,
                ...options.headers,
            },
        });

        if (resp.status === 401) {
            localStorage.removeItem('xixero_token');
            window.location.reload();
            throw new Error('Unauthorized');
        }

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(err.error || `HTTP ${resp.status}`);
        }

        return resp.json();
    }

    // Status
    getStatus() { return this.request('/api/status'); }

    // Providers
    getProviders() { return this.request('/api/providers'); }
    addProvider(data) { return this.request('/api/providers', { method: 'POST', body: JSON.stringify(data) }); }
    updateProvider(id, data) { return this.request(`/api/providers/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
    deleteProvider(id) { return this.request(`/api/providers/${id}`, { method: 'DELETE' }); }
    testProvider(data) { return this.request('/api/providers/test', { method: 'POST', body: JSON.stringify(data) }); }

    // Config
    getConfig() { return this.request('/api/config'); }
    updateConfig(data) { return this.request('/api/config', { method: 'PUT', body: JSON.stringify(data) }); }

    // License
    validateLicense(key) { return this.request('/api/license/validate', { method: 'POST', body: JSON.stringify({ key }) }); }
    getLicenseStatus() { return this.request('/api/license/status'); }

    // Update
    checkUpdate() { return this.request('/api/update/check'); }
    applyUpdate() { return this.request('/api/update/apply', { method: 'POST' }); }

    // Logs
    getLogs(limit = 50) { return this.request(`/api/logs?limit=${limit}`); }
}

export const api = new XixeroAPI();
```

### 2.4 Auth Hook

```javascript
// web-ui/src/hooks/useAuth.js
import { useState, useEffect, createContext, useContext } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [authenticated, setAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('xixero_token');
        if (token) {
            api.setToken(token);
            api.getStatus()
                .then(() => setAuthenticated(true))
                .catch(() => setAuthenticated(false))
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (token) => {
        api.setToken(token);
        await api.getStatus(); // Will throw if invalid
        setAuthenticated(true);
    };

    const logout = () => {
        localStorage.removeItem('xixero_token');
        setAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{ authenticated, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
```

### 2.5 App Router

```jsx
// web-ui/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/layout/Layout';
import Dashboard from './components/dashboard/Dashboard';
import ProviderList from './components/providers/ProviderList';
import ConfigEditor from './components/config/ConfigEditor';
import RequestLog from './components/logs/RequestLog';
import TokenInput from './components/auth/TokenInput';

function ProtectedRoute({ children }) {
    const { authenticated, loading } = useAuth();
    if (loading) return <div>Loading...</div>;
    if (!authenticated) return <Navigate to="/auth" />;
    return children;
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/auth" element={<TokenInput />} />
                    <Route path="/" element={
                        <ProtectedRoute>
                            <Layout />
                        </ProtectedRoute>
                    }>
                        <Route index element={<Dashboard />} />
                        <Route path="providers" element={<ProviderList />} />
                        <Route path="config" element={<ConfigEditor />} />
                        <Route path="logs" element={<RequestLog />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
```

### 2.6 Key Component Example - Dashboard

```jsx
// web-ui/src/components/dashboard/Dashboard.jsx
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import StatusCard from './StatusCard';
import StatsCard from './StatsCard';

export default function Dashboard() {
    const [status, setStatus] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const data = await api.getStatus();
                setStatus(data);
            } catch (err) {
                setError(err.message);
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    if (error) return <div className="text-red-500">Error: {error}</div>;
    if (!status) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatusCard
                    title="Server"
                    value={status.status === 'running' ? 'Online' : 'Offline'}
                    variant={status.status === 'running' ? 'success' : 'error'}
                />
                <StatusCard
                    title="Version"
                    value={`v${status.version}`}
                />
                <StatusCard
                    title="Providers"
                    value={`${status.providers_count} active`}
                />
            </div>

            <StatsCard stats={status.stats} />
        </div>
    );
}
```

---

## 3. API Specifications

### 3.1 Proxy Endpoints (IDE → Provider)

#### POST /v1/chat/completions
```
Request:
  Headers:
    Authorization: Bearer <any-value> (ignored, uses provider key)
    Content-Type: application/json
  Body:
    {
      "model": "claude-sonnet-4",
      "messages": [{"role": "user", "content": "Hello"}],
      "stream": true,
      "temperature": 0.7
    }

Response (non-streaming):
    {
      "id": "chatcmpl-xxx",
      "object": "chat.completion",
      "model": "claude-sonnet-4",
      "choices": [{
        "index": 0,
        "message": {"role": "assistant", "content": "Hi!"},
        "finish_reason": "stop"
      }],
      "usage": {"prompt_tokens": 10, "completion_tokens": 5}
    }

Response (streaming):
    data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"Hi"}}]}
    data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"!"}}]}
    data: [DONE]
```

#### GET /v1/models
```
Response:
    {
      "object": "list",
      "data": [
        {"id": "claude-sonnet-4", "object": "model", "owned_by": "enowx"},
        {"id": "gpt-4", "object": "model", "owned_by": "enowx"}
      ]
    }
```

### 3.2 Management API

#### GET /api/status
```
Headers: X-API-Token: <token>
Response:
    {
      "status": "running",
      "version": "1.0.0",
      "uptime": "2h30m",
      "providers_count": 2,
      "license": {"active": true, "expires_at": "2027-04-23"},
      "stats": {
        "total_requests": 142,
        "success_rate": 98.6,
        "avg_response_ms": 1200
      }
    }
```

#### POST /api/providers
```
Headers: X-API-Token: <token>
Body:
    {
      "name": "My enowX AI",
      "type": "enowx",
      "endpoint": "https://api.enowx.com/v1",
      "api_key": "ENOWX-XXXXX",
      "models": ["claude-sonnet-4", "gpt-4"]
    }

Response (201):
    {
      "id": "enowx-a1b2c3",
      "name": "My enowX AI",
      "type": "enowx",
      "endpoint": "https://api.enowx.com/v1",
      "enabled": true,
      "models": ["claude-sonnet-4", "gpt-4"],
      "created_at": "2026-04-23T10:00:00Z"
    }
```

#### POST /api/providers/test
```
Body:
    {
      "type": "enowx",
      "endpoint": "https://api.enowx.com/v1",
      "api_key": "ENOWX-XXXXX"
    }

Response (200):
    {
      "success": true,
      "latency_ms": 230,
      "models": ["claude-sonnet-4", "gpt-4"]
    }

Response (400):
    {
      "success": false,
      "error": "Authentication failed: invalid API key"
    }
```

#### POST /api/license/validate
```
Body: { "key": "XIXERO-XXXXX-XXXXX" }

Response (200):
    {
      "valid": true,
      "features": ["unlimited_providers", "usage_analytics"],
      "expires_at": "2027-04-23T00:00:00Z"
    }

Response (400):
    {
      "valid": false,
      "message": "Invalid or expired license key"
    }
```

#### GET /api/update/check
```
Response:
    {
      "current": "1.0.0",
      "latest": "1.1.0",
      "has_update": true,
      "changelog": "- Added Anthropic support\n- Fixed streaming bug",
      "download_url": "https://github.com/jinkaka98/xixero/releases/..."
    }
```

---

## 4. Data Models

### 4.1 OpenAI-Compatible Request/Response

```go
// internal/proxy/models.go

type OpenAIChatRequest struct {
    Model       string    `json:"model"`
    Messages    []Message `json:"messages"`
    Stream      bool      `json:"stream,omitempty"`
    Temperature float64   `json:"temperature,omitempty"`
    MaxTokens   int       `json:"max_tokens,omitempty"`
    TopP        float64   `json:"top_p,omitempty"`
    Stop        []string  `json:"stop,omitempty"`
}

type Message struct {
    Role    string `json:"role"`
    Content string `json:"content"`
}

type OpenAIChatResponse struct {
    ID      string   `json:"id"`
    Object  string   `json:"object"`
    Created int64    `json:"created"`
    Model   string   `json:"model"`
    Choices []Choice `json:"choices"`
    Usage   Usage    `json:"usage"`
}

type Choice struct {
    Index        int     `json:"index"`
    Message      Message `json:"message,omitempty"`
    Delta        Message `json:"delta,omitempty"`
    FinishReason string  `json:"finish_reason,omitempty"`
}

type Usage struct {
    PromptTokens     int `json:"prompt_tokens"`
    CompletionTokens int `json:"completion_tokens"`
    TotalTokens      int `json:"total_tokens"`
}
```

### 4.2 API Error Response

```go
type APIError struct {
    Error   string `json:"error"`
    Code    string `json:"code,omitempty"`
    Details string `json:"details,omitempty"`
}

func writeError(w http.ResponseWriter, status int, msg string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(APIError{Error: msg})
}
```

---

## 5. Error Handling Patterns

### 5.1 Go Error Strategy

```go
// Wrap errors with context
func (r *Registry) FindByModel(model string) (Provider, error) {
    provID, ok := r.modelMap[model]
    if !ok {
        return nil, fmt.Errorf("provider not found for model %q", model)
    }
    prov, ok := r.providers[provID]
    if !ok {
        return nil, fmt.Errorf("provider %q registered but not loaded", provID)
    }
    return prov, nil
}

// HTTP handler error pattern
func (s *Server) handleAddProvider(w http.ResponseWriter, r *http.Request) {
    var req ProviderConfig
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, 400, "invalid request body")
        return
    }

    if err := validateProvider(req); err != nil {
        writeError(w, 400, err.Error())
        return
    }

    if err := s.registry.Register(req); err != nil {
        writeError(w, 500, fmt.Sprintf("register provider: %s", err))
        return
    }

    // Save to config
    s.config.Providers = append(s.config.Providers, req)
    if err := s.config.Save(); err != nil {
        writeError(w, 500, "failed to save config")
        return
    }

    w.WriteHeader(201)
    json.NewEncoder(w).Encode(req)
}
```

### 5.2 React Error Handling

```jsx
// Error boundary for component-level errors
class ErrorBoundary extends React.Component {
    state = { hasError: false, error: null };

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 bg-red-50 border border-red-200 rounded">
                    <h3 className="text-red-800 font-bold">Something went wrong</h3>
                    <p className="text-red-600">{this.state.error?.message}</p>
                    <button onClick={() => this.setState({ hasError: false })}>
                        Try Again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// Hook-level error handling
function useAPI(endpoint) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.request(endpoint)
            .then(setData)
            .catch(setError)
            .finally(() => setLoading(false));
    }, [endpoint]);

    return { data, error, loading };
}
```

---

## 6. PowerShell Installer

```powershell
# scripts/install.ps1
$ErrorActionPreference = "Stop"

$repo = "jinkaka98/xixero"
$installDir = "$env:LOCALAPPDATA\xixero"

Write-Host ""
Write-Host "  Xixero Installer" -ForegroundColor Cyan
Write-Host "  =================" -ForegroundColor Cyan
Write-Host ""

# 1. Get latest release
Write-Host "[1/5] Checking latest version..." -ForegroundColor Yellow
$release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest"
$version = $release.tag_name
Write-Host "       Latest: $version" -ForegroundColor Green

# 2. Find Windows binary
Write-Host "[2/5] Downloading binary..." -ForegroundColor Yellow
$asset = $release.assets | Where-Object { $_.name -like "*windows-amd64*" }
if (-not $asset) {
    Write-Host "ERROR: No Windows binary found in release" -ForegroundColor Red
    exit 1
}

# 3. Download
New-Item -ItemType Directory -Path $installDir -Force | Out-Null
$exePath = "$installDir\xixero.exe"
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $exePath
Write-Host "       Downloaded to $exePath" -ForegroundColor Green

# 4. Add to PATH
Write-Host "[3/5] Configuring PATH..." -ForegroundColor Yellow
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$installDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$installDir", "User")
    Write-Host "       Added to PATH" -ForegroundColor Green
} else {
    Write-Host "       Already in PATH" -ForegroundColor Green
}

# 5. Generate config
Write-Host "[4/5] Generating config..." -ForegroundColor Yellow
& $exePath config init 2>$null
Write-Host "       Config created" -ForegroundColor Green

# 6. Done
Write-Host "[5/5] Installation complete!" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Location: $installDir" -ForegroundColor White
Write-Host "  Version:  $version" -ForegroundColor White
Write-Host ""
Write-Host "  Quick Start:" -ForegroundColor Cyan
Write-Host "    1. Open a NEW terminal (to refresh PATH)"
Write-Host "    2. Run: xixero start"
Write-Host "    3. Browser will open automatically"
Write-Host ""
Write-Host "  Docs: https://github.com/$repo" -ForegroundColor DarkGray
Write-Host ""
```

---

**Document Version:** 1.0.0
**Last Updated:** 2026-04-23
**Next:** SECURITY.md (Security & Performance)
