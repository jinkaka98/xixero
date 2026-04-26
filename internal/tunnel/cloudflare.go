package tunnel

import (
	"bufio"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

type Tunnel struct {
	URL     string
	cmd     *exec.Cmd
	localPort int
}

func Start(localPort int) (*Tunnel, error) {
	binPath, err := ensureCloudflared()
	if err != nil {
		return nil, fmt.Errorf("cloudflared not available: %w", err)
	}

	t := &Tunnel{localPort: localPort}

	t.cmd = exec.Command(binPath, "tunnel", "--url", fmt.Sprintf("http://localhost:%d", localPort))
	t.cmd.Env = os.Environ()

	stderr, err := t.cmd.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("stderr pipe: %w", err)
	}

	if err := t.cmd.Start(); err != nil {
		return nil, fmt.Errorf("start cloudflared: %w", err)
	}

	urlCh := make(chan string, 1)
	go func() {
		scanner := bufio.NewScanner(stderr)
		re := regexp.MustCompile(`https://[a-zA-Z0-9-]+\.trycloudflare\.com`)
		for scanner.Scan() {
			line := scanner.Text()
			if match := re.FindString(line); match != "" {
				urlCh <- match
				break
			}
		}
		io.Copy(io.Discard, stderr)
	}()

	select {
	case url := <-urlCh:
		t.URL = url
		log.Info().Str("url", url).Msg("tunnel started")
		return t, nil
	case <-time.After(30 * time.Second):
		t.Stop()
		return nil, fmt.Errorf("timeout waiting for tunnel URL")
	}
}

func (t *Tunnel) Stop() {
	if t.cmd != nil && t.cmd.Process != nil {
		t.cmd.Process.Kill()
		t.cmd.Wait()
	}
}

func (t *Tunnel) IsRunning() bool {
	if t.cmd == nil || t.cmd.Process == nil {
		return false
	}
	return t.cmd.ProcessState == nil
}

func ensureCloudflared() (string, error) {
	if path, err := exec.LookPath("cloudflared"); err == nil {
		return path, nil
	}

	cacheDir := filepath.Join(os.TempDir(), "xixero-bin")
	os.MkdirAll(cacheDir, 0755)

	binName := "cloudflared"
	if runtime.GOOS == "windows" {
		binName = "cloudflared.exe"
	}
	binPath := filepath.Join(cacheDir, binName)

	if _, err := os.Stat(binPath); err == nil {
		return binPath, nil
	}

	log.Info().Msg("downloading cloudflared...")
	url := cloudflaredDownloadURL()
	if url == "" {
		return "", fmt.Errorf("unsupported platform: %s/%s", runtime.GOOS, runtime.GOARCH)
	}

	resp, err := http.Get(url)
	if err != nil {
		return "", fmt.Errorf("download cloudflared: %w", err)
	}
	defer resp.Body.Close()

	out, err := os.Create(binPath)
	if err != nil {
		return "", err
	}
	defer out.Close()

	if _, err := io.Copy(out, resp.Body); err != nil {
		os.Remove(binPath)
		return "", err
	}

	os.Chmod(binPath, 0755)
	log.Info().Str("path", binPath).Msg("cloudflared downloaded")
	return binPath, nil
}

func cloudflaredDownloadURL() string {
	base := "https://github.com/cloudflare/cloudflared/releases/latest/download/"
	switch {
	case runtime.GOOS == "windows" && runtime.GOARCH == "amd64":
		return base + "cloudflared-windows-amd64.exe"
	case runtime.GOOS == "linux" && runtime.GOARCH == "amd64":
		return base + "cloudflared-linux-amd64"
	case runtime.GOOS == "linux" && runtime.GOARCH == "arm64":
		return base + "cloudflared-linux-arm64"
	case runtime.GOOS == "darwin" && runtime.GOARCH == "amd64":
		return base + "cloudflared-darwin-amd64.tgz"
	case runtime.GOOS == "darwin" && runtime.GOARCH == "arm64":
		return base + "cloudflared-darwin-arm64.tgz"
	default:
		return ""
	}
}

func FetchAdminTunnelURL(githubRawURL string) (string, error) {
	client := &http.Client{Timeout: 10 * time.Second}

	cacheBuster := fmt.Sprintf("?t=%d", time.Now().Unix())
	resp, err := client.Get(githubRawURL + cacheBuster)
	if err != nil {
		return "", fmt.Errorf("fetch tunnel config: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("tunnel config not found (status %d)", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	lines := strings.Split(string(body), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.Contains(line, "admin_tunnel_url") && strings.Contains(line, "trycloudflare.com") {
			re := regexp.MustCompile(`https://[a-zA-Z0-9-]+\.trycloudflare\.com`)
			if match := re.FindString(line); match != "" {
				return match, nil
			}
		}
	}

	return "", fmt.Errorf("no tunnel URL found in config")
}
