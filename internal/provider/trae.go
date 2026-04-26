package provider

import (
	"context"
	"encoding/json"
	"net/http"

	"xixero/internal/config"
	"xixero/internal/models"
)

type TraeProvider struct {
	BaseProvider
}

func NewTrae(cfg config.ProviderConfig) *TraeProvider {
	return &TraeProvider{
		BaseProvider: NewBaseProvider(cfg),
	}
}

func (t *TraeProvider) TransformRequest(req models.ChatRequest) ([]byte, error) {
	return json.Marshal(req)
}

func (t *TraeProvider) TransformResponse(body []byte) ([]byte, error) {
	return body, nil
}

func (t *TraeProvider) TransformStreamChunk(line string) (string, error) {
	return line, nil
}

func (t *TraeProvider) TestConnection(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, t.endpoint+"/models", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+t.apiKey)

	resp, err := t.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return &ConnectionError{StatusCode: resp.StatusCode}
	}
	return nil
}
