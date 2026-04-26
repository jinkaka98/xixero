package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
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
	return s.httpServer.ListenAndServe()
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
