package secretbox

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"strings"
)

func deriveKey(secret string) []byte {
	sum := sha256.Sum256([]byte(secret))
	return sum[:]
}

// Encrypt encrypts plaintext using AES-256-GCM and returns a base64 string.
func Encrypt(plaintext, secret string) (string, error) {
	plain := strings.TrimSpace(plaintext)
	if plain == "" {
		return "", nil
	}
	block, err := aes.NewCipher(deriveKey(secret))
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
	sealed := gcm.Seal(nonce, nonce, []byte(plain), nil)
	return base64.StdEncoding.EncodeToString(sealed), nil
}

// Decrypt decrypts a base64 AES-256-GCM ciphertext.
func Decrypt(ciphertextB64, secret string) (string, error) {
	raw := strings.TrimSpace(ciphertextB64)
	if raw == "" {
		return "", nil
	}
	data, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(deriveKey(secret))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(data) < gcm.NonceSize() {
		return "", errors.New("ciphertext inválido")
	}
	nonce := data[:gcm.NonceSize()]
	enc := data[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, enc, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

// MaskHint builds a non-sensitive visual hint for a stored OpenRouter API token (e.g., "sk-or-••••a1b2").
func MaskHint(token string) string {
	t := strings.TrimSpace(token)
	if t == "" {
		return ""
	}
	if len(t) <= 8 {
		return "••••" + t[len(t)-2:]
	}
	prefix := t[:6]
	if !strings.HasPrefix(prefix, "sk-") {
		prefix = t[:4]
	}
	return prefix + "••••" + t[len(t)-4:]
}
