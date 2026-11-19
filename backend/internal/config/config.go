package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port         string
	DatabaseURL  string
	RedisURL     string
	CookieSecure bool
}

func FromEnv() Config {
	return Config{
		Port:         get("PORT", "8080"),
		DatabaseURL:  get("DATABASE_URL", "postgres://tercerize:tercerize_secret_2026@localhost:5432/tercerize?sslmode=disable"),
		RedisURL:     get("REDIS_URL", "redis://localhost:6379"),
		CookieSecure: getBool("COOKIE_SECURE", false),
	}
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
