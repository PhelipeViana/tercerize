package operations

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"tercerize/backend/internal/auth"
	"tercerize/backend/internal/httpx"
	"tercerize/backend/internal/mailer"
	"tercerize/backend/internal/secretbox"
)

type Handlers struct {
	pool            *pgxpool.Pool
	authRepo        *auth.Repository
	mailer          *mailer.Mailer
	appURL          string
	aiEncryptionKey string
	log             *slog.Logger
}

func NewHandlers(pool *pgxpool.Pool, authRepo *auth.Repository, m *mailer.Mailer, appURL, aiEncryptionKey string, log *slog.Logger) *Handlers {
	return &Handlers{
		pool:            pool,
		authRepo:        authRepo,
		mailer:          m,
		appURL:          strings.TrimRight(appURL, "/"),
		aiEncryptionKey: aiEncryptionKey,
		log:             log,
	}
}

func requirePerm(w http.ResponseWriter, sess *auth.SessionContext, perm string) bool {
	if sess == nil || !sess.HasPermission(perm) {
		httpx.Message(w, http.StatusForbidden, "Sua função nesta empresa não possui permissão para realizar esta ação.")
		return false
	}
	return true
}

func seedDefaultRoles(ctx context.Context, tx pgx.Tx, tenantID string) (ownerRoleID string, err error) {
	defaults := []struct {
		key   string
		name  string
		desc  string
		perms string
	}{
		{
			key:   "owner",
			name:  "Dono da empresa",
			desc:  "Acesso total à empresa e gestão exclusiva de funções e subpermissões.",
			perms: `{"contracts:view":true,"contracts:write":true,"service_orders:view":true,"service_orders:write":true,"employees:view":true,"employees:write":true,"epis:view":true,"epis:write":true,"inventory:view":true,"inventory:write":true,"finance:view":true,"finance:write":true,"ai_chat:use":true,"access:manage":true}`,
		},
		{
			key:   "manager",
			name:  "Gerente operacional",
			desc:  "Gestão completa dos módulos operacionais sem gerenciar funções ou acessos.",
			perms: `{"contracts:view":true,"contracts:write":true,"service_orders:view":true,"service_orders:write":true,"employees:view":true,"employees:write":true,"epis:view":true,"epis:write":true,"inventory:view":true,"inventory:write":true,"finance:view":true,"finance:write":true,"ai_chat:use":false,"access:manage":false}`,
		},
		{
			key:   "operator",
			name:  "Operador técnico",
			desc:  "Acesso a ordens de serviço, colaboradores, EPIs e almoxarifado.",
			perms: `{"contracts:view":true,"contracts:write":false,"service_orders:view":true,"service_orders:write":true,"employees:view":true,"employees:write":false,"epis:view":true,"epis:write":true,"inventory:view":true,"inventory:write":true,"finance:view":false,"finance:write":false,"ai_chat:use":false,"access:manage":false}`,
		},
		{
			key:   "financial",
			name:  "Analista financeiro",
			desc:  "Acesso à gestão financeira e visualização de contratos.",
			perms: `{"contracts:view":true,"contracts:write":false,"service_orders:view":false,"service_orders:write":false,"employees:view":false,"employees:write":false,"epis:view":false,"epis:write":false,"inventory:view":false,"inventory:write":false,"finance:view":true,"finance:write":true,"ai_chat:use":false,"access:manage":false}`,
		},
	}

	for _, d := range defaults {
		var rid string
		err = tx.QueryRow(ctx,
			`INSERT INTO tenant_roles (tenant_id, key, name, description, permissions, is_system)
			 VALUES ($1, $2, $3, $4, $5::jsonb, true)
			 ON CONFLICT (tenant_id, key) DO UPDATE SET name = EXCLUDED.name
			 RETURNING id`,
			tenantID, d.key, d.name, d.desc, d.perms).Scan(&rid)
		if err != nil {
			return "", err
		}
		if d.key == "owner" {
			ownerRoleID = rid
		}
	}
	return ownerRoleID, nil
}

func normalizeAIPlanKey(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "standard", "padrao", "padrão":
		return "standard"
	case "premium":
		return "premium"
	default:
		return "free"
	}
}

// CreateCompany: POST /api/tenants (exclusivo Master)
// Exige Razão Social, CNPJ único, Nome do Responsável e E-mail do Responsável.
// Envia automaticamente o link de ativação do Google Authenticator para o e-mail do responsável.
func (h *Handlers) CreateCompany(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || !sess.User.IsMaster {
		httpx.Message(w, http.StatusForbidden, "Apenas usuários com acesso Master podem cadastrar novas empresas.")
		return
	}
	var in struct {
		Name                  string `json:"name"`
		CNPJ                  string `json:"cnpj"`
		OwnerName             string `json:"ownerName"`
		OwnerEmail            string `json:"ownerEmail"`
		OpenRouterToken       string `json:"openrouterToken"`
		AIPlanKey             string `json:"aiPlanKey"`
		AIMonthlyMessageLimit int    `json:"aiMonthlyMessageLimit"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	name := strings.TrimSpace(in.Name)
	if len([]rune(name)) < 2 {
		httpx.Write(w, http.StatusBadRequest, map[string]any{
			"field":   "name",
			"message": "Informe a razão social da empresa (mínimo 2 caracteres).",
		})
		return
	}
	formattedCNPJ, cnpjErr := auth.ValidateCNPJ(in.CNPJ)
	if cnpjErr != "" {
		httpx.Write(w, http.StatusBadRequest, map[string]any{
			"field":   "cnpj",
			"message": cnpjErr,
		})
		return
	}
	ownerName := strings.TrimSpace(in.OwnerName)
	if len([]rune(ownerName)) < 2 {
		httpx.Write(w, http.StatusBadRequest, map[string]any{
			"field":   "ownerName",
			"message": "Informe o nome do responsável (dono da empresa).",
		})
		return
	}
	ownerEmail, emailErr := auth.NormalizeEmail(in.OwnerEmail)
	if emailErr != "" {
		httpx.Write(w, http.StatusBadRequest, map[string]any{
			"field":   "ownerEmail",
			"message": emailErr,
		})
		return
	}

	ctx := r.Context()
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao iniciar transação.")
		return
	}
	defer tx.Rollback(ctx)

	var exists bool
	_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM tenants WHERE cnpj = $1)`, formattedCNPJ).Scan(&exists)
	if exists {
		httpx.Write(w, http.StatusConflict, map[string]any{
			"field":   "cnpj",
			"message": "Já existe uma empresa cadastrada com este CNPJ.",
		})
		return
	}

	ownerUserID, _, _, err := h.authRepo.EnsureUserWithTOTP(ctx, tx, ownerName, ownerEmail)
	if err != nil {
		h.log.Error("provisionar dono da empresa", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao vincular responsável da empresa.")
		return
	}

	rawTokenIn := strings.TrimSpace(in.OpenRouterToken)
	var encToken, tokenHint string
	if rawTokenIn != "" {
		enc, encErr := secretbox.Encrypt(rawTokenIn, h.aiEncryptionKey)
		if encErr != nil {
			h.log.Error("criptografar token OpenRouter", "err", encErr)
			httpx.Message(w, http.StatusInternalServerError, "Erro ao proteger o token OpenRouter.")
			return
		}
		encToken = enc
		tokenHint = secretbox.MaskHint(rawTokenIn)
	}

	aiPlanKey := normalizeAIPlanKey(in.AIPlanKey)
	monthlyLimit := in.AIMonthlyMessageLimit
	if monthlyLimit < 0 {
		monthlyLimit = 0
	}

	var tenantID string
	err = tx.QueryRow(ctx,
		`INSERT INTO tenants (name, cnpj, owner_name, owner_email, owner_user_id, active, openrouter_token_enc, openrouter_token_hint, ai_plan_key, ai_monthly_message_limit)
		 VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9) RETURNING id`,
		name, formattedCNPJ, ownerName, ownerEmail, ownerUserID, encToken, tokenHint, aiPlanKey, monthlyLimit).Scan(&tenantID)
	if err != nil {
		h.log.Error("criar empresa", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao cadastrar empresa.")
		return
	}

	ownerRoleID, err := seedDefaultRoles(ctx, tx, tenantID)
	if err != nil {
		h.log.Error("criar roles padrão da empresa", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao configurar funções padrão da empresa.")
		return
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO tenant_memberships (tenant_id, user_id, role_id)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (tenant_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id`,
		tenantID, ownerUserID, ownerRoleID)
	if err != nil {
		h.log.Error("vincular dono à empresa", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao atribuir permissão de dono.")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao confirmar cadastro da empresa.")
		return
	}

	// Dispara automaticamente o link de ativação do Google Authenticator para o e-mail do responsável
	emailSent := false
	emailWarning := ""
	if rawToken, linkErr := h.authRepo.CreateSetupLink(ctx, ownerUserID, tenantID); linkErr == nil {
		activationURL := fmt.Sprintf("%s/ativar-autenticador?token=%s", h.appURL, url.QueryEscape(rawToken))
		if mailErr := h.mailer.SendAuthenticatorLink(ownerEmail, ownerName, name, "Dono da empresa", activationURL); mailErr != nil {
			h.log.Error("enviar e-mail para dono da empresa", "to", ownerEmail, "err", mailErr)
			emailWarning = "Empresa criada, mas houve falha no disparo do e-mail SMTP: " + mailErr.Error()
		} else {
			emailSent = true
		}
	}

	httpx.Write(w, http.StatusCreated, map[string]any{
		"id":           tenantID,
		"name":         name,
		"cnpj":         formattedCNPJ,
		"ownerName":    ownerName,
		"ownerEmail":   ownerEmail,
		"emailSent":    emailSent,
		"emailWarning": emailWarning,
	})
}

// UpdateCompany: POST /api/tenants/update (exclusivo Master)
// Permite ao Master editar Razão Social, CNPJ, Nome/E-mail do responsável e status Ativa/Desativada.
// Usuários comuns (inclusive Donos) recebem 403 Forbidden e jamais podem alterar estes dados.
func (h *Handlers) UpdateCompany(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || !sess.User.IsMaster {
		httpx.Message(w, http.StatusForbidden, "Apenas usuários com acesso Master podem editar as informações da empresa.")
		return
	}
	var in struct {
		TenantID              string `json:"tenantId"`
		Name                  string `json:"name"`
		CNPJ                  string `json:"cnpj"`
		OwnerName             string `json:"ownerName"`
		OwnerEmail            string `json:"ownerEmail"`
		Active                *bool  `json:"active"`
		ResendLink            bool   `json:"resendLink"`
		OpenRouterToken       string `json:"openrouterToken"`
		ClearOpenRouterToken  bool   `json:"clearOpenrouterToken"`
		AIPlanKey             string `json:"aiPlanKey"`
		AIMonthlyMessageLimit *int   `json:"aiMonthlyMessageLimit"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	tenantID := strings.TrimSpace(in.TenantID)
	if tenantID == "" {
		httpx.Message(w, http.StatusBadRequest, "Empresa inválida.")
		return
	}
	name := strings.TrimSpace(in.Name)
	if len([]rune(name)) < 2 {
		httpx.Write(w, http.StatusBadRequest, map[string]any{
			"field":   "name",
			"message": "Informe a razão social da empresa (mínimo 2 caracteres).",
		})
		return
	}
	formattedCNPJ, cnpjErr := auth.ValidateCNPJ(in.CNPJ)
	if cnpjErr != "" {
		httpx.Write(w, http.StatusBadRequest, map[string]any{
			"field":   "cnpj",
			"message": cnpjErr,
		})
		return
	}
	ownerName := strings.TrimSpace(in.OwnerName)
	if len([]rune(ownerName)) < 2 {
		httpx.Write(w, http.StatusBadRequest, map[string]any{
			"field":   "ownerName",
			"message": "Informe o nome do responsável (dono da empresa).",
		})
		return
	}
	ownerEmail, emailErr := auth.NormalizeEmail(in.OwnerEmail)
	if emailErr != "" {
		httpx.Write(w, http.StatusBadRequest, map[string]any{
			"field":   "ownerEmail",
			"message": emailErr,
		})
		return
	}

	ctx := r.Context()
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao iniciar transação.")
		return
	}
	defer tx.Rollback(ctx)

	var currentActive bool
	var oldOwnerEmail string
	var oldOwnerUserID *string
	err = tx.QueryRow(ctx,
		`SELECT active, COALESCE(owner_email, ''), owner_user_id::text FROM tenants WHERE id = $1`,
		tenantID).Scan(&currentActive, &oldOwnerEmail, &oldOwnerUserID)
	if err != nil {
		httpx.Message(w, http.StatusNotFound, "Empresa não encontrada.")
		return
	}

	var duplicateCNPJ bool
	_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM tenants WHERE cnpj = $1 AND id <> $2)`, formattedCNPJ, tenantID).Scan(&duplicateCNPJ)
	if duplicateCNPJ {
		httpx.Write(w, http.StatusConflict, map[string]any{
			"field":   "cnpj",
			"message": "Já existe outra empresa cadastrada com este CNPJ.",
		})
		return
	}

	newActive := currentActive
	if in.Active != nil {
		newActive = *in.Active
	}

	newOwnerUserID, _, _, err := h.authRepo.EnsureUserWithTOTP(ctx, tx, ownerName, ownerEmail)
	if err != nil {
		h.log.Error("provisionar novo dono da empresa", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao atualizar responsável da empresa.")
		return
	}

	// Atualiza o nome do usuário responsável (exceto se for Master)
	_, _ = tx.Exec(ctx,
		`UPDATE users SET name = $1 WHERE id = $2 AND is_master = false`,
		ownerName, newOwnerUserID)

	// Garante que exista a role owner na empresa
	var ownerRoleID string
	err = tx.QueryRow(ctx, `SELECT id FROM tenant_roles WHERE tenant_id = $1 AND key = 'owner' LIMIT 1`, tenantID).Scan(&ownerRoleID)
	if err != nil || ownerRoleID == "" {
		ownerRoleID, err = seedDefaultRoles(ctx, tx, tenantID)
		if err != nil {
			httpx.Message(w, http.StatusInternalServerError, "Erro ao verificar função de dono da empresa.")
			return
		}
	}

	// Atualiza dados cadastrais da empresa
	_, err = tx.Exec(ctx,
		`UPDATE tenants
		    SET name = $1,
		        cnpj = $2,
		        owner_name = $3,
		        owner_email = $4,
		        owner_user_id = $5,
		        active = $6
		  WHERE id = $7`,
		name, formattedCNPJ, ownerName, ownerEmail, newOwnerUserID, newActive, tenantID)
	if err != nil {
		h.log.Error("atualizar empresa", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao salvar alterações da empresa.")
		return
	}

	// Atualiza ou remove token OpenRouter da empresa quando informado pelo Master
	if in.ClearOpenRouterToken {
		_, _ = tx.Exec(ctx,
			`UPDATE tenants
			    SET openrouter_token_enc = '',
			        openrouter_token_hint = '',
			        ai_credit_depleted_at = NULL,
			        ai_credit_depleted_from = ''
			  WHERE id = $1`, tenantID)
	} else if rawToken := strings.TrimSpace(in.OpenRouterToken); rawToken != "" {
		enc, encErr := secretbox.Encrypt(rawToken, h.aiEncryptionKey)
		if encErr != nil {
			h.log.Error("criptografar token OpenRouter na edição", "err", encErr)
			httpx.Message(w, http.StatusInternalServerError, "Erro ao proteger o token OpenRouter.")
			return
		}
		_, _ = tx.Exec(ctx,
			`UPDATE tenants
			    SET openrouter_token_enc = $1,
			        openrouter_token_hint = $2,
			        ai_credit_depleted_at = NULL,
			        ai_credit_depleted_from = ''
			  WHERE id = $3`,
			enc, secretbox.MaskHint(rawToken), tenantID)
	}

	// Atualiza plano de IA (Free / Padrão / Premium) e limite mensal opcional quando informado pelo Master
	if strings.TrimSpace(in.AIPlanKey) != "" {
		newPlanKey := normalizeAIPlanKey(in.AIPlanKey)
		if newPlanKey != "free" {
			// Ao reativar plano pago após recarga, limpa o alerta de crédito esgotado
			_, _ = tx.Exec(ctx,
				`UPDATE tenants
				    SET ai_plan_key = $1,
				        ai_credit_depleted_at = NULL,
				        ai_credit_depleted_from = ''
				  WHERE id = $2`,
				newPlanKey, tenantID)
		} else {
			_, _ = tx.Exec(ctx,
				`UPDATE tenants SET ai_plan_key = 'free' WHERE id = $1`,
				tenantID)
		}
	}
	if in.AIMonthlyMessageLimit != nil {
		ml := *in.AIMonthlyMessageLimit
		if ml < 0 {
			ml = 0
		}
		_, _ = tx.Exec(ctx,
			`UPDATE tenants SET ai_monthly_message_limit = $1 WHERE id = $2`,
			ml, tenantID)
	}

	// Vincula o novo responsável como Dono da empresa
	_, err = tx.Exec(ctx,
		`INSERT INTO tenant_memberships (tenant_id, user_id, role_id)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (tenant_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id`,
		tenantID, newOwnerUserID, ownerRoleID)
	if err != nil {
		h.log.Error("atualizar vínculo de dono", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao atualizar vínculo do responsável.")
		return
	}

	// Se o responsável mudou, remove o vínculo de dono do antigo responsável (se não for Master) e encerra sessões dele nessa empresa
	ownerChanged := !strings.EqualFold(strings.TrimSpace(oldOwnerEmail), ownerEmail)
	if oldOwnerUserID != nil && *oldOwnerUserID != "" && *oldOwnerUserID != newOwnerUserID {
		_, _ = tx.Exec(ctx,
			`DELETE FROM tenant_memberships
			  WHERE tenant_id = $1
			    AND user_id = $2
			    AND user_id IN (SELECT id FROM users WHERE is_master = false)`,
			tenantID, *oldOwnerUserID)
		_, _ = tx.Exec(ctx,
			`DELETE FROM sessions
			  WHERE active_tenant_id = $1
			    AND user_id = $2
			    AND user_id IN (SELECT id FROM users WHERE is_master = false)`,
			tenantID, *oldOwnerUserID)
	}

	// Se a empresa foi desativada, desloga imediatamente todos os usuários não-Master conectados a ela
	if !newActive {
		_, _ = tx.Exec(ctx,
			`DELETE FROM sessions
			  WHERE active_tenant_id = $1
			    AND user_id IN (SELECT id FROM users WHERE is_master = false)`,
			tenantID)
	}

	if err := tx.Commit(ctx); err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao confirmar alterações da empresa.")
		return
	}

	// Envia link do Google Authenticator se o e-mail do responsável foi alterado ou se o Master marcou reenvio
	emailSent := false
	emailWarning := ""
	if (ownerChanged || in.ResendLink) && newActive {
		if rawToken, linkErr := h.authRepo.CreateSetupLink(ctx, newOwnerUserID, tenantID); linkErr == nil {
			activationURL := fmt.Sprintf("%s/ativar-autenticador?token=%s", h.appURL, url.QueryEscape(rawToken))
			if mailErr := h.mailer.SendAuthenticatorLink(ownerEmail, ownerName, name, "Dono da empresa", activationURL); mailErr != nil {
				h.log.Error("enviar e-mail após edição da empresa", "to", ownerEmail, "err", mailErr)
				emailWarning = "Empresa atualizada, mas houve falha no disparo do e-mail SMTP: " + mailErr.Error()
			} else {
				emailSent = true
			}
		}
	}

	httpx.Write(w, http.StatusOK, map[string]any{
		"ok":           true,
		"id":           tenantID,
		"name":         name,
		"cnpj":         formattedCNPJ,
		"ownerName":    ownerName,
		"ownerEmail":   ownerEmail,
		"active":       newActive,
		"emailSent":    emailSent,
		"emailWarning": emailWarning,
	})
}

var roleKeyRe = regexp.MustCompile(`[^a-z0-9_]+`)

// CreateOrUpdateRole: POST /api/rbac/roles (apenas Dono da empresa ativa ou Master)
func (h *Handlers) CreateOrUpdateRole(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || !sess.CanManageAccess() {
		httpx.Message(w, http.StatusForbidden, "Apenas o Dono da empresa ou acesso Master pode gerenciar roles e permissões.")
		return
	}
	var in struct {
		ID          string          `json:"id"`
		Name        string          `json:"name"`
		Description string          `json:"description"`
		Permissions map[string]bool `json:"permissions"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	name := strings.TrimSpace(in.Name)
	if len([]rune(name)) < 2 {
		httpx.Message(w, http.StatusBadRequest, "Informe o nome da função (mínimo 2 caracteres).")
		return
	}
	if in.Permissions == nil {
		in.Permissions = map[string]bool{}
	}
	// Apenas a role de sistema 'owner' pode gerenciar roles/permissões
	in.Permissions["access:manage"] = false

	permsJSON, _ := json.Marshal(in.Permissions)

	if strings.TrimSpace(in.ID) != "" {
		var key string
		err := h.pool.QueryRow(r.Context(),
			`SELECT key FROM tenant_roles WHERE id = $1 AND tenant_id = $2`,
			strings.TrimSpace(in.ID), sess.Tenant.ID).Scan(&key)
		if err != nil {
			httpx.Message(w, http.StatusNotFound, "Função não encontrada nesta empresa.")
			return
		}
		if key == "owner" {
			httpx.Message(w, http.StatusBadRequest, "A função Dono da empresa possui acesso integral e não pode ser restringida.")
			return
		}
		_, err = h.pool.Exec(r.Context(),
			`UPDATE tenant_roles SET name = $1, description = $2, permissions = $3::jsonb
			 WHERE id = $4 AND tenant_id = $5`,
			name, strings.TrimSpace(in.Description), string(permsJSON), strings.TrimSpace(in.ID), sess.Tenant.ID)
		if err != nil {
			httpx.Message(w, http.StatusInternalServerError, "Erro ao atualizar função.")
			return
		}
		httpx.Write(w, http.StatusOK, map[string]any{"ok": true})
		return
	}

	slug := roleKeyRe.ReplaceAllString(strings.ToLower(name), "_")
	slug = strings.Trim(slug, "_")
	if slug == "" || slug == "owner" || slug == "master" {
		slug = fmt.Sprintf("custom_%d", time.Now().Unix()%100000)
	}

	var id string
	err := h.pool.QueryRow(r.Context(),
		`INSERT INTO tenant_roles (tenant_id, key, name, description, permissions, is_system)
		 VALUES ($1, $2, $3, $4, $5::jsonb, false) RETURNING id`,
		sess.Tenant.ID, slug, name, strings.TrimSpace(in.Description), string(permsJSON)).Scan(&id)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			httpx.Message(w, http.StatusConflict, "Já existe uma função com este nome nesta empresa.")
			return
		}
		h.log.Error("criar role customizada", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao criar função.")
		return
	}
	httpx.Write(w, http.StatusCreated, map[string]any{"id": id})
}

// DeleteRole: POST /api/rbac/roles/delete (apenas Dono da empresa ativa ou Master)
func (h *Handlers) DeleteRole(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || !sess.CanManageAccess() {
		httpx.Message(w, http.StatusForbidden, "Apenas o Dono da empresa ou acesso Master pode excluir funções.")
		return
	}
	var in struct {
		ID string `json:"id"`
	}
	if err := httpx.Read(r, &in); err != nil || strings.TrimSpace(in.ID) == "" {
		httpx.Message(w, http.StatusBadRequest, "Informe a função.")
		return
	}
	var isSystem bool
	if err := h.pool.QueryRow(r.Context(),
		`SELECT is_system FROM tenant_roles WHERE id = $1 AND tenant_id = $2`,
		strings.TrimSpace(in.ID), sess.Tenant.ID).Scan(&isSystem); err != nil {
		httpx.Message(w, http.StatusNotFound, "Função não encontrada.")
		return
	}
	if isSystem {
		httpx.Message(w, http.StatusBadRequest, "Funções padrão do sistema não podem ser excluídas.")
		return
	}
	var count int
	_ = h.pool.QueryRow(r.Context(), `SELECT count(*) FROM tenant_memberships WHERE role_id = $1`, strings.TrimSpace(in.ID)).Scan(&count)
	if count > 0 {
		httpx.Message(w, http.StatusConflict, "Existem usuários vinculados a esta função. Reatribua-os antes de excluir.")
		return
	}
	_, _ = h.pool.Exec(r.Context(), `DELETE FROM tenant_roles WHERE id = $1 AND tenant_id = $2`, strings.TrimSpace(in.ID), sess.Tenant.ID)
	httpx.Write(w, http.StatusOK, map[string]any{"ok": true})
}

// AddMember: POST /api/rbac/members (apenas Dono da empresa ativa ou Master)
// Um mesmo e-mail pode ser dono de várias empresas e subpermissão em outras,
// mas JAMAIS pode ter 2 funções na mesma empresa (UNIQUE (tenant_id, user_id)).
func (h *Handlers) AddMember(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || !sess.CanManageAccess() {
		httpx.Message(w, http.StatusForbidden, "Apenas o Dono da empresa ou acesso Master pode conceder subpermissões.")
		return
	}
	var in struct {
		Name   string `json:"name"`
		Email  string `json:"email"`
		RoleID string `json:"roleId"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	name := strings.TrimSpace(in.Name)
	if len([]rune(name)) < 2 {
		httpx.Message(w, http.StatusBadRequest, "Informe o nome do usuário.")
		return
	}
	email, emailErr := auth.NormalizeEmail(in.Email)
	if emailErr != "" {
		httpx.Message(w, http.StatusBadRequest, emailErr)
		return
	}
	roleID := strings.TrimSpace(in.RoleID)
	if roleID == "" {
		httpx.Message(w, http.StatusBadRequest, "Selecione uma função (Role) para o usuário.")
		return
	}

	ctx := r.Context()
	var roleKey, roleName string
	err := h.pool.QueryRow(ctx,
		`SELECT key, name FROM tenant_roles WHERE id = $1 AND tenant_id = $2`,
		roleID, sess.Tenant.ID).Scan(&roleKey, &roleName)
	if err != nil {
		httpx.Message(w, http.StatusBadRequest, "Função selecionada não pertence a esta empresa.")
		return
	}
	if roleKey == "owner" {
		httpx.Message(w, http.StatusForbidden, "A função de Dono da empresa é única e definida exclusivamente pelo Master em Gestão de empresas.")
		return
	}

	tx, err := h.pool.Begin(ctx)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro interno.")
		return
	}
	defer tx.Rollback(ctx)

	userID, _, _, err := h.authRepo.EnsureUserWithTOTP(ctx, tx, name, email)
	if err != nil {
		h.log.Error("garantir usuário membro", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao localizar ou criar usuário.")
		return
	}

	// Verificação explícita: jamais pode ter 2 funções numa mesma empresa
	var existingRoleName string
	checkErr := tx.QueryRow(ctx,
		`SELECT tr.name
		   FROM tenant_memberships tm
		   JOIN tenant_roles tr ON tr.id = tm.role_id
		  WHERE tm.tenant_id = $1 AND tm.user_id = $2`,
		sess.Tenant.ID, userID).Scan(&existingRoleName)
	if checkErr == nil {
		httpx.Message(w, http.StatusConflict, fmt.Sprintf(
			"Este e-mail (%s) já possui a função '%s' nesta empresa. Um usuário jamais pode ter duas funções na mesma empresa — utilize a opção de alterar função na tabela.",
			email, existingRoleName,
		))
		return
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO tenant_memberships (tenant_id, user_id, role_id) VALUES ($1, $2, $3)`,
		sess.Tenant.ID, userID, roleID)
	if err != nil {
		h.log.Error("vincular membro", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao vincular usuário à empresa.")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao salvar permissão.")
		return
	}

	// Envia link de ativação do Google Authenticator para o e-mail adicionado
	emailSent := false
	emailWarning := ""
	if rawToken, linkErr := h.authRepo.CreateSetupLink(ctx, userID, sess.Tenant.ID); linkErr == nil {
		activationURL := fmt.Sprintf("%s/ativar-autenticador?token=%s", h.appURL, url.QueryEscape(rawToken))
		if mailErr := h.mailer.SendAuthenticatorLink(email, name, sess.Tenant.Name, roleName, activationURL); mailErr != nil {
			h.log.Error("enviar e-mail para membro", "to", email, "err", mailErr)
			emailWarning = "Acesso concedido, mas houve falha no envio do e-mail SMTP: " + mailErr.Error()
		} else {
			emailSent = true
		}
	}

	httpx.Write(w, http.StatusCreated, map[string]any{
		"ok":           true,
		"email":        email,
		"roleName":     roleName,
		"emailSent":    emailSent,
		"emailWarning": emailWarning,
	})
}

// UpdateMemberRole: POST /api/rbac/members/role (apenas Dono ou Master)
func (h *Handlers) UpdateMemberRole(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || !sess.CanManageAccess() {
		httpx.Message(w, http.StatusForbidden, "Apenas o Dono da empresa ou acesso Master pode alterar funções.")
		return
	}
	var in struct {
		MembershipID string `json:"membershipId"`
		RoleID       string `json:"roleId"`
	}
	if err := httpx.Read(r, &in); err != nil || strings.TrimSpace(in.MembershipID) == "" || strings.TrimSpace(in.RoleID) == "" {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}

	var targetUserID, currentKey, tenantOwnerUserID string
	err := h.pool.QueryRow(r.Context(),
		`SELECT tm.user_id::text, tr.key, COALESCE(t.owner_user_id::text, '')
		   FROM tenant_memberships tm
		   JOIN tenant_roles tr ON tr.id = tm.role_id
		   JOIN tenants t ON t.id = tm.tenant_id
		  WHERE tm.id = $1 AND tm.tenant_id = $2`,
		strings.TrimSpace(in.MembershipID), sess.Tenant.ID).Scan(&targetUserID, &currentKey, &tenantOwnerUserID)
	if err != nil {
		httpx.Message(w, http.StatusNotFound, "Vínculo não encontrado nesta empresa.")
		return
	}
	if targetUserID == sess.User.ID {
		httpx.Message(w, http.StatusForbidden, "Você não pode alterar a sua própria função nesta empresa.")
		return
	}
	if currentKey == "owner" || (tenantOwnerUserID != "" && targetUserID == tenantOwnerUserID) {
		httpx.Message(w, http.StatusForbidden, "A função do Dono da empresa não pode ser alterada aqui. A troca de responsável é feita exclusivamente pelo Master em Gestão de empresas.")
		return
	}

	var newKey string
	err = h.pool.QueryRow(r.Context(),
		`SELECT key FROM tenant_roles WHERE id = $1 AND tenant_id = $2`,
		strings.TrimSpace(in.RoleID), sess.Tenant.ID).Scan(&newKey)
	if err != nil {
		httpx.Message(w, http.StatusBadRequest, "Nova função inválida.")
		return
	}
	if newKey == "owner" {
		httpx.Message(w, http.StatusForbidden, "A função de Dono da empresa é única e definida exclusivamente pelo Master em Gestão de empresas.")
		return
	}

	_, err = h.pool.Exec(r.Context(),
		`UPDATE tenant_memberships SET role_id = $1 WHERE id = $2 AND tenant_id = $3`,
		strings.TrimSpace(in.RoleID), strings.TrimSpace(in.MembershipID), sess.Tenant.ID)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao alterar função.")
		return
	}
	httpx.Write(w, http.StatusOK, map[string]any{"ok": true})
}

// RemoveMember: POST /api/rbac/members/remove (apenas Dono ou Master)
func (h *Handlers) RemoveMember(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || !sess.CanManageAccess() {
		httpx.Message(w, http.StatusForbidden, "Apenas o Dono da empresa ou acesso Master pode remover acessos.")
		return
	}
	var in struct {
		MembershipID string `json:"membershipId"`
	}
	if err := httpx.Read(r, &in); err != nil || strings.TrimSpace(in.MembershipID) == "" {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	var targetUserID, roleKey, tenantOwnerUserID string
	err := h.pool.QueryRow(r.Context(),
		`SELECT tm.user_id::text, tr.key, COALESCE(t.owner_user_id::text, '')
		   FROM tenant_memberships tm
		   JOIN tenant_roles tr ON tr.id = tm.role_id
		   JOIN tenants t ON t.id = tm.tenant_id
		  WHERE tm.id = $1 AND tm.tenant_id = $2`,
		strings.TrimSpace(in.MembershipID), sess.Tenant.ID).Scan(&targetUserID, &roleKey, &tenantOwnerUserID)
	if err != nil {
		httpx.Message(w, http.StatusNotFound, "Membro não encontrado.")
		return
	}
	if targetUserID == sess.User.ID {
		httpx.Message(w, http.StatusForbidden, "Você não pode remover o seu próprio acesso nesta empresa.")
		return
	}
	if roleKey == "owner" || (tenantOwnerUserID != "" && targetUserID == tenantOwnerUserID) {
		httpx.Message(w, http.StatusBadRequest, "O Dono principal da empresa não pode ser removido da empresa.")
		return
	}
	_, _ = h.pool.Exec(r.Context(), `DELETE FROM tenant_memberships WHERE id = $1 AND tenant_id = $2`,
		strings.TrimSpace(in.MembershipID), sess.Tenant.ID)
	httpx.Write(w, http.StatusOK, map[string]any{"ok": true})
}

// ResendMemberLink: POST /api/rbac/members/resend-link (apenas Dono ou Master)
func (h *Handlers) ResendMemberLink(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || !sess.CanManageAccess() {
		httpx.Message(w, http.StatusForbidden, "Apenas o Dono da empresa ou acesso Master pode reenviar o link de acesso.")
		return
	}
	var in struct {
		UserID string `json:"userId"`
	}
	if err := httpx.Read(r, &in); err != nil || strings.TrimSpace(in.UserID) == "" {
		httpx.Message(w, http.StatusBadRequest, "Informe o usuário.")
		return
	}
	var uName, uEmail, roleName string
	err := h.pool.QueryRow(r.Context(),
		`SELECT u.name, u.email, tr.name
		   FROM tenant_memberships tm
		   JOIN users u ON u.id = tm.user_id
		   JOIN tenant_roles tr ON tr.id = tm.role_id
		  WHERE tm.tenant_id = $1 AND tm.user_id = $2`,
		sess.Tenant.ID, strings.TrimSpace(in.UserID)).Scan(&uName, &uEmail, &roleName)
	if err != nil {
		httpx.Message(w, http.StatusNotFound, "Usuário não vinculado a esta empresa.")
		return
	}
	rawToken, err := h.authRepo.CreateSetupLink(r.Context(), strings.TrimSpace(in.UserID), sess.Tenant.ID)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao gerar link de ativação.")
		return
	}
	activationURL := fmt.Sprintf("%s/ativar-autenticador?token=%s", h.appURL, url.QueryEscape(rawToken))
	if err := h.mailer.SendAuthenticatorLink(uEmail, uName, sess.Tenant.Name, roleName, activationURL); err != nil {
		h.log.Error("reenviar link SMTP", "to", uEmail, "err", err)
		httpx.Message(w, http.StatusBadGateway, "Falha ao enviar o e-mail SMTP: "+err.Error())
		return
	}
	httpx.Write(w, http.StatusOK, map[string]any{"ok": true, "message": "Link de ativação enviado para " + uEmail})
}

// ToggleTenantActive: POST /api/tenants/toggle-active (exclusivo Master)
// Ao bloquear uma empresa (active = false), desloga imediatamente todos os usuários não-Master conectados a ela.
func (h *Handlers) ToggleTenantActive(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || !sess.User.IsMaster {
		httpx.Message(w, http.StatusForbidden, "Apenas acesso Master pode bloquear ou reativar empresas.")
		return
	}
	var in struct {
		TenantID string `json:"tenantId"`
	}
	if err := httpx.Read(r, &in); err != nil || strings.TrimSpace(in.TenantID) == "" {
		httpx.Message(w, http.StatusBadRequest, "Informe a empresa.")
		return
	}
	targetID := strings.TrimSpace(in.TenantID)
	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro interno.")
		return
	}
	defer tx.Rollback(r.Context())

	var newActive bool
	err = tx.QueryRow(r.Context(),
		`UPDATE tenants SET active = NOT active WHERE id = $1 RETURNING active`,
		targetID).Scan(&newActive)
	if err != nil {
		httpx.Message(w, http.StatusNotFound, "Empresa não encontrada.")
		return
	}
	if !newActive {
		// Desloga imediatamente todos os usuários não-Master que estejam na empresa bloqueada
		_, _ = tx.Exec(r.Context(),
			`DELETE FROM sessions
			 WHERE active_tenant_id = $1
			   AND user_id IN (SELECT id FROM users WHERE is_master = false)`,
			targetID)
	}
	if err := tx.Commit(r.Context()); err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao atualizar status da empresa.")
		return
	}
	httpx.Write(w, http.StatusOK, map[string]any{"ok": true, "active": newActive})
}

// ResendCompanyOwnerLink: POST /api/tenants/resend-owner-link (exclusivo Master)
// Reenvia o link de ativação do Google Authenticator diretamente para o responsável (Dono) de uma empresa.
func (h *Handlers) ResendCompanyOwnerLink(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || !sess.User.IsMaster {
		httpx.Message(w, http.StatusForbidden, "Apenas acesso Master pode reenviar convites de empresa.")
		return
	}
	var in struct {
		TenantID string `json:"tenantId"`
	}
	if err := httpx.Read(r, &in); err != nil || strings.TrimSpace(in.TenantID) == "" {
		httpx.Message(w, http.StatusBadRequest, "Informe a empresa.")
		return
	}
	targetID := strings.TrimSpace(in.TenantID)
	var companyName, ownerName, ownerEmail string
	var ownerUserID *string
	var active bool
	err := h.pool.QueryRow(r.Context(),
		`SELECT name, COALESCE(owner_name, ''), COALESCE(owner_email, ''), owner_user_id::text, active
		   FROM tenants
		  WHERE id = $1`, targetID).Scan(&companyName, &ownerName, &ownerEmail, &ownerUserID, &active)
	if err != nil {
		httpx.Message(w, http.StatusNotFound, "Empresa não encontrada.")
		return
	}
	if !active {
		httpx.Message(w, http.StatusBadRequest, "Ative a empresa antes de reenviar o link de acesso ao responsável.")
		return
	}
	if ownerUserID == nil || *ownerUserID == "" || strings.TrimSpace(ownerEmail) == "" {
		httpx.Message(w, http.StatusBadRequest, "Esta empresa não possui um responsável válido configurado.")
		return
	}
	rawToken, err := h.authRepo.CreateSetupLink(r.Context(), *ownerUserID, targetID)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao gerar link de ativação.")
		return
	}
	activationURL := fmt.Sprintf("%s/ativar-autenticador?token=%s", h.appURL, url.QueryEscape(rawToken))
	if err := h.mailer.SendAuthenticatorLink(ownerEmail, ownerName, companyName, "Dono da empresa", activationURL); err != nil {
		h.log.Error("reenviar link dono empresa SMTP", "to", ownerEmail, "err", err)
		httpx.Message(w, http.StatusBadGateway, "Falha ao enviar o e-mail SMTP: "+err.Error())
		return
	}
	httpx.Write(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "Novo link do Google Authenticator enviado para " + ownerEmail + ".",
	})
}

// ToggleUserBlock: POST /api/rbac/members/block (Master ou Dono da empresa ativa)
// Ao bloquear um usuário (inclusive um Dono, quando acionado pelo Master), revoga imediatamente todas as sessões e links ativos.
func (h *Handlers) ToggleUserBlock(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || !sess.CanManageAccess() {
		httpx.Message(w, http.StatusForbidden, "Apenas o Dono da empresa ou acesso Master pode bloquear usuários.")
		return
	}
	var in struct {
		UserID string `json:"userId"`
	}
	if err := httpx.Read(r, &in); err != nil || strings.TrimSpace(in.UserID) == "" {
		httpx.Message(w, http.StatusBadRequest, "Informe o usuário.")
		return
	}
	targetUserID := strings.TrimSpace(in.UserID)
	if targetUserID == sess.User.ID {
		httpx.Message(w, http.StatusBadRequest, "Você não pode bloquear o próprio acesso.")
		return
	}

	var targetIsMaster bool
	var targetRoleKey string
	err := h.pool.QueryRow(r.Context(),
		`SELECT u.is_master, tr.key
		   FROM tenant_memberships tm
		   JOIN users u ON u.id = tm.user_id
		   JOIN tenant_roles tr ON tr.id = tm.role_id
		  WHERE tm.tenant_id = $1 AND tm.user_id = $2`,
		sess.Tenant.ID, targetUserID).Scan(&targetIsMaster, &targetRoleKey)
	if err != nil {
		httpx.Message(w, http.StatusNotFound, "Usuário não encontrado nesta empresa.")
		return
	}
	if targetIsMaster {
		httpx.Message(w, http.StatusForbidden, "Um acesso Master não pode ser bloqueado.")
		return
	}
	if targetRoleKey == "owner" && !sess.User.IsMaster {
		httpx.Message(w, http.StatusForbidden, "Apenas um usuário Master pode bloquear o Dono da empresa.")
		return
	}

	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro interno.")
		return
	}
	defer tx.Rollback(r.Context())

	var nowBlocked bool
	err = tx.QueryRow(r.Context(),
		`UPDATE users SET blocked = NOT COALESCE(blocked, false) WHERE id = $1 RETURNING blocked`,
		targetUserID).Scan(&nowBlocked)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao alterar bloqueio do usuário.")
		return
	}
	if nowBlocked {
		// Revogação imediata: encerra todas as sessões ativas e invalida links pendentes do usuário bloqueado
		_, _ = tx.Exec(r.Context(), `DELETE FROM sessions WHERE user_id = $1`, targetUserID)
		_, _ = tx.Exec(r.Context(), `DELETE FROM auth_setup_links WHERE user_id = $1`, targetUserID)
	}
	if err := tx.Commit(r.Context()); err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao salvar bloqueio.")
		return
	}
	httpx.Write(w, http.StatusOK, map[string]any{"ok": true, "blocked": nowBlocked})
}

// CreateClient: POST /api/clients
func (h *Handlers) CreateClient(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if !requirePerm(w, sess, "contracts:write") {
		return
	}
	var in struct {
		Name    string `json:"name"`
		CNPJ    string `json:"cnpj"`
		Phone   string `json:"phone"`
		Email   string `json:"email"`
		Contact string `json:"contact"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	name := strings.TrimSpace(in.Name)
	if len([]rune(name)) < 2 {
		httpx.Write(w, http.StatusBadRequest, map[string]any{
			"field":   "name",
			"message": "Informe a razão social do cliente tomador.",
		})
		return
	}
	formattedCNPJ, cnpjErr := auth.ValidateCNPJ(in.CNPJ)
	if cnpjErr != "" {
		httpx.Write(w, http.StatusBadRequest, map[string]any{
			"field":   "cnpj",
			"message": cnpjErr,
		})
		return
	}
	formattedPhone, phoneErr := auth.ValidatePhoneBR(in.Phone)
	if phoneErr != "" {
		httpx.Write(w, http.StatusBadRequest, map[string]any{
			"field":   "phone",
			"message": phoneErr,
		})
		return
	}
	normalizedEmail, emailErr := auth.NormalizeEmail(in.Email)
	if emailErr != "" {
		httpx.Write(w, http.StatusBadRequest, map[string]any{
			"field":   "email",
			"message": emailErr,
		})
		return
	}

	contactSummary := formattedPhone + " · " + normalizedEmail
	if extra := strings.TrimSpace(in.Contact); extra != "" {
		contactSummary = extra + " · " + contactSummary
	}

	var id string
	err := h.pool.QueryRow(r.Context(),
		`INSERT INTO clients (tenant_id, name, cnpj, phone, email, contact)
		 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		sess.Tenant.ID, name, formattedCNPJ, formattedPhone, normalizedEmail, contactSummary).Scan(&id)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			httpx.Write(w, http.StatusConflict, map[string]any{
				"field":   "cnpj",
				"message": "Este CNPJ já está cadastrado na lista de clientes desta empresa.",
			})
			return
		}
		h.log.Error("criar cliente", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao cadastrar cliente.")
		return
	}
	httpx.Write(w, http.StatusCreated, map[string]any{
		"id":    id,
		"name":  name,
		"cnpj":  formattedCNPJ,
		"phone": formattedPhone,
		"email": normalizedEmail,
	})
}

// CreateContract: POST /api/contracts
func (h *Handlers) CreateContract(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if !requirePerm(w, sess, "contracts:write") {
		return
	}
	var in struct {
		ClientID       string  `json:"clientId"`
		Code           string  `json:"code"`
		Object         string  `json:"object"`
		ScopeNotes     string  `json:"scopeNotes"`
		Workstation    string  `json:"workstation"`
		DurationMonths int     `json:"durationMonths"`
		MonthlyValue   float64 `json:"monthlyValue"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	if strings.TrimSpace(in.ClientID) == "" || strings.TrimSpace(in.Object) == "" {
		httpx.Message(w, http.StatusBadRequest, "Selecione o cliente tomador e informe o objeto do contrato.")
		return
	}
	if in.MonthlyValue <= 0 {
		httpx.Write(w, http.StatusBadRequest, map[string]any{
			"field":   "monthlyValue",
			"message": "Informe o valor mensal acordado para o contrato.",
		})
		return
	}
	if in.DurationMonths <= 0 {
		in.DurationMonths = 12
	}
	code := strings.TrimSpace(in.Code)
	if code == "" {
		var count int
		_ = h.pool.QueryRow(r.Context(), `SELECT count(*) + 1 FROM contracts WHERE tenant_id = $1`, sess.Tenant.ID).Scan(&count)
		code = fmt.Sprintf("#CT-%03d", count)
	}
	workstation := strings.TrimSpace(in.Workstation)
	if workstation == "" {
		workstation = "Unidade Principal"
	}

	var id string
	err := h.pool.QueryRow(r.Context(),
		`INSERT INTO contracts (tenant_id, client_id, code, object, scope_notes, workstation, duration_months, monthly_value, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Ativo') RETURNING id`,
		sess.Tenant.ID, in.ClientID, code, strings.TrimSpace(in.Object), strings.TrimSpace(in.ScopeNotes), workstation, in.DurationMonths, in.MonthlyValue).Scan(&id)
	if err != nil {
		h.log.Error("criar contrato", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao salvar contrato.")
		return
	}
	httpx.Write(w, http.StatusCreated, map[string]any{"id": id, "code": code, "clientId": in.ClientID})
}

// CreateEmployee: POST /api/employees
func (h *Handlers) CreateEmployee(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if !requirePerm(w, sess, "employees:write") {
		return
	}
	var in struct {
		ContractID string `json:"contractId"`
		Name       string `json:"name"`
		RoleTitle  string `json:"roleTitle"`
		Schedule   string `json:"schedule"`
		Status     string `json:"status"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	name := strings.TrimSpace(in.Name)
	roleTitle := strings.TrimSpace(in.RoleTitle)
	if name == "" || roleTitle == "" {
		httpx.Message(w, http.StatusBadRequest, "Informe o nome do colaborador e a função.")
		return
	}
	schedule := strings.TrimSpace(in.Schedule)
	if schedule == "" {
		schedule = "Comercial 44h (08h às 18h)"
	}
	status := strings.TrimSpace(in.Status)
	if status != "Alocado" && status != "Disponível" && status != "Afastado" {
		status = "Alocado"
	}
	var contractPtr *string
	var clientID string
	if strings.TrimSpace(in.ContractID) != "" {
		c := strings.TrimSpace(in.ContractID)
		contractPtr = &c
		_ = h.pool.QueryRow(r.Context(), `SELECT client_id FROM contracts WHERE id = $1 AND tenant_id = $2`, c, sess.Tenant.ID).Scan(&clientID)
	} else {
		status = "Disponível"
	}

	var id string
	err := h.pool.QueryRow(r.Context(),
		`INSERT INTO employees (tenant_id, contract_id, name, role_title, schedule, status)
		 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		sess.Tenant.ID, contractPtr, name, roleTitle, schedule, status).Scan(&id)
	if err != nil {
		h.log.Error("criar colaborador", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao cadastrar colaborador.")
		return
	}
	httpx.Write(w, http.StatusCreated, map[string]any{"id": id, "clientId": clientID, "contractId": in.ContractID})
}

// UpdateEmployeeSchedule: POST /api/employees/schedule
func (h *Handlers) UpdateEmployeeSchedule(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if !requirePerm(w, sess, "employees:write") {
		return
	}
	var in struct {
		ID         string `json:"id"`
		ContractID string `json:"contractId"`
		Schedule   string `json:"schedule"`
		Status     string `json:"status"`
	}
	if err := httpx.Read(r, &in); err != nil || strings.TrimSpace(in.ID) == "" {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	schedule := strings.TrimSpace(in.Schedule)
	if schedule == "" {
		schedule = "Comercial 44h (08h às 18h)"
	}
	status := strings.TrimSpace(in.Status)
	if status != "Alocado" && status != "Disponível" && status != "Afastado" {
		status = "Alocado"
	}
	var contractPtr *string
	if strings.TrimSpace(in.ContractID) != "" {
		c := strings.TrimSpace(in.ContractID)
		contractPtr = &c
	} else if status == "Alocado" {
		status = "Disponível"
	}

	_, err := h.pool.Exec(r.Context(),
		`UPDATE employees
		 SET contract_id = $1, schedule = $2, status = $3
		 WHERE id = $4 AND tenant_id = $5`,
		contractPtr, schedule, status, strings.TrimSpace(in.ID), sess.Tenant.ID)
	if err != nil {
		h.log.Error("atualizar escala do colaborador", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao atualizar escala do colaborador.")
		return
	}
	httpx.Write(w, http.StatusOK, map[string]any{"ok": true})
}

// CreateEPI: POST /api/epis
func (h *Handlers) CreateEPI(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if !requirePerm(w, sess, "epis:write") {
		return
	}
	var in struct {
		EmployeeID    string `json:"employeeId"`
		EPIName       string `json:"epiName"`
		CANumber      string `json:"caNumber"`
		DeliveredAt   string `json:"deliveredAt"`
		ExpiresAt     string `json:"expiresAt"`
		ReceiptSigned bool   `json:"receiptSigned"`
		SignedBy      string `json:"signedBy"`
		EvidenceCode  string `json:"evidenceCode"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	if strings.TrimSpace(in.EmployeeID) == "" || strings.TrimSpace(in.EPIName) == "" || strings.TrimSpace(in.CANumber) == "" {
		httpx.Message(w, http.StatusBadRequest, "Informe o colaborador, o equipamento (EPI) e o número do CA.")
		return
	}
	deliveredAt := strings.TrimSpace(in.DeliveredAt)
	if deliveredAt == "" {
		deliveredAt = time.Now().Format("2006-01-02")
	}
	expiresAt := strings.TrimSpace(in.ExpiresAt)
	if expiresAt == "" {
		expiresAt = time.Now().AddDate(1, 0, 0).Format("2006-01-02")
	}

	var signedAt *time.Time
	signedBy := strings.TrimSpace(in.SignedBy)
	evidenceCode := strings.TrimSpace(in.EvidenceCode)
	if in.ReceiptSigned {
		now := time.Now()
		signedAt = &now
		if signedBy == "" {
			signedBy = "Confirmado na entrega presencial"
		}
		if evidenceCode == "" {
			evidenceCode = fmt.Sprintf("TRM-%d", now.Unix()%1000000)
		}
	} else {
		signedBy = ""
		evidenceCode = ""
	}

	var id string
	err := h.pool.QueryRow(r.Context(),
		`INSERT INTO epi_deliveries (tenant_id, employee_id, epi_name, ca_number, delivered_at, expires_at, receipt_signed, signed_at, signed_by, evidence_code)
		 VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, $9, $10) RETURNING id`,
		sess.Tenant.ID, in.EmployeeID, strings.TrimSpace(in.EPIName), strings.TrimSpace(in.CANumber),
		deliveredAt, expiresAt, in.ReceiptSigned, signedAt, signedBy, evidenceCode).Scan(&id)
	if err != nil {
		h.log.Error("registrar EPI", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao registrar entrega de EPI.")
		return
	}
	httpx.Write(w, http.StatusCreated, map[string]any{"id": id, "receiptSigned": in.ReceiptSigned})
}

// SignEPI: POST /api/epis/sign
func (h *Handlers) SignEPI(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if !requirePerm(w, sess, "epis:write") {
		return
	}
	var in struct {
		ID           string `json:"id"`
		SignedBy     string `json:"signedBy"`
		EvidenceCode string `json:"evidenceCode"`
	}
	if err := httpx.Read(r, &in); err != nil || strings.TrimSpace(in.ID) == "" {
		httpx.Message(w, http.StatusBadRequest, "Informe a entrega de EPI a ser assinada.")
		return
	}
	signedBy := strings.TrimSpace(in.SignedBy)
	if signedBy == "" {
		signedBy = "Termo assinado pelo colaborador"
	}
	evidenceCode := strings.TrimSpace(in.EvidenceCode)
	if evidenceCode == "" {
		evidenceCode = fmt.Sprintf("TRM-%d", time.Now().Unix()%1000000)
	}

	tag, err := h.pool.Exec(r.Context(),
		`UPDATE epi_deliveries
		 SET receipt_signed = true,
		     signed_at = now(),
		     signed_by = $1,
		     evidence_code = $2
		 WHERE id = $3 AND tenant_id = $4`,
		signedBy, evidenceCode, strings.TrimSpace(in.ID), sess.Tenant.ID)
	if err != nil || tag.RowsAffected() == 0 {
		httpx.Message(w, http.StatusBadRequest, "Não foi possível registrar a assinatura do EPI.")
		return
	}
	httpx.Write(w, http.StatusOK, map[string]any{"ok": true, "evidenceCode": evidenceCode})
}

// CreateInventoryItem: POST /api/inventory-items
func (h *Handlers) CreateInventoryItem(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if !requirePerm(w, sess, "inventory:write") {
		return
	}
	var in struct {
		SKU         string  `json:"sku"`
		Description string  `json:"description"`
		Category    string  `json:"category"`
		Quantity    int     `json:"quantity"`
		Unit        string  `json:"unit"`
		UnitValue   float64 `json:"unitValue"`
		MinQuantity int     `json:"minQuantity"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	sku := strings.ToUpper(strings.TrimSpace(in.SKU))
	desc := strings.TrimSpace(in.Description)
	if sku == "" || desc == "" {
		httpx.Message(w, http.StatusBadRequest, "Informe o código SKU e a descrição do item.")
		return
	}
	if in.Quantity < 0 {
		httpx.Message(w, http.StatusBadRequest, "O saldo inicial não pode ser negativo.")
		return
	}
	cat := strings.TrimSpace(in.Category)
	if cat != "Material" && cat != "Ferramenta" {
		cat = "Material"
	}
	unit := strings.TrimSpace(in.Unit)
	if unit == "" {
		unit = "un."
	}
	if in.MinQuantity <= 0 {
		in.MinQuantity = 2
	}

	var id string
	err := h.pool.QueryRow(r.Context(),
		`INSERT INTO inventory_items (tenant_id, sku, description, category, quantity, unit, unit_value, min_quantity)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
		sess.Tenant.ID, sku, desc, cat, in.Quantity, unit, in.UnitValue, in.MinQuantity).Scan(&id)
	if err != nil {
		h.log.Error("criar item de estoque", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao cadastrar item de estoque.")
		return
	}
	httpx.Write(w, http.StatusCreated, map[string]any{"id": id})
}

// CreateInventoryMovement: POST /api/inventory-movements
func (h *Handlers) CreateInventoryMovement(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if !requirePerm(w, sess, "inventory:write") {
		return
	}
	var in struct {
		ItemID         string `json:"itemId"`
		EmployeeID     string `json:"employeeId"`
		ServiceOrderID string `json:"serviceOrderId"`
		MovementType   string `json:"movementType"`
		Quantity       int    `json:"quantity"`
		Notes          string `json:"notes"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	if strings.TrimSpace(in.ItemID) == "" || in.Quantity <= 0 {
		httpx.Write(w, http.StatusBadRequest, map[string]any{
			"field":   "quantity",
			"message": "Selecione o item e informe uma quantidade maior que zero.",
		})
		return
	}
	mType := strings.TrimSpace(in.MovementType)
	if mType != "Entrada" && mType != "Saída" && mType != "Cautela" && mType != "Devolução" {
		httpx.Write(w, http.StatusBadRequest, map[string]any{
			"field":   "movementType",
			"message": "Selecione o tipo de operação de estoque.",
		})
		return
	}
	if (mType == "Cautela" || mType == "Devolução") && strings.TrimSpace(in.EmployeeID) == "" {
		httpx.Write(w, http.StatusBadRequest, map[string]any{
			"field":   "employeeId",
			"message": "Selecione o colaborador responsável pela cautela ou devolução.",
		})
		return
	}

	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro interno.")
		return
	}
	defer tx.Rollback(r.Context())

	var currentQty int
	var itemSku, itemDesc, itemUnit string
	err = tx.QueryRow(r.Context(),
		`SELECT sku, description, quantity, unit
		 FROM inventory_items
		 WHERE id = $1 AND tenant_id = $2
		 FOR UPDATE`,
		strings.TrimSpace(in.ItemID), sess.Tenant.ID).Scan(&itemSku, &itemDesc, &currentQty, &itemUnit)
	if err != nil {
		httpx.Message(w, http.StatusBadRequest, "Item não encontrado no estoque da empresa ativa.")
		return
	}

	delta := in.Quantity
	if mType == "Saída" || mType == "Cautela" {
		if in.Quantity > currentQty {
			httpx.Write(w, http.StatusConflict, map[string]any{
				"field":             "quantity",
				"availableQuantity": currentQty,
				"requestedQuantity": in.Quantity,
				"message": fmt.Sprintf(
					"Saldo insuficiente para %s (%s): saldo disponível de %d %s, mas foi solicitada saída de %d %s.",
					itemSku, itemDesc, currentQty, itemUnit, in.Quantity, itemUnit,
				),
			})
			return
		}
		delta = -in.Quantity
	}

	newQty := currentQty + delta
	_, err = tx.Exec(r.Context(),
		`UPDATE inventory_items
		 SET quantity = $1
		 WHERE id = $2 AND tenant_id = $3`,
		newQty, strings.TrimSpace(in.ItemID), sess.Tenant.ID)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Falha ao atualizar saldo do item.")
		return
	}

	var empPtr *string
	if strings.TrimSpace(in.EmployeeID) != "" {
		e := strings.TrimSpace(in.EmployeeID)
		empPtr = &e
	}
	var osPtr *string
	if strings.TrimSpace(in.ServiceOrderID) != "" {
		o := strings.TrimSpace(in.ServiceOrderID)
		osPtr = &o
	}

	var movID string
	err = tx.QueryRow(r.Context(),
		`INSERT INTO inventory_movements (tenant_id, item_id, employee_id, service_order_id, movement_type, previous_quantity, quantity, new_quantity, notes)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
		sess.Tenant.ID, strings.TrimSpace(in.ItemID), empPtr, osPtr, mType, currentQty, in.Quantity, newQty, strings.TrimSpace(in.Notes)).Scan(&movID)
	if err != nil {
		h.log.Error("registrar movimentação", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao registrar movimentação.")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao confirmar movimentação.")
		return
	}
	httpx.Write(w, http.StatusCreated, map[string]any{
		"id":               movID,
		"previousQuantity": currentQty,
		"newQuantity":      newQty,
	})
}

// CreateServiceOrder: POST /api/service-orders
func (h *Handlers) CreateServiceOrder(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if !requirePerm(w, sess, "service_orders:write") {
		return
	}
	var in struct {
		ClientID     string `json:"clientId"`
		ContractID   string `json:"contractId"`
		EmployeeID   string `json:"employeeId"`
		Description  string `json:"description"`
		Priority     string `json:"priority"`
		Status       string `json:"status"`
		ScheduledFor string `json:"scheduledFor"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	if strings.TrimSpace(in.ClientID) == "" || strings.TrimSpace(in.Description) == "" {
		httpx.Message(w, http.StatusBadRequest, "Selecione o cliente e descreva o serviço da OS.")
		return
	}
	var count int
	_ = h.pool.QueryRow(r.Context(), `SELECT count(*) + 104 FROM service_orders WHERE tenant_id = $1`, sess.Tenant.ID).Scan(&count)
	code := fmt.Sprintf("#OS-%d", count)

	priority := strings.TrimSpace(in.Priority)
	if priority != "Normal" && priority != "Alta" && priority != "Urgente" {
		priority = "Normal"
	}
	status := strings.TrimSpace(in.Status)
	if status != "Agendada" && status != "Em Execução" && status != "Concluída" {
		status = "Agendada"
	}
	var empPtr *string
	if strings.TrimSpace(in.EmployeeID) != "" {
		e := strings.TrimSpace(in.EmployeeID)
		empPtr = &e
	}
	var contractPtr *string
	if strings.TrimSpace(in.ContractID) != "" {
		c := strings.TrimSpace(in.ContractID)
		contractPtr = &c
	}

	var scheduledPtr *time.Time
	if rawSched := strings.TrimSpace(in.ScheduledFor); rawSched != "" {
		if t, err := time.Parse("2006-01-02T15:04", rawSched); err == nil {
			scheduledPtr = &t
		} else if t2, err2 := time.Parse(time.RFC3339, rawSched); err2 == nil {
			scheduledPtr = &t2
		}
	}
	if status == "Agendada" && scheduledPtr == nil {
		t := time.Now().Add(24 * time.Hour)
		scheduledPtr = &t
	}

	var id string
	err := h.pool.QueryRow(r.Context(),
		`INSERT INTO service_orders (tenant_id, client_id, contract_id, employee_id, code, description, priority, status, scheduled_for)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
		sess.Tenant.ID, in.ClientID, contractPtr, empPtr, code, strings.TrimSpace(in.Description), priority, status, scheduledPtr).Scan(&id)
	if err != nil {
		h.log.Error("criar OS", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao abrir Ordem de Serviço.")
		return
	}
	httpx.Write(w, http.StatusCreated, map[string]any{"id": id, "code": code})
}

// UpdateServiceOrderStatus: POST /api/service-orders/status
func (h *Handlers) UpdateServiceOrderStatus(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if !requirePerm(w, sess, "service_orders:write") {
		return
	}
	var in struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	if in.Status != "Agendada" && in.Status != "Em Execução" && in.Status != "Concluída" {
		httpx.Message(w, http.StatusBadRequest, "Status inválido.")
		return
	}
	_, err := h.pool.Exec(r.Context(),
		`UPDATE service_orders
		 SET status = $1,
		     completed_at = CASE WHEN $1 = 'Concluída' THEN now() ELSE NULL END
		 WHERE id = $2 AND tenant_id = $3`,
		in.Status, in.ID, sess.Tenant.ID)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao atualizar status da OS.")
		return
	}
	httpx.Write(w, http.StatusOK, map[string]any{"ok": true})
}

// CreateFinancialEntry: POST /api/financial-entries
func (h *Handlers) CreateFinancialEntry(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if !requirePerm(w, sess, "finance:write") {
		return
	}
	var in struct {
		ContractID  string  `json:"contractId"`
		EntryType   string  `json:"entryType"`
		Description string  `json:"description"`
		Amount      float64 `json:"amount"`
		DueDate     string  `json:"dueDate"`
		Status      string  `json:"status"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	if strings.TrimSpace(in.Description) == "" || in.Amount <= 0 {
		httpx.Message(w, http.StatusBadRequest, "Informe a descrição e um valor maior que zero para o lançamento.")
		return
	}
	eType := strings.TrimSpace(in.EntryType)
	if eType != "Receita" && eType != "Despesa" {
		eType = "Receita"
	}
	status := strings.TrimSpace(in.Status)
	if status != "Pendente" && status != "Conciliado" {
		status = "Pendente"
	}
	dueDate := strings.TrimSpace(in.DueDate)
	if dueDate == "" {
		dueDate = time.Now().Format("2006-01-02")
	}
	var contractPtr *string
	if strings.TrimSpace(in.ContractID) != "" {
		c := strings.TrimSpace(in.ContractID)
		contractPtr = &c
	}

	var id string
	err := h.pool.QueryRow(r.Context(),
		`INSERT INTO financial_entries (tenant_id, contract_id, entry_type, description, amount, due_date, reconciliation_status, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6::date, $7, now()) RETURNING id`,
		sess.Tenant.ID, contractPtr, eType, strings.TrimSpace(in.Description), in.Amount, dueDate, status).Scan(&id)
	if err != nil {
		h.log.Error("criar lançamento financeiro", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao registrar lançamento financeiro.")
		return
	}
	httpx.Write(w, http.StatusCreated, map[string]any{"id": id})
}

// ReconcileFinancialEntry: POST /api/financial-entries/reconcile
func (h *Handlers) ReconcileFinancialEntry(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if !requirePerm(w, sess, "finance:write") {
		return
	}
	var in struct {
		ID string `json:"id"`
	}
	if err := httpx.Read(r, &in); err != nil || strings.TrimSpace(in.ID) == "" {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	_, err := h.pool.Exec(r.Context(),
		`UPDATE financial_entries
		 SET reconciliation_status = CASE WHEN reconciliation_status = 'Conciliado' THEN 'Pendente' ELSE 'Conciliado' END,
		     updated_at = now()
		 WHERE id = $1 AND tenant_id = $2`,
		in.ID, sess.Tenant.ID)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao conciliar lançamento.")
		return
	}
	httpx.Write(w, http.StatusOK, map[string]any{"ok": true})
}
