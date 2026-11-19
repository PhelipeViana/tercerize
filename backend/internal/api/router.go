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
		r.Post("/auth/register", authHandlers.Register)
		r.Post("/auth/login", authHandlers.Login)
		r.Post("/auth/logout", authHandlers.Logout)

		r.Group(func(r chi.Router) {
			r.Use(authHandlers.Require)
			r.Get("/me", authHandlers.Me)

			// Multi-Empresas (Nível Desenvolvedor)
			r.Post("/tenants/switch", authHandlers.SwitchTenant)
			r.Post("/tenants", opHandlers.CreateCompany)

			// 6 Módulos do Briefing Executivo
			r.Post("/clients", opHandlers.CreateClient)
			r.Post("/contracts", opHandlers.CreateContract)
			r.Post("/employees", opHandlers.CreateEmployee)
			r.Post("/epis", opHandlers.CreateEPI)
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
