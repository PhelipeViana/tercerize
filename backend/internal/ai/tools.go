package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"tercerize/backend/internal/auth"
)

// Citation representa uma referência interna clicável retornada ao frontend.
type Citation struct {
	Code   string `json:"code"`
	Module string `json:"module"`
	Href   string `json:"href"`
	Label  string `json:"label"`
}

// CompanyKPIs contém indicadores agregados determinísticos (100% precisos, sem LIMIT 80).
type CompanyKPIs struct {
	TenantName     string         `json:"empresa"`
	ReferenceDate  string         `json:"dataReferencia"`
	AllowedModules []string       `json:"modulosLiberados"`
	Contracts      map[string]any `json:"contratos,omitempty"`
	Employees      map[string]any `json:"colaboradores,omitempty"`
	EPIs           map[string]any `json:"epis,omitempty"`
	Inventory      map[string]any `json:"almoxarifado,omitempty"`
	ServiceOrders  map[string]any `json:"ordensServico,omitempty"`
	Finance        map[string]any `json:"financeiro,omitempty"`
}

// GetCompanyKPIs calcula totais e agregações reais direto do PostgreSQL com cache Redis
// versionado atomicamente por (ai_data_version, ai_rbac_version) — 0ms de janela de staleness.
func GetCompanyKPIs(ctx context.Context, pool *pgxpool.Pool, rdb *redis.Client, sess *auth.SessionContext, dataVersion, rbacVersion int64) (*CompanyKPIs, error) {
	tenantID := sess.Tenant.ID
	modules := allowedKnowledgeModules(sess)
	modKey := strings.Join(modules, ",")
	refDate := time.Now().Format("02/01/2006")

	cacheKey := ""
	if rdb != nil {
		cacheKey = fmt.Sprintf("ai:kpi:v2:%s:%d:%d:%s:%s", tenantID, dataVersion, rbacVersion, refDate, modKey)
		if raw, err := rdb.Get(ctx, cacheKey).Bytes(); err == nil && len(raw) > 0 {
			var cached CompanyKPIs
			if json.Unmarshal(raw, &cached) == nil {
				return &cached, nil
			}
		}
	}

	kpis := &CompanyKPIs{
		TenantName:     sess.Tenant.Name,
		ReferenceDate:  refDate,
		AllowedModules: modules,
	}

	if sess.HasPermission("contracts:view") {
		var clientsTotal, contractsTotal, activeCount, suspendedCount, closedCount int
		var activeMRR, totalMRR float64
		if err := pool.QueryRow(ctx, `
			SELECT (SELECT count(*)::int FROM clients WHERE tenant_id = $1),
			       count(*)::int,
			       count(*) FILTER (WHERE status = 'Ativo')::int,
			       count(*) FILTER (WHERE status = 'Suspenso')::int,
			       count(*) FILTER (WHERE status = 'Encerrado')::int,
			       COALESCE(sum(monthly_value) FILTER (WHERE status = 'Ativo'), 0)::float8,
			       COALESCE(sum(monthly_value), 0)::float8
			  FROM contracts
			 WHERE tenant_id = $1`, tenantID).
			Scan(&clientsTotal, &contractsTotal, &activeCount, &suspendedCount, &closedCount, &activeMRR, &totalMRR); err != nil {
			return nil, fmt.Errorf("kpis contratos: %w", err)
		}
		kpis.Contracts = map[string]any{
			"totalClientes":          clientsTotal,
			"totalContratos":         contractsTotal,
			"contratosAtivos":        activeCount,
			"contratosSuspensos":     suspendedCount,
			"contratosEncerrados":    closedCount,
			"receitaMensalAtivaBRL":  round2(activeMRR),
			"receitaMensalTotalBRL":  round2(totalMRR),
		}
	}

	if sess.HasPermission("employees:view") {
		var total, allocated, available, onLeave int
		if err := pool.QueryRow(ctx, `
			SELECT count(*)::int,
			       count(*) FILTER (WHERE status = 'Alocado')::int,
			       count(*) FILTER (WHERE status = 'Disponível')::int,
			       count(*) FILTER (WHERE status = 'Afastado')::int
			  FROM employees
			 WHERE tenant_id = $1`, tenantID).
			Scan(&total, &allocated, &available, &onLeave); err != nil {
			return nil, fmt.Errorf("kpis colaboradores: %w", err)
		}
		kpis.Employees = map[string]any{
			"totalColaboradores": total,
			"alocados":           allocated,
			"disponiveis":        available,
			"afastados":          onLeave,
		}
	}

	if sess.HasPermission("epis:view") {
		var total, expired, expiring30d, unsigned int
		if err := pool.QueryRow(ctx, `
			SELECT count(*)::int,
			       count(*) FILTER (WHERE expires_at < CURRENT_DATE)::int,
			       count(*) FILTER (WHERE expires_at >= CURRENT_DATE AND expires_at <= CURRENT_DATE + interval '30 days')::int,
			       count(*) FILTER (WHERE receipt_signed = false)::int
			  FROM epi_deliveries
			 WHERE tenant_id = $1`, tenantID).
			Scan(&total, &expired, &expiring30d, &unsigned); err != nil {
			return nil, fmt.Errorf("kpis epis: %w", err)
		}
		kpis.EPIs = map[string]any{
			"totalEntregas":       total,
			"vencidos":            expired,
			"venceEm30Dias":       expiring30d,
			"pendentesAssinatura": unsigned,
		}
	}

	if sess.HasPermission("inventory:view") {
		var totalItems, lowStock, totalUnits, totalMovements int
		var totalValue float64
		if err := pool.QueryRow(ctx, `
			SELECT count(*)::int,
			       count(*) FILTER (WHERE quantity <= min_quantity)::int,
			       COALESCE(sum(quantity), 0)::int,
			       COALESCE(sum(quantity * unit_value), 0)::float8,
			       (SELECT count(*)::int FROM inventory_movements WHERE tenant_id = $1)
			  FROM inventory_items
			 WHERE tenant_id = $1`, tenantID).
			Scan(&totalItems, &lowStock, &totalUnits, &totalValue, &totalMovements); err != nil {
			return nil, fmt.Errorf("kpis almoxarifado: %w", err)
		}
		kpis.Inventory = map[string]any{
			"totalItens":            totalItems,
			"abaixoDoMinimo":        lowStock,
			"unidadesEmEstoque":     totalUnits,
			"valorTotalEstoqueBRL":  round2(totalValue),
			"totalMovimentacoes":    totalMovements,
		}
	}

	if sess.HasPermission("service_orders:view") {
		var total, scheduled, inProgress, completed, urgentOpen, highOpen int
		if err := pool.QueryRow(ctx, `
			SELECT count(*)::int,
			       count(*) FILTER (WHERE status = 'Agendada')::int,
			       count(*) FILTER (WHERE status = 'Em Execução')::int,
			       count(*) FILTER (WHERE status = 'Concluída')::int,
			       count(*) FILTER (WHERE status <> 'Concluída' AND priority = 'Urgente')::int,
			       count(*) FILTER (WHERE status <> 'Concluída' AND priority = 'Alta')::int
			  FROM service_orders
			 WHERE tenant_id = $1`, tenantID).
			Scan(&total, &scheduled, &inProgress, &completed, &urgentOpen, &highOpen); err != nil {
			return nil, fmt.Errorf("kpis os: %w", err)
		}
		kpis.ServiceOrders = map[string]any{
			"totalOS":            total,
			"agendadas":          scheduled,
			"emExecucao":         inProgress,
			"concluidas":         completed,
			"abertasUrgentes":    urgentOpen,
			"abertasAltaPrior":   highOpen,
		}
	}

	if sess.HasPermission("finance:view") {
		var totalEntries, pendingCount, overdueCount int
		var revenues, expenses, pendingRevenues, pendingExpenses, overdueTotal float64
		if err := pool.QueryRow(ctx, `
			SELECT count(*)::int,
			       COALESCE(sum(amount) FILTER (WHERE entry_type = 'Receita'), 0)::float8,
			       COALESCE(sum(amount) FILTER (WHERE entry_type = 'Despesa'), 0)::float8,
			       COALESCE(sum(amount) FILTER (WHERE entry_type = 'Receita' AND reconciliation_status = 'Pendente'), 0)::float8,
			       COALESCE(sum(amount) FILTER (WHERE entry_type = 'Despesa' AND reconciliation_status = 'Pendente'), 0)::float8,
			       count(*) FILTER (WHERE reconciliation_status = 'Pendente')::int,
			       count(*) FILTER (WHERE reconciliation_status = 'Pendente' AND due_date < CURRENT_DATE)::int,
			       COALESCE(sum(amount) FILTER (WHERE reconciliation_status = 'Pendente' AND due_date < CURRENT_DATE), 0)::float8
			  FROM financial_entries
			 WHERE tenant_id = $1`, tenantID).
			Scan(&totalEntries, &revenues, &expenses, &pendingRevenues, &pendingExpenses, &pendingCount, &overdueCount, &overdueTotal); err != nil {
			return nil, fmt.Errorf("kpis financeiro: %w", err)
		}
		kpis.Finance = map[string]any{
			"totalLancamentos":       totalEntries,
			"totalReceitasBRL":       round2(revenues),
			"totalDespesasBRL":       round2(expenses),
			"saldoConsolidadoBRL":    round2(revenues - expenses),
			"receitasPendentesBRL":   round2(pendingRevenues),
			"despesasPendentesBRL":   round2(pendingExpenses),
			"lancamentosPendentes":   pendingCount,
			"lancamentosAtrasados":   overdueCount,
			"valorTotalAtrasadoBRL":  round2(overdueTotal),
		}
	}

	if rdb != nil && cacheKey != "" {
		if encoded, err := json.Marshal(kpis); err == nil {
			_ = rdb.Set(ctx, cacheKey, encoded, 10*time.Minute).Err()
		}
	}
	return kpis, nil
}

// ToolExecutor encapsula a execução segura das 9 ferramentas somente-leitura travadas por tenant + RBAC.
type ToolExecutor struct {
	pool        *pgxpool.Pool
	rdb         *redis.Client
	knowledge   *KnowledgeWorker
	sess        *auth.SessionContext
	apiToken    string
	dataVersion int64
	rbacVersion int64
	citations   map[string]Citation
	citOrder    []string
	dbMs        int64
	knowledgeMs int64
}

func NewToolExecutor(pool *pgxpool.Pool, rdb *redis.Client, knowledge *KnowledgeWorker, sess *auth.SessionContext, apiToken string, dataVersion, rbacVersion int64) *ToolExecutor {
	return &ToolExecutor{
		pool:        pool,
		rdb:         rdb,
		knowledge:   knowledge,
		sess:        sess,
		apiToken:    apiToken,
		dataVersion: dataVersion,
		rbacVersion: rbacVersion,
		citations:   make(map[string]Citation),
	}
}

func (e *ToolExecutor) ToolDBMs() int64        { return e.dbMs }
func (e *ToolExecutor) ToolKnowledgeMs() int64 { return e.knowledgeMs }

func (e *ToolExecutor) Citations() []Citation {
	out := make([]Citation, 0, len(e.citOrder))
	for _, k := range e.citOrder {
		out = append(out, e.citations[k])
	}
	return out
}

func (e *ToolExecutor) addCitation(code, module, label string) {
	clean := strings.TrimSpace(code)
	if clean == "" || len(e.citOrder) >= 16 {
		return
	}
	key := module + ":" + clean
	if _, exists := e.citations[key]; exists {
		return
	}
	hrefMap := map[string]string{
		"contracts":      "/admin/contracts",
		"service_orders": "/admin/service-orders",
		"employees":      "/admin/employees",
		"epis":           "/admin/epis",
		"inventory":      "/admin/inventory-items",
		"finance":        "/admin/finance",
	}
	href := hrefMap[module]
	if href == "" {
		href = "/admin"
	}
	e.citations[key] = Citation{Code: clean, Module: module, Href: href, Label: label}
	e.citOrder = append(e.citOrder, key)
}

// Definitions retorna apenas as ferramentas cujas permissões a Role do usuário possui.
func (e *ToolExecutor) Definitions() []ToolDef {
	defs := []ToolDef{
		{
			Type: "function",
			Function: ToolFunctionDef{
				Name:        "get_company_kpis",
				Description: "Retorna todos os KPIs e totais exatos (COUNT/SUM reais sem truncamento) de todos os módulos liberados da empresa.",
				Parameters:  map[string]any{"type": "object", "properties": map[string]any{}},
			},
		},
		{
			Type: "function",
			Function: ToolFunctionDef{
				Name:        "search_knowledge",
				Description: "Busca híbrida (FTS + trigram + semântica) em contratos, clientes, OS, colaboradores, EPIs, estoque e financeiro. Use para localizar códigos, nomes com erro de digitação ou termos descritivos.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"query": map[string]any{"type": "string", "description": "Termo, código (CTR-, OS-, CA-, SKU-) ou pergunta de busca"},
						"limit": map[string]any{"type": "integer", "description": "Quantidade máxima de resultados (1 a 15, padrão 8)"},
					},
					"required": []string{"query"},
				},
			},
		},
		{
			Type: "function",
			Function: ToolFunctionDef{
				Name:        "get_entity_relations",
				Description: "Expansão de subgrafo 1-hop: dado um código ou nome de contrato, cliente, OS ou colaborador, retorna todas as entidades diretamente ligadas.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"entity_type": map[string]any{"type": "string", "enum": []string{"contract", "client", "employee", "service_order"}},
						"term":        map[string]any{"type": "string", "description": "Código (ex: CTR-001, OS-2026-010) ou parte do nome"},
					},
					"required": []string{"entity_type", "term"},
				},
			},
		},
	}

	if e.sess.HasPermission("contracts:view") {
		defs = append(defs, ToolDef{
			Type: "function",
			Function: ToolFunctionDef{
				Name:        "query_clients",
				Description: "Lista clientes tomadores cadastrados da empresa (com quantidade de contratos e receita mensal ativa), ordenáveis alfabeticamente.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"search": map[string]any{"type": "string", "description": "Filtro opcional por parte do nome do cliente"},
						"limit":  map[string]any{"type": "integer", "description": "Limite de clientes (padrão 100, máx 200)"},
					},
				},
			},
		})
		defs = append(defs, ToolDef{
			Type: "function",
			Function: ToolFunctionDef{
				Name:        "query_contracts",
				Description: "Lista e agrega contratos da empresa com filtros opcionais de status, cliente, valor mínimo e ordenação.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"status":      map[string]any{"type": "string", "enum": []string{"Ativo", "Suspenso", "Encerrado", ""}},
						"client_name": map[string]any{"type": "string", "description": "Filtro parcial pelo nome do cliente"},
						"min_value":   map[string]any{"type": "number", "description": "Valor mensal mínimo em R$"},
						"limit":       map[string]any{"type": "integer", "description": "Limite de linhas (padrão 30, máx 100)"},
					},
				},
			},
		})
	}

	if e.sess.HasPermission("service_orders:view") {
		defs = append(defs, ToolDef{
			Type: "function",
			Function: ToolFunctionDef{
				Name:        "query_service_orders",
				Description: "Consulta Ordens de Serviço (OS) com filtros por status, prioridade, cliente, últimos N dias ou busca textual.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"status":    map[string]any{"type": "string", "enum": []string{"Agendada", "Em Execução", "Concluída", "abertas", ""}},
						"priority":  map[string]any{"type": "string", "enum": []string{"Normal", "Alta", "Urgente", ""}},
						"client":    map[string]any{"type": "string", "description": "Filtro parcial por nome do cliente"},
						"last_days": map[string]any{"type": "integer", "description": "Filtrar criadas nos últimos N dias (ex: 30)"},
						"limit":     map[string]any{"type": "integer", "description": "Limite de linhas (padrão 30, máx 100)"},
					},
				},
			},
		})
	}

	if e.sess.HasPermission("employees:view") || e.sess.HasPermission("epis:view") {
		defs = append(defs, ToolDef{
			Type: "function",
			Function: ToolFunctionDef{
				Name:        "query_employees_and_epis",
				Description: "Consulta colaboradores (alocação/escala/status) e entregas de EPIs (vencidos, a vencer em 30 dias ou pendentes de assinatura).",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"mode": map[string]any{"type": "string", "enum": []string{"employees", "epis_alerts", "epis_all"}, "description": "Tipo de listagem desejada"},
						"status": map[string]any{"type": "string", "description": "Status do colaborador (Alocado, Disponível, Afastado)"},
						"limit":  map[string]any{"type": "integer", "description": "Limite de linhas (padrão 30, máx 100)"},
					},
				},
			},
		})
	}

	if e.sess.HasPermission("inventory:view") {
		defs = append(defs, ToolDef{
			Type: "function",
			Function: ToolFunctionDef{
				Name:        "query_inventory",
				Description: "Consulta itens do almoxarifado (todos ou abaixo do mínimo) e movimentações recentes.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"only_low_stock":     map[string]any{"type": "boolean", "description": "Se true, retorna apenas itens com saldo <= mínimo"},
						"include_movements":  map[string]any{"type": "boolean", "description": "Se true, inclui últimas movimentações"},
						"limit":              map[string]any{"type": "integer", "description": "Limite de linhas (padrão 30, máx 100)"},
					},
				},
			},
		})
	}

	if e.sess.HasPermission("finance:view") {
		defs = append(defs, ToolDef{
			Type: "function",
			Function: ToolFunctionDef{
				Name:        "query_financial_summary",
				Description: "Consulta lançamentos financeiros filtrados (Receita/Despesa, Pendente/Conciliado, atrasados, mês YYYY-MM) e comparativo mensal.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"entry_type":    map[string]any{"type": "string", "enum": []string{"Receita", "Despesa", ""}},
						"status":        map[string]any{"type": "string", "enum": []string{"Pendente", "Conciliado", "atrasados", ""}},
						"month":         map[string]any{"type": "string", "description": "Competência YYYY-MM (opcional)"},
						"last_days":     map[string]any{"type": "integer", "description": "Últimos N dias de vencimento (opcional)"},
						"monthly_chart": map[string]any{"type": "boolean", "description": "Se true, inclui resumo agregado mês a mês"},
						"limit":         map[string]any{"type": "integer", "description": "Limite de lançamentos detalhados (padrão 35, máx 100)"},
					},
				},
			},
		})
	}

	return defs
}

// ToolStatusLabel retorna uma frase amigável em PT-BR para exibir no stream SSE enquanto a tool executa.
func ToolStatusLabel(name string) string {
	switch name {
	case "get_company_kpis":
		return "Calculando indicadores reais da empresa..."
	case "search_knowledge":
		return "Executando busca híbrida nos registros..."
	case "query_clients":
		return "Consultando lista de clientes..."
	case "query_contracts":
		return "Consultando contratos e clientes..."
	case "query_service_orders":
		return "Consultando ordens de serviço..."
	case "query_employees_and_epis":
		return "Consultando colaboradores e conformidade de EPIs..."
	case "query_inventory":
		return "Verificando saldos do almoxarifado..."
	case "query_financial_summary":
		return "Consolidando lançamentos e saldo financeiro..."
	case "get_entity_relations":
		return "Cruzando relações do registro no subgrafo..."
	default:
		return "Consultando dados da empresa..."
	}
}

// Execute executa uma tool pelo nome, validando RBAC e isolamento de tenant_id.
func (e *ToolExecutor) Execute(ctx context.Context, name, rawArgs string) string {
	var args map[string]any
	if strings.TrimSpace(rawArgs) != "" {
		_ = json.Unmarshal([]byte(rawArgs), &args)
	}
	if args == nil {
		args = map[string]any{}
	}

	var out any
	var err error
	t0 := time.Now()

	switch name {
	case "get_company_kpis":
		out, err = GetCompanyKPIs(ctx, e.pool, e.rdb, e.sess, e.dataVersion, e.rbacVersion)
		e.dbMs += time.Since(t0).Milliseconds()
	case "search_knowledge":
		out, err = e.execSearchKnowledge(ctx, args)
		e.knowledgeMs += time.Since(t0).Milliseconds()
	case "query_clients":
		out, err = e.execQueryClients(ctx, args)
		e.dbMs += time.Since(t0).Milliseconds()
	case "query_contracts":
		out, err = e.execQueryContracts(ctx, args)
		e.dbMs += time.Since(t0).Milliseconds()
	case "query_service_orders":
		out, err = e.execQueryServiceOrders(ctx, args)
		e.dbMs += time.Since(t0).Milliseconds()
	case "query_employees_and_epis":
		out, err = e.execQueryEmployeesAndEPIs(ctx, args)
		e.dbMs += time.Since(t0).Milliseconds()
	case "query_inventory":
		out, err = e.execQueryInventory(ctx, args)
		e.dbMs += time.Since(t0).Milliseconds()
	case "query_financial_summary":
		out, err = e.execQueryFinancial(ctx, args)
		e.dbMs += time.Since(t0).Milliseconds()
	case "get_entity_relations":
		out, err = e.execEntityRelations(ctx, args)
		e.dbMs += time.Since(t0).Milliseconds()
	default:
		return `{"erro":"ferramenta não reconhecida"}`
	}

	if err != nil {
		b, _ := json.Marshal(map[string]string{"erro": err.Error()})
		return string(b)
	}
	b, err := json.Marshal(out)
	if err != nil {
		return `{"erro":"falha ao serializar resultado"}`
	}
	return truncateRunes(string(b), 14000)
}

func (e *ToolExecutor) execSearchKnowledge(ctx context.Context, args map[string]any) (any, error) {
	if e.knowledge == nil {
		return map[string]any{"resultados": []any{}}, nil
	}
	q := argString(args, "query")
	lim := argInt(args, "limit", 8, 1, 15)
	hits, err := e.knowledge.HybridSearch(ctx, e.sess.Tenant.ID, e.apiToken, q, allowedKnowledgeModules(e.sess), lim)
	if err != nil {
		return nil, err
	}
	for _, h := range hits {
		if code, ok := h.Metadata["code"].(string); ok && code != "" {
			e.addCitation(code, h.ModuleKey, code)
		}
	}
	return map[string]any{
		"totalEncontrados": len(hits),
		"resultados":       hits,
	}, nil
}

func (e *ToolExecutor) execQueryClients(ctx context.Context, args map[string]any) (any, error) {
	if !e.sess.HasPermission("contracts:view") {
		return map[string]string{"erro": "Perfil atual não possui permissão para visualizar clientes."}, nil
	}
	search := argString(args, "search")
	lim := argInt(args, "limit", 100, 1, 200)

	var totalClients int
	_ = e.pool.QueryRow(ctx, `
		SELECT count(*)::int
		  FROM clients
		 WHERE tenant_id = $1
		   AND ($2 = '' OR name ILIKE '%' || $2 || '%')`,
		e.sess.Tenant.ID, search).Scan(&totalClients)

	rows, err := e.pool.Query(ctx, `
		SELECT cl.name,
		       count(c.id)::int AS contracts_total,
		       count(c.id) FILTER (WHERE c.status = 'Ativo')::int AS contracts_active,
		       COALESCE(sum(c.monthly_value) FILTER (WHERE c.status = 'Ativo'), 0)::float8 AS active_mrr
		  FROM clients cl
		  LEFT JOIN contracts c ON c.client_id = cl.id AND c.tenant_id = cl.tenant_id
		 WHERE cl.tenant_id = $1
		   AND ($2 = '' OR cl.name ILIKE '%' || $2 || '%')
		 GROUP BY cl.id, cl.name
		 ORDER BY lower(cl.name) ASC, cl.id ASC
		 LIMIT $3`,
		e.sess.Tenant.ID, search, lim)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type clientRow struct {
		Name            string  `json:"nome"`
		ContractsTotal  int     `json:"totalContratos"`
		ContractsActive int     `json:"contratosAtivos"`
		ActiveMRR       float64 `json:"receitaMensalAtivaBRL"`
	}
	items := []clientRow{}
	for rows.Next() {
		var r clientRow
		if err := rows.Scan(&r.Name, &r.ContractsTotal, &r.ContractsActive, &r.ActiveMRR); err != nil {
			return nil, err
		}
		r.ActiveMRR = round2(r.ActiveMRR)
		items = append(items, r)
	}
	return map[string]any{
		"totalClientes": totalClients,
		"exibidos":      len(items),
		"clientes":      items,
	}, rows.Err()
}

func (e *ToolExecutor) execQueryContracts(ctx context.Context, args map[string]any) (any, error) {
	if !e.sess.HasPermission("contracts:view") {
		return map[string]string{"erro": "Perfil atual não possui permissão para visualizar contratos."}, nil
	}
	status := argString(args, "status")
	clientName := argString(args, "client_name")
	minVal := argFloat(args, "min_value")
	lim := argInt(args, "limit", 30, 1, 100)

	var totalMatching int
	var sumMatching float64
	_ = e.pool.QueryRow(ctx, `
		SELECT count(*)::int, COALESCE(sum(c.monthly_value), 0)::float8
		  FROM contracts c
		  JOIN clients cl ON cl.id = c.client_id AND cl.tenant_id = c.tenant_id
		 WHERE c.tenant_id = $1
		   AND ($2 = '' OR c.status = $2)
		   AND ($3 = '' OR cl.name ILIKE '%' || $3 || '%')
		   AND ($4 <= 0 OR c.monthly_value >= $4)`,
		e.sess.Tenant.ID, status, clientName, minVal).Scan(&totalMatching, &sumMatching)

	rows, err := e.pool.Query(ctx, `
		SELECT c.code, cl.name, c.object, c.workstation, c.duration_months,
		       c.monthly_value::float8, c.status,
		       (SELECT count(*)::int FROM employees emp WHERE emp.contract_id = c.id AND emp.tenant_id = c.tenant_id)
		  FROM contracts c
		  JOIN clients cl ON cl.id = c.client_id AND cl.tenant_id = c.tenant_id
		 WHERE c.tenant_id = $1
		   AND ($2 = '' OR c.status = $2)
		   AND ($3 = '' OR cl.name ILIKE '%' || $3 || '%')
		   AND ($4 <= 0 OR c.monthly_value >= $4)
		 ORDER BY c.monthly_value DESC, c.code ASC, c.id ASC
		 LIMIT $5`,
		e.sess.Tenant.ID, status, clientName, minVal, lim)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type rowItem struct {
		Code           string  `json:"codigo"`
		Client         string  `json:"cliente"`
		Object         string  `json:"objeto"`
		Workstation    string  `json:"posto"`
		DurationMonths int     `json:"vigenciaMeses"`
		MonthlyValue   float64 `json:"valorMensalBRL"`
		Status         string  `json:"status"`
		Employees      int     `json:"colaboradores"`
	}
	items := []rowItem{}
	for rows.Next() {
		var r rowItem
		if err := rows.Scan(&r.Code, &r.Client, &r.Object, &r.Workstation, &r.DurationMonths, &r.MonthlyValue, &r.Status, &r.Employees); err != nil {
			return nil, err
		}
		items = append(items, r)
		e.addCitation(r.Code, "contracts", r.Code+" · "+r.Client)
	}
	return map[string]any{
		"totalFiltrado":     totalMatching,
		"somaValorMensal":   round2(sumMatching),
		"exibidos":          len(items),
		"contratos":         items,
	}, rows.Err()
}

func (e *ToolExecutor) execQueryServiceOrders(ctx context.Context, args map[string]any) (any, error) {
	if !e.sess.HasPermission("service_orders:view") {
		return map[string]string{"erro": "Perfil atual não possui permissão para visualizar ordens de serviço."}, nil
	}
	status := argString(args, "status")
	priority := argString(args, "priority")
	clientName := argString(args, "client")
	lastDays := argInt(args, "last_days", 0, 0, 3650)
	lim := argInt(args, "limit", 30, 1, 100)

	var totalMatching int
	_ = e.pool.QueryRow(ctx, `
		SELECT count(*)::int
		  FROM service_orders o
		  LEFT JOIN clients cl ON cl.id = o.client_id AND cl.tenant_id = o.tenant_id
		 WHERE o.tenant_id = $1
		   AND ($2 = '' OR ($2 = 'abertas' AND o.status <> 'Concluída') OR o.status = $2)
		   AND ($3 = '' OR o.priority = $3)
		   AND ($4 = '' OR cl.name ILIKE '%' || $4 || '%')
		   AND ($5 <= 0 OR o.created_at >= now() - make_interval(days => $5))`,
		e.sess.Tenant.ID, status, priority, clientName, lastDays).Scan(&totalMatching)

	rows, err := e.pool.Query(ctx, `
		SELECT o.code, COALESCE(cl.name, 'Não informado'), COALESCE(emp.name, 'Sem técnico'),
		       o.description, o.priority, o.status,
		       to_char(o.created_at AT TIME ZONE 'America/Cuiaba', 'DD/MM/YYYY')
		  FROM service_orders o
		  LEFT JOIN clients cl ON cl.id = o.client_id AND cl.tenant_id = o.tenant_id
		  LEFT JOIN employees emp ON emp.id = o.employee_id AND emp.tenant_id = o.tenant_id
		 WHERE o.tenant_id = $1
		   AND ($2 = '' OR ($2 = 'abertas' AND o.status <> 'Concluída') OR o.status = $2)
		   AND ($3 = '' OR o.priority = $3)
		   AND ($4 = '' OR cl.name ILIKE '%' || $4 || '%')
		   AND ($5 <= 0 OR o.created_at >= now() - make_interval(days => $5))
		 ORDER BY CASE o.priority WHEN 'Urgente' THEN 1 WHEN 'Alta' THEN 2 ELSE 3 END, o.created_at DESC, o.id ASC
		 LIMIT $6`,
		e.sess.Tenant.ID, status, priority, clientName, lastDays, lim)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type rowItem struct {
		Code        string `json:"codigo"`
		Client      string `json:"cliente"`
		Employee    string `json:"tecnico"`
		Description string `json:"descricao"`
		Priority    string `json:"prioridade"`
		Status      string `json:"status"`
		CreatedAt   string `json:"abertaEm"`
	}
	items := []rowItem{}
	for rows.Next() {
		var r rowItem
		if err := rows.Scan(&r.Code, &r.Client, &r.Employee, &r.Description, &r.Priority, &r.Status, &r.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, r)
		e.addCitation(r.Code, "service_orders", r.Code+" · "+r.Priority)
	}
	return map[string]any{
		"totalFiltrado": totalMatching,
		"exibidas":      len(items),
		"ordensServico": items,
	}, rows.Err()
}

func (e *ToolExecutor) execQueryEmployeesAndEPIs(ctx context.Context, args map[string]any) (any, error) {
	mode := argString(args, "mode")
	if mode == "" {
		if e.sess.HasPermission("epis:view") {
			mode = "epis_alerts"
		} else {
			mode = "employees"
		}
	}
	lim := argInt(args, "limit", 30, 1, 100)

	if mode == "employees" {
		if !e.sess.HasPermission("employees:view") {
			return map[string]string{"erro": "Perfil atual não possui permissão para visualizar colaboradores."}, nil
		}
		status := argString(args, "status")
		rows, err := e.pool.Query(ctx, `
			SELECT emp.name, emp.role_title, emp.schedule, emp.status, COALESCE(c.code, 'Sem contrato')
			  FROM employees emp
			  LEFT JOIN contracts c ON c.id = emp.contract_id AND c.tenant_id = emp.tenant_id
			 WHERE emp.tenant_id = $1
			   AND ($2 = '' OR emp.status = $2)
			 ORDER BY emp.name ASC, emp.id ASC
			 LIMIT $3`, e.sess.Tenant.ID, status, lim)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		type empRow struct {
			Name     string `json:"nome"`
			Role     string `json:"funcao"`
			Schedule string `json:"escala"`
			Status   string `json:"status"`
			Contract string `json:"contrato"`
		}
		items := []empRow{}
		for rows.Next() {
			var r empRow
			if err := rows.Scan(&r.Name, &r.Role, &r.Schedule, &r.Status, &r.Contract); err != nil {
				return nil, err
			}
			items = append(items, r)
		}
		return map[string]any{"colaboradores": items}, rows.Err()
	}

	if !e.sess.HasPermission("epis:view") {
		return map[string]string{"erro": "Perfil atual não possui permissão para visualizar EPIs."}, nil
	}
	onlyAlerts := mode != "epis_all"
	rows, err := e.pool.Query(ctx, `
		SELECT COALESCE(emp.name, 'Não informado'), d.epi_name, d.ca_number,
		       to_char(d.expires_at, 'DD/MM/YYYY'), d.receipt_signed,
		       CASE
		         WHEN d.expires_at < CURRENT_DATE THEN 'Vencido'
		         WHEN d.expires_at <= CURRENT_DATE + interval '30 days' THEN 'Vence em até 30 dias'
		         ELSE 'Regular'
		       END
		  FROM epi_deliveries d
		  LEFT JOIN employees emp ON emp.id = d.employee_id AND emp.tenant_id = d.tenant_id
		 WHERE d.tenant_id = $1
		   AND ($2 = false OR d.expires_at <= CURRENT_DATE + interval '30 days' OR d.receipt_signed = false)
		 ORDER BY d.expires_at ASC, d.id ASC
		 LIMIT $3`, e.sess.Tenant.ID, onlyAlerts, lim)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type epiRow struct {
		Employee string `json:"colaborador"`
		EPI      string `json:"epi"`
		CA       string `json:"ca"`
		Expires  string `json:"validade"`
		Signed   bool   `json:"assinado"`
		State    string `json:"situacao"`
	}
	items := []epiRow{}
	for rows.Next() {
		var r epiRow
		if err := rows.Scan(&r.Employee, &r.EPI, &r.CA, &r.Expires, &r.Signed, &r.State); err != nil {
			return nil, err
		}
		items = append(items, r)
		e.addCitation(r.CA, "epis", r.CA+" · "+r.EPI)
	}
	return map[string]any{"epis": items}, rows.Err()
}

func (e *ToolExecutor) execQueryInventory(ctx context.Context, args map[string]any) (any, error) {
	if !e.sess.HasPermission("inventory:view") {
		return map[string]string{"erro": "Perfil atual não possui permissão para visualizar almoxarifado."}, nil
	}
	onlyLow := argBool(args, "only_low_stock")
	includeMovs := argBool(args, "include_movements")
	lim := argInt(args, "limit", 30, 1, 100)

	rows, err := e.pool.Query(ctx, `
		SELECT sku, description, category, quantity, unit, min_quantity, unit_value::float8
		  FROM inventory_items
		 WHERE tenant_id = $1
		   AND ($2 = false OR quantity <= min_quantity)
		 ORDER BY (quantity <= min_quantity) DESC, quantity ASC, description ASC, id ASC
		 LIMIT $3`, e.sess.Tenant.ID, onlyLow, lim)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type invRow struct {
		SKU       string  `json:"sku"`
		Desc      string  `json:"descricao"`
		Category  string  `json:"categoria"`
		Qty       int     `json:"saldo"`
		Unit      string  `json:"unidade"`
		MinQty    int     `json:"minimo"`
		UnitValue float64 `json:"valorUnitarioBRL"`
	}
	items := []invRow{}
	for rows.Next() {
		var r invRow
		if err := rows.Scan(&r.SKU, &r.Desc, &r.Category, &r.Qty, &r.Unit, &r.MinQty, &r.UnitValue); err != nil {
			return nil, err
		}
		items = append(items, r)
		e.addCitation(r.SKU, "inventory", r.SKU+" · "+r.Desc)
	}
	res := map[string]any{"itens": items}

	if includeMovs {
		mRows, mErr := e.pool.Query(ctx, `
			SELECT COALESCE(i.sku, ''), m.movement_type, m.quantity, COALESCE(emp.name, ''), COALESCE(m.notes, ''),
			       to_char(m.created_at AT TIME ZONE 'America/Cuiaba', 'DD/MM/YYYY')
			  FROM inventory_movements m
			  LEFT JOIN inventory_items i ON i.id = m.item_id AND i.tenant_id = m.tenant_id
			  LEFT JOIN employees emp ON emp.id = m.employee_id AND emp.tenant_id = m.tenant_id
			 WHERE m.tenant_id = $1
			 ORDER BY m.created_at DESC
			 LIMIT 20`, e.sess.Tenant.ID)
		if mErr == nil {
			type movRow struct {
				SKU      string `json:"sku"`
				Type     string `json:"tipo"`
				Qty      int    `json:"quantidade"`
				Employee string `json:"colaborador"`
				Notes    string `json:"observacao"`
				Date     string `json:"data"`
			}
			movs := []movRow{}
			for mRows.Next() {
				var mv movRow
				if mRows.Scan(&mv.SKU, &mv.Type, &mv.Qty, &mv.Employee, &mv.Notes, &mv.Date) == nil {
					movs = append(movs, mv)
				}
			}
			mRows.Close()
			res["movimentacoesRecentes"] = movs
		}
	}
	return res, rows.Err()
}

func (e *ToolExecutor) execQueryFinancial(ctx context.Context, args map[string]any) (any, error) {
	if !e.sess.HasPermission("finance:view") {
		return map[string]string{"erro": "Perfil atual não possui permissão para visualizar o módulo financeiro."}, nil
	}
	entryType := argString(args, "entry_type")
	status := argString(args, "status")
	month := argString(args, "month")
	lastDays := argInt(args, "last_days", 0, 0, 3650)
	monthlyChart := argBool(args, "monthly_chart")
	lim := argInt(args, "limit", 35, 1, 100)

	var totalCount int
	var sumRevenues, sumExpenses float64
	_ = e.pool.QueryRow(ctx, `
		SELECT count(*)::int,
		       COALESCE(sum(amount) FILTER (WHERE entry_type = 'Receita'), 0)::float8,
		       COALESCE(sum(amount) FILTER (WHERE entry_type = 'Despesa'), 0)::float8
		  FROM financial_entries
		 WHERE tenant_id = $1
		   AND ($2 = '' OR entry_type = $2)
		   AND ($3 = '' OR ($3 = 'atrasados' AND reconciliation_status = 'Pendente' AND due_date < CURRENT_DATE) OR reconciliation_status = $3)
		   AND ($4 = '' OR to_char(due_date, 'YYYY-MM') = $4)
		   AND ($5 <= 0 OR due_date >= CURRENT_DATE - make_interval(days => $5))`,
		e.sess.Tenant.ID, entryType, status, month, lastDays).Scan(&totalCount, &sumRevenues, &sumExpenses)

	rows, err := e.pool.Query(ctx, `
		SELECT f.entry_type, f.description, f.amount::float8,
		       to_char(f.due_date, 'DD/MM/YYYY'), f.reconciliation_status,
		       COALESCE(c.code, 'Geral')
		  FROM financial_entries f
		  LEFT JOIN contracts c ON c.id = f.contract_id AND c.tenant_id = f.tenant_id
		 WHERE f.tenant_id = $1
		   AND ($2 = '' OR f.entry_type = $2)
		   AND ($3 = '' OR ($3 = 'atrasados' AND f.reconciliation_status = 'Pendente' AND f.due_date < CURRENT_DATE) OR f.reconciliation_status = $3)
		   AND ($4 = '' OR to_char(f.due_date, 'YYYY-MM') = $4)
		   AND ($5 <= 0 OR f.due_date >= CURRENT_DATE - make_interval(days => $5))
		 ORDER BY f.due_date DESC, f.amount DESC, f.id ASC
		 LIMIT $6`,
		e.sess.Tenant.ID, entryType, status, month, lastDays, lim)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type finRow struct {
		Type     string  `json:"tipo"`
		Desc     string  `json:"descricao"`
		Amount   float64 `json:"valorBRL"`
		DueDate  string  `json:"vencimento"`
		Status   string  `json:"situacao"`
		Contract string  `json:"contrato"`
	}
	items := []finRow{}
	for rows.Next() {
		var r finRow
		if err := rows.Scan(&r.Type, &r.Desc, &r.Amount, &r.DueDate, &r.Status, &r.Contract); err != nil {
			return nil, err
		}
		items = append(items, r)
		if r.Contract != "Geral" {
			e.addCitation(r.Contract, "contracts", r.Contract)
		}
	}

	res := map[string]any{
		"totalFiltrado": totalCount,
		"receitasBRL":   round2(sumRevenues),
		"despesasBRL":   round2(sumExpenses),
		"saldoBRL":      round2(sumRevenues - sumExpenses),
		"lancamentos":   items,
	}

	if monthlyChart || month == "" {
		mRows, mErr := e.pool.Query(ctx, `
			SELECT to_char(date_trunc('month', due_date), 'YYYY-MM') AS ym,
			       COALESCE(sum(amount) FILTER (WHERE entry_type = 'Receita'), 0)::float8,
			       COALESCE(sum(amount) FILTER (WHERE entry_type = 'Despesa'), 0)::float8,
			       count(*)::int
			  FROM financial_entries
			 WHERE tenant_id = $1
			 GROUP BY 1
			 ORDER BY 1 DESC
			 LIMIT 12`, e.sess.Tenant.ID)
		if mErr == nil {
			type mRow struct {
				Month    string  `json:"competencia"`
				Revenues float64 `json:"receitasBRL"`
				Expenses float64 `json:"despesasBRL"`
				Balance  float64 `json:"saldoBRL"`
				Count    int     `json:"lancamentos"`
			}
			months := []mRow{}
			for mRows.Next() {
				var mr mRow
				if mRows.Scan(&mr.Month, &mr.Revenues, &mr.Expenses, &mr.Count) == nil {
					mr.Balance = round2(mr.Revenues - mr.Expenses)
					mr.Revenues = round2(mr.Revenues)
					mr.Expenses = round2(mr.Expenses)
					months = append(months, mr)
				}
			}
			mRows.Close()
			res["resumoMensal"] = months
		}
	}
	return res, rows.Err()
}

// execEntityRelations implementa a expansão de subgrafo 1-hop no PostgreSQL.
func (e *ToolExecutor) execEntityRelations(ctx context.Context, args map[string]any) (any, error) {
	entityType := argString(args, "entity_type")
	term := argString(args, "term")
	if term == "" {
		return map[string]string{"erro": "Informe o código ou nome para expandir relações."}, nil
	}

	switch entityType {
	case "contract":
		if !e.sess.HasPermission("contracts:view") {
			return map[string]string{"erro": "Sem permissão para contratos."}, nil
		}
		var cid, code, clientName, obj, status string
		var val float64
		err := e.pool.QueryRow(ctx, `
			SELECT c.id::text, c.code, cl.name, c.object, c.status, c.monthly_value::float8
			  FROM contracts c
			  JOIN clients cl ON cl.id = c.client_id AND cl.tenant_id = c.tenant_id
			 WHERE c.tenant_id = $1
			   AND (c.code ILIKE '%' || $2 || '%' OR cl.name ILIKE '%' || $2 || '%' OR c.object ILIKE '%' || $2 || '%')
			 LIMIT 1`, e.sess.Tenant.ID, term).Scan(&cid, &code, &clientName, &obj, &status, &val)
		if err != nil {
			return map[string]string{"mensagem": "Contrato não encontrado para o termo informado."}, nil
		}
		e.addCitation(code, "contracts", code+" · "+clientName)
		out := map[string]any{
			"contrato": map[string]any{"codigo": code, "cliente": clientName, "objeto": obj, "status": status, "valorMensalBRL": val},
		}
		if e.sess.HasPermission("employees:view") {
			rows, _ := e.pool.Query(ctx, `SELECT name, role_title, status FROM employees WHERE tenant_id = $1 AND contract_id = $2 LIMIT 20`, e.sess.Tenant.ID, cid)
			if rows != nil {
				emps := []map[string]any{}
				for rows.Next() {
					var n, rt, st string
					if rows.Scan(&n, &rt, &st) == nil {
						emps = append(emps, map[string]any{"nome": n, "funcao": rt, "status": st})
					}
				}
				rows.Close()
				out["colaboradoresAlocados"] = emps
			}
		}
		if e.sess.HasPermission("finance:view") {
			var rev, exp float64
			var cnt int
			_ = e.pool.QueryRow(ctx, `
				SELECT count(*)::int,
				       COALESCE(sum(amount) FILTER (WHERE entry_type='Receita'),0)::float8,
				       COALESCE(sum(amount) FILTER (WHERE entry_type='Despesa'),0)::float8
				  FROM financial_entries WHERE tenant_id = $1 AND contract_id = $2`, e.sess.Tenant.ID, cid).Scan(&cnt, &rev, &exp)
			out["financeiroVinculado"] = map[string]any{"lancamentos": cnt, "receitasBRL": round2(rev), "despesasBRL": round2(exp)}
		}
		return out, nil

	case "client":
		if !e.sess.HasPermission("contracts:view") {
			return map[string]string{"erro": "Sem permissão para clientes/contratos."}, nil
		}
		var clID, clName string
		err := e.pool.QueryRow(ctx, `SELECT id::text, name FROM clients WHERE tenant_id = $1 AND name ILIKE '%' || $2 || '%' LIMIT 1`, e.sess.Tenant.ID, term).Scan(&clID, &clName)
		if err != nil {
			return map[string]string{"mensagem": "Cliente não encontrado."}, nil
		}
		out := map[string]any{"cliente": clName}
		cRows, _ := e.pool.Query(ctx, `SELECT code, object, status, monthly_value::float8 FROM contracts WHERE tenant_id = $1 AND client_id = $2 LIMIT 15`, e.sess.Tenant.ID, clID)
		if cRows != nil {
			list := []map[string]any{}
			for cRows.Next() {
				var code, obj, st string
				var mv float64
				if cRows.Scan(&code, &obj, &st, &mv) == nil {
					list = append(list, map[string]any{"codigo": code, "objeto": obj, "status": st, "valorMensalBRL": mv})
					e.addCitation(code, "contracts", code+" · "+clName)
				}
			}
			cRows.Close()
			out["contratos"] = list
		}
		if e.sess.HasPermission("service_orders:view") {
			oRows, _ := e.pool.Query(ctx, `SELECT code, description, priority, status FROM service_orders WHERE tenant_id = $1 AND client_id = $2 ORDER BY created_at DESC LIMIT 15`, e.sess.Tenant.ID, clID)
			if oRows != nil {
				list := []map[string]any{}
				for oRows.Next() {
					var code, desc, prio, st string
					if oRows.Scan(&code, &desc, &prio, &st) == nil {
						list = append(list, map[string]any{"codigo": code, "descricao": desc, "prioridade": prio, "status": st})
						e.addCitation(code, "service_orders", code+" · "+prio)
					}
				}
				oRows.Close()
				out["ordensServico"] = list
			}
		}
		return out, nil

	case "employee":
		if !e.sess.HasPermission("employees:view") {
			return map[string]string{"erro": "Sem permissão para colaboradores."}, nil
		}
		var empID, name, roleTitle, sched, st, contractCode string
		err := e.pool.QueryRow(ctx, `
			SELECT emp.id::text, emp.name, emp.role_title, emp.schedule, emp.status, COALESCE(c.code, 'Sem contrato')
			  FROM employees emp
			  LEFT JOIN contracts c ON c.id = emp.contract_id AND c.tenant_id = emp.tenant_id
			 WHERE emp.tenant_id = $1 AND emp.name ILIKE '%' || $2 || '%'
			 LIMIT 1`, e.sess.Tenant.ID, term).Scan(&empID, &name, &roleTitle, &sched, &st, &contractCode)
		if err != nil {
			return map[string]string{"mensagem": "Colaborador não encontrado."}, nil
		}
		out := map[string]any{
			"colaborador": map[string]any{"nome": name, "funcao": roleTitle, "escala": sched, "status": st, "contrato": contractCode},
		}
		if e.sess.HasPermission("epis:view") {
			eRows, _ := e.pool.Query(ctx, `SELECT epi_name, ca_number, to_char(expires_at, 'DD/MM/YYYY'), receipt_signed FROM epi_deliveries WHERE tenant_id = $1 AND employee_id = $2 ORDER BY expires_at ASC LIMIT 15`, e.sess.Tenant.ID, empID)
			if eRows != nil {
				list := []map[string]any{}
				for eRows.Next() {
					var epi, ca, exp string
					var signed bool
					if eRows.Scan(&epi, &ca, &exp, &signed) == nil {
						list = append(list, map[string]any{"epi": epi, "ca": ca, "validade": exp, "assinado": signed})
						e.addCitation(ca, "epis", ca+" · "+epi)
					}
				}
				eRows.Close()
				out["epis"] = list
			}
		}
		if e.sess.HasPermission("service_orders:view") {
			oRows, _ := e.pool.Query(ctx, `SELECT code, description, priority, status FROM service_orders WHERE tenant_id = $1 AND employee_id = $2 ORDER BY created_at DESC LIMIT 10`, e.sess.Tenant.ID, empID)
			if oRows != nil {
				list := []map[string]any{}
				for oRows.Next() {
					var code, desc, prio, ost string
					if oRows.Scan(&code, &desc, &prio, &ost) == nil {
						list = append(list, map[string]any{"codigo": code, "descricao": desc, "prioridade": prio, "status": ost})
						e.addCitation(code, "service_orders", code)
					}
				}
				oRows.Close()
				out["ordensServico"] = list
			}
		}
		return out, nil

	case "service_order":
		if !e.sess.HasPermission("service_orders:view") {
			return map[string]string{"erro": "Sem permissão para ordens de serviço."}, nil
		}
		var code, clName, empName, desc, prio, st, createdAt string
		err := e.pool.QueryRow(ctx, `
			SELECT o.code, COALESCE(cl.name, 'Não informado'), COALESCE(emp.name, 'Sem técnico'),
			       o.description, o.priority, o.status,
			       to_char(o.created_at AT TIME ZONE 'America/Cuiaba', 'DD/MM/YYYY HH24:MI')
			  FROM service_orders o
			  LEFT JOIN clients cl ON cl.id = o.client_id AND cl.tenant_id = o.tenant_id
			  LEFT JOIN employees emp ON emp.id = o.employee_id AND emp.tenant_id = o.tenant_id
			 WHERE o.tenant_id = $1 AND (o.code ILIKE '%' || $2 || '%' OR o.description ILIKE '%' || $2 || '%')
			 LIMIT 1`, e.sess.Tenant.ID, term).Scan(&code, &clName, &empName, &desc, &prio, &st, &createdAt)
		if err != nil {
			return map[string]string{"mensagem": "Ordem de serviço não encontrada."}, nil
		}
		e.addCitation(code, "service_orders", code+" · "+clName)
		return map[string]any{
			"ordemServico": map[string]any{
				"codigo": code, "cliente": clName, "tecnico": empName,
				"descricao": desc, "prioridade": prio, "status": st, "abertaEm": createdAt,
			},
		}, nil
	}

	return map[string]string{"erro": "entity_type não suportado"}, nil
}

func argString(m map[string]any, k string) string {
	if v, ok := m[k].(string); ok {
		return strings.TrimSpace(v)
	}
	return ""
}

func argBool(m map[string]any, k string) bool {
	if v, ok := m[k].(bool); ok {
		return v
	}
	return false
}

func argFloat(m map[string]any, k string) float64 {
	if v, ok := m[k].(float64); ok {
		return v
	}
	return 0
}

func argInt(m map[string]any, k string, def, minV, maxV int) int {
	v := def
	if f, ok := m[k].(float64); ok {
		v = int(f)
	}
	if v < minV {
		return minV
	}
	if v > maxV {
		return maxV
	}
	return v
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}
