package proxy

import (
	"encoding/json"
	"testing"

	"xixero/internal/models"
)

func TestInjectRoutingMetadata(t *testing.T) {
	payload := []byte(`{"id":"chatcmpl-test","object":"chat.completion","created":123,"model":"gpt-4","choices":[{"index":0,"message":{"role":"assistant","content":"OK"}}]}`)
	resolution := models.RoutingResolution{
		ProviderID:  "provider-1",
		Model:       "claude-opus-4.6",
		RuleID:      "rule-123",
		MatchedRule: "Route Claude",
	}

	enriched := injectRoutingMetadata(payload, resolution)

	var decoded map[string]any
	if err := json.Unmarshal(enriched, &decoded); err != nil {
		t.Fatalf("unmarshal enriched response: %v", err)
	}

	routing, ok := decoded["x_routing"].(map[string]any)
	if !ok {
		t.Fatalf("expected x_routing object, got %T", decoded["x_routing"])
	}

	if got := routing["provider_id"]; got != resolution.ProviderID {
		t.Fatalf("provider_id mismatch: got %v want %s", got, resolution.ProviderID)
	}
	if got := routing["model"]; got != resolution.Model {
		t.Fatalf("model mismatch: got %v want %s", got, resolution.Model)
	}
	if got := routing["rule_id"]; got != resolution.RuleID {
		t.Fatalf("rule_id mismatch: got %v want %s", got, resolution.RuleID)
	}
	if got := routing["matched_rule"]; got != resolution.MatchedRule {
		t.Fatalf("matched_rule mismatch: got %v want %s", got, resolution.MatchedRule)
	}

	choices, ok := decoded["choices"].([]any)
	if !ok || len(choices) != 1 {
		t.Fatalf("expected original choices to remain intact, got %#v", decoded["choices"])
	}
}

func TestInjectRoutingMetadataReturnsOriginalPayloadWhenInvalidJSON(t *testing.T) {
	payload := []byte("not-json")
	resolution := models.RoutingResolution{ProviderID: "provider-1", Model: "gpt-4"}

	enriched := injectRoutingMetadata(payload, resolution)

	if string(enriched) != string(payload) {
		t.Fatalf("expected original payload to be returned for invalid JSON")
	}
}
