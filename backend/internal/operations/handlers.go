package operations

import (
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"tercerize/backend/internal/auth"
	"tercerize/backend/internal/httpx"
)

type Handlers struct {
	pool *pgxpool.Pool
	log  *slog.Logger
}

func NewHandlers(pool *pgxpool.Pool, log *slog.Logger) *Handlers {
	return &Handlers{pool: pool, log: log}
}

// CreateCompany: POST /api/tenants (exclusivo para role = 'developer')
func (h *Handlers) CreateCompany(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || sess.User.Role != "developer" {
		httpx.Message(w, http.StatusForbidden, "Apenas desenvolvedores podem cadastrar novas empresas.")
		return
	}
	var in struct {
		Name string `json:"name"`
		CNPJ string `json:"cnpj"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	name := strings.TrimSpace(in.Name)
	cnpj := strings.TrimSpace(in.CNPJ)
	if name == "" || cnpj == "" {
		httpx.Message(w, http.StatusBadRequest, "Informe a Razão Social e o CNPJ da empresa.")
		return
	}
	var id string
	err := h.pool.QueryRow(r.Context(),
		`INSERT INTO tenants (name, cnpj, active) VALUES ($1, $2, true) RETURNING id`,
		name, cnpj).Scan(&id)
	if err != nil {
		h.log.Error("criar empresa", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao cadastrar empresa.")
		return
	}
	httpx.Write(w, http.StatusCreated, map[string]any{"id": id})
}

// CreateClient: POST /api/clients
func (h *Handlers) CreateClient(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	var in struct {
		Name    string `json:"name"`
		CNPJ    string `json:"cnpj"`
		Contact string `json:"contact"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	name := strings.TrimSpace(in.Name)
	cnpj := strings.TrimSpace(in.CNPJ)
	if name == "" || cnpj == "" {
		httpx.Message(w, http.StatusBadRequest, "Informe o nome do cliente tomador e o CNPJ.")
		return
	}
	var id string
	err := h.pool.QueryRow(r.Context(),
		`INSERT INTO clients (tenant_id, name, cnpj, contact)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		sess.Tenant.ID, name, cnpj, strings.TrimSpace(in.Contact)).Scan(&id)
	if err != nil {
		h.log.Error("criar cliente", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao cadastrar cliente.")
		return
	}
	httpx.Write(w, http.StatusCreated, map[string]any{"id": id})
}

// CreateContract: POST /api/contracts
func (h *Handlers) CreateContract(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
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
		httpx.Message(w, http.StatusBadRequest, "Selecione o Cliente Tomador e informe o Objeto/Escopo do contrato.")
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
	httpx.Write(w, http.StatusCreated, map[string]any{"id": id, "code": code})
}

// CreateEmployee: POST /api/employees
func (h *Handlers) CreateEmployee(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
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
		schedule = "Comercial 44h (Seg-Sex)"
	}
	status := strings.TrimSpace(in.Status)
	if status != "Alocado" && status != "Disponível" && status != "Afastado" {
		status = "Alocado"
	}
	var contractPtr *string
	if strings.TrimSpace(in.ContractID) != "" {
		c := strings.TrimSpace(in.ContractID)
		contractPtr = &c
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
	httpx.Write(w, http.StatusCreated, map[string]any{"id": id})
}

// CreateEPI: POST /api/epis
func (h *Handlers) CreateEPI(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	var in struct {
		EmployeeID string `json:"employeeId"`
		EPIName    string `json:"epiName"`
		CANumber   string `json:"caNumber"`
		ExpiresAt  string `json:"expiresAt"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	if strings.TrimSpace(in.EmployeeID) == "" || strings.TrimSpace(in.EPIName) == "" || strings.TrimSpace(in.CANumber) == "" {
		httpx.Message(w, http.StatusBadRequest, "Informe o colaborador, o EPI e o número do CA.")
		return
	}
	expiresAt := strings.TrimSpace(in.ExpiresAt)
	if expiresAt == "" {
		expiresAt = "2027-11-19"
	}
	var id string
	err := h.pool.QueryRow(r.Context(),
		`INSERT INTO epi_deliveries (tenant_id, employee_id, epi_name, ca_number, expires_at, receipt_signed)
		 VALUES ($1, $2, $3, $4, $5::date, true) RETURNING id`,
		sess.Tenant.ID, in.EmployeeID, strings.TrimSpace(in.EPIName), strings.TrimSpace(in.CANumber), expiresAt).Scan(&id)
	if err != nil {
		h.log.Error("registrar EPI", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao registrar entrega de EPI.")
		return
	}
	httpx.Write(w, http.StatusCreated, map[string]any{"id": id})
}

// CreateInventoryItem: POST /api/inventory-items
func (h *Handlers) CreateInventoryItem(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
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
	var in struct {
		ItemID       string `json:"itemId"`
		EmployeeID   string `json:"employeeId"`
		MovementType string `json:"movementType"`
		Quantity     int    `json:"quantity"`
		Notes        string `json:"notes"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	if strings.TrimSpace(in.ItemID) == "" || in.Quantity <= 0 {
		httpx.Message(w, http.StatusBadRequest, "Selecione o item e informe uma quantidade válida.")
		return
	}
	mType := strings.TrimSpace(in.MovementType)
	if mType != "Entrada" && mType != "Saída" && mType != "Cautela" && mType != "Devolução" {
		mType = "Saída"
	}

	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro interno.")
		return
	}
	defer tx.Rollback(r.Context())

	delta := in.Quantity
	if mType == "Saída" || mType == "Cautela" {
		delta = -in.Quantity
	}

	var newQty int
	err = tx.QueryRow(r.Context(),
		`UPDATE inventory_items
		 SET quantity = GREATEST(0, quantity + $1)
		 WHERE id = $2 AND tenant_id = $3
		 RETURNING quantity`,
		delta, in.ItemID, sess.Tenant.ID).Scan(&newQty)
	if err != nil {
		httpx.Message(w, http.StatusBadRequest, "Item não encontrado nesta empresa.")
		return
	}

	var empPtr *string
	if strings.TrimSpace(in.EmployeeID) != "" {
		e := strings.TrimSpace(in.EmployeeID)
		empPtr = &e
	}

	var movID string
	err = tx.QueryRow(r.Context(),
		`INSERT INTO inventory_movements (tenant_id, item_id, employee_id, movement_type, quantity, notes)
		 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		sess.Tenant.ID, in.ItemID, empPtr, mType, in.Quantity, strings.TrimSpace(in.Notes)).Scan(&movID)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao registrar movimentação.")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao confirmar movimentação.")
		return
	}
	httpx.Write(w, http.StatusCreated, map[string]any{"id": movID, "newQuantity": newQty})
}

// CreateServiceOrder: POST /api/service-orders
func (h *Handlers) CreateServiceOrder(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	var in struct {
		ClientID    string `json:"clientId"`
		EmployeeID  string `json:"employeeId"`
		Description string `json:"description"`
		Priority    string `json:"priority"`
		Status      string `json:"status"`
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

	var id string
	err := h.pool.QueryRow(r.Context(),
		`INSERT INTO service_orders (tenant_id, client_id, employee_id, code, description, priority, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		sess.Tenant.ID, in.ClientID, empPtr, code, strings.TrimSpace(in.Description), priority, status).Scan(&id)
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
		httpx.Message(w, http.StatusBadRequest, "Informe a descrição e o valor do lançamento.")
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
		dueDate = "2026-11-30"
	}
	var contractPtr *string
	if strings.TrimSpace(in.ContractID) != "" {
		c := strings.TrimSpace(in.ContractID)
		contractPtr = &c
	}

	var id string
	err := h.pool.QueryRow(r.Context(),
		`INSERT INTO financial_entries (tenant_id, contract_id, entry_type, description, amount, due_date, reconciliation_status)
		 VALUES ($1, $2, $3, $4, $5, $6::date, $7) RETURNING id`,
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
	var in struct {
		ID string `json:"id"`
	}
	if err := httpx.Read(r, &in); err != nil || strings.TrimSpace(in.ID) == "" {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	_, err := h.pool.Exec(r.Context(),
		`UPDATE financial_entries
		 SET reconciliation_status = CASE WHEN reconciliation_status = 'Conciliado' THEN 'Pendente' ELSE 'Conciliado' END
		 WHERE id = $1 AND tenant_id = $2`,
		in.ID, sess.Tenant.ID)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao conciliar lançamento.")
		return
	}
	httpx.Write(w, http.StatusOK, map[string]any{"ok": true})
}
