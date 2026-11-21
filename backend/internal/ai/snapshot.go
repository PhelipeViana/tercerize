package ai

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"tercerize/backend/internal/auth"
)

type TenantSnapshot struct {
	GeneratedAt    string         `json:"geradoEm"`
	Company        CompanyInfo    `json:"empresa"`
	AllowedModules []string       `json:"modulosPermitidos"`
	Clients        any            `json:"clientes,omitempty"`
	Contracts      any            `json:"contratos,omitempty"`
	ServiceOrders  any            `json:"ordensServico,omitempty"`
	Employees      any            `json:"colaboradores,omitempty"`
	EPIs           any            `json:"epis,omitempty"`
	Inventory      any            `json:"almoxarifado,omitempty"`
	Finance        any            `json:"financeiro,omitempty"`
}

type CompanyInfo struct {
	Name       string `json:"razaoSocial"`
	CNPJ       string `json:"cnpj"`
	OwnerName  string `json:"responsavel"`
	OwnerEmail string `json:"emailResponsavel"`
}

// BuildTenantSnapshot coleta SOMENTE os dados da empresa instanciada (WHERE tenant_id = sess.Tenant.ID)
// respeitando estritamente as permissões de visualização da Role do usuário autenticado.
func BuildTenantSnapshot(ctx context.Context, pool *pgxpool.Pool, sess *auth.SessionContext) (*TenantSnapshot, error) {
	loc, _ := time.LoadLocation("America/Cuiaba")
	if loc == nil {
		loc = time.UTC
	}
	snap := &TenantSnapshot{
		GeneratedAt: time.Now().In(loc).Format("02/01/2006 15:04"),
		Company: CompanyInfo{
			Name:       sess.Tenant.Name,
			CNPJ:       sess.Tenant.CNPJ,
			OwnerName:  sess.Tenant.OwnerName,
			OwnerEmail: sess.Tenant.OwnerEmail,
		},
		AllowedModules: []string{},
	}
	tid := sess.Tenant.ID

	// 1. Clientes e Contratos
	if sess.HasPermission("contracts:view") {
		snap.AllowedModules = append(snap.AllowedModules, "Clientes e contratos")
		type clientItem struct {
			Name  string `json:"nome"`
			CNPJ  string `json:"cnpj"`
			Phone string `json:"telefone"`
			Email string `json:"email"`
		}
		var clients []clientItem
		if rows, err := pool.Query(ctx,
			`SELECT name, cnpj, COALESCE(phone, ''), COALESCE(email, contact)
			   FROM clients WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 80`, tid); err == nil {
			for rows.Next() {
				var c clientItem
				if rows.Scan(&c.Name, &c.CNPJ, &c.Phone, &c.Email) == nil {
					clients = append(clients, c)
				}
			}
			rows.Close()
		}
		snap.Clients = map[string]any{"total": len(clients), "lista": clients}

		type contractItem struct {
			Code           string  `json:"codigo"`
			ClientName     string  `json:"cliente"`
			Object         string  `json:"objeto"`
			Workstation    string  `json:"unidadePostos"`
			DurationMonths int     `json:"vigenciaMeses"`
			MonthlyValue   float64 `json:"valorMensal"`
			Status         string  `json:"situacao"`
		}
		var contracts []contractItem
		var activeCount int
		var monthlySum float64
		if rows, err := pool.Query(ctx,
			`SELECT c.code, cl.name, c.object, c.workstation, c.duration_months, c.monthly_value::float8, c.status
			   FROM contracts c
			   JOIN clients cl ON cl.id = c.client_id
			  WHERE c.tenant_id = $1
			  ORDER BY c.created_at DESC LIMIT 80`, tid); err == nil {
			for rows.Next() {
				var ct contractItem
				if rows.Scan(&ct.Code, &ct.ClientName, &ct.Object, &ct.Workstation, &ct.DurationMonths, &ct.MonthlyValue, &ct.Status) == nil {
					contracts = append(contracts, ct)
					if ct.Status == "Ativo" {
						activeCount++
						monthlySum += ct.MonthlyValue
					}
				}
			}
			rows.Close()
		}
		snap.Contracts = map[string]any{
			"total":               len(contracts),
			"ativos":              activeCount,
			"receitaMensalAtiva":  monthlySum,
			"lista":               contracts,
		}
	}

	// 2. Ordens de Serviço
	if sess.HasPermission("service_orders:view") {
		snap.AllowedModules = append(snap.AllowedModules, "Ordens de serviço")
		type osItem struct {
			Code         string `json:"codigo"`
			Client       string `json:"cliente"`
			Contract     string `json:"contrato"`
			Technician   string `json:"tecnico"`
			Description  string `json:"descricao"`
			Priority     string `json:"prioridade"`
			Status       string `json:"situacao"`
			ScheduledFor string `json:"agendadaPara"`
			CreatedAt    string `json:"abertaEm"`
		}
		var list []osItem
		counts := map[string]int{"Agendada": 0, "Em Execução": 0, "Concluída": 0, "UrgenteAtiva": 0}
		if rows, err := pool.Query(ctx,
			`SELECT o.code, cl.name, COALESCE(ct.code, ''), COALESCE(e.name, 'Não designado'),
			        o.description, o.priority, o.status,
			        COALESCE(to_char(o.scheduled_for AT TIME ZONE 'America/Cuiaba', 'DD/MM/YYYY HH24:MI'), ''),
			        to_char(o.created_at AT TIME ZONE 'America/Cuiaba', 'DD/MM/YYYY HH24:MI')
			   FROM service_orders o
			   JOIN clients cl ON cl.id = o.client_id
			   LEFT JOIN contracts ct ON ct.id = o.contract_id
			   LEFT JOIN employees e ON e.id = o.employee_id
			  WHERE o.tenant_id = $1
			  ORDER BY o.created_at DESC LIMIT 80`, tid); err == nil {
			for rows.Next() {
				var it osItem
				if rows.Scan(&it.Code, &it.Client, &it.Contract, &it.Technician, &it.Description, &it.Priority, &it.Status, &it.ScheduledFor, &it.CreatedAt) == nil {
					list = append(list, it)
					counts[it.Status]++
					if it.Priority == "Urgente" && it.Status != "Concluída" {
						counts["UrgenteAtiva"]++
					}
				}
			}
			rows.Close()
		}
		snap.ServiceOrders = map[string]any{"resumo": counts, "total": len(list), "lista": list}
	}

	// 3. Colaboradores e Escalas
	if sess.HasPermission("employees:view") {
		snap.AllowedModules = append(snap.AllowedModules, "Colaboradores e escalas")
		type empItem struct {
			Name     string `json:"nome"`
			Role     string `json:"funcao"`
			Contract string `json:"contrato"`
			Client   string `json:"cliente"`
			Schedule string `json:"escala"`
			Status   string `json:"situacao"`
		}
		var list []empItem
		var allocated int
		if rows, err := pool.Query(ctx,
			`SELECT e.name, e.role_title, COALESCE(ct.code, 'Reserva técnica'), COALESCE(cl.name, ''), e.schedule, e.status
			   FROM employees e
			   LEFT JOIN contracts ct ON ct.id = e.contract_id
			   LEFT JOIN clients cl ON cl.id = ct.client_id
			  WHERE e.tenant_id = $1
			  ORDER BY e.created_at DESC LIMIT 100`, tid); err == nil {
			for rows.Next() {
				var it empItem
				if rows.Scan(&it.Name, &it.Role, &it.Contract, &it.Client, &it.Schedule, &it.Status) == nil {
					list = append(list, it)
					if it.Status == "Alocado" {
						allocated++
					}
				}
			}
			rows.Close()
		}
		snap.Employees = map[string]any{"total": len(list), "alocados": allocated, "lista": list}
	}

	// 4. Controle de EPIs
	if sess.HasPermission("epis:view") {
		snap.AllowedModules = append(snap.AllowedModules, "Controle de EPIs")
		type epiItem struct {
			Employee    string `json:"colaborador"`
			EPI         string `json:"equipamento"`
			CA          string `json:"ca"`
			DeliveredAt string `json:"entrega"`
			ExpiresAt   string `json:"validadeCA"`
			DaysLeft    int    `json:"diasParaVencer"`
			Signed      bool   `json:"termoAssinado"`
			Protocol    string `json:"protocolo"`
		}
		var list []epiItem
		var pendingSign, expiringSoon int
		if rows, err := pool.Query(ctx,
			`SELECT e.name, d.epi_name, d.ca_number,
			        to_char(d.delivered_at, 'DD/MM/YYYY'),
			        to_char(d.expires_at, 'DD/MM/YYYY'),
			        (d.expires_at - CURRENT_DATE)::int,
			        d.receipt_signed, COALESCE(d.evidence_code, '')
			   FROM epi_deliveries d
			   JOIN employees e ON e.id = d.employee_id
			  WHERE d.tenant_id = $1
			  ORDER BY d.delivered_at DESC LIMIT 80`, tid); err == nil {
			for rows.Next() {
				var it epiItem
				if rows.Scan(&it.Employee, &it.EPI, &it.CA, &it.DeliveredAt, &it.ExpiresAt, &it.DaysLeft, &it.Signed, &it.Protocol) == nil {
					list = append(list, it)
					if !it.Signed {
						pendingSign++
					}
					if it.DaysLeft <= 30 {
						expiringSoon++
					}
				}
			}
			rows.Close()
		}
		snap.EPIs = map[string]any{
			"total":                len(list),
			"assinaturasPendentes": pendingSign,
			"caVencidoOuAte30Dias": expiringSoon,
			"lista":                list,
		}
	}

	// 5. Almoxarifado e Ativos
	if sess.HasPermission("inventory:view") {
		snap.AllowedModules = append(snap.AllowedModules, "Almoxarifado e ativos")
		type invItem struct {
			SKU         string  `json:"sku"`
			Description string  `json:"descricao"`
			Category    string  `json:"categoria"`
			Quantity    int     `json:"saldo"`
			Unit        string  `json:"unidade"`
			UnitValue   float64 `json:"valorUnitario"`
			MinQty      int     `json:"estoqueMinimo"`
			LowStock    bool    `json:"nivelBaixo"`
		}
		var items []invItem
		var lowCount int
		var totalValue float64
		if rows, err := pool.Query(ctx,
			`SELECT sku, description, category, quantity, unit, unit_value::float8, min_quantity
			   FROM inventory_items WHERE tenant_id = $1 ORDER BY sku ASC LIMIT 100`, tid); err == nil {
			for rows.Next() {
				var it invItem
				if rows.Scan(&it.SKU, &it.Description, &it.Category, &it.Quantity, &it.Unit, &it.UnitValue, &it.MinQty) == nil {
					it.LowStock = it.Quantity <= it.MinQty
					if it.LowStock {
						lowCount++
					}
					totalValue += float64(it.Quantity) * it.UnitValue
					items = append(items, it)
				}
			}
			rows.Close()
		}

		type movItem struct {
			Date     string `json:"data"`
			SKU      string `json:"sku"`
			Type     string `json:"operacao"`
			PrevQty  int    `json:"saldoAntes"`
			Qty      int    `json:"quantidade"`
			NewQty   int    `json:"saldoFinal"`
			Employee string `json:"responsavel"`
			OSCode   string `json:"os"`
		}
		var movs []movItem
		if rows, err := pool.Query(ctx,
			`SELECT to_char(m.created_at AT TIME ZONE 'America/Cuiaba', 'DD/MM/YYYY HH24:MI'),
			        i.sku, m.movement_type, m.previous_quantity, m.quantity, m.new_quantity,
			        COALESCE(e.name, 'Almoxarifado'), COALESCE(o.code, '')
			   FROM inventory_movements m
			   JOIN inventory_items i ON i.id = m.item_id
			   LEFT JOIN employees e ON e.id = m.employee_id
			   LEFT JOIN service_orders o ON o.id = m.service_order_id
			  WHERE m.tenant_id = $1
			  ORDER BY m.created_at DESC LIMIT 30`, tid); err == nil {
			for rows.Next() {
				var mv movItem
				if rows.Scan(&mv.Date, &mv.SKU, &mv.Type, &mv.PrevQty, &mv.Qty, &mv.NewQty, &mv.Employee, &mv.OSCode) == nil {
					movs = append(movs, mv)
				}
			}
			rows.Close()
		}
		snap.Inventory = map[string]any{
			"totalSkus":           len(items),
			"itensNivelBaixo":     lowCount,
			"valorTotalEstoque":   totalValue,
			"itens":               items,
			"ultimasMovimentacoes": movs,
		}
	}

	// 6. Gestão Financeira (SOMENTE se o usuário possuir finance:view)
	if sess.HasPermission("finance:view") {
		snap.AllowedModules = append(snap.AllowedModules, "Gestão financeira")
		type finItem struct {
			Type        string  `json:"tipo"`
			Contract    string  `json:"contrato"`
			Description string  `json:"descricao"`
			Amount      float64 `json:"valor"`
			DueDate     string  `json:"vencimento"`
			Competence  string  `json:"competencia"`
			Status      string  `json:"conciliacao"`
		}
		var entries []finItem
		var totalRec, totalDesp, recConciliada float64
		var pendentes int
		if rows, err := pool.Query(ctx,
			`SELECT f.entry_type, COALESCE(ct.code, 'Geral'), f.description, f.amount::float8,
			        to_char(f.due_date, 'DD/MM/YYYY'), to_char(f.due_date, 'MM/YYYY'), f.reconciliation_status
			   FROM financial_entries f
			   LEFT JOIN contracts ct ON ct.id = f.contract_id
			  WHERE f.tenant_id = $1
			  ORDER BY f.due_date DESC LIMIT 100`, tid); err == nil {
			for rows.Next() {
				var it finItem
				if rows.Scan(&it.Type, &it.Contract, &it.Description, &it.Amount, &it.DueDate, &it.Competence, &it.Status) == nil {
					entries = append(entries, it)
					if it.Type == "Receita" {
						totalRec += it.Amount
						if it.Status == "Conciliado" {
							recConciliada += it.Amount
						}
					} else {
						totalDesp += it.Amount
					}
					if it.Status == "Pendente" {
						pendentes++
					}
				}
			}
			rows.Close()
		}
		snap.Finance = map[string]any{
			"totalLancamentos":  len(entries),
			"totalReceitas":     totalRec,
			"receitasConciliadas": recConciliada,
			"totalDespesas":     totalDesp,
			"saldoLiquido":      totalRec - totalDesp,
			"pendentes":         pendentes,
			"lancamentos":       entries,
		}
	}

	return snap, nil
}

func (s *TenantSnapshot) JSON() string {
	b, err := json.Marshal(s)
	if err != nil {
		return "{}"
	}
	return string(b)
}
