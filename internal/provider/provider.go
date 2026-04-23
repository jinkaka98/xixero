package provider

import (
	"bytes"
	"context"
	"net/http"
	"time"

	"xixero/internal/config"
	"xixero/internal/models"
)

type Provider interface {
	ID() string
	Name() string
	Type() string
	Models() []string
	SupportsStreaming() bool
	TransformRequest(req models.ChatRequest) ([]byte, error)
	Send(ctx context.Context, body []byte) (*http.Response, error)
	TransformResponse(body []byte) ([]byte, error)
	TransformStreamChunk(line string) (string, error)
	TestConnection(ctx context.Context) error
}

type BaseProvider struct {
	id           string
	name         string
	providerType string
	endpoint     string
	apiKey       string
	models       []string
	client       *http.Client
}

func NewBaseProvider(cfg config.ProviderConfig) BaseProvider {
	return BaseProvider{
		id:           cfg.ID,
		name:         cfg.Name,
		providerType: cfg.Type,
		endpoint:     cfg.Endpoint,
		apiKey:       cfg.APIKey,
		models:       cfg.Models,
		client: &http.Client{
			Timeout: 0, // no timeout for streaming
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 10,
				IdleConnTimeout:     90 * time.Second,
			},
		},
	}
}

func (b *BaseProvider) ID() string              { return b.id }
func (b *BaseProvider) Name() string            { return b.name }
func (b *BaseProvider) Type() string            { return b.providerType }
func (b *BaseProvider) Models() []string         { return b.models }
func (b *BaseProvider) SupportsStreaming() bool   { return true }

func (b *BaseProvider) Send(ctx context.Context, body []byte) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, b.endpoint+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+b.apiKey)
	return b.client.Do(req)
}

func (b *BaseProvider) TestConnection(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, b.endpoint+"/models", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+b.apiKey)

	resp, err := b.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return &ConnectionError{StatusCode: resp.StatusCode}
	}
	return nil
}

type ConnectionError struct {
	StatusCode int
}

func (e *ConnectionError) Error() string {
	return "connection test failed with status " + http.StatusText(e.StatusCode)
}
