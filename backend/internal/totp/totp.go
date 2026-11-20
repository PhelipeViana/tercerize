package totp

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"net/url"
	"strings"
	"time"
)

const (
	PeriodSeconds = 30
	Digits        = 6
)

var base32NoPad = base32.StdEncoding.WithPadding(base32.NoPadding)

// GenerateSecret generates a random 20-byte RFC 6238 TOTP secret encoded as uppercase Base32 without padding.
func GenerateSecret() (string, error) {
	buf := make([]byte, 20)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base32NoPad.EncodeToString(buf), nil
}

// CodeAt computes the 6-digit TOTP code for a given Base32 secret and Unix timestamp.
func CodeAt(secret string, at time.Time) (string, error) {
	cleaned := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(secret), " ", ""))
	key, err := base32NoPad.DecodeString(cleaned)
	if err != nil {
		// Try standard padded base32 fallback
		key, err = base32.StdEncoding.DecodeString(cleaned)
		if err != nil {
			return "", fmt.Errorf("segredo TOTP inválido: %w", err)
		}
	}

	counter := uint64(at.Unix() / PeriodSeconds)
	var msg [8]byte
	binary.BigEndian.PutUint64(msg[:], counter)

	mac := hmac.New(sha1.New, key)
	mac.Write(msg[:])
	sum := mac.Sum(nil)

	offset := sum[len(sum)-1] & 0x0f
	codeInt := (uint32(sum[offset])&0x7f)<<24 |
		(uint32(sum[offset+1])&0xff)<<16 |
		(uint32(sum[offset+2])&0xff)<<8 |
		(uint32(sum[offset+3]) & 0xff)

	otp := codeInt % 1_000_000
	return fmt.Sprintf("%06d", otp), nil
}

// Verify checks whether the provided 6-digit code matches the current 30s window or ±1 adjacent window.
func Verify(secret, code string, now time.Time) bool {
	normalized := strings.TrimSpace(strings.ReplaceAll(code, " ", ""))
	if len(normalized) != Digits {
		return false
	}
	for _, offset := range []int64{0, -PeriodSeconds, PeriodSeconds} {
		expected, err := CodeAt(secret, now.Add(time.Duration(offset)*time.Second))
		if err == nil && hmac.Equal([]byte(normalized), []byte(expected)) {
			return true
		}
	}
	return false
}

// OTPAuthURI returns the standard otpauth:// URI recognized directly by Google Authenticator.
func OTPAuthURI(issuer, accountEmail, secret string) string {
	label := url.PathEscape(fmt.Sprintf("%s:%s", issuer, accountEmail))
	q := url.Values{}
	q.Set("secret", secret)
	q.Set("issuer", issuer)
	q.Set("algorithm", "SHA1")
	q.Set("digits", "6")
	q.Set("period", "30")
	return fmt.Sprintf("otpauth://totp/%s?%s", label, q.Encode())
}
