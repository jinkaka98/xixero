# Xixero - Security & Performance Architecture

> Ref: PLANNER.md (architecture), IMPLEMENTATION.md (technical specs)

---

## 1. Threat Model

### Attack Surface

```
┌──────────────────────────────────────────────────────────────┐
│                      ATTACK VECTORS                           │
│                                                                │
│  [A] Malicious Website ──→ localhost:7860 (CSRF/CORS abuse)  │
│  [B] Local Malware ──→ config.json (API key theft)           │
│  [C] Network Sniffer ──→ proxy ↔ provider (MITM)            │
│  [D] License Bypass ──→ offline tampering                     │
│  [E] Supply Chain ──→ malicious binary via update             │
│  [F] Token Theft ──→ localStorage in browser                  │
│  [G] Brute Force ──→ API token guessing                       │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### Trust Boundaries

| Zone | Trust Level | Assets |
|------|-------------|--------|
| Local Binary | High | Config, API keys, license cache |
| Browser (GitHub Pages) | Medium | API token in localStorage |
| Network (proxy → provider) | Low | Request/response data |
| GitHub Releases | Medium | Binary updates |
| License Server | Medium | License validation |

---

## 2. API Key Encryption at Rest

### Strategy: AES-256-GCM + Machine-Bound Key Derivation

API keys di config.json TIDAK boleh plaintext. Encrypt menggunakan key yang derived dari machine-specific data.

### Key Derivation

```go
// pkg/utils/crypto.go
package utils

import (
    "crypto/aes"
    "crypto/cipher"
    "crypto/rand"
    "crypto/sha256"
    "encoding/base64"
    "fmt"
    "io"
    "os"
    "os/exec"
    "runtime"
    "strings"

    "golang.org/x/crypto/pbkdf2"
)

// getMachineID returns a machine-specific identifier
// Windows: MachineGuid from registry
// Linux: /etc/machine-id
func getMachineID() (string, error) {
    switch runtime.GOOS {
    case "windows":
        out, err := exec.Command("powershell", "-Command",
            "(Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography' -Name MachineGuid).MachineGuid",
        ).Output()
        if err != nil {
            return "", fmt.Errorf("get machine guid: %w", err)
        }
        return strings.TrimSpace(string(out)), nil

    case "linux":
        data, err := os.ReadFile("/etc/machine-id")
        if err != nil {
            return "", err
        }
        return strings.TrimSpace(string(data)), nil

    default:
        // Fallback: hostname + username
        host, _ := os.Hostname()
        user := os.Getenv("USER")
        if user == "" {
            user = os.Getenv("USERNAME")
        }
        return host + ":" + user, nil
    }
}

// DeriveKey creates a machine-bound encryption key
func DeriveKey(salt []byte) ([]byte, error) {
    machineID, err := getMachineID()
    if err != nil {
        return nil, err
    }

    // PBKDF2 with machine ID as password, 100k iterations
    key := pbkdf2.Key(
        []byte(machineID),
        salt,
        100_000,
        32, // AES-256
        sha256.New,
    )
    return key, nil
}
```

### Encrypt / Decrypt

```go
// Encrypt encrypts plaintext using AES-256-GCM
func Encrypt(plaintext string) (string, error) {
    // Generate random salt
    salt := make([]byte, 16)
    if _, err := io.ReadFull(rand.Reader, salt); err != nil {
        return "", err
    }

    key, err := DeriveKey(salt)
    if err != nil {
        return "", err
    }

    block, err := aes.NewCipher(key)
    if err != nil {
        return "", err
    }

    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", err
    }

    nonce := make([]byte, gcm.NonceSize())
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return "", err
    }

    ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)

    // Format: base64(salt + nonce + ciphertext)
    combined := append(salt, ciphertext...)
    return "enc:" + base64.StdEncoding.EncodeToString(combined), nil
}

// Decrypt decrypts an encrypted string
func Decrypt(encrypted string) (string, error) {
    if !strings.HasPrefix(encrypted, "enc:") {
        return encrypted, nil // Not encrypted, return as-is (backward compat)
    }

    data, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(encrypted, "enc:"))
    if err != nil {
        return "", err
    }

    // Extract salt (first 16 bytes)
    salt := data[:16]
    ciphertext := data[16:]

    key, err := DeriveKey(salt)
    if err != nil {
        return "", err
    }

    block, err := aes.NewCipher(key)
    if err != nil {
        return "", err
    }

    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", err
    }

    nonceSize := gcm.NonceSize()
    nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

    plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
    if err != nil {
        return "", fmt.Errorf("decrypt failed (wrong machine?): %w", err)
    }

    return string(plaintext), nil
}
```

### Config.json (Encrypted API Keys)

```json
{
  "providers": [
    {
      "id": "enowx-1",
      "name": "My enowX AI",
      "api_key": "enc:c2FsdC4uLi5ub25jZS4uLi5jaXBoZXJ0ZXh0Li4u",
      "endpoint": "https://api.enowx.com/v1"
    }
  ]
}
```

**Catatan:** Prefix `enc:` menandakan value sudah encrypted. Kalau tanpa prefix, dianggap plaintext (backward compatibility saat migrasi).

---

## 3. Local Server Security

### 3.1 CORS Protection

```go
// Strict CORS - hanya allow origin yang dikenal
func (s *Server) corsMiddleware(next http.Handler) http.Handler {
    allowedOrigins := map[string]bool{
        "https://jinkaka98.github.io": true,
        fmt.Sprintf("http://localhost:%d", s.config.Server.Port): true,
    }

    // Dev mode: tambah Vite dev server
    if s.config.DevMode {
        allowedOrigins["http://localhost:5173"] = true
    }

    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        origin := r.Header.Get("Origin")

        if allowedOrigins[origin] {
            w.Header().Set("Access-Control-Allow-Origin", origin)
            w.Header().Set("Access-Control-Allow-Credentials", "true")
        }

        // NEVER use Access-Control-Allow-Origin: *
        // Ini akan membuka akses ke semua website

        w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Token")
        w.Header().Set("Access-Control-Max-Age", "86400")

        if r.Method == "OPTIONS" {
            w.WriteHeader(204)
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

### 3.2 Anti-CSRF untuk Localhost

```go
// Tolak request dari origin yang tidak dikenal
func (s *Server) csrfMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Skip untuk proxy endpoints (IDE tidak kirim Origin header)
        if strings.HasPrefix(r.URL.Path, "/v1/") {
            next.ServeHTTP(w, r)
            return
        }

        origin := r.Header.Get("Origin")
        referer := r.Header.Get("Referer")

        // Kalau ada Origin header, HARUS dari allowed list
        if origin != "" && !s.isAllowedOrigin(origin) {
            http.Error(w, `{"error":"forbidden origin"}`, 403)
            return
        }

        // Kalau ada Referer, HARUS dari allowed domain
        if referer != "" && !s.isAllowedReferer(referer) {
            http.Error(w, `{"error":"forbidden referer"}`, 403)
            return
        }

        next.ServeHTTP(w, r)
    })
}
```

### 3.3 API Token Security

```go
// Token generation: 32 bytes random = 256-bit entropy
func generateAPIToken() string {
    b := make([]byte, 32)
    rand.Read(b)
    return hex.EncodeToString(b) // 64 char hex string
}

// Constant-time comparison (prevent timing attacks)
func (s *Server) authMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := r.Header.Get("X-API-Token")

        // Constant-time compare
        if subtle.ConstantTimeCompare([]byte(token), []byte(s.config.APIToken)) != 1 {
            // Rate limit failed attempts
            s.rateLimiter.RecordFailedAuth(r.RemoteAddr)
            time.Sleep(100 * time.Millisecond) // Slow down brute force

            http.Error(w, `{"error":"unauthorized"}`, 401)
            return
        }

        next.ServeHTTP(w, r)
    })
}
```

### 3.4 Bind to Localhost Only

```go
// CRITICAL: Hanya bind ke 127.0.0.1, BUKAN 0.0.0.0
// 0.0.0.0 akan expose server ke network
server := &http.Server{
    Addr: "127.0.0.1:7860", // HANYA localhost
    // JANGAN: "0.0.0.0:7860" atau ":7860"
}
```

### 3.5 Browser localStorage Mitigation

```javascript
// web-ui/src/lib/storage.js

// Token disimpan di localStorage dengan expiry
export function saveToken(token) {
    const data = {
        token,
        savedAt: Date.now(),
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
    };
    localStorage.setItem('xixero_auth', JSON.stringify(data));
}

export function getToken() {
    const raw = localStorage.getItem('xixero_auth');
    if (!raw) return null;

    try {
        const data = JSON.parse(raw);
        if (Date.now() > data.expiresAt) {
            localStorage.removeItem('xixero_auth');
            return null;
        }
        return data.token;
    } catch {
        return null;
    }
}

// Clear on logout
export function clearToken() {
    localStorage.removeItem('xixero_auth');
}
```

---

## 4. Provider Communication Security

### 4.1 TLS Enforcement

```go
// Force HTTPS untuk semua provider connections
func newSecureHTTPClient() *http.Client {
    return &http.Client{
        Timeout: 120 * time.Second,
        Transport: &http.Transport{
            TLSClientConfig: &tls.Config{
                MinVersion: tls.VersionTLS12,
                // Prefer strong cipher suites
                CipherSuites: []uint16{
                    tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
                    tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
                    tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
                    tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
                },
            },
            MaxIdleConns:        100,
            MaxIdleConnsPerHost: 10,
            IdleConnTimeout:     90 * time.Second,
        },
    }
}

// Validate provider endpoint
func validateEndpoint(endpoint string) error {
    u, err := url.Parse(endpoint)
    if err != nil {
        return fmt.Errorf("invalid URL: %w", err)
    }

    // MUST be HTTPS (except localhost for testing)
    if u.Scheme != "https" && u.Hostname() != "localhost" {
        return fmt.Errorf("provider endpoint must use HTTPS")
    }

    // Block private/internal IPs (SSRF prevention)
    if isPrivateIP(u.Hostname()) && u.Hostname() != "localhost" {
        return fmt.Errorf("provider endpoint cannot be a private IP")
    }

    return nil
}
```

### 4.2 Request Sanitization

```go
// Strip sensitive headers sebelum forward ke provider
func sanitizeRequest(r *http.Request) {
    // Remove client's auth header (kita inject provider key sendiri)
    r.Header.Del("Authorization")

    // Remove internal headers
    r.Header.Del("X-API-Token")
    r.Header.Del("Cookie")

    // Remove proxy-revealing headers
    r.Header.Del("X-Forwarded-For")
    r.Header.Del("X-Real-IP")
}

// Strip sensitive data dari response sebelum kirim ke client
func sanitizeResponse(resp *http.Response) {
    resp.Header.Del("Set-Cookie")
    resp.Header.Del("X-Request-Id") // Provider internal ID
}
```

---

## 5. License System Security

### 5.1 License Key Format

```
Format: XIXERO-XXXXX-XXXXX-XXXXX-XXXXX
        prefix  seg1   seg2   seg3   checksum

Segments: Base32 encoded (A-Z, 2-7)
Checksum: CRC32 dari seg1+seg2+seg3, encoded Base32
```

```go
// internal/license/keygen.go
func ValidateKeyFormat(key string) error {
    parts := strings.Split(key, "-")
    if len(parts) != 5 {
        return fmt.Errorf("invalid key format")
    }
    if parts[0] != "XIXERO" {
        return fmt.Errorf("invalid key prefix")
    }

    // Validate checksum
    payload := parts[1] + parts[2] + parts[3]
    expectedChecksum := computeChecksum(payload)
    if parts[4] != expectedChecksum {
        return fmt.Errorf("invalid checksum")
    }

    return nil
}
```

### 5.2 License Validation Flow

```
┌──────────┐     ┌──────────────┐     ┌─────────────────┐
│  Client   │────→│ Xixero Proxy │────→│ License Server   │
│  (Web UI) │     │ (localhost)  │     │ (Cloudflare)     │
└──────────┘     └──────────────┘     └─────────────────┘
                        │                       │
                   1. User input key       4. Validate key
                   2. Format check         5. Return JWT
                   3. Send to server       6. Cache locally
                        │                       │
                   7. Store encrypted      
                      JWT in config        
```

### 5.3 JWT License Token

```go
// License server returns signed JWT
type LicenseClaims struct {
    jwt.RegisteredClaims
    LicenseKey string   `json:"license_key"`
    Features   []string `json:"features"`
    MachineID  string   `json:"machine_id"` // Bind to machine
    MaxDevices int      `json:"max_devices"`
}

// Validate JWT locally (offline validation)
func ValidateLicenseJWT(tokenString string, publicKey *rsa.PublicKey) (*LicenseClaims, error) {
    token, err := jwt.ParseWithClaims(tokenString, &LicenseClaims{}, func(token *jwt.Token) (interface{}, error) {
        // Verify signing method
        if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
            return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
        }
        return publicKey, nil
    })

    if err != nil {
        return nil, err
    }

    claims, ok := token.Claims.(*LicenseClaims)
    if !ok || !token.Valid {
        return nil, fmt.Errorf("invalid token")
    }

    // Check machine binding
    currentMachine, _ := getMachineID()
    if claims.MachineID != "" && claims.MachineID != currentMachine {
        return nil, fmt.Errorf("license not valid for this machine")
    }

    return claims, nil
}
```

### 5.4 Anti-Tampering

```go
// Periodic revalidation (setiap 7 hari)
func (lc *LicenseClient) StartPeriodicCheck(cfg *config.Config) {
    ticker := time.NewTicker(7 * 24 * time.Hour)
    go func() {
        for range ticker.C {
            result, err := lc.Validate(cfg.License.Key)
            if err != nil {
                log.Warn().Err(err).Msg("License revalidation failed (offline mode)")
                continue
            }
            if !result.Valid {
                log.Warn().Msg("License expired or revoked")
                cfg.License.Features = []string{} // Downgrade to free
                cfg.Save()
            }
        }
    }()
}

// Config file integrity check
func (c *Config) VerifyIntegrity() bool {
    // Hash seluruh config kecuali integrity field
    data, _ := json.Marshal(c)
    expected := sha256.Sum256(data)
    return hmac.Equal(expected[:], c.IntegrityHash)
}
```

---

## 6. Auto-Update Security

### 6.1 Binary Integrity Verification

```go
// internal/update/verify.go

// VerifyChecksum validates downloaded binary against checksums.txt
func VerifyChecksum(binaryPath string, checksumURL string) error {
    // 1. Download checksums.txt dari release
    resp, err := http.Get(checksumURL)
    if err != nil {
        return fmt.Errorf("fetch checksums: %w", err)
    }
    defer resp.Body.Close()

    checksumData, _ := io.ReadAll(resp.Body)

    // 2. Parse checksums (format: "sha256hash  filename")
    expectedHash := parseChecksum(checksumData, filepath.Base(binaryPath))
    if expectedHash == "" {
        return fmt.Errorf("no checksum found for binary")
    }

    // 3. Hash downloaded binary
    f, err := os.Open(binaryPath)
    if err != nil {
        return err
    }
    defer f.Close()

    hasher := sha256.New()
    io.Copy(hasher, f)
    actualHash := hex.EncodeToString(hasher.Sum(nil))

    // 4. Compare
    if actualHash != expectedHash {
        return fmt.Errorf("checksum mismatch: expected %s, got %s", expectedHash, actualHash)
    }

    return nil
}
```

### 6.2 Rollback Mechanism

```go
func (u *Updater) Apply(release *Release) error {
    currentExe, _ := os.Executable()
    backupExe := currentExe + ".backup"
    tmpExe := currentExe + ".new"

    // 1. Download ke temp file
    if err := u.download(release, tmpExe); err != nil {
        os.Remove(tmpExe)
        return fmt.Errorf("download failed: %w", err)
    }

    // 2. Verify checksum
    checksumURL := findChecksumURL(release)
    if err := VerifyChecksum(tmpExe, checksumURL); err != nil {
        os.Remove(tmpExe)
        return fmt.Errorf("integrity check failed: %w", err)
    }

    // 3. Backup current binary
    if err := copyFile(currentExe, backupExe); err != nil {
        os.Remove(tmpExe)
        return fmt.Errorf("backup failed: %w", err)
    }

    // 4. Replace
    if err := os.Rename(tmpExe, currentExe); err != nil {
        // Rollback: restore backup
        os.Rename(backupExe, currentExe)
        return fmt.Errorf("replace failed, rolled back: %w", err)
    }

    os.Chmod(currentExe, 0755)

    log.Info().
        Str("from", u.current).
        Str("to", release.TagName).
        Msg("Update applied successfully")

    return nil
}

// Rollback ke versi sebelumnya
func (u *Updater) Rollback() error {
    currentExe, _ := os.Executable()
    backupExe := currentExe + ".backup"

    if _, err := os.Stat(backupExe); os.IsNotExist(err) {
        return fmt.Errorf("no backup found for rollback")
    }

    os.Rename(currentExe, currentExe+".failed")
    os.Rename(backupExe, currentExe)

    log.Info().Msg("Rolled back to previous version")
    return nil
}
```

### 6.3 GitHub Release Verification

```go
// Verify release is from correct repository
func (u *Updater) verifyRelease(release *Release) error {
    // Check release author
    if release.Author.Login != u.owner {
        return fmt.Errorf("release author mismatch")
    }

    // Check tag format
    if !strings.HasPrefix(release.TagName, "v") {
        return fmt.Errorf("invalid tag format")
    }

    // Ensure not a pre-release (unless user opts in)
    if release.Prerelease && !u.allowPrerelease {
        return fmt.Errorf("skipping pre-release")
    }

    return nil
}
```

---

## 7. Performance Optimization

### 7.1 Connection Pooling

```go
// Shared HTTP transport untuk semua provider connections
var sharedTransport = &http.Transport{
    MaxIdleConns:        200,           // Total idle connections
    MaxIdleConnsPerHost: 20,            // Per-provider idle connections
    MaxConnsPerHost:     50,            // Max concurrent per provider
    IdleConnTimeout:     90 * time.Second,
    TLSHandshakeTimeout: 10 * time.Second,
    ResponseHeaderTimeout: 30 * time.Second,

    // Keep-alive
    DisableKeepAlives: false,

    // Buffer sizes
    WriteBufferSize: 64 * 1024, // 64KB write buffer
    ReadBufferSize:  64 * 1024, // 64KB read buffer
}

func newProviderClient() *http.Client {
    return &http.Client{
        Transport: sharedTransport,
        Timeout:   0, // No timeout (streaming needs unlimited)
    }
}
```

### 7.2 Streaming SSE Optimization

```go
// Optimized streaming handler
func (p *Proxy) handleStreaming(w http.ResponseWriter, r *http.Request, prov provider.Provider, body []byte) {
    // Set SSE headers
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")
    w.Header().Set("X-Accel-Buffering", "no") // Disable nginx buffering

    flusher, ok := w.(http.Flusher)
    if !ok {
        writeError(w, 500, "streaming not supported")
        return
    }

    // Context with timeout for initial response
    ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
    defer cancel()

    resp, err := prov.Send(ctx, body)
    if err != nil {
        writeError(w, 502, "provider timeout")
        return
    }
    defer resp.Body.Close()

    // Reset timeout - streaming bisa lama
    // Tapi tetap monitor client disconnect
    ctx = r.Context()

    // Buffered reader untuk efisiensi
    reader := bufio.NewReaderSize(resp.Body, 4096) // 4KB buffer

    for {
        select {
        case <-ctx.Done():
            // Client disconnected
            return
        default:
        }

        line, err := reader.ReadBytes('\n')
        if err != nil {
            if err == io.EOF {
                break
            }
            return
        }

        // Write + flush immediately untuk low latency
        w.Write(line)
        flusher.Flush()
    }
}
```

### 7.3 Timeout Strategy

```go
// Timeout configuration per operation type
type TimeoutConfig struct {
    // Connection establishment
    DialTimeout     time.Duration // 5s
    TLSHandshake    time.Duration // 10s

    // Non-streaming requests
    RequestTimeout  time.Duration // 30s
    ResponseHeader  time.Duration // 15s

    // Streaming requests
    StreamInitial   time.Duration // 30s (time to first byte)
    StreamIdle      time.Duration // 60s (max time between chunks)
    StreamMax       time.Duration // 0   (no max, stream until done)

    // Management API
    APITimeout      time.Duration // 10s

    // Update download
    UpdateTimeout   time.Duration // 300s (5 min for large binaries)
}

var DefaultTimeouts = TimeoutConfig{
    DialTimeout:    5 * time.Second,
    TLSHandshake:   10 * time.Second,
    RequestTimeout: 30 * time.Second,
    ResponseHeader: 15 * time.Second,
    StreamInitial:  30 * time.Second,
    StreamIdle:     60 * time.Second,
    StreamMax:      0,
    APITimeout:     10 * time.Second,
    UpdateTimeout:  300 * time.Second,
}
```

### 7.4 Memory Management

```go
// Limit request body size
func (s *Server) bodySizeMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Max 10MB request body
        r.Body = http.MaxBytesReader(w, r.Body, 10*1024*1024)
        next.ServeHTTP(w, r)
    })
}

// Reuse byte buffers untuk reduce GC pressure
var bufferPool = sync.Pool{
    New: func() interface{} {
        buf := make([]byte, 32*1024) // 32KB
        return &buf
    },
}

func getBuffer() *[]byte {
    return bufferPool.Get().(*[]byte)
}

func putBuffer(buf *[]byte) {
    bufferPool.Put(buf)
}
```

---

## 8. Rate Limiting

### 8.1 Token Bucket per Provider

```go
// internal/proxy/ratelimit.go
package proxy

import (
    "sync"
    "time"
)

type RateLimiter struct {
    mu       sync.Mutex
    buckets  map[string]*TokenBucket // provider_id → bucket
    global   *TokenBucket
}

type TokenBucket struct {
    tokens     float64
    maxTokens  float64
    refillRate float64 // tokens per second
    lastRefill time.Time
}

func NewRateLimiter(globalRPS int) *RateLimiter {
    return &RateLimiter{
        buckets: make(map[string]*TokenBucket),
        global: &TokenBucket{
            tokens:     float64(globalRPS),
            maxTokens:  float64(globalRPS),
            refillRate: float64(globalRPS),
            lastRefill: time.Now(),
        },
    }
}

func (rl *RateLimiter) Allow(providerID string) bool {
    rl.mu.Lock()
    defer rl.mu.Unlock()

    // Check global limit
    if !rl.global.allow() {
        return false
    }

    // Check per-provider limit
    bucket, ok := rl.buckets[providerID]
    if !ok {
        return true // No per-provider limit set
    }
    return bucket.allow()
}

func (tb *TokenBucket) allow() bool {
    now := time.Now()
    elapsed := now.Sub(tb.lastRefill).Seconds()
    tb.tokens = min(tb.maxTokens, tb.tokens+(elapsed*tb.refillRate))
    tb.lastRefill = now

    if tb.tokens < 1 {
        return false
    }
    tb.tokens--
    return true
}

func (rl *RateLimiter) SetProviderLimit(providerID string, rps int) {
    rl.mu.Lock()
    defer rl.mu.Unlock()

    rl.buckets[providerID] = &TokenBucket{
        tokens:     float64(rps),
        maxTokens:  float64(rps),
        refillRate: float64(rps),
        lastRefill: time.Now(),
    }
}
```

### 8.2 Backpressure Handling

```go
// Middleware: return 429 when rate limited
func (s *Server) rateLimitMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Extract provider from request
        providerID := s.resolveProvider(r)

        if !s.rateLimiter.Allow(providerID) {
            w.Header().Set("Retry-After", "1")
            w.Header().Set("X-RateLimit-Remaining", "0")
            writeError(w, 429, "rate limit exceeded, retry after 1 second")
            return
        }

        next.ServeHTTP(w, r)
    })
}
```

### 8.3 Auth Brute Force Protection

```go
type AuthRateLimiter struct {
    mu       sync.Mutex
    attempts map[string]*authAttempt // IP → attempts
}

type authAttempt struct {
    count    int
    lastFail time.Time
    blocked  bool
}

func (arl *AuthRateLimiter) RecordFailedAuth(ip string) {
    arl.mu.Lock()
    defer arl.mu.Unlock()

    a, ok := arl.attempts[ip]
    if !ok {
        a = &authAttempt{}
        arl.attempts[ip] = a
    }

    a.count++
    a.lastFail = time.Now()

    // Block after 5 failed attempts
    if a.count >= 5 {
        a.blocked = true
    }
}

func (arl *AuthRateLimiter) IsBlocked(ip string) bool {
    arl.mu.Lock()
    defer arl.mu.Unlock()

    a, ok := arl.attempts[ip]
    if !ok {
        return false
    }

    // Unblock after 15 minutes
    if a.blocked && time.Since(a.lastFail) > 15*time.Minute {
        a.blocked = false
        a.count = 0
        return false
    }

    return a.blocked
}
```

---

## 9. Logging & Audit

### 9.1 Request Logging

```go
// Log setiap request dengan detail yang cukup untuk debugging
// tapi TANPA sensitive data (API keys, request body)
type RequestLog struct {
    Timestamp  time.Time `json:"timestamp"`
    Method     string    `json:"method"`
    Path       string    `json:"path"`
    StatusCode int       `json:"status_code"`
    Duration   int64     `json:"duration_ms"`
    Provider   string    `json:"provider"`
    Model      string    `json:"model"`
    Error      string    `json:"error,omitempty"`
    // NEVER log: API keys, request body, response body
}

func (s *Server) logRequest(log RequestLog) {
    // Write ke file
    s.requestLogger.Log(log)

    // Keep in-memory buffer untuk Web UI (last 1000 requests)
    s.requestBuffer.Add(log)
}
```

### 9.2 Sensitive Data Redaction

```go
// Redact sensitive fields sebelum logging
func redactConfig(cfg *Config) *Config {
    redacted := *cfg
    redacted.APIToken = "***REDACTED***"

    for i := range redacted.Providers {
        redacted.Providers[i].APIKey = "***REDACTED***"
    }

    redacted.License.Key = "***REDACTED***"
    return &redacted
}

// Redact Authorization header
func redactHeaders(h http.Header) http.Header {
    redacted := h.Clone()
    if redacted.Get("Authorization") != "" {
        redacted.Set("Authorization", "Bearer ***REDACTED***")
    }
    if redacted.Get("X-API-Token") != "" {
        redacted.Set("X-API-Token", "***REDACTED***")
    }
    return redacted
}
```

---

## 10. Security Checklist (Pre-Release)

### Must Have (P0)
- [ ] API keys encrypted at rest (AES-256-GCM)
- [ ] Server binds to 127.0.0.1 only
- [ ] CORS whitelist (no wildcard)
- [ ] API token auth on management endpoints
- [ ] Constant-time token comparison
- [ ] HTTPS enforced for provider connections
- [ ] Request body size limit (10MB)
- [ ] Sensitive data redacted from logs
- [ ] Binary checksum verification on update

### Should Have (P1)
- [ ] Auth brute force protection (5 attempts → 15min block)
- [ ] Rate limiting per provider
- [ ] CSRF protection for management API
- [ ] License machine binding
- [ ] Config file integrity check
- [ ] Rollback mechanism for failed updates

### Nice to Have (P2)
- [ ] Request/response encryption in transit (local HTTPS)
- [ ] Audit log for config changes
- [ ] IP allowlist for management API
- [ ] Automatic key rotation reminders
- [ ] Security headers (CSP, HSTS, X-Frame-Options)

---

## 11. Performance Benchmarks (Target)

| Metric | Target | Notes |
|--------|--------|-------|
| Proxy overhead (non-streaming) | < 5ms | Time added by proxy |
| Proxy overhead (streaming, per chunk) | < 1ms | Per SSE chunk |
| Memory usage (idle) | < 20MB | No active requests |
| Memory usage (100 concurrent) | < 100MB | 100 streaming requests |
| Startup time | < 500ms | Cold start to ready |
| Config load time | < 10ms | Parse + validate |
| Max concurrent connections | 1000+ | Per provider |
| Request throughput | 500+ req/s | Non-streaming |

### Benchmark Commands

```bash
# Startup time
time xixero start --benchmark

# Request throughput (non-streaming)
hey -n 1000 -c 50 -m POST \
    -H "Content-Type: application/json" \
    -d '{"model":"gpt-4","messages":[{"role":"user","content":"hi"}]}' \
    http://localhost:7860/v1/chat/completions

# Memory profiling
go tool pprof http://localhost:7860/debug/pprof/heap

# CPU profiling
go tool pprof http://localhost:7860/debug/pprof/profile?seconds=30
```

---

**Document Version:** 1.0.0
**Last Updated:** 2026-04-23
**Maintainer:** @jinkaka98
