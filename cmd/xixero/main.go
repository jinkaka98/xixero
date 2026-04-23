package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/spf13/cobra"

	"xixero/internal/config"
	"xixero/internal/server"
	"xixero/internal/update"
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
		Use:           "xixero",
		Short:         "Xixero local AI gateway",
		SilenceUsage:  true,
		SilenceErrors: true,
	}

	rootCmd.AddCommand(newStartCmd())
	rootCmd.AddCommand(newVersionCmd())
	rootCmd.AddCommand(newUpdateCmd())

	return rootCmd
}

func newStartCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "start",
		Short: "Start the Xixero HTTP server",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("load config: %w", err)
			}

			srv := server.New(cfg)
			ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
			defer stop()

			errCh := make(chan error, 1)

			go func() {
				fmt.Printf("Xixero listening on http://%s:%d\n", cfg.Server.Host, cfg.Server.Port)
				if serveErr := srv.Start(); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
					errCh <- serveErr
					return
				}

				errCh <- nil
			}()

			select {
			case <-ctx.Done():
				shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()

				if err := srv.Shutdown(shutdownCtx); err != nil {
					return fmt.Errorf("shutdown server: %w", err)
				}

				if serveErr := <-errCh; serveErr != nil {
					return fmt.Errorf("server exited: %w", serveErr)
				}

				return nil
			case serveErr := <-errCh:
				if serveErr != nil {
					return fmt.Errorf("start server: %w", serveErr)
				}

				return nil
			}
		},
	}
}

func newVersionCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print build version information",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("version=%s commit=%s date=%s\n", Version, Commit, Date)
		},
	}
}

func newUpdateCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "update",
		Short: "Check for updates and apply",
		RunE: func(cmd *cobra.Command, args []string) error {
			u := update.New(Version)

			fmt.Println("Checking for updates...")
			result, release, err := u.Check()
			if err != nil {
				return fmt.Errorf("check update: %w", err)
			}

			if !result.HasUpdate {
				fmt.Printf("Already up to date (v%s)\n", result.Current)
				return nil
			}

			fmt.Printf("Update available: v%s -> v%s\n", result.Current, result.Latest)
			fmt.Println("Downloading...")

			if err := u.Apply(release); err != nil {
				return fmt.Errorf("apply update: %w", err)
			}

			fmt.Printf("Updated to v%s. Restart xixero to apply.\n", result.Latest)
			return nil
		},
	}
}
