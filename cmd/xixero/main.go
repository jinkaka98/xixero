package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/spf13/cobra"

	"xixero/internal/config"
	"xixero/internal/license"
	"xixero/internal/server"
	"xixero/internal/store"
)

var (
	Version = "dev"
	Commit  = "none"
	Date    = "unknown"
)

func main() {
	if err := newRootCmd().Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func newRootCmd() *cobra.Command {
	rootCmd := &cobra.Command{
		Use:   "xixero",
		Short: "Xixero - Local AI Gateway",
		Long: `
  Xixero - Local AI Gateway
  Route AI requests from your IDE through a single local endpoint.

  Quick Start:
    xixero license <KEY>    Activate your license
    xixero start            Start the gateway
    xixero                  Same as 'xixero start'`,

		// Running 'xixero' without subcommand = same as 'xixero start'
		RunE: func(cmd *cobra.Command, args []string) error {
			return runStart()
		},
		SilenceUsage:  true,
		SilenceErrors: true,
	}

	rootCmd.AddCommand(newStartCmd())
	rootCmd.AddCommand(newLicenseCmd())
	rootCmd.AddCommand(newStopCmd())
	rootCmd.AddCommand(newUpdateCmd())
	rootCmd.AddCommand(newUninstallCmd())
	rootCmd.AddCommand(newVersionCmd())
	rootCmd.AddCommand(newStatusCmd())

	return rootCmd
}

// ─── START ───

func newStartCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "start",
		Short: "Start the Xixero gateway server",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runStart()
		},
	}
}

func runStart() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	// Check license FIRST
	enf := license.NewEnforcer(config.ConfigDir(), "")
	if !enf.IsValid() && cfg.License.Key == "" {
		printBanner(cfg)
		fmt.Println()
		fmt.Println("  ERROR: No license key found.")
		fmt.Println()
		fmt.Println("  To get started:")
		fmt.Println("    1. Get a key: Discord @xixero1445 (send DM)")
		fmt.Println("    2. Activate:  xixero license <YOUR-KEY>")
		fmt.Println("    3. Start:     xixero start")
		fmt.Println()
		return fmt.Errorf("license required")
	}

	// Redirect logs to file
	server.InitSilentLogging()

	srv := server.New(cfg)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errCh := make(chan error, 1)
	go func() {
		if serveErr := srv.Start(); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			errCh <- serveErr
			return
		}
		errCh <- nil
	}()

	// Print banner
	printBanner(cfg)
	url := fmt.Sprintf("http://localhost:%d", cfg.Server.Port)
	fmt.Println()
	fmt.Printf("  Dashboard : %s\n", url)
	fmt.Println("  Press Ctrl+C to stop")
	fmt.Println()

	// Wait
	select {
	case <-ctx.Done():
		fmt.Println("\n  Shutting down...")
		shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Shutdown(shutCtx)
		<-errCh
		fmt.Println("  Stopped.")
		return nil
	case serveErr := <-errCh:
		return serveErr
	}
}

// ─── LICENSE ───

func newLicenseCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "license <KEY>",
		Short: "Activate a license key",
		Long: `Activate your Xixero license key.

  Get a key by sending a DM to @xixero1445 on Discord.

  Example:
    xixero license XIXERO-ABCDE-12345-FGHIJ`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			licenseKey := args[0]

			if err := store.ValidateKeyFormat(licenseKey); err != nil {
				return err
			}

			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("load config: %w", err)
			}

			enf := license.NewEnforcer(config.ConfigDir(), "")

			fmt.Println()
			fmt.Println("  Validating license...")

			if err := enf.Activate(licenseKey); err != nil {
				fmt.Println("  FAILED")
				return fmt.Errorf("activation failed: %w", err)
			}

			cfg.License.Key = licenseKey
			if err := cfg.Save(); err != nil {
				return fmt.Errorf("save config: %w", err)
			}

			fmt.Println("  License activated!")
			fmt.Println()
			fmt.Println("  You can now start Xixero:")
			fmt.Println("    xixero start")
			fmt.Println("    xixero        (same thing)")
			fmt.Println()
			return nil
		},
	}
}

// ─── STOP ───

func newStopCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "stop",
		Short: "Stop the running Xixero server",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Find and kill xixero processes (except this one)
			myPid := os.Getpid()
			fmt.Printf("  Stopping Xixero (my PID: %d)...\n", myPid)

			// Use taskkill on Windows
			killCmd := fmt.Sprintf("Get-Process xixero -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne %d } | Stop-Process -Force", myPid)
			runPowershell(killCmd)

			fmt.Println("  Stopped.")
			return nil
		},
	}
}

// ─── VERSION ───

func newVersionCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Show version information",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Println()
			fmt.Printf("  Xixero v%s\n", Version)
			fmt.Printf("  Build:  %s (%s)\n", Commit, Date)
			fmt.Println()
		},
	}
}

// ─── STATUS ───

func newStatusCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Check if Xixero server is running",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Println()

			// Check if server is running
			client := &http.Client{Timeout: 2 * time.Second}
			resp, err := client.Get("http://localhost:7860/api/status")
			if err != nil {
				fmt.Println("  Status: Not running")
				fmt.Println()
				fmt.Println("  Start with: xixero start")
			} else {
				defer resp.Body.Close()
				fmt.Println("  Status: Running")
				fmt.Println("  URL:    http://localhost:7860")
			}

			// Check license
			cfg, _ := config.Load()
			if cfg != nil && cfg.License.Key != "" {
				fmt.Println("  License: Active")
			} else {
				fmt.Println("  License: Not activated")
			}
			fmt.Println()
		},
	}
}

// ─── UPDATE ───

const latestURL = "https://jinkaka98.github.io/releases/latest.json"

type releaseInfo struct {
	Version   string `json:"version"`
	Installer struct {
		URL  string `json:"url"`
		Size int64  `json:"size"`
	} `json:"installer"`
	Notes string `json:"notes"`
}

func newUpdateCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "update",
		Short: "Check for updates and install latest version",
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Println()
			fmt.Println("  Checking for updates...")

			client := &http.Client{Timeout: 15 * time.Second}
			resp, err := client.Get(latestURL + "?t=" + fmt.Sprintf("%d", time.Now().Unix()))
			if err != nil {
				return fmt.Errorf("cannot reach update server: %w", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != 200 {
				return fmt.Errorf("update server returned HTTP %d", resp.StatusCode)
			}

			var release releaseInfo
			if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
				return fmt.Errorf("parse release info: %w", err)
			}

			if release.Version == Version {
				fmt.Printf("  Already up to date (v%s)\n\n", Version)
				return nil
			}

			// Compare versions
			if !isNewer(release.Version, Version) {
				fmt.Printf("  Already up to date (v%s)\n\n", Version)
				return nil
			}

			sizeMB := float64(release.Installer.Size) / 1024 / 1024
			fmt.Printf("  Update available: v%s -> v%s (%.1fMB)\n", Version, release.Version, sizeMB)
			fmt.Println("  Downloading...")

			// Download installer
			dlResp, err := client.Get(release.Installer.URL)
			if err != nil {
				return fmt.Errorf("download failed: %w", err)
			}
			defer dlResp.Body.Close()

			// Save to temp
			tmpPath := filepath.Join(os.TempDir(), "xixero-update.exe")
			out, err := os.Create(tmpPath)
			if err != nil {
				return fmt.Errorf("create temp file: %w", err)
			}

			written, err := io.Copy(out, dlResp.Body)
			out.Close()
			if err != nil {
				return fmt.Errorf("download error: %w", err)
			}

			fmt.Printf("  Downloaded (%.1fMB)\n", float64(written)/1024/1024)
			fmt.Println("  Installing...")

			// Run installer (it will replace the binary and exit)
			installCmd := exec.Command(tmpPath)
			installCmd.SysProcAttr = &syscall.SysProcAttr{
				HideWindow:    true,
				CreationFlags: 0x08000000,
			}
			if err := installCmd.Start(); err != nil {
				return fmt.Errorf("run installer: %w", err)
			}

			fmt.Printf("  Updated to v%s!\n", release.Version)
			fmt.Println("  Restart xixero to use the new version.")
			fmt.Println()
			return nil
		},
	}
}

func isNewer(remote, local string) bool {
	rParts := strings.Split(remote, ".")
	lParts := strings.Split(local, ".")
	for i := 0; i < 3; i++ {
		var r, l int
		if i < len(rParts) { fmt.Sscanf(rParts[i], "%d", &r) }
		if i < len(lParts) { fmt.Sscanf(lParts[i], "%d", &l) }
		if r > l { return true }
		if r < l { return false }
	}
	return false
}

// ─── UNINSTALL ───

func newUninstallCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "uninstall",
		Short: "Remove Xixero from this computer",
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Println()
			fmt.Println("  Uninstalling Xixero...")
			fmt.Println()

			installDir := config.ConfigDir()

			// Step 1: Stop running server
			fmt.Println("  [1/4] Stopping server...")
			myPid := os.Getpid()
			runPowershell(fmt.Sprintf(
				"Get-Process xixero -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne %d } | Stop-Process -Force",
				myPid,
			))
			fmt.Println("        OK")

			// Step 2: Remove from PATH
			fmt.Println("  [2/4] Removing from PATH...")
			runPowershell(fmt.Sprintf(`
				$p = [Environment]::GetEnvironmentVariable("Path", "User")
				$new = ($p -split ";" | Where-Object { $_ -ne "%s" -and $_ -ne "" }) -join ";"
				[Environment]::SetEnvironmentVariable("Path", $new, "User")
			`, installDir))
			fmt.Println("        OK")

			// Step 3: Remove config and cache files
			fmt.Println("  [3/4] Removing config files...")
			configFiles := []string{
				filepath.Join(installDir, "config.json"),
				filepath.Join(installDir, "license-cache.json"),
				filepath.Join(installDir, "server.log"),
				filepath.Join(installDir, "admin.db"),
			}
			for _, f := range configFiles {
				os.Remove(f)
			}
			fmt.Println("        OK")

			// Step 4: Schedule binary deletion (can't delete while running)
			fmt.Println("  [4/4] Scheduling binary removal...")
			exePath := filepath.Join(installDir, "xixero.exe")
			// Use cmd /c to delete after this process exits
			runPowershell(fmt.Sprintf(`
				Start-Sleep -Seconds 2
				Remove-Item "%s" -Force -ErrorAction SilentlyContinue
				$remaining = Get-ChildItem "%s" -ErrorAction SilentlyContinue
				if (-not $remaining) { Remove-Item "%s" -Force -ErrorAction SilentlyContinue }
			`, exePath, installDir, installDir))
			fmt.Println("        OK")

			fmt.Println()
			fmt.Println("  =====================================")
			fmt.Println("       XIXERO UNINSTALLED")
			fmt.Println("  =====================================")
			fmt.Println()
			fmt.Printf("  Removed from: %s\n", installDir)
			fmt.Println("  PATH cleaned up.")
			fmt.Println()
			fmt.Println("  To reinstall:")
			fmt.Println("    irm https://jinkaka98.github.io/install.ps1 | iex")
			fmt.Println()
			return nil
		},
	}
}

// ─── BANNER ───

func printBanner(cfg *config.Config) {
	fmt.Println()
	fmt.Println("  __  __ ___ __  __ _____ ____   ___  ")
	fmt.Println("  \\ \\/ /|_ _|\\ \\/ /| ____|  _ \\ / _ \\ ")
	fmt.Println("   \\  /  | |  \\  / |  _| | |_) | | | |")
	fmt.Println("   /  \\  | |  /  \\ | |___|  _ <| |_| |")
	fmt.Println("  /_/\\_\\|___|/_/\\_\\|_____|_| \\_\\\\___/ ")
	fmt.Println()
	fmt.Printf("  v%s\n", Version)
}

// ─── HELPERS ───

func runPowershell(script string) {
	c := exec.Command("powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", script)
	c.Run()
}

func adminDBPath() string {
	return filepath.Join(config.ConfigDir(), "admin.db")
}
