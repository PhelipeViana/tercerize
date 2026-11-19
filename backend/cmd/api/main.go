package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"

	"tercerize/backend/internal/api"
	"tercerize/backend/internal/auth"
	"tercerize/backend/internal/config"
	"tercerize/backend/internal/db"
	"tercerize/backend/internal/operations"
	"tercerize/backend/internal/seed"
	"tercerize/backend/migrations"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("servidor parou", "err", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	cfg := config.FromEnv()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	applied, err := db.Migrate(ctx, pool, migrations.Files)
	if err != nil {
		return err
	}
	for _, name := range applied {
		log.Info("migration aplicada", "name", name)
	}

	if err := seed.Ensure(ctx, pool); err != nil {
		return err
	}
	log.Info("seed multi-empresa e credencial developer verificados")

	redisOpt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		return err
	}
	rdb := redis.NewClient(redisOpt)
	defer rdb.Close()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Warn("Redis não respondeu ao subir; limite de login desligado temporariamente", "err", err)
	}

	authRepo := auth.NewRepository(pool)
	authHandlers := auth.NewHandlers(authRepo, auth.NewLoginLimiter(rdb), cfg.CookieSecure, log)
	opHandlers := operations.NewHandlers(pool, log)

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           api.New(pool, authHandlers, opHandlers),
		ReadHeaderTimeout: 10 * time.Second,
	}
	errCh := make(chan error, 1)
	go func() {
		log.Info("API Tercerize no ar", "addr", server.Addr)
		errCh <- server.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}
	log.Info("encerrando")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	return server.Shutdown(shutdownCtx)
}
