package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"tercerize/backend/internal/httpx"
	"tercerize/backend/internal/mailer"
	"tercerize/backend/internal/totp"
)

type Handlers struct {
	repo    *Repository
	limiter *LoginLimiter
	mailer  *mailer.Mailer
	appName string
	appURL  string
	secure  bool
	log     *slog.Logger
}

func NewHandlers(
	repo *Repository,
	limiter *LoginLimiter,
	m *mailer.Mailer,
	appName string,
	appURL string,
	cookieSecure bool,
	log *slog.Logger,
) *Handlers {
	return &Handlers{
		repo:    repo,
		limiter: limiter,
		mailer:  m,
		appName: appName,
		appURL:  strings.TrimRight(appURL, "/"),
		secure:  cookieSecure,
		log:     log,
	}
}

type enteredResponse struct {
	Session Session `json:"session"`
}

const (
	msgServerError = "Não consegui concluir agora. Tente de novo."
	msgBadRequest  = "Pedido inválido."
)

// Login authenticates exclusively via Email + Google Authenticator 6-digit TOTP code. No exceptions.
func (h *Handlers) Login(w http.ResponseWriter, r *http.Request) {
	var in LoginInput
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, msgBadRequest)
		return
	}
	in, errs := ValidateLogin(in)
	if errs != nil {
		httpx.Write(w, http.StatusBadRequest, map[string]any{"errors": errs})
		return
	}

	ctx := r.Context()
	key := clientIP(r) + "|" + in.Email
	blocked, err := h.limiter.IsBlocked(ctx, key)
	if err != nil {
		h.log.Error("limite de login indisponível", "err", err)
	}
	if blocked {
		httpx.Message(w, http.StatusTooManyRequests, "Muitas tentativas. Aguarde alguns minutos e tente novamente.")
		return
	}

	user, err := h.repo.FindUserByEmail(ctx, in.Email)
	if err != nil {
		h.fail(w, "buscar usuário", err)
		return
	}

	valid := false
	if user != nil && user.TOTPSecret != "" {
		valid = totp.Verify(user.TOTPSecret, in.Code, time.Now())
	}
	if !valid {
		if err := h.limiter.RecordFailure(ctx, key); err != nil {
			h.log.Error("limite de login indisponível", "err", err)
		}
		httpx.Message(w, http.StatusUnauthorized, "E-mail ou código do Google Authenticator inválido.")
		return
	}

	tenantID, err := h.repo.FindDefaultTenantForUser(ctx, user.ID, user.IsMaster)
	if err != nil {
		h.fail(w, "resolver empresa padrão do usuário", err)
		return
	}
	if tenantID == "" {
		httpx.Message(w, http.StatusForbidden, "Este e-mail não está vinculado a nenhuma empresa ativa.")
		return
	}

	if err := h.limiter.Reset(ctx, key); err != nil {
		h.log.Error("limite de login indisponível", "err", err)
	}
	_ = h.repo.MarkTOTPConfigured(ctx, user.ID)
	h.enter(w, r, user.ID, tenantID, http.StatusOK)
}

// RequestSetupLink sends an email with the activation link (no QR code) for Google Authenticator configuration.
func (h *Handlers) RequestSetupLink(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email string `json:"email"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, msgBadRequest)
		return
	}
	email, msg := NormalizeEmail(in.Email)
	if msg != "" {
		httpx.Write(w, http.StatusBadRequest, map[string]any{"errors": FieldErrors{"email": {msg}}})
		return
	}

	ctx := r.Context()
	user, err := h.repo.FindUserByEmail(ctx, email)
	if err != nil {
		h.fail(w, "buscar e-mail para link do autenticador", err)
		return
	}
	if user == nil {
		// Generic response to avoid account enumeration
		httpx.Write(w, http.StatusOK, map[string]any{
			"ok":      true,
			"message": "Se o e-mail estiver cadastrado na plataforma, enviamos o link de configuração do Google Authenticator para sua caixa de entrada.",
		})
		return
	}

	tenantID, _ := h.repo.FindDefaultTenantForUser(ctx, user.ID, user.IsMaster)
	rawToken, err := h.repo.CreateSetupLink(ctx, user.ID, tenantID)
	if err != nil {
		h.fail(w, "criar link de ativação", err)
		return
	}

	activationURL := fmt.Sprintf("%s/ativar-autenticador?token=%s", h.appURL, url.QueryEscape(rawToken))
	roleLabel := "Acesso Corporativo"
	if user.IsMaster {
		roleLabel = "Acesso Master"
	}
	if err := h.mailer.SendAuthenticatorLink(user.Email, user.Name, "", roleLabel, activationURL); err != nil {
		h.log.Error("enviar e-mail do autenticador", "to", user.Email, "err", err)
		httpx.Message(w, http.StatusBadGateway, "Não foi possível enviar o e-mail no momento. Verifique as credenciais SMTP no .env.")
		return
	}

	httpx.Write(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "Enviamos o link de ativação do Google Authenticator para o seu e-mail.",
	})
}

// GetSetupLink validates the activation link token and returns the Base32 key + otpauth:// deep link (NO QR Code).
func (h *Handlers) GetSetupLink(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	info, err := h.repo.LookupSetupLink(r.Context(), token)
	if errors.Is(err, ErrInvalidSetupLink) {
		httpx.Message(w, http.StatusNotFound, "Este link de ativação é inválido ou já expirou. Solicite um novo link na tela de login.")
		return
	}
	if err != nil {
		h.fail(w, "consultar link de ativação", err)
		return
	}

	httpx.Write(w, http.StatusOK, map[string]any{
		"email":       info.UserEmail,
		"name":        info.UserName,
		"companyName": info.CompanyName,
		"roleName":    info.RoleName,
		"totpSecret":  info.TOTPSecret,
		"otpAuthUri":  totp.OTPAuthURI(h.appName, info.UserEmail, info.TOTPSecret),
	})
}

// CompleteSetupLink verifies the first 6-digit code generated by Google Authenticator, consumes the link, and starts a session.
func (h *Handlers) CompleteSetupLink(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Token string `json:"token"`
		Code  string `json:"code"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, msgBadRequest)
		return
	}
	info, err := h.repo.LookupSetupLink(r.Context(), in.Token)
	if errors.Is(err, ErrInvalidSetupLink) {
		httpx.Message(w, http.StatusNotFound, "Link de ativação inválido ou expirado.")
		return
	}
	if err != nil {
		h.fail(w, "consultar link para ativação", err)
		return
	}

	if !totp.Verify(info.TOTPSecret, in.Code, time.Now()) {
		httpx.Message(w, http.StatusUnauthorized, "Código do Google Authenticator inválido. Confirme os 6 dígitos atuais no aplicativo.")
		return
	}

	if err := h.repo.ConsumeSetupLink(r.Context(), info.LinkID, info.UserID); err != nil {
		h.fail(w, "consumir link de ativação", err)
		return
	}

	tenantID := info.TenantID
	if tenantID == "" {
		tenantID, err = h.repo.FindDefaultTenantForUser(r.Context(), info.UserID, info.IsMaster)
		if err != nil {
			h.fail(w, "resolver empresa ao ativar", err)
			return
		}
	}
	if tenantID == "" {
		httpx.Message(w, http.StatusForbidden, "Nenhuma empresa ativa vinculada a este e-mail.")
		return
	}
	h.enter(w, r, info.UserID, tenantID, http.StatusOK)
}

func (h *Handlers) Logout(w http.ResponseWriter, r *http.Request) {
	if err := h.repo.End(r.Context(), TokenFrom(r)); err != nil {
		h.fail(w, "encerrar sessão", err)
		return
	}
	http.SetCookie(w, ClearedCookie(h.secure))
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) Me(w http.ResponseWriter, r *http.Request) {
	httpx.Write(w, http.StatusOK, SessionFromContext(r.Context()))
}

// SwitchTenant allows Master to switch to any company, and any multi-company user to switch between their linked companies.
func (h *Handlers) SwitchTenant(w http.ResponseWriter, r *http.Request) {
	sess := SessionFromContext(r.Context())
	if sess == nil {
		httpx.Message(w, http.StatusUnauthorized, "Sessão inválida.")
		return
	}
	var in struct {
		TenantID string `json:"tenantId"`
	}
	if err := httpx.Read(r, &in); err != nil || strings.TrimSpace(in.TenantID) == "" {
		httpx.Message(w, http.StatusBadRequest, msgBadRequest)
		return
	}
	targetID := strings.TrimSpace(in.TenantID)
	allowed, err := h.repo.UserCanAccessTenant(r.Context(), sess.User.ID, sess.User.IsMaster, targetID)
	if err != nil {
		h.fail(w, "verificar acesso à empresa", err)
		return
	}
	if !allowed {
		httpx.Message(w, http.StatusForbidden, "Você não possui vínculo ou permissão nesta empresa.")
		return
	}
	if err := h.repo.SwitchActiveTenant(r.Context(), TokenFrom(r), targetID); err != nil {
		h.fail(w, "alternar empresa ativa", err)
		return
	}
	httpx.Write(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handlers) enter(w http.ResponseWriter, r *http.Request, userID, tenantID string, status int) {
	session, err := h.repo.Start(r.Context(), userID, tenantID)
	if err != nil {
		h.fail(w, "abrir sessão", err)
		return
	}
	http.SetCookie(w, Cookie(session, h.secure))
	httpx.Write(w, status, enteredResponse{Session: session})
}

func (h *Handlers) fail(w http.ResponseWriter, what string, err error) {
	h.log.Error(what, "err", err)
	httpx.Message(w, http.StatusInternalServerError, msgServerError)
}

func clientIP(r *http.Request) string {
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		if first := strings.TrimSpace(strings.Split(forwarded, ",")[0]); first != "" {
			return first
		}
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return "local"
}

type ctxKey struct{}

func (h *Handlers) Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, err := h.repo.Lookup(r.Context(), TokenFrom(r))
		if err != nil {
			h.fail(w, "ler sessão", err)
			return
		}
		if session == nil {
			httpx.Message(w, http.StatusUnauthorized, "Entre para continuar.")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, session)))
	})
}

func SessionFromContext(ctx context.Context) *SessionContext {
	s, _ := ctx.Value(ctxKey{}).(*SessionContext)
	return s
}
