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
	"xixero/internal/provider"
	"xixero/internal/proxy"
)

type Server struct {
	router     *mux.Router
	httpServer *http.Server
	config     *config.Config
	proxy      *proxy.Proxy
	registry   *provider.Registry
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
	reg := provider.NewRegistry(cfg.Providers)
	prx := proxy.New(reg, cfg)

	s := &Server{
		router:    router,
		config:    cfg,
		proxy:     prx,
		registry:  reg,
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

	// Proxy endpoints (IDE → Provider) — no auth required
	s.router.HandleFunc("/v1/chat/completions", s.proxy.HandleChatCompletions).Methods(http.MethodPost)
	s.router.HandleFunc("/v1/models", s.proxy.HandleModels).Methods(http.MethodGet)
	s.router.HandleFunc("/v1/embeddings", s.proxy.HandleEmbeddings).Methods(http.MethodPost)

	// Public status
	s.router.HandleFunc("/api/status", s.handleStatus).Methods(http.MethodGet)

	// Management API — auth required
	mgmt := s.router.PathPrefix("/api").Subrouter()
	mgmt.Use(s.authMiddleware)

	mgmt.HandleFunc("/providers", h.ListProviders).Methods(http.MethodGet)
	mgmt.HandleFunc("/providers", h.AddProvider).Methods(http.MethodPost)
	mgmt.HandleFunc("/providers/test", h.TestProvider).Methods(http.MethodPost)
	mgmt.HandleFunc("/providers/{id}", h.GetProvider).Methods(http.MethodGet)
	mgmt.HandleFunc("/providers/{id}", h.DeleteProvider).Methods(http.MethodDelete)
	mgmt.HandleFunc("/config", h.GetConfig).Methods(http.MethodGet)
	mgmt.HandleFunc("/config", h.UpdateConfig).Methods(http.MethodPut)
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
