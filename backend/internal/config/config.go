package config

import (
	"os"
	"strconv"
	"strings"
)

type MailConfig struct {
	Mailer      string
	Host        string
	Port        string
	Username    string
	Password    string
	Encryption  string
	FromAddress string
	FromName    string
}

type Config struct {
	Port                      string
	DatabaseURL               string
	RedisURL                  string
	CookieSecure              bool
	AppName                   string
	AppURL                    string
	AIEncryptionKey           string
	AIEmbeddingModel          string
	AIEmbeddingDimensions     int
	AIPlatformEmbeddingKey    string
	AIResponseCacheTTLSeconds int
	AIOpenRouterResponseCache bool
	AIOpenRouterCacheTTL      int
	Mail                      MailConfig
}

func FromEnv() Config {
	appName := get("APP_NAME", "Tercerize")
	fromName := strings.ReplaceAll(get("MAIL_FROM_NAME", appName), "${APP_NAME}", appName)
	return Config{
		Port:                      get("PORT", "8080"),
		DatabaseURL:               get("DATABASE_URL", "postgres://tercerize:tercerize_secret_2026@localhost:5432/tercerize?sslmode=disable"),
		RedisURL:                  get("REDIS_URL", "redis://localhost:6379"),
		CookieSecure:              getBool("COOKIE_SECURE", false),
		AppName:                   appName,
		AppURL:                    strings.TrimRight(get("APP_URL", "https://tercerize.dataweb3.com.br"), "/"),
		AIEncryptionKey:           get("AI_ENCRYPTION_KEY", "tercerize_openrouter_aes256_key_2026"),
		AIEmbeddingModel:          get("AI_EMBEDDING_MODEL", "openai/text-embedding-3-small"),
		AIEmbeddingDimensions:     getInt("AI_EMBEDDING_DIMENSIONS", 1536),
		AIPlatformEmbeddingKey:    strings.TrimSpace(os.Getenv("AI_PLATFORM_EMBEDDING_KEY")),
		AIResponseCacheTTLSeconds: getInt("AI_RESPONSE_CACHE_TTL_SECONDS", 600),
		AIOpenRouterResponseCache: getBool("AI_OPENROUTER_RESPONSE_CACHE", false),
		AIOpenRouterCacheTTL:      getInt("AI_OPENROUTER_CACHE_TTL", 300),
		Mail: MailConfig{
			Mailer:      get("MAIL_MAILER", "smtp"),
			Host:        get("MAIL_HOST", ""),
			Port:        get("MAIL_PORT", "465"),
			Username:    get("MAIL_USERNAME", ""),
			Password:    get("MAIL_PASSWORD", ""),
			Encryption:  strings.ToLower(get("MAIL_ENCRYPTION", "ssl")),
			FromAddress: strings.Trim(get("MAIL_FROM_ADDRESS", get("MAIL_USERNAME", "")), `"`),
			FromName:    strings.Trim(fromName, `"`),
		},
	}
}

func getInt(name string, fallback int) int {
	value, err := strconv.Atoi(os.Getenv(name))
	if err != nil || value < 1 || value > 4096 {
		return fallback
	}
	return value
}

func get(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func getBool(name string, fallback bool) bool {
	value, err := strconv.ParseBool(os.Getenv(name))
	if err != nil {
		return fallback
	}
	return value
}
