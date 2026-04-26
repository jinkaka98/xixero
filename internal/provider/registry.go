package provider

import (
	"fmt"
	"sort"

	"xixero/internal/config"
	"xixero/internal/models"
)

type Registry struct {
	providers map[string]Provider
	modelMap  map[string]string
	rules     []config.RoutingRuleConfig
}

func NewRegistry(configs []config.ProviderConfig, rules []config.RoutingRuleConfig) *Registry {
	r := &Registry{
		providers: make(map[string]Provider),
		modelMap:  make(map[string]string),
		rules:     append([]config.RoutingRuleConfig{}, rules...),
	}
	for _, cfg := range configs {
		if !cfg.Enabled {
			continue
		}
		_ = r.Register(cfg)
	}
	r.sortRules()
	return r
}

func (r *Registry) Register(cfg config.ProviderConfig) error {
	var prov Provider
	switch cfg.Type {
	case "enowx":
		prov = NewEnowX(cfg)
	case "openai":
		prov = NewOpenAI(cfg)
	case "trae":
		prov = NewTrae(cfg)
	default:
		return fmt.Errorf("unknown provider type: %s", cfg.Type)
	}

	r.providers[cfg.ID] = prov
	for _, model := range cfg.Models {
		r.modelMap[model] = cfg.ID
	}
	return nil
}

func (r *Registry) SetRules(rules []config.RoutingRuleConfig) {
	r.rules = append([]config.RoutingRuleConfig{}, rules...)
	r.sortRules()
}

func (r *Registry) ListRules() []config.RoutingRuleConfig {
	return append([]config.RoutingRuleConfig{}, r.rules...)
}

func (r *Registry) Resolve(req models.ChatRequest, endpointType string) (Provider, string, models.RoutingResolution, error) {
	for _, rule := range r.rules {
		if !rule.Enabled {
			continue
		}
		if rule.EndpointType != "" && rule.EndpointType != endpointType && rule.EndpointType != "*" {
			continue
		}
		if rule.SourceModel != "" && rule.SourceModel != req.Model && rule.SourceModel != "*" {
			continue
		}
		prov, err := r.FindByID(rule.TargetProvider)
		if err != nil {
			continue
		}
		resolvedModel := req.Model
		if rule.TargetModel != "" {
			resolvedModel = rule.TargetModel
		}
		return prov, resolvedModel, models.RoutingResolution{
			ProviderID:  prov.ID(),
			Model:       resolvedModel,
			RuleID:      rule.ID,
			MatchedRule: rule.Name,
		}, nil
	}

	prov, err := r.FindByModel(req.Model)
	if err != nil {
		return nil, "", models.RoutingResolution{}, err
	}
	return prov, req.Model, models.RoutingResolution{ProviderID: prov.ID(), Model: req.Model}, nil
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
	sort.Slice(result, func(i, j int) bool { return result[i].ID() < result[j].ID() })
	return result
}

func (r *Registry) ListModels() []string {
	result := make([]string, 0, len(r.modelMap))
	for model := range r.modelMap {
		result = append(result, model)
	}
	sort.Strings(result)
	return result
}

func (r *Registry) sortRules() {
	sort.SliceStable(r.rules, func(i, j int) bool {
		if r.rules[i].Priority == r.rules[j].Priority {
			return r.rules[i].Name < r.rules[j].Name
		}
		return r.rules[i].Priority < r.rules[j].Priority
	})
}
