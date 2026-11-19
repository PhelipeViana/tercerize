package auth

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type User struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

type Tenant struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	CNPJ   string `json:"cnpj"`
	Active bool   `json:"active"`
}

type SessionContext struct {
	User   User   `json:"user"`
	Tenant Tenant `json:"tenant"`
}

var ErrEmailTaken = errors.New("e-mail já cadastrado")

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) CreateAccount(ctx context.Context, companyName, cnpj, name, email, passwordHash string) (userID, tenantID string, err error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return "", "", err
	}
	defer tx.Rollback(ctx)

	if err := tx.QueryRow(ctx, "INSERT INTO tenants (name, cnpj) VALUES ($1, $2) RETURNING id", companyName, cnpj).Scan(&tenantID); err != nil {
		return "", "", err
	}
	err = tx.QueryRow(ctx,
		"INSERT INTO users (tenant_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, 'admin') RETURNING id",
		tenantID, name, email, passwordHash).Scan(&userID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return "", "", ErrEmailTaken
		}
		return "", "", err
	}
	return userID, tenantID, tx.Commit(ctx)
}

type LoginUser struct {
	ID           string
	TenantID     string
	PasswordHash string
	Role         string
}

func (r *Repository) FindUserForLogin(ctx context.Context, email string) (*LoginUser, error) {
	var u LoginUser
	err := r.pool.QueryRow(ctx,
		`SELECT u.id, u.tenant_id, u.password_hash, u.role
		   FROM users u
		  WHERE lower(u.email) = lower($1)`, email).Scan(&u.ID, &u.TenantID, &u.PasswordHash, &u.Role)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repository) InsertSession(ctx context.Context, userID, tenantID, tokenHash string, expiresAt time.Time) error {
	_, err := r.pool.Exec(ctx,
		"INSERT INTO sessions (user_id, active_tenant_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
		userID, tenantID, tokenHash, expiresAt)
	return err
}

func (r *Repository) DeleteExpiredSessions(ctx context.Context, userID string) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM sessions WHERE user_id = $1 AND expires_at <= now()", userID)
	return err
}

func (r *Repository) DeleteSession(ctx context.Context, tokenHash string) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM sessions WHERE token_hash = $1", tokenHash)
	return err
}

func (r *Repository) SwitchActiveTenant(ctx context.Context, token string, tenantID string) error {
	if token == "" {
		return errors.New("sessão ausente")
	}
	_, err := r.pool.Exec(ctx,
		`UPDATE sessions SET active_tenant_id = $1 WHERE token_hash = $2 AND expires_at > now()`,
		tenantID, hashToken(token))
	return err
}

func (r *Repository) FindSession(ctx context.Context, tokenHash string) (*SessionContext, error) {
	var s SessionContext
	err := r.pool.QueryRow(ctx,
		`SELECT u.id, u.name, u.email, u.role, t.id, t.name, t.cnpj, t.active
		   FROM sessions s
		   JOIN users u ON u.id = s.user_id
		   JOIN tenants t ON t.id = s.active_tenant_id
		  WHERE s.token_hash = $1 AND s.expires_at > now()`, tokenHash).
		Scan(&s.User.ID, &s.User.Name, &s.User.Email, &s.User.Role, &s.Tenant.ID, &s.Tenant.Name, &s.Tenant.CNPJ, &s.Tenant.Active)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}
