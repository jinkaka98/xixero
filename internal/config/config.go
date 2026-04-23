package config

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

const defaultVersion = "1.0.0"

type Config struct {
	Version   string           `json:"version"`
	Server    ServerConfig     `json:"server"`
	Providers []ProviderConfig `json:"providers"`
	License   LicenseConfig    `json:"license"`
	Logging   LogConfig        `json:"logging"`
	APIToken  string           `json:"api_token"`
}

type ServerConfig struct {
	Host string `json:"host"`
	Port int    `json:"port"`
}

type ProviderConfig struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Type     string   `json:"type"`
	Endpoint string   `json:"endpoint"`
	APIKey   string   `json:"api_key"`
	Enabled  bool     `json:"enabled"`
	Models   []string `json:"models"`
}

type LicenseConfig struct {
	Key         string   `json:"key"`
	ValidatedAt string   `json:"validated_at"`
	ExpiresAt   string   `json:"expires_at"`
	Features    []string `json:"features"`
}

type LogConfig struct {
	Level        string `json:"level"`
	LogRequests  bool   `json:"log_requests"`
	LogResponses bool   `json:"log_responses"`
}

func ConfigDir() string {
	return filepath.Join(os.Getenv("LOCALAPPDATA"), "xixero")
}

func ConfigPath() string {
	return filepath.Join(ConfigDir(), "config.json")
}

func Load() (*Config, error) {
	data, err := os.ReadFile(ConfigPath())
	if err != nil {
		if os.IsNotExist(err) {
			return CreateDefault()
		}

		return nil, fmt.Errorf("read config: %w", err)
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	return &cfg, nil
}

func (c *Config) Save() error {
	if err := os.MkdirAll(ConfigDir(), 0o755); err != nil {
		return fmt.Errorf("create config dir: %w", err)
	}

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}

	if err := os.WriteFile(ConfigPath(), data, 0o644); err != nil {
		return fmt.Errorf("write config: %w", err)
	}

	return nil
}

func CreateDefault() (*Config, error) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return nil, fmt.Errorf("generate api token: %w", err)
	}

	cfg := &Config{
		Version: defaultVersion,
		Server: ServerConfig{
			Host: "127.0.0.1",
			Port: 7860,
		},
		Providers: []ProviderConfig{},
		License:   LicenseConfig{},
		Logging: LogConfig{
			Level:        "info",
			LogRequests:  true,
			LogResponses: false,
		},
		APIToken: hex.EncodeToString(tokenBytes),
	}

	if err := cfg.Save(); err != nil {
		return nil, err
	}

	return cfg, nil
}
