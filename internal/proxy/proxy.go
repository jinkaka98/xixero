package proxy

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"xixero/internal/config"
	"xixero/internal/models"
	"xixero/internal/provider"
)

type Proxy struct {
	registry *provider.Registry
	config   *config.Config
}

func New(reg *provider.Registry, cfg *config.Config) *Proxy {
	return &Proxy{registry: reg, config: cfg}
}

func (p *Proxy) HandleChatCompletions(w http.ResponseWriter, r *http.Request) {
	var req models.ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	prov, resolvedModel, resolution, err := p.registry.Resolve(req, "chat")
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if resolvedModel != "" {
		req.Model = resolvedModel
	}

	body, err := prov.TransformRequest(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "request transform failed")
		return
	}

	if req.Stream {
		p.handleStreaming(w, r, prov, body)
		return
	}
	p.handleNonStreaming(w, r, prov, body, resolution)
}

func (p *Proxy) HandleModels(w http.ResponseWriter, r *http.Request) {
	providers := p.registry.ListAll()
	var items []models.ModelInfo

	for _, prov := range providers {
		for _, m := range prov.Models() {
			items = append(items, models.ModelInfo{
				ID:      m,
				Object:  "model",
				OwnedBy: prov.Type(),
			})
		}
	}

	if items == nil {
		items = []models.ModelInfo{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(models.ModelList{
		Object: "list",
		Data:   items,
	})
}

func (p *Proxy) HandleEmbeddings(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "embeddings not yet supported")
}

func (p *Proxy) handleStreaming(w http.ResponseWriter, r *http.Request, prov provider.Provider, body []byte) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming not supported")
		return
	}

	resp, err := prov.Send(r.Context(), body)
	if err != nil {
		writeError(w, http.StatusBadGateway, "provider request failed")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(resp.StatusCode)
		_, _ = w.Write(respBody)
		return
	}

	reader := bufio.NewReaderSize(resp.Body, 4096)
	for {
		select {
		case <-r.Context().Done():
			return
		default:
		}

		line, err := reader.ReadBytes('\n')
		if err != nil {
			if err == io.EOF {
				break
			}
			return
		}

		transformed, transformErr := prov.TransformStreamChunk(string(line))
		if transformErr != nil {
			continue
		}

		_, _ = fmt.Fprint(w, transformed)
		flusher.Flush()
	}
}

func (p *Proxy) handleNonStreaming(w http.ResponseWriter, r *http.Request, prov provider.Provider, body []byte, resolution models.RoutingResolution) {
	resp, err := prov.Send(r.Context(), body)
	if err != nil {
		writeError(w, http.StatusBadGateway, "provider request failed")
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read provider response")
		return
	}

	transformed, err := prov.TransformResponse(respBody)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "response transform failed")
		return
	}

	transformed = injectRoutingMetadata(transformed, resolution)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	_, _ = w.Write(transformed)
}

func injectRoutingMetadata(payload []byte, resolution models.RoutingResolution) []byte {
	if len(payload) == 0 {
		return payload
	}

	var response map[string]any
	if err := json.Unmarshal(payload, &response); err != nil {
		return payload
	}

	response["x_routing"] = map[string]any{
		"provider_id":  resolution.ProviderID,
		"model":        resolution.Model,
		"rule_id":      resolution.RuleID,
		"matched_rule": resolution.MatchedRule,
	}

	enriched, err := json.Marshal(response)
	if err != nil {
		return payload
	}

	return enriched
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(models.APIError{Error: msg})
}
