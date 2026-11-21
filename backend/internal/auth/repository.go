package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"tercerize/backend/internal/totp"
)

type User struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Email          string `json:"email"`
	IsMaster       bool   `json:"isMaster"`
	Blocked        bool   `json:"blocked"`
	TOTPConfigured bool   `json:"totpConfigured"`
}

type Tenant struct {
	ID                 string `json:"id"`
	Name               string `json:"name"`
	CNPJ               string `json:"cnpj"`
	OwnerName          string `json:"ownerName"`
	OwnerEmail         string `json:"ownerEmail"`
	Active             bool   `json:"active"`
	HasOpenRouterToken bool   `json:"hasOpenrouterToken"`
}

type RoleInfo struct {
	ID          string          `json:"id"`
	Key         string          `json:"key"`
	Name        string          `json:"name"`
	Permissions map[string]bool `json:"permissions"`
}

type SessionContext struct {
	User   User     `json:"user"`
	Tenant Tenant   `json:"tenant"`
	Role   RoleInfo `json:"role"`
}

func (s *SessionContext) CanManageAccess() bool {
	if s == nil {
		return false
	}
	return s.User.IsMaster || s.Role.Key == "owner" || s.Role.Permissions["access:manage"]
}

func (s *SessionContext) HasPermission(perm string) bool {
	if s == nil {
		return false
	}
	if s.User.IsMaster || s.Role.Key == "owner" {
		return true
	}
	return s.Role.Permissions[perm]
}

var AllPermissionsTrue = map[string]bool{
	"contracts:view":       true,
	"contracts:write":      true,
	"service_orders:view":  true,
	"service_orders:write": true,
	"employees:view":       true,
	"employees:write":      true,
	"epis:view":            true,
	"epis:write":           true,
	"inventory:view":       true,
	"inventory:write":      true,
	"finance:view":         true,
	"finance:write":        true,
	"ai_chat:use":          true,
	"access:manage":        true,
}

var ErrInvalidSetupLink = errors.New("link de ativação inválido ou expirado")

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

type LoginUser struct {
	ID         string
	Name       string
	Email      string
	IsMaster   bool
	Blocked    bool
	TOTPSecret string
}

func (r *Repository) FindUserByEmail(ctx context.Context, email string) (*LoginUser, error) {
	var u LoginUser
	err := r.pool.QueryRow(ctx,
		`SELECT id, name, email, is_master, COALESCE(blocked, false), totp_secret
		   FROM users
		  WHERE lower(email) = lower($1)`, email).
		Scan(&u.ID, &u.Name, &u.Email, &u.IsMaster, &u.Blocked, &u.TOTPSecret)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(u.TOTPSecret) == "" {
		secret, genErr := totp.GenerateSecret()
		if genErr != nil {
			return nil, genErr
		}
		if _, updErr := r.pool.Exec(ctx, `UPDATE users SET totp_secret = $1 WHERE id = $2`, secret, u.ID); updErr != nil {
			return nil, updErr
		}
		u.TOTPSecret = secret
	}
	return &u, nil
}

// FindLinkedCompanyByCNPJ checks if the user is linked (via tenant_memberships or owner_user_id) to an active company with the given formatted CNPJ.
func (r *Repository) FindLinkedCompanyByCNPJ(ctx context.Context, userID, formattedCNPJ string) (tenantID string, companyName string, roleName string, ok bool, err error) {
	err = r.pool.QueryRow(ctx,
		`SELECT t.id, t.name, COALESCE(tr.name, 'Vinculado')
		   FROM tenants t
		   LEFT JOIN tenant_memberships tm ON tm.tenant_id = t.id AND tm.user_id = $1
		   LEFT JOIN tenant_roles tr ON tr.id = tm.role_id
		  WHERE t.cnpj = $2
		    AND t.active = true
		    AND (tm.user_id IS NOT NULL OR t.owner_user_id = $1)
		  LIMIT 1`,
		userID, formattedCNPJ).Scan(&tenantID, &companyName, &roleName)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", "", false, nil
	}
	if err != nil {
		return "", "", "", false, err
	}
	return tenantID, companyName, roleName, true, nil
}

// EnsureUserWithTOTP finds an existing user by email or creates one with a generated Base32 TOTP secret.
func (r *Repository) EnsureUserWithTOTP(ctx context.Context, tx pgx.Tx, name, email string) (userID string, totpSecret string, created bool, err error) {
	err = tx.QueryRow(ctx,
		`SELECT id, totp_secret FROM users WHERE lower(email) = lower($1)`, email).
		Scan(&userID, &totpSecret)
	if err == nil {
		if strings.TrimSpace(totpSecret) == "" {
			totpSecret, err = totp.GenerateSecret()
			if err != nil {
				return "", "", false, err
			}
			_, err = tx.Exec(ctx, `UPDATE users SET totp_secret = $1 WHERE id = $2`, totpSecret, userID)
			if err != nil {
				return "", "", false, err
			}
		}
		return userID, totpSecret, false, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", "", false, err
	}

	totpSecret, err = totp.GenerateSecret()
	if err != nil {
		return "", "", false, err
	}
	err = tx.QueryRow(ctx,
		`INSERT INTO users (name, email, password_hash, role, is_master, totp_secret)
		 VALUES ($1, lower($2), '', 'operator', false, $3)
		 RETURNING id`,
		strings.TrimSpace(name), strings.TrimSpace(email), totpSecret).
		Scan(&userID)
	if err != nil {
		return "", "", false, err
	}
	return userID, totpSecret, true, nil
}

func (r *Repository) MarkTOTPConfigured(ctx context.Context, userID string) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET totp_configured_at = COALESCE(totp_configured_at, now()) WHERE id = $1`, userID)
	return err
}

func (r *Repository) RecordUserAccess(ctx context.Context, userID string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE users
		    SET last_login_at = now(),
		        login_count = COALESCE(login_count, 0) + 1,
		        totp_configured_at = COALESCE(totp_configured_at, now())
		  WHERE id = $1`, userID)
	return err
}

func (r *Repository) CreateSetupLink(ctx context.Context, userID, tenantID string) (string, error) {
	rawBytes := make([]byte, 24)
	if _, err := rand.Read(rawBytes); err != nil {
		return "", err
	}
	rawToken := base64.RawURLEncoding.EncodeToString(rawBytes)
	tokenHash := hashToken(rawToken)
	expiresAt := time.Now().Add(24 * time.Hour)

	var tenantPtr *string
	if strings.TrimSpace(tenantID) != "" {
		t := strings.TrimSpace(tenantID)
		tenantPtr = &t
	}
	_, err := r.pool.Exec(ctx,
		`INSERT INTO auth_setup_links (user_id, tenant_id, token_hash, expires_at)
		 VALUES ($1, $2, $3, $4)`,
		userID, tenantPtr, tokenHash, expiresAt)
	if err != nil {
		return "", err
	}
	return rawToken, nil
}

type SetupLinkInfo struct {
	LinkID      string
	UserID      string
	UserName    string
	UserEmail   string
	IsMaster    bool
	Blocked     bool
	TOTPSecret  string
	TenantID    string
	CompanyName string
	RoleName    string
}

func (r *Repository) LookupSetupLink(ctx context.Context, rawToken string) (*SetupLinkInfo, error) {
	if strings.TrimSpace(rawToken) == "" {
		return nil, ErrInvalidSetupLink
	}
	var info SetupLinkInfo
	var tenantID, companyName, roleName *string
	err := r.pool.QueryRow(ctx,
		`SELECT l.id, u.id, u.name, u.email, u.is_master, COALESCE(u.blocked, false), u.totp_secret,
		        l.tenant_id::text, t.name, tr.name
		   FROM auth_setup_links l
		   JOIN users u ON u.id = l.user_id
		   LEFT JOIN tenants t ON t.id = l.tenant_id
		   LEFT JOIN tenant_memberships tm ON tm.tenant_id = l.tenant_id AND tm.user_id = u.id
		   LEFT JOIN tenant_roles tr ON tr.id = tm.role_id
		  WHERE l.token_hash = $1
		    AND l.used_at IS NULL
		    AND l.expires_at > now()`,
		hashToken(strings.TrimSpace(rawToken))).
		Scan(&info.LinkID, &info.UserID, &info.UserName, &info.UserEmail, &info.IsMaster, &info.Blocked, &info.TOTPSecret,
			&tenantID, &companyName, &roleName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrInvalidSetupLink
	}
	if err != nil {
		return nil, err
	}
	if tenantID != nil {
		info.TenantID = *tenantID
	}
	if companyName != nil {
		info.CompanyName = *companyName
	}
	if roleName != nil {
		info.RoleName = *roleName
	} else if info.IsMaster {
		info.RoleName = "Master"
	}
	if strings.TrimSpace(info.TOTPSecret) == "" {
		secret, genErr := totp.GenerateSecret()
		if genErr != nil {
			return nil, genErr
		}
		_, _ = r.pool.Exec(ctx, `UPDATE users SET totp_secret = $1 WHERE id = $2`, secret, info.UserID)
		info.TOTPSecret = secret
	}
	return &info, nil
}

func (r *Repository) ConsumeSetupLink(ctx context.Context, linkID, userID string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE auth_setup_links SET used_at = now() WHERE id = $1`, linkID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE users SET totp_configured_at = now() WHERE id = $1`, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) FindDefaultTenantForUser(ctx context.Context, userID string, isMaster bool) (string, error) {
	if isMaster {
		// O Master entra por padrão no contexto MASTER (Painel Global), podendo escolher qualquer empresa depois.
		return "", nil
	}
	var tenantID string
	err := r.pool.QueryRow(ctx,
		`SELECT tm.tenant_id
		   FROM tenant_memberships tm
		   JOIN tenants t ON t.id = tm.tenant_id
		  WHERE tm.user_id = $1 AND t.active = true
		  ORDER BY tm.created_at ASC
		  LIMIT 1`, userID).Scan(&tenantID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return tenantID, err
}

func (r *Repository) UserCanAccessTenant(ctx context.Context, userID string, isMaster bool, tenantID string) (bool, error) {
	if isMaster {
		var exists bool
		err := r.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM tenants WHERE id = $1)`, tenantID).Scan(&exists)
		return exists, err
	}
	var exists bool
	err := r.pool.QueryRow(ctx,
		`SELECT EXISTS(
		   SELECT 1 FROM tenant_memberships tm
		   JOIN tenants t ON t.id = tm.tenant_id
		  WHERE tm.user_id = $1 AND tm.tenant_id = $2 AND t.active = true
		)`, userID, tenantID).Scan(&exists)
	return exists, err
}

func (r *Repository) InsertSession(ctx context.Context, userID, tenantID, tokenHash string, expiresAt time.Time) error {
	var tenantPtr *string
	if strings.TrimSpace(tenantID) != "" {
		t := strings.TrimSpace(tenantID)
		tenantPtr = &t
	}
	_, err := r.pool.Exec(ctx,
		"INSERT INTO sessions (user_id, active_tenant_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
		userID, tenantPtr, tokenHash, expiresAt)
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
	var tenantPtr *string
	if trimmed := strings.TrimSpace(tenantID); trimmed != "" && !strings.EqualFold(trimmed, "MASTER") {
		tenantPtr = &trimmed
	}
	_, err := r.pool.Exec(ctx,
		`UPDATE sessions SET active_tenant_id = $1 WHERE token_hash = $2 AND expires_at > now()`,
		tenantPtr, hashToken(token))
	return err
}

func (r *Repository) FindSession(ctx context.Context, tokenHash string) (*SessionContext, error) {
	var s SessionContext
	var totpConfiguredAt *time.Time
	var roleID, roleKey, roleName *string
	var permsRaw []byte

	err := r.pool.QueryRow(ctx,
		`SELECT u.id, u.name, u.email, u.is_master, COALESCE(u.blocked, false), u.totp_configured_at,
		        COALESCE(t.id::text, ''), COALESCE(t.name, ''), COALESCE(t.cnpj, ''),
		        COALESCE(t.owner_name, ''), COALESCE(t.owner_email, ''), COALESCE(t.active, false),
		        (COALESCE(t.openrouter_token_enc, '') <> ''),
		        tr.id::text, tr.key, tr.name, tr.permissions
		   FROM sessions s
		   JOIN users u ON u.id = s.user_id
		   LEFT JOIN tenants t ON t.id = s.active_tenant_id
		   LEFT JOIN tenant_memberships tm ON tm.tenant_id = t.id AND tm.user_id = u.id
		   LEFT JOIN tenant_roles tr ON tr.id = tm.role_id
		  WHERE s.token_hash = $1 AND s.expires_at > now()`, tokenHash).
		Scan(
			&s.User.ID, &s.User.Name, &s.User.Email, &s.User.IsMaster, &s.User.Blocked, &totpConfiguredAt,
			&s.Tenant.ID, &s.Tenant.Name, &s.Tenant.CNPJ, &s.Tenant.OwnerName, &s.Tenant.OwnerEmail, &s.Tenant.Active,
			&s.Tenant.HasOpenRouterToken,
			&roleID, &roleKey, &roleName, &permsRaw,
		)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if s.User.Blocked {
		return nil, nil
	}
	if !s.User.IsMaster && (s.Tenant.ID == "" || !s.Tenant.Active) {
		return nil, nil
	}
	s.User.TOTPConfigured = totpConfiguredAt != nil

	if s.User.IsMaster {
		s.Role = RoleInfo{
			ID:          "master",
			Key:         "master",
			Name:        "Master",
			Permissions: AllPermissionsTrue,
		}
		return &s, nil
	}

	if roleID == nil || roleKey == nil || roleName == nil {
		return nil, nil
	}
	perms := map[string]bool{}
	if len(permsRaw) > 0 {
		_ = json.Unmarshal(permsRaw, &perms)
	}
	s.Role = RoleInfo{
		ID:          *roleID,
		Key:         *roleKey,
		Name:        *roleName,
		Permissions: perms,
	}
	return &s, nil
}
