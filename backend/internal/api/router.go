package api

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"tercerize/backend/internal/auth"
	"tercerize/backend/internal/operations"
)

func New(pool *pgxpool.Pool, authHandlers *auth.Handlers, opHandlers *operations.Handlers) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := pool.Ping(ctx); err != nil {
			http.Error(w, "banco indisponível", http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	r.Route("/api", func(r chi.Router) {
		// Autenticação exclusiva via E-mail + Google Authenticator (TOTP) e link enviado por e-mail
		r.Post("/auth/login", authHandlers.Login)
		r.Post("/auth/logout", authHandlers.Logout)
		r.Post("/auth/request-link", authHandlers.RequestSetupLink)
		r.Get("/auth/setup-link", authHandlers.GetSetupLink)
		r.Post("/auth/setup-link/verify", authHandlers.CompleteSetupLink)

		r.Group(func(r chi.Router) {
			r.Use(authHandlers.Require)
			r.Get("/me", authHandlers.Me)

			// Multi-Empresas (troca para Master ou usuários vinculados a múltiplas empresas; criação exclusiva Master)
			r.Post("/tenants/switch", authHandlers.SwitchTenant)
			r.Post("/tenants", opHandlers.CreateCompany)

			// Roles e Permissões (exclusivo Dono da empresa ativa ou Master)
			r.Post("/rbac/roles", opHandlers.CreateOrUpdateRole)
			r.Post("/rbac/roles/delete", opHandlers.DeleteRole)
			r.Post("/rbac/members", opHandlers.AddMember)
			r.Post("/rbac/members/role", opHandlers.UpdateMemberRole)
			r.Post("/rbac/members/remove", opHandlers.RemoveMember)
			r.Post("/rbac/members/resend-link", opHandlers.ResendMemberLink)

			// 6 Módulos Operacionais (com validação de permissão por módulo)
			r.Post("/clients", opHandlers.CreateClient)
			r.Post("/contracts", opHandlers.CreateContract)
			r.Post("/employees", opHandlers.CreateEmployee)
			r.Post("/employees/schedule", opHandlers.UpdateEmployeeSchedule)
			r.Post("/epis", opHandlers.CreateEPI)
			r.Post("/epis/sign", opHandlers.SignEPI)
			r.Post("/inventory-items", opHandlers.CreateInventoryItem)
			r.Post("/inventory-movements", opHandlers.CreateInventoryMovement)
			r.Post("/service-orders", opHandlers.CreateServiceOrder)
			r.Post("/service-orders/status", opHandlers.UpdateServiceOrderStatus)
			r.Post("/financial-entries", opHandlers.CreateFinancialEntry)
			r.Post("/financial-entries/reconcile", opHandlers.ReconcileFinancialEntry)
		})
	})

	return r
}
