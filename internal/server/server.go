package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os/exec"
	"runtime"
	"time"

	"github.com/gorilla/mux"

	"xixero/internal/api"
	"xixero/internal/config"
	"xixero/internal/license"
	"xixero/internal/provider"
	"xixero/internal/proxy"
)

type Server struct {
	router     *mux.Router
	httpServer *http.Server
	config     *config.Config
	proxy      *proxy.Proxy
	registry   *provider.Registry
	enforcer   *license.Enforcer
	startedAt  time.Time
}

type statusResponse struct {
	Status         string `json:"status"`
	Version        string `json:"version"`
	ProvidersCount int    `json:"providers_count"`
	Uptime         string `json:"uptime"`
}

func New(cfg *config.Config) *Server {
	router := mux.NewRouter()
	reg := provider.NewRegistry(cfg.Providers, cfg.RoutingRules)
	prx := proxy.New(reg, cfg)

	validationURL := "https://raw.githubusercontent.com/jinkaka98/xixero/main/tunnel-config.json"
	if cfg.License.ValidationURLSource != "" {
		validationURL = cfg.License.ValidationURLSource
	}
	enf := license.NewEnforcer(config.ConfigDir(), validationURL)

	s := &Server{
		router:    router,
		config:    cfg,
		proxy:     prx,
		registry:  reg,
		enforcer:  enf,
		startedAt: time.Now(),
	}

	s.setupMiddleware()
	s.setupRoutes()
	s.httpServer = &http.Server{
		Addr:              net.JoinHostPort(cfg.Server.Host, fmt.Sprintf("%d", cfg.Server.Port)),
		Handler:           s.router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	return s
}

func (s *Server) Start() error {
	// Auto-open browser after short delay
	go func() {
		time.Sleep(800 * time.Millisecond)
		url := fmt.Sprintf("http://localhost:%d", s.config.Server.Port)
		openBrowser(url)
	}()
	return s.httpServer.ListenAndServe()
}

func openBrowser(url string) {
	var err error
	switch runtime.GOOS {
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	default:
		err = exec.Command("xdg-open", url).Start()
	}
	_ = err
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}

func (s *Server) setupMiddleware() {
	s.router.Use(s.recoveryMiddleware)
	s.router.Use(s.corsMiddleware)
	s.router.Use(s.loggingMiddleware)
}

func (s *Server) setupRoutes() {
	h := api.NewHandlers(s.config, s.registry)

	proxyRoutes := s.router.PathPrefix("/v1").Subrouter()
	proxyRoutes.Use(s.licenseMiddleware)
	proxyRoutes.HandleFunc("/chat/completions", s.proxy.HandleChatCompletions).Methods(http.MethodPost)
	proxyRoutes.HandleFunc("/models", s.proxy.HandleModels).Methods(http.MethodGet)
	proxyRoutes.HandleFunc("/embeddings", s.proxy.HandleEmbeddings).Methods(http.MethodPost)

	s.router.HandleFunc("/api/status", s.handleStatus).Methods(http.MethodGet, http.MethodOptions)

	mgmt := s.router.PathPrefix("/api").Subrouter()
	mgmt.Use(s.authMiddleware)

	mgmt.HandleFunc("/providers", h.ListProviders).Methods(http.MethodGet, http.MethodOptions)
	mgmt.HandleFunc("/providers", h.AddProvider).Methods(http.MethodPost, http.MethodOptions)
	mgmt.HandleFunc("/providers/test", h.TestProvider).Methods(http.MethodPost, http.MethodOptions)
	mgmt.HandleFunc("/providers/{id}", h.GetProvider).Methods(http.MethodGet, http.MethodOptions)
	mgmt.HandleFunc("/providers/{id}", h.DeleteProvider).Methods(http.MethodDelete, http.MethodOptions)
	mgmt.HandleFunc("/config", h.GetConfig).Methods(http.MethodGet, http.MethodOptions)
	mgmt.HandleFunc("/config", h.UpdateConfig).Methods(http.MethodPut, http.MethodOptions)
	mgmt.HandleFunc("/routing-rules", h.ListRoutingRules).Methods(http.MethodGet, http.MethodOptions)
	mgmt.HandleFunc("/routing-rules", h.CreateRoutingRule).Methods(http.MethodPost, http.MethodOptions)
	mgmt.HandleFunc("/routing-rules/{id}", h.UpdateRoutingRule).Methods(http.MethodPut, http.MethodOptions)
	mgmt.HandleFunc("/routing-rules/{id}", h.DeleteRoutingRule).Methods(http.MethodDelete, http.MethodOptions)

	// Catch-all: serve HTML shell for any non-API GET request (SPA routing)
	s.router.PathPrefix("/").HandlerFunc(s.handleUI).Methods(http.MethodGet)
}

func (s *Server) handleUI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Xixero</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0f;color:#e8e4df;font-family:monospace;min-height:100vh}
#app{min-height:100vh}
.loader{min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px}
.spinner{width:32px;height:32px;border:3px solid rgba(255,140,0,0.2);border-top-color:#ff8c00;border-radius:50%%;animation:spin 0.8s linear infinite}
.loader p{color:#6b6560;font-size:13px;letter-spacing:0.1em}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
<script>
window.XIXERO_CONFIG={apiBase:"http://localhost:%d"};
</script>
</head>
<body>
<div id="root">
<div class="loader">
<div class="spinner"></div>
<p>LOADING XIXERO...</p>
</div>
</div>
<script type="module" crossorigin src="https://jinkaka98.github.io/ui/assets/app.js"></script>
<link rel="stylesheet" crossorigin href="https://jinkaka98.github.io/ui/assets/index.css">
</body>
</html>`, s.config.Server.Port)
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, statusResponse{
		Status:         "running",
		Version:        s.config.Version,
		ProvidersCount: len(s.registry.ListAll()),
		Uptime:         time.Since(s.startedAt).Round(time.Second).String(),
	})
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
	}
}
