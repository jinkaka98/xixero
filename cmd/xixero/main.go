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

	"crypto/rand"
	"encoding/hex"
	"path/filepath"

	"golang.org/x/crypto/bcrypt"

	"xixero/internal/admin"
	"xixero/internal/config"
	"xixero/internal/license"
	"xixero/internal/server"
	"xixero/internal/store"
	"xixero/internal/tunnel"
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
	rootCmd.AddCommand(newActivateCmd())
	rootCmd.AddCommand(newAdminCmd())

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

func newActivateCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "activate [license-key]",
		Short: "Activate license key",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			licenseKey := args[0]

			if err := store.ValidateKeyFormat(licenseKey); err != nil {
				return err
			}

			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("load config: %w", err)
			}

			validationURL := "https://raw.githubusercontent.com/jinkaka98/xixero/main/tunnel-config.json"
			if cfg.License.ValidationURLSource != "" {
				validationURL = cfg.License.ValidationURLSource
			}

			enf := license.NewEnforcer(config.ConfigDir(), validationURL)

			fmt.Println("Validating license...")
			if err := enf.Activate(licenseKey); err != nil {
				return fmt.Errorf("activation failed: %w", err)
			}

			cfg.License.Key = licenseKey
			if err := cfg.Save(); err != nil {
				return fmt.Errorf("save config: %w", err)
			}

			fmt.Println("License activated!")
			return nil
		},
	}
}

func adminDBPath() string {
	return filepath.Join(config.ConfigDir(), "admin.db")
}

func newAdminCmd() *cobra.Command {
	adminCmd := &cobra.Command{
		Use:   "admin",
		Short: "Admin management commands",
	}

	adminCmd.AddCommand(newAdminInitCmd())
	adminCmd.AddCommand(newAdminStartCmd())
	adminCmd.AddCommand(newAdminGenLicenseCmd())
	adminCmd.AddCommand(newAdminRevokeLicenseCmd())
	adminCmd.AddCommand(newAdminListLicensesCmd())

	return adminCmd
}

func newAdminInitCmd() *cobra.Command {
	var username, password string

	cmd := &cobra.Command{
		Use:   "init",
		Short: "Initialize admin credentials and database",
		RunE: func(cmd *cobra.Command, args []string) error {
			if username == "" {
				username = "admin"
			}
			if password == "" {
				return fmt.Errorf("--password is required")
			}

			s, err := store.Open(adminDBPath())
			if err != nil {
				return err
			}
			defer s.Close()

			hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
			if err != nil {
				return err
			}

			if err := s.SetAdminCredentials(username, string(hash)); err != nil {
				return err
			}

			secretBytes := make([]byte, 32)
			rand.Read(secretBytes)
			secretKey := hex.EncodeToString(secretBytes)

			fmt.Println("Admin initialized!")
			fmt.Printf("  Username:   %s\n", username)
			fmt.Printf("  Secret Key: %s\n", secretKey)
			fmt.Println("  Save the secret key — you'll need it for admin start.")
			return nil
		},
	}

	cmd.Flags().StringVar(&username, "username", "admin", "Admin username")
	cmd.Flags().StringVar(&password, "password", "", "Admin password")
	cmd.MarkFlagRequired("password")

	return cmd
}

func newAdminStartCmd() *cobra.Command {
	var secretKey, ghToken, ghRepo, ghFile string
	var port int
	var enableTunnel bool

	cmd := &cobra.Command{
		Use:   "start",
		Short: "Start admin server with tunnel",
		RunE: func(cmd *cobra.Command, args []string) error {
			s, err := store.Open(adminDBPath())
			if err != nil {
				return err
			}
			defer s.Close()

			srv := admin.NewServer(s, port, secretKey)

			ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
			defer stop()

			errCh := make(chan error, 1)
			go func() {
				fmt.Printf("Admin API on http://localhost:%d\n", port)
				if err := srv.Start(); err != nil && !errors.Is(err, http.ErrServerClosed) {
					errCh <- err
					return
				}
				errCh <- nil
			}()

			var tun *tunnel.Tunnel
			var ghSync *tunnel.GitHubSync

			if enableTunnel {
				time.Sleep(1 * time.Second)
				tun, err = tunnel.Start(port)
				if err != nil {
					fmt.Printf("Warning: tunnel failed: %s\n", err)
				} else {
					fmt.Printf("Tunnel: %s\n", tun.URL)

					if ghToken != "" && ghRepo != "" {
						parts := splitRepo(ghRepo)
						ghSync = tunnel.NewGitHubSync(ghToken, parts[0], parts[1], ghFile)
						if err := ghSync.PushTunnelURL(tun.URL); err != nil {
							fmt.Printf("Warning: GitHub sync failed: %s\n", err)
						} else {
							fmt.Println("Tunnel URL pushed to GitHub")
						}
					}
				}
			}

			select {
			case <-ctx.Done():
				if tun != nil {
					tun.Stop()
				}
				if ghSync != nil {
					ghSync.SetOffline()
				}
				shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()
				srv.Shutdown(shutCtx)
				<-errCh
				return nil
			case err := <-errCh:
				return err
			}
		},
	}

	cmd.Flags().StringVar(&secretKey, "secret", "", "Admin secret key (from admin init)")
	cmd.Flags().IntVar(&port, "port", 7861, "Admin server port")
	cmd.Flags().BoolVar(&enableTunnel, "tunnel", false, "Enable trycloudflare tunnel")
	cmd.Flags().StringVar(&ghToken, "gh-token", "", "GitHub personal access token")
	cmd.Flags().StringVar(&ghRepo, "gh-repo", "jinkaka98/xixero", "GitHub repo for tunnel config")
	cmd.Flags().StringVar(&ghFile, "gh-file", "tunnel-config.json", "Tunnel config file path in repo")
	cmd.MarkFlagRequired("secret")

	return cmd
}

func newAdminGenLicenseCmd() *cobra.Command {
	var name string
	var days int

	cmd := &cobra.Command{
		Use:   "generate-license",
		Short: "Generate a new license key",
		RunE: func(cmd *cobra.Command, args []string) error {
			s, err := store.Open(adminDBPath())
			if err != nil {
				return err
			}
			defer s.Close()

			lic, err := s.CreateLicense(name, time.Duration(days)*24*time.Hour)
			if err != nil {
				return err
			}

			fmt.Printf("License generated!\n")
			fmt.Printf("  Key:     %s\n", lic.Key)
			fmt.Printf("  Name:    %s\n", lic.Name)
			fmt.Printf("  Expires: %s\n", lic.ExpiresAt.Format("2006-01-02"))
			return nil
		},
	}

	cmd.Flags().StringVar(&name, "name", "", "License holder name")
	cmd.Flags().IntVar(&days, "days", 365, "License duration in days")
	cmd.MarkFlagRequired("name")

	return cmd
}

func newAdminRevokeLicenseCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "revoke-license [key]",
		Short: "Revoke a license key",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			s, err := store.Open(adminDBPath())
			if err != nil {
				return err
			}
			defer s.Close()

			if err := s.RevokeLicense(args[0]); err != nil {
				return err
			}
			fmt.Println("License revoked.")
			return nil
		},
	}
}

func newAdminListLicensesCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "list-licenses",
		Short: "List all licenses",
		RunE: func(cmd *cobra.Command, args []string) error {
			s, err := store.Open(adminDBPath())
			if err != nil {
				return err
			}
			defer s.Close()

			licenses, err := s.ListLicenses()
			if err != nil {
				return err
			}

			if len(licenses) == 0 {
				fmt.Println("No licenses found.")
				return nil
			}

			fmt.Printf("%-40s %-15s %-12s %-10s\n", "KEY", "NAME", "EXPIRES", "STATUS")
			fmt.Println(fmt.Sprintf("%s", "────────────────────────────────────────────────────────────────────────────────"))
			for _, l := range licenses {
				status := "active"
				if l.Revoked {
					status = "revoked"
				} else if time.Now().After(l.ExpiresAt) {
					status = "expired"
				}
				fmt.Printf("%-40s %-15s %-12s %-10s\n", l.Key, l.Name, l.ExpiresAt.Format("2006-01-02"), status)
			}
			return nil
		},
	}
}

func splitRepo(repo string) [2]string {
	parts := [2]string{"jinkaka98", "xixero"}
	for i, p := range split(repo, "/") {
		if i < 2 {
			parts[i] = p
		}
	}
	return parts
}

func split(s, sep string) []string {
	var result []string
	for s != "" {
		idx := indexOf(s, sep)
		if idx < 0 {
			result = append(result, s)
			break
		}
		result = append(result, s[:idx])
		s = s[idx+len(sep):]
	}
	return result
}

func indexOf(s, sub string) int {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
