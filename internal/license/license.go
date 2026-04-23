package license

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"xixero/internal/config"
)

type Client struct {
	serverURL  string
	httpClient *http.Client
}

type ValidationResult struct {
	Valid     bool     `json:"valid"`
	Features []string `json:"features"`
	ExpiresAt string  `json:"expires_at"`
	Message  string   `json:"message,omitempty"`
}

func NewClient(serverURL string) *Client {
	return &Client{
		serverURL:  serverURL,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *Client) Validate(key string) (*ValidationResult, error) {
	body, _ := json.Marshal(map[string]string{"key": key})
	resp, err := c.httpClient.Post(c.serverURL+"/validate", "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("license server unreachable: %w", err)
	}
	defer resp.Body.Close()

	var result ValidationResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}
	return &result, nil
}

func ValidateOffline(cfg *config.LicenseConfig) bool {
	if cfg.Key == "" || cfg.ExpiresAt == "" {
		return false
	}
	expires, err := time.Parse(time.RFC3339, cfg.ExpiresAt)
	if err != nil {
		return false
	}
	return time.Now().Before(expires)
}

func ValidateKeyFormat(key string) error {
	if len(key) < 10 {
		return fmt.Errorf("license key too short")
	}
	return nil
}
