package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"strings"
	"time"
)

const (
	CookieName = "tercerize_session"
	sessionTTL = 30 * 24 * time.Hour
)

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

type Session struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expiresAt"`
}

func (r *Repository) Start(ctx context.Context, userID, tenantID string) (Session, error) {
	if err := r.DeleteExpiredSessions(ctx, userID); err != nil {
		return Session{}, err
	}
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return Session{}, err
	}
	token := base64.RawURLEncoding.EncodeToString(raw)
	expiresAt := time.Now().Add(sessionTTL)
	if err := r.InsertSession(ctx, userID, tenantID, hashToken(token), expiresAt); err != nil {
		return Session{}, err
	}
	return Session{Token: token, ExpiresAt: expiresAt}, nil
}

func (r *Repository) End(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	return r.DeleteSession(ctx, hashToken(token))
}

func (r *Repository) Lookup(ctx context.Context, token string) (*SessionContext, error) {
	if token == "" {
		return nil, nil
	}
	return r.FindSession(ctx, hashToken(token))
}

func Cookie(s Session, secure bool) *http.Cookie {
	return &http.Cookie{
		Name: CookieName, Value: s.Token, Path: "/", Expires: s.ExpiresAt,
		HttpOnly: true, Secure: secure, SameSite: http.SameSiteLaxMode,
	}
}

func ClearedCookie(secure bool) *http.Cookie {
	return &http.Cookie{
		Name: CookieName, Value: "", Path: "/", MaxAge: -1,
		HttpOnly: true, Secure: secure, SameSite: http.SameSiteLaxMode,
	}
}

func TokenFrom(r *http.Request) string {
	if c, err := r.Cookie(CookieName); err == nil && c.Value != "" {
		return c.Value
	}
	if token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer "); ok {
		return strings.TrimSpace(token)
	}
	return ""
}
