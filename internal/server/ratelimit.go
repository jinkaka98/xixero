package server

import (
	"sync"
	"time"
)

type rateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*tokenBucket
	global  *tokenBucket
}

type tokenBucket struct {
	tokens     float64
	maxTokens  float64
	refillRate float64
	lastRefill time.Time
}

func newRateLimiter(globalRPS int) *rateLimiter {
	return &rateLimiter{
		buckets: make(map[string]*tokenBucket),
		global: &tokenBucket{
			tokens:     float64(globalRPS),
			maxTokens:  float64(globalRPS),
			refillRate: float64(globalRPS),
			lastRefill: time.Now(),
		},
	}
}

func (rl *rateLimiter) allow(providerID string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	if !rl.global.take() {
		return false
	}

	bucket, ok := rl.buckets[providerID]
	if !ok {
		return true
	}
	return bucket.take()
}

func (tb *tokenBucket) take() bool {
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

func (rl *rateLimiter) setProviderLimit(providerID string, rps int) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	rl.buckets[providerID] = &tokenBucket{
		tokens:     float64(rps),
		maxTokens:  float64(rps),
		refillRate: float64(rps),
		lastRefill: time.Now(),
	}
}

type authLimiter struct {
	mu       sync.Mutex
	attempts map[string]*authAttempt
}

type authAttempt struct {
	count    int
	lastFail time.Time
	blocked  bool
}

func newAuthLimiter() *authLimiter {
	return &authLimiter{
		attempts: make(map[string]*authAttempt),
	}
}

func (al *authLimiter) recordFail(ip string) {
	al.mu.Lock()
	defer al.mu.Unlock()

	a, ok := al.attempts[ip]
	if !ok {
		a = &authAttempt{}
		al.attempts[ip] = a
	}

	a.count++
	a.lastFail = time.Now()

	if a.count >= 5 {
		a.blocked = true
	}
}

func (al *authLimiter) isBlocked(ip string) bool {
	al.mu.Lock()
	defer al.mu.Unlock()

	a, ok := al.attempts[ip]
	if !ok {
		return false
	}

	if a.blocked && time.Since(a.lastFail) > 15*time.Minute {
		a.blocked = false
		a.count = 0
		return false
	}

	return a.blocked
}
