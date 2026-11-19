package auth

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"strings"

	"tercerize/backend/internal/httpx"
)

type Handlers struct {
	repo    *Repository
	limiter *LoginLimiter
	secure  bool
	log     *slog.Logger
}

func NewHandlers(repo *Repository, limiter *LoginLimiter, cookieSecure bool, log *slog.Logger) *Handlers {
	return &Handlers{repo: repo, limiter: limiter, secure: cookieSecure, log: log}
}

type enteredResponse struct {
	Session Session `json:"session"`
}

const (
	msgServerError = "Não consegui concluir agora. Tente de novo."
	msgBadRequest  = "Pedido inválido."
)

func (h *Handlers) Register(w http.ResponseWriter, r *http.Request) {
	var in RegisterInput
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, msgBadRequest)
		return
	}
	in, errs := ValidateRegister(in)
	if errs != nil {
		httpx.Write(w, http.StatusBadRequest, map[string]any{"errors": errs})
		return
	}
	hash, err := HashPassword(in.Password)
	if err != nil {
		h.fail(w, "hash da senha", err)
		return
	}
	userID, tenantID, err := h.repo.CreateAccount(r.Context(), in.CompanyName, in.CNPJ, in.Name, in.Email, hash)
	if errors.Is(err, ErrEmailTaken) {
		httpx.Write(w, http.StatusConflict, map[string]any{"errors": FieldErrors{"email": {"Este e-mail já está cadastrado."}}})
		return
	}
	if err != nil {
		h.fail(w, "criar conta", err)
		return
	}
	h.enter(w, r, userID, tenantID, http.StatusCreated)
}

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
		httpx.Message(w, http.StatusTooManyRequests, "Muitas tentativas. Aguarde alguns minutos e tente de novo.")
		return
	}

	user, err := h.repo.FindUserForLogin(ctx, in.Email)
	if err != nil {
		h.fail(w, "buscar usuário", err)
		return
	}
	valid := false
	if user != nil {
		valid = VerifyPassword(user.PasswordHash, in.Password)
	} else {
		VerifyAgainstDummy(in.Password)
	}
	if !valid {
		if err := h.limiter.RecordFailure(ctx, key); err != nil {
			h.log.Error("limite de login indisponível", "err", err)
		}
		httpx.Message(w, http.StatusUnauthorized, "E-mail ou senha incorretos.")
		return
	}
	if err := h.limiter.Reset(ctx, key); err != nil {
		h.log.Error("limite de login indisponível", "err", err)
	}
	h.enter(w, r, user.ID, user.TenantID, http.StatusOK)
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

func (h *Handlers) SwitchTenant(w http.ResponseWriter, r *http.Request) {
	sess := SessionFromContext(r.Context())
	if sess == nil || sess.User.Role != "developer" {
		httpx.Message(w, http.StatusForbidden, "Apenas usuários de nível desenvolvedor podem alternar entre empresas.")
		return
	}
	var in struct {
		TenantID string `json:"tenantId"`
	}
	if err := httpx.Read(r, &in); err != nil || strings.TrimSpace(in.TenantID) == "" {
		httpx.Message(w, http.StatusBadRequest, msgBadRequest)
		return
	}
	if err := h.repo.SwitchActiveTenant(r.Context(), TokenFrom(r), strings.TrimSpace(in.TenantID)); err != nil {
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
