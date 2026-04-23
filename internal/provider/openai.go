package provider

import (
	"context"
	"encoding/json"
	"net/http"

	"xixero/internal/config"
	"xixero/internal/models"
)

type OpenAIProvider struct {
	BaseProvider
}

func NewOpenAI(cfg config.ProviderConfig) *OpenAIProvider {
	return &OpenAIProvider{
		BaseProvider: NewBaseProvider(cfg),
	}
}

func (o *OpenAIProvider) TransformRequest(req models.ChatRequest) ([]byte, error) {
	return json.Marshal(req)
}

func (o *OpenAIProvider) TransformResponse(body []byte) ([]byte, error) {
	return body, nil
}

func (o *OpenAIProvider) TransformStreamChunk(line string) (string, error) {
	return line, nil
}

func (o *OpenAIProvider) TestConnection(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, o.endpoint+"/models", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+o.apiKey)

	resp, err := o.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return &ConnectionError{StatusCode: resp.StatusCode}
	}
	return nil
}
