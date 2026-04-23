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

	prov, err := p.registry.FindByModel(req.Model)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("no provider for model: %s", req.Model))
		return
	}

	body, err := prov.TransformRequest(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "request transform failed")
		return
	}

	if req.Stream {
		p.handleStreaming(w, r, prov, body)
	} else {
		p.handleNonStreaming(w, r, prov, body)
	}
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
	json.NewEncoder(w).Encode(models.ModelList{
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
		w.Write(respBody)
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

		lineStr := string(line)
		transformed, transformErr := prov.TransformStreamChunk(lineStr)
		if transformErr != nil {
			continue
		}

		fmt.Fprint(w, transformed)
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

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(transformed)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(models.APIError{Error: msg})
}
