package license

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/rs/zerolog/log"

	"xixero/internal/config"
)

const (
	firestoreProject = "ixero-95d56"
	firestoreBaseURL = "https://firestore.googleapis.com/v1/projects/" + firestoreProject + "/databases/(default)/documents"
)

type Enforcer struct {
	mu        sync.RWMutex
	cache     *CacheEntry
	cachePath string
}

type CacheEntry struct {
	LicenseKey   string    `json:"license_key"`
	Name         string    `json:"name"`
	ValidatedAt  time.Time `json:"validated_at"`
	ExpiresAt    time.Time `json:"expires_at"`
	CacheExpires time.Time `json:"cache_expires_at"`
	Features     []string  `json:"features"`
}

func NewEnforcer(configDir string, _ string) *Enforcer {
	e := &Enforcer{
		cachePath: filepath.Join(configDir, "license-cache.json"),
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

// Activate validates a license key against Firebase Firestore (public REST API)
func (e *Enforcer) Activate(licenseKey string) error {
	// Query Firestore for license by key
	lic, err := queryLicenseByKey(licenseKey)
	if err != nil {
		return fmt.Errorf("license lookup failed: %w", err)
	}

	if lic == nil {
		return fmt.Errorf("license not found")
	}

	if lic.Revoked {
		return fmt.Errorf("license has been revoked")
	}

	var expiresAt time.Time
	formats := []string{
		time.RFC3339,
		"2006-01-02T15:04:05.000Z",
		"2006-01-02T15:04:05Z",
		"2006-01-02",
	}
	parsed := false
	for _, f := range formats {
		if t, err := time.Parse(f, lic.ExpiresAt); err == nil {
			expiresAt = t
			parsed = true
			break
		}
	}
	if !parsed {
		return fmt.Errorf("invalid expiry date: %s", lic.ExpiresAt)
	}

	if time.Now().After(expiresAt) {
		return fmt.Errorf("license has expired")
	}

	entry := &CacheEntry{
		LicenseKey:   licenseKey,
		Name:         lic.Name,
		ValidatedAt:  time.Now(),
		ExpiresAt:    expiresAt,
		CacheExpires: time.Now().Add(7 * 24 * time.Hour),
		Features:     []string{"proxy", "streaming", "multi_provider"},
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

// ─── Firestore REST API ───

type firestoreLicense struct {
	Name      string
	ExpiresAt string
	Revoked   bool
	Key       string
}

// queryLicenseByKey queries Firestore REST API for a license document where key == licenseKey
func queryLicenseByKey(licenseKey string) (*firestoreLicense, error) {
	// Use Firestore REST API structured query
	queryURL := firestoreBaseURL + ":runQuery"

	queryBody := fmt.Sprintf(`{
		"structuredQuery": {
			"from": [{"collectionId": "licenses"}],
			"where": {
				"fieldFilter": {
					"field": {"fieldPath": "key"},
					"op": "EQUAL",
					"value": {"stringValue": %q}
				}
			},
			"limit": 1
		}
	}`, licenseKey)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Post(queryURL, "application/json", bytes.NewBufferString(queryBody))
	if err != nil {
		return nil, fmt.Errorf("firestore request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("firestore returned HTTP %d: %s", resp.StatusCode, string(body))
	}

	var results []struct {
		Document *struct {
			Fields map[string]firestoreValue `json:"fields"`
		} `json:"document"`
	}

	if err := json.Unmarshal(body, &results); err != nil {
		return nil, fmt.Errorf("parse firestore response: %w", err)
	}

	if len(results) == 0 || results[0].Document == nil {
		return nil, nil
	}

	fields := results[0].Document.Fields
	return &firestoreLicense{
		Key:       getStringField(fields, "key"),
		Name:      getStringField(fields, "name"),
		ExpiresAt: getStringField(fields, "expires_at"),
		Revoked:   getBoolField(fields, "revoked"),
	}, nil
}

type firestoreValue struct {
	StringValue    *string `json:"stringValue,omitempty"`
	BooleanValue   *bool   `json:"booleanValue,omitempty"`
	TimestampValue *string `json:"timestampValue,omitempty"`
	IntegerValue   *string `json:"integerValue,omitempty"`
}

func getStringField(fields map[string]firestoreValue, key string) string {
	if v, ok := fields[key]; ok {
		if v.StringValue != nil {
			return *v.StringValue
		}
		if v.TimestampValue != nil {
			return *v.TimestampValue
		}
		if v.IntegerValue != nil {
			return *v.IntegerValue
		}
	}
	return ""
}

func getBoolField(fields map[string]firestoreValue, key string) bool {
	if v, ok := fields[key]; ok && v.BooleanValue != nil {
		return *v.BooleanValue
	}
	return false
}

// ─── Cache ───

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


