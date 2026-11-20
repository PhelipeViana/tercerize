package operations

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
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

	var exists bool
	_ = h.pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM tenants WHERE cnpj = $1)`, formattedCNPJ).Scan(&exists)
	if exists {
		httpx.Write(w, http.StatusConflict, map[string]any{
			"field":   "cnpj",
			"message": "Já existe uma empresa cadastrada com este CNPJ.",
		})
		return
	}

	var id string
	err := h.pool.QueryRow(r.Context(),
		`INSERT INTO tenants (name, cnpj, active) VALUES ($1, $2, true) RETURNING id`,
		name, formattedCNPJ).Scan(&id)
	if err != nil {
		h.log.Error("criar empresa", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao cadastrar empresa.")
		return
	}
	httpx.Write(w, http.StatusCreated, map[string]any{"id": id, "name": name, "cnpj": formattedCNPJ})
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

	var id string
	err := h.pool.QueryRow(r.Context(),
		`INSERT INTO clients (tenant_id, name, cnpj, contact)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		sess.Tenant.ID, name, formattedCNPJ, strings.TrimSpace(in.Contact)).Scan(&id)
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
	httpx.Write(w, http.StatusCreated, map[string]any{"id": id, "name": name, "cnpj": formattedCNPJ})
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
// QA-01: Locks item row with FOR UPDATE and strictly rejects outflows greater than available balance.
func (h *Handlers) CreateInventoryMovement(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
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
