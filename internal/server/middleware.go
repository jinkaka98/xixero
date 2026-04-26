package server

import (
	"crypto/subtle"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"xixero/internal/config"
)

// InitSilentLogging redirects all zerolog output to a log file instead of stdout.
// Call this before starting the server to keep the terminal clean.
func InitSilentLogging() {
	logDir := config.ConfigDir()
	os.MkdirAll(logDir, 0o755)
	logFile, err := os.OpenFile(filepath.Join(logDir, "server.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		// If we can't open log file, just discard logs
		log.Logger = zerolog.New(io.Discard)
		return
	}
	log.Logger = zerolog.New(logFile).With().Timestamp().Logger()
}

func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	allowed := map[string]bool{
		"https://jinkaka98.github.io": true,
		fmt.Sprintf("http://localhost:%d", s.config.Server.Port): true,
		"http://localhost:5173": true,
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if allowed[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Token, Authorization")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("X-API-Token")
		expected := s.config.APIToken

		if subtle.ConstantTimeCompare([]byte(token), []byte(expected)) != 1 {
			time.Sleep(100 * time.Millisecond)
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(wrapped, r)

		log.Info().
			Str("method", r.Method).
			Str("path", r.URL.Path).
			Int("status", wrapped.statusCode).
			Dur("duration", time.Since(start)).
			Msg("request")
	})
}

func (s *Server) recoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Error().Interface("panic", err).Str("path", r.URL.Path).Msg("recovered from panic")
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
			}
		}()
		next.ServeHTTP(w, r)
	})
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (s *Server) licenseMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.enforcer.IsValid() {
			writeJSON(w, http.StatusForbidden, map[string]string{
				"error":   "license_required",
				"message": "Valid license required. Run: xixero activate <key>",
			})
			return
		}
		next.ServeHTTP(w, r)
	})
}
