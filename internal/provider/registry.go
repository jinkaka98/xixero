package provider

import (
	"fmt"

	"xixero/internal/config"
)

type Registry struct {
	providers map[string]Provider
	modelMap  map[string]string
}

func NewRegistry(configs []config.ProviderConfig) *Registry {
	r := &Registry{
		providers: make(map[string]Provider),
		modelMap:  make(map[string]string),
	}
	for _, cfg := range configs {
		if !cfg.Enabled {
			continue
		}
		_ = r.Register(cfg)
	}
	return r
}

func (r *Registry) Register(cfg config.ProviderConfig) error {
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

func (r *Registry) Unregister(id string) {
	prov, ok := r.providers[id]
	if !ok {
		return
	}
	for _, model := range prov.Models() {
		if r.modelMap[model] == id {
			delete(r.modelMap, model)
		}
	}
	delete(r.providers, id)
}

func (r *Registry) FindByModel(model string) (Provider, error) {
	provID, ok := r.modelMap[model]
	if !ok {
		return nil, fmt.Errorf("no provider for model: %s", model)
	}
	prov, ok := r.providers[provID]
	if !ok {
		return nil, fmt.Errorf("provider %s registered but not loaded", provID)
	}
	return prov, nil
}

func (r *Registry) FindByID(id string) (Provider, error) {
	prov, ok := r.providers[id]
	if !ok {
		return nil, fmt.Errorf("provider not found: %s", id)
	}
	return prov, nil
}

func (r *Registry) ListAll() []Provider {
	result := make([]Provider, 0, len(r.providers))
	for _, p := range r.providers {
		result = append(result, p)
	}
	return result
}

func (r *Registry) ListModels() []string {
	result := make([]string, 0, len(r.modelMap))
	for model := range r.modelMap {
		result = append(result, model)
	}
	return result
}
