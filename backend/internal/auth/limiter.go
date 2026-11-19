package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type LoginLimiter struct {
	rdb         *redis.Client
	maxFailures int64
	window      time.Duration
}

func NewLoginLimiter(rdb *redis.Client) *LoginLimiter {
	return &LoginLimiter{rdb: rdb, maxFailures: 8, window: 15 * time.Minute}
}

func (l *LoginLimiter) key(k string) string { return "login:failures:" + k }

func (l *LoginLimiter) IsBlocked(ctx context.Context, key string) (bool, error) {
	n, err := l.rdb.Get(ctx, l.key(key)).Int64()
	if err == redis.Nil {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("limite de login: %w", err)
	}
	return n >= l.maxFailures, nil
}

func (l *LoginLimiter) RecordFailure(ctx context.Context, key string) error {
	pipe := l.rdb.TxPipeline()
	pipe.Incr(ctx, l.key(key))
	pipe.ExpireNX(ctx, l.key(key), l.window)
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("limite de login: %w", err)
	}
	return nil
}

func (l *LoginLimiter) Reset(ctx context.Context, key string) error {
	return l.rdb.Del(ctx, l.key(key)).Err()
}
