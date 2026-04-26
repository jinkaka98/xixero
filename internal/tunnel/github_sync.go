package tunnel

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"
)

type GitHubSync struct {
	token    string
	owner    string
	repo     string
	filePath string
	client   *http.Client
}

type TunnelConfig struct {
	AdminTunnelURL string `json:"admin_tunnel_url"`
	UpdatedAt      string `json:"updated_at"`
	Status         string `json:"status"`
}

func NewGitHubSync(token, owner, repo, filePath string) *GitHubSync {
	return &GitHubSync{
		token:    token,
		owner:    owner,
		repo:     repo,
		filePath: filePath,
		client:   &http.Client{Timeout: 15 * time.Second},
	}
}

func (g *GitHubSync) PushTunnelURL(tunnelURL string) error {
	cfg := TunnelConfig{
		AdminTunnelURL: tunnelURL,
		UpdatedAt:      time.Now().UTC().Format(time.RFC3339),
		Status:         "online",
	}

	content, _ := json.MarshalIndent(cfg, "", "  ")
	encoded := base64.StdEncoding.EncodeToString(content)

	sha, _ := g.getFileSHA()

	body := map[string]string{
		"message": "update tunnel config",
		"content": encoded,
	}
	if sha != "" {
		body["sha"] = sha
	}

	bodyJSON, _ := json.Marshal(body)

	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s", g.owner, g.repo, g.filePath)
	req, err := http.NewRequest(http.MethodPut, url, bytes.NewReader(bodyJSON))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+g.token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.client.Do(req)
	if err != nil {
		return fmt.Errorf("push to github: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("github api error %d: %s", resp.StatusCode, string(respBody))
	}

	log.Info().Str("url", tunnelURL).Msg("tunnel URL pushed to GitHub")
	return nil
}

func (g *GitHubSync) SetOffline() error {
	cfg := TunnelConfig{
		AdminTunnelURL: "",
		UpdatedAt:      time.Now().UTC().Format(time.RFC3339),
		Status:         "offline",
	}

	content, _ := json.MarshalIndent(cfg, "", "  ")
	encoded := base64.StdEncoding.EncodeToString(content)

	sha, _ := g.getFileSHA()

	body := map[string]string{
		"message": "admin offline",
		"content": encoded,
	}
	if sha != "" {
		body["sha"] = sha
	}

	bodyJSON, _ := json.Marshal(body)

	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s", g.owner, g.repo, g.filePath)
	req, _ := http.NewRequest(http.MethodPut, url, bytes.NewReader(bodyJSON))
	req.Header.Set("Authorization", "Bearer "+g.token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func (g *GitHubSync) getFileSHA() (string, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s", g.owner, g.repo, g.filePath)
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("Authorization", "Bearer "+g.token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := g.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", nil
	}

	var result struct {
		SHA string `json:"sha"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.SHA, nil
}
