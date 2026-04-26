package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
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
