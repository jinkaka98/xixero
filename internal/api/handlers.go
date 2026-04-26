package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
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

	filteredRules := make([]config.RoutingRuleConfig, 0, len(h.config.RoutingRules))
	for _, rule := range h.config.RoutingRules {
		if rule.TargetProvider != id {
			filteredRules = append(filteredRules, rule)
		}
	}
	h.config.RoutingRules = filteredRules
	h.registry.SetRules(filteredRules)

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

	prov, err := newProviderForType(cfg)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	start := time.Now()
	if err := prov.TestConnection(r.Context()); err != nil {
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
		Version:      h.config.Version,
		Server:       h.config.Server,
		Logging:      h.config.Logging,
		RoutingRules: h.config.RoutingRules,
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
	if req.RoutingRules != nil {
		h.config.RoutingRules = *req.RoutingRules
		h.registry.SetRules(*req.RoutingRules)
	}

	if err := h.config.Save(); err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "failed to save config"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "config updated"})
}

func (h *Handlers) ListRoutingRules(w http.ResponseWriter, r *http.Request) {
	rules := append([]config.RoutingRuleConfig{}, h.config.RoutingRules...)
	sort.SliceStable(rules, func(i, j int) bool {
		if rules[i].Priority == rules[j].Priority {
			return rules[i].Name < rules[j].Name
		}
		return rules[i].Priority < rules[j].Priority
	})
	writeJSON(w, http.StatusOK, rules)
}

func (h *Handlers) CreateRoutingRule(w http.ResponseWriter, r *http.Request) {
	var req routingRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid request body"})
		return
	}
	if req.Name == "" || req.TargetProvider == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "name and target_provider are required"})
		return
	}
	if _, err := h.registry.FindByID(req.TargetProvider); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	rule := config.RoutingRuleConfig{
		ID:             fmt.Sprintf("rule-%d", time.Now().UnixMilli()),
		Name:           req.Name,
		SourceModel:    req.SourceModel,
		TargetProvider: req.TargetProvider,
		TargetModel:    req.TargetModel,
		EndpointType:   req.EndpointType,
		Enabled:        req.Enabled,
		Priority:       req.Priority,
	}
	if rule.EndpointType == "" {
		rule.EndpointType = "chat"
	}

	h.config.RoutingRules = append(h.config.RoutingRules, rule)
	h.registry.SetRules(h.config.RoutingRules)
	if err := h.config.Save(); err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "failed to save config"})
		return
	}

	writeJSON(w, http.StatusCreated, rule)
}

func (h *Handlers) UpdateRoutingRule(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	var req routingRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid request body"})
		return
	}

	updated := false
	for i := range h.config.RoutingRules {
		if h.config.RoutingRules[i].ID == id {
			if req.Name != "" {
				h.config.RoutingRules[i].Name = req.Name
			}
			h.config.RoutingRules[i].SourceModel = req.SourceModel
			h.config.RoutingRules[i].TargetProvider = req.TargetProvider
			h.config.RoutingRules[i].TargetModel = req.TargetModel
			h.config.RoutingRules[i].EndpointType = req.EndpointType
			h.config.RoutingRules[i].Enabled = req.Enabled
			h.config.RoutingRules[i].Priority = req.Priority
			updated = true
			break
		}
	}
	if !updated {
		writeJSON(w, http.StatusNotFound, errorResponse{Error: "routing rule not found"})
		return
	}

	h.registry.SetRules(h.config.RoutingRules)
	if err := h.config.Save(); err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "failed to save config"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "routing rule updated"})
}

func (h *Handlers) DeleteRoutingRule(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	updated := make([]config.RoutingRuleConfig, 0, len(h.config.RoutingRules))
	found := false
	for _, rule := range h.config.RoutingRules {
		if rule.ID == id {
			found = true
			continue
		}
		updated = append(updated, rule)
	}
	if !found {
		writeJSON(w, http.StatusNotFound, errorResponse{Error: "routing rule not found"})
		return
	}
	
	h.config.RoutingRules = updated
	h.registry.SetRules(updated)
	if err := h.config.Save(); err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "failed to save config"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "routing rule deleted"})
}

func newProviderForType(cfg config.ProviderConfig) (provider.Provider, error) {
	switch cfg.Type {
	case "enowx":
		return provider.NewEnowX(cfg), nil
	case "openai":
		return provider.NewOpenAI(cfg), nil
	case "trae":
		return provider.NewTrae(cfg), nil
	default:
		return nil, fmt.Errorf("unknown provider type: %s", cfg.Type)
	}
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

type routingRuleRequest struct {
	Name           string `json:"name"`
	SourceModel    string `json:"source_model"`
	TargetProvider string `json:"target_provider"`
	TargetModel    string `json:"target_model"`
	EndpointType   string `json:"endpoint_type"`
	Enabled        bool   `json:"enabled"`
	Priority       int    `json:"priority"`
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
	Version      string                     `json:"version"`
	Server       config.ServerConfig        `json:"server"`
	Logging      config.LogConfig           `json:"logging"`
	RoutingRules []config.RoutingRuleConfig `json:"routing_rules"`
}

type updateConfigRequest struct {
	Logging      *config.LogConfig           `json:"logging,omitempty"`
	RoutingRules *[]config.RoutingRuleConfig `json:"routing_rules,omitempty"`
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}
