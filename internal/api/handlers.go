package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"

	"xixero/internal/config"
	"xixero/internal/provider"
)

type Handlers struct {
	config   *config.Config
	registry *provider.Registry
}

func NewHandlers(cfg *config.Config, reg *provider.Registry) *Handlers {
	return &Handlers{config: cfg, registry: reg}
}

func (h *Handlers) ListProviders(w http.ResponseWriter, r *http.Request) {
	providers := h.registry.ListAll()
	result := make([]providerResponse, 0, len(providers))

	for _, p := range providers {
		result = append(result, providerResponse{
			ID:      p.ID(),
			Name:    p.Name(),
			Type:    p.Type(),
			Models:  p.Models(),
			Enabled: true,
		})
	}

	writeJSON(w, http.StatusOK, result)
}

func (h *Handlers) AddProvider(w http.ResponseWriter, r *http.Request) {
	var req addProviderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid request body"})
		return
	}

	if req.Name == "" || req.Type == "" || req.Endpoint == "" || req.APIKey == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "name, type, endpoint, and api_key are required"})
		return
	}

	cfg := config.ProviderConfig{
		ID:       fmt.Sprintf("%s-%d", req.Type, time.Now().UnixMilli()),
		Name:     req.Name,
		Type:     req.Type,
		Endpoint: req.Endpoint,
		APIKey:   req.APIKey,
		Enabled:  true,
		Models:   req.Models,
	}

	if err := h.registry.Register(cfg); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	h.config.Providers = append(h.config.Providers, cfg)
	if err := h.config.Save(); err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "failed to save config"})
		return
	}

	writeJSON(w, http.StatusCreated, providerResponse{
		ID:      cfg.ID,
		Name:    cfg.Name,
		Type:    cfg.Type,
		Models:  cfg.Models,
		Enabled: cfg.Enabled,
	})
}

func (h *Handlers) GetProvider(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	prov, err := h.registry.FindByID(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, errorResponse{Error: err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, providerResponse{
		ID:      prov.ID(),
		Name:    prov.Name(),
		Type:    prov.Type(),
		Models:  prov.Models(),
		Enabled: true,
	})
}

func (h *Handlers) DeleteProvider(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	if _, err := h.registry.FindByID(id); err != nil {
		writeJSON(w, http.StatusNotFound, errorResponse{Error: err.Error()})
		return
	}

	h.registry.Unregister(id)

	updated := make([]config.ProviderConfig, 0)
	for _, p := range h.config.Providers {
		if p.ID != id {
			updated = append(updated, p)
		}
	}
	h.config.Providers = updated

	if err := h.config.Save(); err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "failed to save config"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "provider deleted"})
}

func (h *Handlers) TestProvider(w http.ResponseWriter, r *http.Request) {
	var req testProviderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid request body"})
		return
	}

	cfg := config.ProviderConfig{
		ID:       "test-temp",
		Name:     "test",
		Type:     req.Type,
		Endpoint: req.Endpoint,
		APIKey:   req.APIKey,
		Enabled:  true,
	}

	var prov provider.Provider
	switch req.Type {
	case "enowx":
		prov = provider.NewEnowX(cfg)
	case "openai":
		prov = provider.NewOpenAI(cfg)
	default:
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: fmt.Sprintf("unknown provider type: %s", req.Type)})
		return
	}

	ctx, cancel := r.Context(), func() {}
	_ = cancel
	start := time.Now()

	if err := prov.TestConnection(ctx); err != nil {
		writeJSON(w, http.StatusOK, testProviderResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, testProviderResponse{
		Success:   true,
		LatencyMs: time.Since(start).Milliseconds(),
	})
}

func (h *Handlers) GetConfig(w http.ResponseWriter, r *http.Request) {
	safe := safeConfig{
		Version: h.config.Version,
		Server:  h.config.Server,
		Logging: h.config.Logging,
	}
	writeJSON(w, http.StatusOK, safe)
}

func (h *Handlers) UpdateConfig(w http.ResponseWriter, r *http.Request) {
	var req updateConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid request body"})
		return
	}

	if req.Logging != nil {
		h.config.Logging = *req.Logging
	}

	if err := h.config.Save(); err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "failed to save config"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "config updated"})
}

type providerResponse struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	Type    string   `json:"type"`
	Models  []string `json:"models"`
	Enabled bool     `json:"enabled"`
}

type addProviderRequest struct {
	Name     string   `json:"name"`
	Type     string   `json:"type"`
	Endpoint string   `json:"endpoint"`
	APIKey   string   `json:"api_key"`
	Models   []string `json:"models"`
}

type testProviderRequest struct {
	Type     string `json:"type"`
	Endpoint string `json:"endpoint"`
	APIKey   string `json:"api_key"`
}

type testProviderResponse struct {
	Success   bool   `json:"success"`
	LatencyMs int64  `json:"latency_ms,omitempty"`
	Error     string `json:"error,omitempty"`
}

type errorResponse struct {
	Error string `json:"error"`
}

type safeConfig struct {
	Version string              `json:"version"`
	Server  config.ServerConfig `json:"server"`
	Logging config.LogConfig    `json:"logging"`
}

type updateConfigRequest struct {
	Logging *config.LogConfig `json:"logging,omitempty"`
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(payload)
}
