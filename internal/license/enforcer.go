package license

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/rs/zerolog/log"

	"xixero/internal/config"
	"xixero/internal/tunnel"
)

type Enforcer struct {
	mu        sync.RWMutex
	cache     *CacheEntry
	cachePath string
	configURL string
}

type CacheEntry struct {
	LicenseKey    string    `json:"license_key"`
	Name          string    `json:"name"`
	ValidatedAt   time.Time `json:"validated_at"`
	ExpiresAt     time.Time `json:"expires_at"`
	CacheExpires  time.Time `json:"cache_expires_at"`
	Features      []string  `json:"features"`
}

func NewEnforcer(configDir string, validationURLSource string) *Enforcer {
	e := &Enforcer{
		cachePath: filepath.Join(configDir, "license-cache.json"),
		configURL: validationURLSource,
	}
	e.loadCache()
	return e
}

func (e *Enforcer) IsValid() bool {
	e.mu.RLock()
	defer e.mu.RUnlock()

	if e.cache == nil {
		return false
	}
	if time.Now().After(e.cache.ExpiresAt) {
		return false
	}
	return true
}

func (e *Enforcer) IsCacheExpired() bool {
	e.mu.RLock()
	defer e.mu.RUnlock()

	if e.cache == nil {
		return true
	}
	return time.Now().After(e.cache.CacheExpires)
}

func (e *Enforcer) Activate(licenseKey string) error {
	adminURL, err := tunnel.FetchAdminTunnelURL(e.configURL)
	if err != nil {
		return fmt.Errorf("admin server unreachable: %w", err)
	}

	machineID, _ := getMachineID()

	body, _ := json.Marshal(map[string]string{
		"key":        licenseKey,
		"machine_id": machineID,
	})

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Post(adminURL+"/api/license/validate", "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("validation request failed: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Valid     bool     `json:"valid"`
		Error     string   `json:"error"`
		Name      string   `json:"name"`
		ExpiresAt string   `json:"expires_at"`
		Features  []string `json:"features"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	if resp.StatusCode != 200 || !result.Valid {
		errMsg := result.Error
		if errMsg == "" {
			errMsg = "license validation failed"
		}
		return fmt.Errorf("%s", errMsg)
	}

	expires, _ := time.Parse(time.RFC3339, result.ExpiresAt)

	entry := &CacheEntry{
		LicenseKey:   licenseKey,
		Name:         result.Name,
		ValidatedAt:  time.Now(),
		ExpiresAt:    expires,
		CacheExpires: time.Now().Add(7 * 24 * time.Hour),
		Features:     result.Features,
	}

	e.mu.Lock()
	e.cache = entry
	e.mu.Unlock()

	return e.saveCache()
}

func (e *Enforcer) StartPeriodicCheck(cfg *config.Config) {
	go func() {
		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()

		for range ticker.C {
			if !e.IsCacheExpired() {
				continue
			}

			if cfg.License.Key == "" {
				continue
			}

			log.Info().Msg("re-validating license...")
			if err := e.Activate(cfg.License.Key); err != nil {
				log.Warn().Err(err).Msg("license re-validation failed, using cache")
			} else {
				log.Info().Msg("license re-validated")
			}
		}
	}()
}

func (e *Enforcer) loadCache() {
	data, err := os.ReadFile(e.cachePath)
	if err != nil {
		return
	}

	var entry CacheEntry
	if err := json.Unmarshal(data, &entry); err != nil {
		return
	}

	e.cache = &entry
}

func (e *Enforcer) saveCache() error {
	e.mu.RLock()
	defer e.mu.RUnlock()

	data, err := json.MarshalIndent(e.cache, "", "  ")
	if err != nil {
		return err
	}

	os.MkdirAll(filepath.Dir(e.cachePath), 0755)
	return os.WriteFile(e.cachePath, data, 0644)
}

func getMachineID() (string, error) {
	host, _ := os.Hostname()
	user := os.Getenv("USERNAME")
	if user == "" {
		user = os.Getenv("USER")
	}
	return host + ":" + user, nil
}
