package operations

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"tercerize/backend/internal/auth"
	"tercerize/backend/internal/httpx"
	"tercerize/backend/internal/secretbox"
)

var allowedPartnerFeatureKeys = []string{
	"companies:create",
	"companies:edit",
	"companies:toggle_active",
	"companies:impersonate",
	"companies:ai_token",
	"analytics:portfolio",
}

func defaultPartnerFeatures() map[string]bool {
	return map[string]bool{
		"companies:create":        true,
		"companies:edit":          true,
		"companies:toggle_active": true,
		"companies:impersonate":   true,
		"companies:ai_token":      true,
		"analytics:portfolio":     false,
	}
}

func sanitizePartnerFeatures(in map[string]bool) map[string]bool {
	if in == nil {
		return defaultPartnerFeatures()
	}
	out := make(map[string]bool, len(allowedPartnerFeatureKeys))
	for _, k := range allowedPartnerFeatureKeys {
		out[k] = in[k]
	}
	return out
}

// ---------- ENDPOINTS EXCLUSIVOS ADMIN MASTER (/api/partners/*) ----------

// CreatePartnerCompany: POST /api/partners (exclusivo Admin Master)
// Cadastra uma nova empresa já promovida ao nível Parceiros e envia o link do Google Authenticator ao Dono.
func (h *Handlers) CreatePartnerCompany(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || !sess.User.IsMaster {
		httpx.Message(w, http.StatusForbidden, "Apenas o Admin Master pode cadastrar empresas parceiras.")
		return
	}

	var in struct {
		Name                  string          `json:"name"`
		CNPJ                  string          `json:"cnpj"`
		OwnerName             string          `json:"ownerName"`
		OwnerEmail            string          `json:"ownerEmail"`
		OpenRouterToken       string          `json:"openrouterToken"`
		AIPlanKey             string          `json:"aiPlanKey"`
		AIMonthlyMessageLimit int             `json:"aiMonthlyMessageLimit"`
		PartnerMaxCompanies   int             `json:"partnerMaxCompanies"`
		PartnerNotes          string          `json:"partnerNotes"`
		PartnerFeatures       map[string]bool `json:"partnerFeatures"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}

	name := strings.TrimSpace(in.Name)
	if len([]rune(name)) < 2 {
		httpx.Write(w, http.StatusBadRequest, map[string]any{"field": "name", "message": "Informe a razão social da empresa parceira (mínimo 2 caracteres)."})
		return
	}
	formattedCNPJ, cnpjErr := auth.ValidateCNPJ(in.CNPJ)
	if cnpjErr != "" {
		httpx.Write(w, http.StatusBadRequest, map[string]any{"field": "cnpj", "message": cnpjErr})
		return
	}
	ownerName := strings.TrimSpace(in.OwnerName)
	if len([]rune(ownerName)) < 2 {
		httpx.Write(w, http.StatusBadRequest, map[string]any{"field": "ownerName", "message": "Informe o nome do dono parceiro."})
		return
	}
	ownerEmail, emailErr := auth.NormalizeEmail(in.OwnerEmail)
	if emailErr != "" {
		httpx.Write(w, http.StatusBadRequest, map[string]any{"field": "ownerEmail", "message": emailErr})
		return
	}

	maxCompanies := in.PartnerMaxCompanies
	if maxCompanies < 0 {
		maxCompanies = 0
	}
	monthlyLimit := in.AIMonthlyMessageLimit
	if monthlyLimit < 0 {
		monthlyLimit = 0
	}
	features := sanitizePartnerFeatures(in.PartnerFeatures)
	featuresJSON, _ := json.Marshal(features)

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
		httpx.Write(w, http.StatusConflict, map[string]any{"field": "cnpj", "message": "Já existe uma empresa cadastrada com este CNPJ. Use a opção Promover empresa existente."})
		return
	}

	ownerUserID, _, _, err := h.authRepo.EnsureUserWithTOTP(ctx, tx, ownerName, ownerEmail)
	if err != nil {
		h.log.Error("provisionar dono parceiro", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao vincular responsável parceiro.")
		return
	}

	var encToken, tokenHint string
	if rawToken := strings.TrimSpace(in.OpenRouterToken); rawToken != "" {
		enc, encErr := secretbox.Encrypt(rawToken, h.aiEncryptionKey)
		if encErr != nil {
			httpx.Message(w, http.StatusInternalServerError, "Erro ao proteger o token OpenRouter.")
			return
		}
		encToken = enc
		tokenHint = secretbox.MaskHint(rawToken)
	}

	var tenantID string
	err = tx.QueryRow(ctx,
		`INSERT INTO tenants (
		   name, cnpj, owner_name, owner_email, owner_user_id, active,
		   openrouter_token_enc, openrouter_token_hint, ai_plan_key, ai_monthly_message_limit,
		   is_partner, partner_features, partner_max_companies, partner_notes, partner_enabled_at,
		   created_by_user_id
		 )
		 VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9, true, $10::jsonb, $11, $12, now(), $13)
		 RETURNING id`,
		name, formattedCNPJ, ownerName, ownerEmail, ownerUserID,
		encToken, tokenHint, normalizeAIPlanKey(in.AIPlanKey), monthlyLimit,
		string(featuresJSON), maxCompanies, strings.TrimSpace(in.PartnerNotes), sess.User.ID,
	).Scan(&tenantID)
	if err != nil {
		h.log.Error("criar empresa parceira", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao cadastrar empresa parceira.")
		return
	}

	ownerRoleID, err := seedDefaultRoles(ctx, tx, tenantID)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao configurar funções padrão da empresa parceira.")
		return
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO tenant_memberships (tenant_id, user_id, role_id)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (tenant_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id`,
		tenantID, ownerUserID, ownerRoleID)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao atribuir permissão de dono parceiro.")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao confirmar cadastro da empresa parceira.")
		return
	}

	emailSent := false
	emailWarning := ""
	if rawToken, linkErr := h.authRepo.CreateSetupLink(ctx, ownerUserID, tenantID); linkErr == nil {
		activationURL := fmt.Sprintf("%s/ativar-autenticador?token=%s", h.appURL, url.QueryEscape(rawToken))
		if mailErr := h.mailer.SendAuthenticatorLink(ownerEmail, ownerName, name, "Dono Parceiro", activationURL); mailErr != nil {
			h.log.Error("enviar e-mail para dono parceiro", "to", ownerEmail, "err", mailErr)
			emailWarning = "Parceiro cadastrado, mas houve falha no envio do e-mail SMTP: " + mailErr.Error()
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

// PromoteOrUpdatePartner: POST /api/partners/promote e POST /api/partners/update (exclusivo Admin Master)
// Promove uma empresa existente para Parceira ou atualiza recursos liberados, cota e observações.
func (h *Handlers) PromoteOrUpdatePartner(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || !sess.User.IsMaster {
		httpx.Message(w, http.StatusForbidden, "Apenas o Admin Master pode promover ou configurar parceiros.")
		return
	}

	var in struct {
		TenantID            string          `json:"tenantId"`
		PartnerMaxCompanies int             `json:"partnerMaxCompanies"`
		PartnerNotes        string          `json:"partnerNotes"`
		PartnerFeatures     map[string]bool `json:"partnerFeatures"`
	}
	if err := httpx.Read(r, &in); err != nil || strings.TrimSpace(in.TenantID) == "" {
		httpx.Message(w, http.StatusBadRequest, "Selecione uma empresa válida.")
		return
	}
	tenantID := strings.TrimSpace(in.TenantID)

	var name, parentPartnerID string
	var active bool
	err := h.pool.QueryRow(r.Context(),
		`SELECT name, active, COALESCE(parent_partner_tenant_id::text, '') FROM tenants WHERE id = $1`,
		tenantID).Scan(&name, &active, &parentPartnerID)
	if err != nil {
		httpx.Message(w, http.StatusNotFound, "Empresa não encontrada.")
		return
	}
	if parentPartnerID != "" {
		httpx.Message(w, http.StatusBadRequest, "Empresas cadastradas por outro parceiro não podem ser promovidas a Parceiras (evita sub-revenda em cascata).")
		return
	}
	if !active {
		httpx.Message(w, http.StatusBadRequest, "Ative a empresa antes de promovê-la para o ambiente Parceiros.")
		return
	}

	maxCompanies := in.PartnerMaxCompanies
	if maxCompanies < 0 {
		maxCompanies = 0
	}
	features := sanitizePartnerFeatures(in.PartnerFeatures)
	featuresJSON, _ := json.Marshal(features)

	_, err = h.pool.Exec(r.Context(),
		`UPDATE tenants
		    SET is_partner = true,
		        partner_features = $1::jsonb,
		        partner_max_companies = $2,
		        partner_notes = $3,
		        partner_enabled_at = COALESCE(partner_enabled_at, now())
		  WHERE id = $4`,
		string(featuresJSON), maxCompanies, strings.TrimSpace(in.PartnerNotes), tenantID)
	if err != nil {
		h.log.Error("promover/atualizar parceiro", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao salvar configuração de parceiro.")
		return
	}

	httpx.Write(w, http.StatusOK, map[string]any{
		"ok":   true,
		"name": name,
	})
}

// RevokePartner: POST /api/partners/revoke (exclusivo Admin Master)
// Remove a promoção de Parceiro imediatamente, redirecionando sessões do ambiente Parceiros para a própria empresa.
// As empresas clientes já cadastradas pelo parceiro permanecem intactas sob gestão do Admin Master.
func (h *Handlers) RevokePartner(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || !sess.User.IsMaster {
		httpx.Message(w, http.StatusForbidden, "Apenas o Admin Master pode remover a promoção de parceiros.")
		return
	}
	var in struct {
		TenantID string `json:"tenantId"`
	}
	if err := httpx.Read(r, &in); err != nil || strings.TrimSpace(in.TenantID) == "" {
		httpx.Message(w, http.StatusBadRequest, "Empresa parceira inválida.")
		return
	}
	tenantID := strings.TrimSpace(in.TenantID)

	ctx := r.Context()
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro interno.")
		return
	}
	defer tx.Rollback(ctx)

	var name string
	var ownerUserID *string
	err = tx.QueryRow(ctx,
		`UPDATE tenants
		    SET is_partner = false
		  WHERE id = $1
		  RETURNING name, owner_user_id::text`, tenantID).Scan(&name, &ownerUserID)
	if err != nil {
		httpx.Message(w, http.StatusNotFound, "Empresa parceira não encontrada.")
		return
	}

	// Retira imediatamente qualquer sessão do dono parceiro que esteja no ambiente Parceiros ou em sub-empresa da carteira
	if ownerUserID != nil && *ownerUserID != "" {
		_, _ = tx.Exec(ctx,
			`UPDATE sessions
			    SET context_mode = 'tenant',
			        active_tenant_id = $1
			  WHERE user_id = $2
			    AND (
			      context_mode = 'partner'
			      OR active_tenant_id IN (SELECT id FROM tenants WHERE parent_partner_tenant_id = $1)
			    )`,
			tenantID, *ownerUserID)
	}

	if err := tx.Commit(ctx); err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao remover promoção de parceiro.")
		return
	}

	httpx.Write(w, http.StatusOK, map[string]any{
		"ok":   true,
		"name": name,
	})
}

// ---------- ENDPOINTS DEDICADOS DO AMBIENTE PARCEIROS (/api/partner/*) ----------

func requirePartnerFeature(w http.ResponseWriter, sess *auth.SessionContext, feature string) bool {
	if sess == nil || !sess.User.IsPartner || sess.User.PartnerTenantID == "" {
		httpx.Message(w, http.StatusForbidden, "Acesso exclusivo para empresas promovidas ao ambiente Parceiros.")
		return false
	}
	if !sess.HasPartnerFeature(feature) {
		httpx.Message(w, http.StatusForbidden, "Este recurso ainda não foi liberado pelo Admin Master para a sua conta Parceira.")
		return false
	}
	return true
}

// PartnerCreateCompany: POST /api/partner/companies
// Permite ao Dono Parceiro cadastrar uma nova empresa cliente na própria carteira (com Token OpenRouter opcional).
func (h *Handlers) PartnerCreateCompany(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if !requirePartnerFeature(w, sess, "companies:create") {
		return
	}

	var in struct {
		Name            string `json:"name"`
		CNPJ            string `json:"cnpj"`
		OwnerName       string `json:"ownerName"`
		OwnerEmail      string `json:"ownerEmail"`
		OpenRouterToken string `json:"openrouterToken"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}

	name := strings.TrimSpace(in.Name)
	if len([]rune(name)) < 2 {
		httpx.Write(w, http.StatusBadRequest, map[string]any{"field": "name", "message": "Informe a razão social da empresa (mínimo 2 caracteres)."})
		return
	}
	formattedCNPJ, cnpjErr := auth.ValidateCNPJ(in.CNPJ)
	if cnpjErr != "" {
		httpx.Write(w, http.StatusBadRequest, map[string]any{"field": "cnpj", "message": cnpjErr})
		return
	}
	ownerName := strings.TrimSpace(in.OwnerName)
	if len([]rune(ownerName)) < 2 {
		httpx.Write(w, http.StatusBadRequest, map[string]any{"field": "ownerName", "message": "Informe o nome do responsável (dono da empresa)."})
		return
	}
	ownerEmail, emailErr := auth.NormalizeEmail(in.OwnerEmail)
	if emailErr != "" {
		httpx.Write(w, http.StatusBadRequest, map[string]any{"field": "ownerEmail", "message": emailErr})
		return
	}

	ctx := r.Context()
	// Verifica cota máxima de empresas do parceiro (quando > 0)
	if sess.User.PartnerMaxCompanies > 0 {
		var currentCount int
		_ = h.pool.QueryRow(ctx,
			`SELECT count(*) FROM tenants WHERE parent_partner_tenant_id = $1`,
			sess.User.PartnerTenantID).Scan(&currentCount)
		if currentCount >= sess.User.PartnerMaxCompanies {
			httpx.Message(w, http.StatusForbidden, fmt.Sprintf(
				"Você atingiu o limite de %d empresa(s) liberadas para sua conta Parceira. Solicite ampliação ao Admin Master.",
				sess.User.PartnerMaxCompanies,
			))
			return
		}
	}

	tx, err := h.pool.Begin(ctx)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao iniciar transação.")
		return
	}
	defer tx.Rollback(ctx)

	var exists bool
	_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM tenants WHERE cnpj = $1)`, formattedCNPJ).Scan(&exists)
	if exists {
		httpx.Write(w, http.StatusConflict, map[string]any{"field": "cnpj", "message": "Já existe uma empresa cadastrada com este CNPJ."})
		return
	}

	ownerUserID, _, _, err := h.authRepo.EnsureUserWithTOTP(ctx, tx, ownerName, ownerEmail)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao vincular responsável da empresa.")
		return
	}

	var encToken, tokenHint string
	if rawToken := strings.TrimSpace(in.OpenRouterToken); rawToken != "" && sess.HasPartnerFeature("companies:ai_token") {
		enc, encErr := secretbox.Encrypt(rawToken, h.aiEncryptionKey)
		if encErr != nil {
			httpx.Message(w, http.StatusInternalServerError, "Erro ao proteger o token OpenRouter.")
			return
		}
		encToken = enc
		tokenHint = secretbox.MaskHint(rawToken)
	}

	// Planos de IA são definidos exclusivamente pelo Admin Master (toda nova empresa inicia no default 'free')
	const aiPlanKey = "free"

	var tenantID string
	err = tx.QueryRow(ctx,
		`INSERT INTO tenants (
		   name, cnpj, owner_name, owner_email, owner_user_id, active,
		   openrouter_token_enc, openrouter_token_hint, ai_plan_key,
		   parent_partner_tenant_id, created_by_user_id
		 )
		 VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9, $10)
		 RETURNING id`,
		name, formattedCNPJ, ownerName, ownerEmail, ownerUserID,
		encToken, tokenHint, aiPlanKey,
		sess.User.PartnerTenantID, sess.User.ID,
	).Scan(&tenantID)
	if err != nil {
		h.log.Error("parceiro criar empresa", "partner", sess.User.PartnerTenantID, "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao cadastrar empresa cliente.")
		return
	}

	ownerRoleID, err := seedDefaultRoles(ctx, tx, tenantID)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao configurar funções padrão da empresa.")
		return
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO tenant_memberships (tenant_id, user_id, role_id)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (tenant_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id`,
		tenantID, ownerUserID, ownerRoleID)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao vincular responsável à empresa.")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao confirmar cadastro.")
		return
	}

	emailSent := false
	emailWarning := ""
	if rawToken, linkErr := h.authRepo.CreateSetupLink(ctx, ownerUserID, tenantID); linkErr == nil {
		activationURL := fmt.Sprintf("%s/ativar-autenticador?token=%s", h.appURL, url.QueryEscape(rawToken))
		if mailErr := h.mailer.SendAuthenticatorLink(ownerEmail, ownerName, name, "Dono da empresa", activationURL); mailErr != nil {
			h.log.Error("enviar e-mail para cliente de parceiro", "to", ownerEmail, "err", mailErr)
			emailWarning = "Empresa criada, mas houve falha no envio do e-mail SMTP: " + mailErr.Error()
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

// PartnerUpdateCompany: POST /api/partner/companies/update
// Permite ao Dono Parceiro editar SOMENTE empresas cadastradas por ele (parent_partner_tenant_id = PartnerTenantID).
func (h *Handlers) PartnerUpdateCompany(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if !requirePartnerFeature(w, sess, "companies:edit") {
		return
	}

	var in struct {
		TenantID             string `json:"tenantId"`
		Name                 string `json:"name"`
		CNPJ                 string `json:"cnpj"`
		OwnerName            string `json:"ownerName"`
		OwnerEmail           string `json:"ownerEmail"`
		Active               *bool  `json:"active"`
		ResendLink           bool   `json:"resendLink"`
		OpenRouterToken      string `json:"openrouterToken"`
		ClearOpenRouterToken bool   `json:"clearOpenrouterToken"`
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
		httpx.Write(w, http.StatusBadRequest, map[string]any{"field": "name", "message": "Informe a razão social da empresa (mínimo 2 caracteres)."})
		return
	}
	formattedCNPJ, cnpjErr := auth.ValidateCNPJ(in.CNPJ)
	if cnpjErr != "" {
		httpx.Write(w, http.StatusBadRequest, map[string]any{"field": "cnpj", "message": cnpjErr})
		return
	}
	ownerName := strings.TrimSpace(in.OwnerName)
	if len([]rune(ownerName)) < 2 {
		httpx.Write(w, http.StatusBadRequest, map[string]any{"field": "ownerName", "message": "Informe o nome do responsável (dono da empresa)."})
		return
	}
	ownerEmail, emailErr := auth.NormalizeEmail(in.OwnerEmail)
	if emailErr != "" {
		httpx.Write(w, http.StatusBadRequest, map[string]any{"field": "ownerEmail", "message": emailErr})
		return
	}

	ctx := r.Context()
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao iniciar transação.")
		return
	}
	defer tx.Rollback(ctx)

	// Isolamento estrito: só permite editar empresas que pertençam à carteira deste Parceiro
	var currentActive bool
	var oldOwnerEmail string
	var oldOwnerUserID *string
	err = tx.QueryRow(ctx,
		`SELECT active, COALESCE(owner_email, ''), owner_user_id::text
		   FROM tenants
		  WHERE id = $1 AND parent_partner_tenant_id = $2`,
		tenantID, sess.User.PartnerTenantID).Scan(&currentActive, &oldOwnerEmail, &oldOwnerUserID)
	if err != nil {
		httpx.Message(w, http.StatusForbidden, "Você só pode editar empresas cadastradas na sua carteira Parceira.")
		return
	}

	var duplicateCNPJ bool
	_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM tenants WHERE cnpj = $1 AND id <> $2)`, formattedCNPJ, tenantID).Scan(&duplicateCNPJ)
	if duplicateCNPJ {
		httpx.Write(w, http.StatusConflict, map[string]any{"field": "cnpj", "message": "Já existe outra empresa cadastrada com este CNPJ."})
		return
	}

	newActive := currentActive
	if in.Active != nil && sess.HasPartnerFeature("companies:toggle_active") {
		newActive = *in.Active
	}

	newOwnerUserID, _, _, err := h.authRepo.EnsureUserWithTOTP(ctx, tx, ownerName, ownerEmail)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao atualizar responsável da empresa.")
		return
	}
	_, _ = tx.Exec(ctx, `UPDATE users SET name = $1 WHERE id = $2 AND is_master = false`, ownerName, newOwnerUserID)

	var ownerRoleID string
	err = tx.QueryRow(ctx, `SELECT id FROM tenant_roles WHERE tenant_id = $1 AND key = 'owner' LIMIT 1`, tenantID).Scan(&ownerRoleID)
	if err != nil || ownerRoleID == "" {
		ownerRoleID, err = seedDefaultRoles(ctx, tx, tenantID)
		if err != nil {
			httpx.Message(w, http.StatusInternalServerError, "Erro ao verificar função de dono.")
			return
		}
	}

	_, err = tx.Exec(ctx,
		`UPDATE tenants
		    SET name = $1, cnpj = $2, owner_name = $3, owner_email = $4, owner_user_id = $5, active = $6
		  WHERE id = $7 AND parent_partner_tenant_id = $8`,
		name, formattedCNPJ, ownerName, ownerEmail, newOwnerUserID, newActive, tenantID, sess.User.PartnerTenantID)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao salvar alterações.")
		return
	}

	if sess.HasPartnerFeature("companies:ai_token") {
		if in.ClearOpenRouterToken {
			_, _ = tx.Exec(ctx,
				`UPDATE tenants SET openrouter_token_enc = '', openrouter_token_hint = '', ai_credit_depleted_at = NULL, ai_credit_depleted_from = '' WHERE id = $1`,
				tenantID)
		} else if rawToken := strings.TrimSpace(in.OpenRouterToken); rawToken != "" {
			enc, encErr := secretbox.Encrypt(rawToken, h.aiEncryptionKey)
			if encErr != nil {
				httpx.Message(w, http.StatusInternalServerError, "Erro ao proteger o token OpenRouter.")
				return
			}
			_, _ = tx.Exec(ctx,
				`UPDATE tenants SET openrouter_token_enc = $1, openrouter_token_hint = $2, ai_credit_depleted_at = NULL, ai_credit_depleted_from = '' WHERE id = $3`,
				enc, secretbox.MaskHint(rawToken), tenantID)
		}
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO tenant_memberships (tenant_id, user_id, role_id)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (tenant_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id`,
		tenantID, newOwnerUserID, ownerRoleID)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao atualizar vínculo de dono.")
		return
	}

	ownerChanged := !strings.EqualFold(strings.TrimSpace(oldOwnerEmail), ownerEmail)
	if oldOwnerUserID != nil && *oldOwnerUserID != "" && *oldOwnerUserID != newOwnerUserID {
		_, _ = tx.Exec(ctx,
			`DELETE FROM tenant_memberships WHERE tenant_id = $1 AND user_id = $2 AND user_id IN (SELECT id FROM users WHERE is_master = false)`,
			tenantID, *oldOwnerUserID)
		_, _ = tx.Exec(ctx,
			`DELETE FROM sessions WHERE active_tenant_id = $1 AND user_id = $2 AND user_id IN (SELECT id FROM users WHERE is_master = false)`,
			tenantID, *oldOwnerUserID)
	}

	if !newActive {
		_, _ = tx.Exec(ctx,
			`DELETE FROM sessions WHERE active_tenant_id = $1 AND user_id IN (SELECT id FROM users WHERE is_master = false) AND user_id <> $2`,
			tenantID, sess.User.ID)
	}

	if err := tx.Commit(ctx); err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao confirmar alterações.")
		return
	}

	emailSent := false
	emailWarning := ""
	if newActive && (ownerChanged || in.ResendLink) {
		if rawToken, linkErr := h.authRepo.CreateSetupLink(ctx, newOwnerUserID, tenantID); linkErr == nil {
			activationURL := fmt.Sprintf("%s/ativar-autenticador?token=%s", h.appURL, url.QueryEscape(rawToken))
			if mailErr := h.mailer.SendAuthenticatorLink(ownerEmail, ownerName, name, "Dono da empresa", activationURL); mailErr != nil {
				emailWarning = "Alterações salvas, mas houve falha no envio do e-mail SMTP: " + mailErr.Error()
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

// PartnerToggleCompanyActive: POST /api/partner/companies/toggle-active
func (h *Handlers) PartnerToggleCompanyActive(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if !requirePartnerFeature(w, sess, "companies:toggle_active") {
		return
	}
	var in struct {
		TenantID string `json:"tenantId"`
	}
	if err := httpx.Read(r, &in); err != nil || strings.TrimSpace(in.TenantID) == "" {
		httpx.Message(w, http.StatusBadRequest, "Empresa inválida.")
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
		`UPDATE tenants SET active = NOT active
		  WHERE id = $1 AND parent_partner_tenant_id = $2
		  RETURNING active`,
		targetID, sess.User.PartnerTenantID).Scan(&newActive)
	if err != nil {
		httpx.Message(w, http.StatusForbidden, "Você só pode ativar ou desativar empresas da sua carteira Parceira.")
		return
	}

	if !newActive {
		_, _ = tx.Exec(r.Context(),
			`DELETE FROM sessions
			  WHERE active_tenant_id = $1
			    AND user_id IN (SELECT id FROM users WHERE is_master = false)
			    AND user_id <> $2`,
			targetID, sess.User.ID)
	}

	if err := tx.Commit(r.Context()); err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao alterar status da empresa.")
		return
	}

	httpx.Write(w, http.StatusOK, map[string]any{"ok": true, "active": newActive})
}

// PartnerResendCompanyOwnerLink: POST /api/partner/companies/resend-owner-link
func (h *Handlers) PartnerResendCompanyOwnerLink(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || !sess.User.IsPartner || sess.User.PartnerTenantID == "" {
		httpx.Message(w, http.StatusForbidden, "Acesso exclusivo para empresas parceiras.")
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
		  WHERE id = $1 AND parent_partner_tenant_id = $2`,
		targetID, sess.User.PartnerTenantID).Scan(&companyName, &ownerName, &ownerEmail, &ownerUserID, &active)
	if err != nil {
		httpx.Message(w, http.StatusForbidden, "Empresa não pertence à sua carteira Parceira.")
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
		httpx.Message(w, http.StatusBadGateway, "Falha ao enviar o e-mail SMTP: "+err.Error())
		return
	}
	httpx.Write(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "Novo link do Google Authenticator enviado para " + ownerEmail + ".",
	})
}
