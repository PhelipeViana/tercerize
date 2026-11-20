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
		// Login em 2 etapas: 1) Validar e-mail -> 2) Validar senha do Google Authenticator
		r.Post("/auth/check-email", authHandlers.CheckLoginEmail)
		r.Post("/auth/login", authHandlers.Login)
		r.Post("/auth/logout", authHandlers.Logout)

		// Recuperação de Autenticação em 2 etapas (exige CNPJ vinculado para não-Master)
		r.Post("/auth/recovery/check-email", authHandlers.RecoveryCheckEmail)
		r.Post("/auth/recovery/send-link", authHandlers.RecoverySendLink)
		r.Post("/auth/request-link", authHandlers.RequestSetupLink)
		r.Get("/auth/setup-link", authHandlers.GetSetupLink)
		r.Post("/auth/setup-link/verify", authHandlers.CompleteSetupLink)

		r.Group(func(r chi.Router) {
			r.Use(authHandlers.Require)
			r.Get("/me", authHandlers.Me)

			// Multi-Empresas (gestão exclusiva Master)
			r.Post("/tenants/switch", authHandlers.SwitchTenant)
			r.Post("/tenants", opHandlers.CreateCompany)
			r.Post("/tenants/update", opHandlers.UpdateCompany)
			r.Post("/tenants/toggle-active", opHandlers.ToggleTenantActive)

			// Roles e Permissões (exclusivo Dono da empresa ativa ou Master)
			r.Post("/rbac/roles", opHandlers.CreateOrUpdateRole)
			r.Post("/rbac/roles/delete", opHandlers.DeleteRole)
			r.Post("/rbac/members", opHandlers.AddMember)
			r.Post("/rbac/members/role", opHandlers.UpdateMemberRole)
			r.Post("/rbac/members/remove", opHandlers.RemoveMember)
			r.Post("/rbac/members/resend-link", opHandlers.ResendMemberLink)
			r.Post("/rbac/members/block", opHandlers.ToggleUserBlock)

			// 6 Módulos Operacionais
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
