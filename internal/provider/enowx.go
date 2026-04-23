package provider

import (
	"context"
	"encoding/json"
	"net/http"

	"xixero/internal/config"
	"xixero/internal/models"
)

type EnowXProvider struct {
	BaseProvider
}

func NewEnowX(cfg config.ProviderConfig) *EnowXProvider {
	return &EnowXProvider{
		BaseProvider: NewBaseProvider(cfg),
	}
}

func (e *EnowXProvider) TransformRequest(req models.ChatRequest) ([]byte, error) {
	return json.Marshal(req)
}

func (e *EnowXProvider) TransformResponse(body []byte) ([]byte, error) {
	return body, nil
}

func (e *EnowXProvider) TransformStreamChunk(line string) (string, error) {
	return line, nil
}

func (e *EnowXProvider) TestConnection(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, e.endpoint+"/models", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+e.apiKey)

	resp, err := e.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return &ConnectionError{StatusCode: resp.StatusCode}
	}
	return nil
}
