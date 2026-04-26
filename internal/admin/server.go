package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"golang.org/x/crypto/bcrypt"

	"xixero/internal/store"
)

type AdminServer struct {
	router     *mux.Router
	httpServer *http.Server
	store      *store.Store
	port       int
	secretKey  string
}

func NewServer(s *store.Store, port int, secretKey string) *AdminServer {
	router := mux.NewRouter()
	srv := &AdminServer{
		router:    router,
		store:     s,
		port:      port,
		secretKey: secretKey,
	}

	srv.setupRoutes()
	srv.httpServer = &http.Server{
		Addr:              net.JoinHostPort("127.0.0.1", fmt.Sprintf("%d", port)),
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	return srv
}

func (s *AdminServer) Start() error {
	return s.httpServer.ListenAndServe()
}

func (s *AdminServer) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}

func (s *AdminServer) setupRoutes() {
	s.router.Use(corsMiddleware)

	s.router.HandleFunc("/admin/auth/login", s.handleLogin).Methods(http.MethodPost, http.MethodOptions)
	s.router.HandleFunc("/api/license/validate", s.handleValidateLicense).Methods(http.MethodPost, http.MethodOptions)

	api := s.router.PathPrefix("/admin/api").Subrouter()
	api.Use(s.adminAuthMiddleware)

	api.HandleFunc("/dashboard", s.handleDashboard).Methods(http.MethodGet, http.MethodOptions)
	api.HandleFunc("/licenses", s.handleListLicenses).Methods(http.MethodGet, http.MethodOptions)
	api.HandleFunc("/licenses", s.handleCreateLicense).Methods(http.MethodPost, http.MethodOptions)
	api.HandleFunc("/licenses/{key}", s.handleRevokeLicense).Methods(http.MethodDelete, http.MethodOptions)
}

func (s *AdminServer) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	username, hash, err := s.store.GetAdminCredentials()
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "admin not initialized"})
		return
	}

	if req.Username != username || bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		time.Sleep(200 * time.Millisecond)
		writeJSON(w, 401, map[string]string{"error": "invalid credentials"})
		return
	}

	writeJSON(w, 200, map[string]string{"token": s.secretKey, "message": "login successful"})
}

func (s *AdminServer) handleValidateLicense(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Key       string `json:"key"`
		MachineID string `json:"machine_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	lic, err := s.store.ValidateLicense(req.Key, req.MachineID)
	if err != nil {
		writeJSON(w, 403, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"valid":      true,
		"name":       lic.Name,
		"expires_at": lic.ExpiresAt.Format(time.RFC3339),
		"features":   []string{"proxy", "streaming", "multi_provider"},
	})
}

func (s *AdminServer) handleDashboard(w http.ResponseWriter, r *http.Request) {
	licenses, _ := s.store.ListLicenses()
	totalToday, _ := s.store.GetTotalUsageToday()

	active := 0
	revoked := 0
	for _, l := range licenses {
		if l.Revoked {
			revoked++
		} else if time.Now().Before(l.ExpiresAt) {
			active++
		}
	}

	writeJSON(w, 200, map[string]interface{}{
		"total_licenses":  len(licenses),
		"active_licenses": active,
		"revoked":         revoked,
		"requests_today":  totalToday,
	})
}

func (s *AdminServer) handleListLicenses(w http.ResponseWriter, r *http.Request) {
	licenses, err := s.store.ListLicenses()
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	if licenses == nil {
		licenses = []store.License{}
	}
	writeJSON(w, 200, licenses)
}

func (s *AdminServer) handleCreateLicense(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
		Days int    `json:"days"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	if req.Name == "" {
		writeJSON(w, 400, map[string]string{"error": "name is required"})
		return
	}
	if req.Days <= 0 {
		req.Days = 365
	}

	lic, err := s.store.CreateLicense(req.Name, time.Duration(req.Days)*24*time.Hour)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, 201, lic)
}

func (s *AdminServer) handleRevokeLicense(w http.ResponseWriter, r *http.Request) {
	key := mux.Vars(r)["key"]
	if err := s.store.RevokeLicense(key); err != nil {
		writeJSON(w, 404, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]string{"message": "license revoked"})
}

func (s *AdminServer) adminAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}
		token := r.Header.Get("X-Admin-Token")
		if token != s.secretKey {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token")
		if r.Method == http.MethodOptions {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(payload)
}
