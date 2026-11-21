package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"tercerize/backend/internal/auth"
	"tercerize/backend/internal/httpx"
	"tercerize/backend/internal/secretbox"
)

type Handlers struct {
	pool          *pgxpool.Pool
	rdb           *redis.Client
	client        *OpenRouterClient
	encryptionKey string
	log           *slog.Logger
}

func NewHandlers(
	pool *pgxpool.Pool,
	rdb *redis.Client,
	appURL string,
	appName string,
	encryptionKey string,
	log *slog.Logger,
) *Handlers {
	return &Handlers{
		pool:          pool,
		rdb:           rdb,
		client:        NewOpenRouterClient(appURL, appName, rdb, log),
		encryptionKey: encryptionKey,
		log:           log,
	}
}

func (h *Handlers) loadSettings(ctx context.Context) Settings {
	s := Settings{
		Models:          DefaultModels,
		TimeoutSeconds:  12,
		CooldownSeconds: 180,
	}
	var rawModels []byte
	var timeoutSec, cooldownSec int
	err := h.pool.QueryRow(ctx,
		`SELECT models, timeout_seconds, cooldown_seconds FROM ai_settings WHERE id = 1`).
		Scan(&rawModels, &timeoutSec, &cooldownSec)
	if err == nil {
		var list []string
		if json.Unmarshal(rawModels, &list) == nil && len(list) > 0 {
			s.Models = list
		}
		if timeoutSec >= 5 && timeoutSec <= 60 {
			s.TimeoutSeconds = timeoutSec
		}
		if cooldownSec >= 30 && cooldownSec <= 1800 {
			s.CooldownSeconds = cooldownSec
		}
	}
	return s
}

// GetSettings: GET /api/ai/settings (exclusivo Master)
func (h *Handlers) GetSettings(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || !sess.User.IsMaster {
		httpx.Message(w, http.StatusForbidden, "Apenas acesso Master pode gerenciar modelos globais de IA.")
		return
	}
	settings := h.loadSettings(r.Context())

	type modelStat struct {
		Model         string `json:"model"`
		Calls         int    `json:"calls"`
		AvgLatencyMs  int    `json:"avgLatencyMs"`
		TotalFallback int    `json:"totalFallback"`
		InCooldown    bool   `json:"inCooldown"`
	}
	statsMap := map[string]*modelStat{}
	for _, m := range settings.Models {
		statsMap[m] = &modelStat{
			Model:      m,
			InCooldown: h.client.IsModelInCooldown(r.Context(), m),
		}
	}
	if rows, err := h.pool.Query(r.Context(),
		`SELECT model_used, count(*), COALESCE(avg(latency_ms)::int, 0), COALESCE(sum(fallback_count)::int, 0)
		   FROM ai_messages
		  WHERE role = 'assistant' AND model_used <> ''
		  GROUP BY model_used`); err == nil {
		for rows.Next() {
			var m string
			var calls, avgMs, fb int
			if rows.Scan(&m, &calls, &avgMs, &fb) == nil {
				st, ok := statsMap[m]
				if !ok {
					st = &modelStat{Model: m, InCooldown: h.client.IsModelInCooldown(r.Context(), m)}
					statsMap[m] = st
				}
				st.Calls = calls
				st.AvgLatencyMs = avgMs
				st.TotalFallback = fb
			}
		}
		rows.Close()
	}

	stats := make([]modelStat, 0, len(statsMap))
	for _, m := range settings.Models {
		if st, ok := statsMap[m]; ok {
			stats = append(stats, *st)
		}
	}

	httpx.Write(w, http.StatusOK, map[string]any{
		"models":          settings.Models,
		"timeoutSeconds":  settings.TimeoutSeconds,
		"cooldownSeconds": settings.CooldownSeconds,
		"stats":           stats,
	})
}

// UpdateSettings: POST /api/ai/settings (exclusivo Master)
func (h *Handlers) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || !sess.User.IsMaster {
		httpx.Message(w, http.StatusForbidden, "Apenas acesso Master pode alterar os modelos globais de IA.")
		return
	}
	var in struct {
		Models          []string `json:"models"`
		TimeoutSeconds  int      `json:"timeoutSeconds"`
		CooldownSeconds int      `json:"cooldownSeconds"`
		ClearCooldowns  bool     `json:"clearCooldowns"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Dados inválidos.")
		return
	}

	cleanModels := make([]string, 0, len(in.Models))
	seen := map[string]bool{}
	for _, m := range in.Models {
		trimmed := strings.TrimSpace(m)
		if trimmed == "" || seen[trimmed] {
			continue
		}
		seen[trimmed] = true
		cleanModels = append(cleanModels, trimmed)
		if len(cleanModels) >= 10 {
			break
		}
	}
	if len(cleanModels) == 0 {
		httpx.Message(w, http.StatusBadRequest, "Informe ao menos um modelo OpenRouter válido.")
		return
	}
	if in.TimeoutSeconds < 5 || in.TimeoutSeconds > 60 {
		in.TimeoutSeconds = 12
	}
	if in.CooldownSeconds < 30 || in.CooldownSeconds > 1800 {
		in.CooldownSeconds = 180
	}

	modelsJSON, _ := json.Marshal(cleanModels)
	_, err := h.pool.Exec(r.Context(),
		`INSERT INTO ai_settings (id, models, timeout_seconds, cooldown_seconds, updated_at)
		 VALUES (1, $1::jsonb, $2, $3, now())
		 ON CONFLICT (id) DO UPDATE
		 SET models = EXCLUDED.models,
		     timeout_seconds = EXCLUDED.timeout_seconds,
		     cooldown_seconds = EXCLUDED.cooldown_seconds,
		     updated_at = now()`,
		string(modelsJSON), in.TimeoutSeconds, in.CooldownSeconds)
	if err != nil {
		h.log.Error("salvar ai_settings", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao salvar configuração de modelos.")
		return
	}
	if in.ClearCooldowns {
		h.client.ClearCooldowns(r.Context(), cleanModels)
	}
	httpx.Write(w, http.StatusOK, map[string]any{
		"ok":              true,
		"models":          cleanModels,
		"timeoutSeconds":  in.TimeoutSeconds,
		"cooldownSeconds": in.CooldownSeconds,
	})
}

// ListConversations: GET /api/ai/conversations
func (h *Handlers) ListConversations(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || sess.Tenant.ID == "" || !sess.HasPermission("ai_chat:use") {
		httpx.Message(w, http.StatusForbidden, "Sem permissão para acessar o Assistente IA nesta empresa.")
		return
	}
	type convRow struct {
		ID        string `json:"id"`
		Title     string `json:"title"`
		UpdatedAt string `json:"updatedAt"`
	}
	rows, err := h.pool.Query(r.Context(),
		`SELECT id, title, to_char(updated_at AT TIME ZONE 'America/Cuiaba', 'DD/MM/YYYY HH24:MI')
		   FROM ai_conversations
		  WHERE tenant_id = $1 AND user_id = $2
		  ORDER BY updated_at DESC LIMIT 40`,
		sess.Tenant.ID, sess.User.ID)
	if err != nil {
		httpx.Message(w, http.StatusInternalServerError, "Erro ao listar conversas.")
		return
	}
	defer rows.Close()
	list := []convRow{}
	for rows.Next() {
		var c convRow
		if rows.Scan(&c.ID, &c.Title, &c.UpdatedAt) == nil {
			list = append(list, c)
		}
	}
	httpx.Write(w, http.StatusOK, map[string]any{"conversations": list})
}

// DeleteConversation: POST /api/ai/conversations/delete
func (h *Handlers) DeleteConversation(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || sess.Tenant.ID == "" || !sess.HasPermission("ai_chat:use") {
		httpx.Message(w, http.StatusForbidden, "Sem permissão para gerenciar conversas nesta empresa.")
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		var in struct {
			ID string `json:"id"`
		}
		_ = httpx.Read(r, &in)
		id = strings.TrimSpace(in.ID)
	}
	if id == "" {
		httpx.Message(w, http.StatusBadRequest, "Conversa inválida.")
		return
	}
	_, _ = h.pool.Exec(r.Context(),
		`DELETE FROM ai_conversations WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
		id, sess.Tenant.ID, sess.User.ID)
	httpx.Write(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handlers) checkUserRateLimit(ctx context.Context, tenantID, userID string) bool {
	if h.rdb == nil {
		return true
	}
	key := fmt.Sprintf("ai:rate:%s:%s:%s", tenantID, userID, time.Now().Format("2006010215"))
	count, err := h.rdb.Incr(ctx, key).Result()
	if err != nil {
		return true
	}
	if count == 1 {
		_ = h.rdb.Expire(ctx, key, 65*time.Minute).Err()
	}
	return count <= 30
}

// Chat: POST /api/ai/chat
// Lê exclusivamente os dados da empresa instanciada (sess.Tenant.ID), respeita o RBAC da Role,
// usa o token OpenRouter da empresa e aplica fallback automático entre os modelos gratuitos configurados.
func (h *Handlers) Chat(w http.ResponseWriter, r *http.Request) {
	sess := auth.SessionFromContext(r.Context())
	if sess == nil || sess.Tenant.ID == "" {
		httpx.Message(w, http.StatusForbidden, "Selecione uma empresa ativa para utilizar o Assistente IA.")
		return
	}
	if !sess.HasPermission("ai_chat:use") {
		httpx.Message(w, http.StatusForbidden, "Sua função nesta empresa não possui acesso liberado ao Assistente IA.")
		return
	}

	var in struct {
		ConversationID string `json:"conversationId"`
		Message        string `json:"message"`
	}
	if err := httpx.Read(r, &in); err != nil {
		httpx.Message(w, http.StatusBadRequest, "Mensagem inválida.")
		return
	}
	userMsg := strings.TrimSpace(in.Message)
	if len([]rune(userMsg)) < 2 {
		httpx.Message(w, http.StatusBadRequest, "Digite uma pergunta ou o relatório desejado.")
		return
	}
	if len([]rune(userMsg)) > 2000 {
		httpx.Message(w, http.StatusBadRequest, "A mensagem excede o limite de 2.000 caracteres.")
		return
	}

	if !h.checkUserRateLimit(r.Context(), sess.Tenant.ID, sess.User.ID) {
		httpx.Message(w, http.StatusTooManyRequests, "Limite horário de perguntas atingido (30/hora). Tente novamente em breve.")
		return
	}

	// Recupera e descriptografa o token OpenRouter exclusivo da empresa instanciada
	var encToken string
	if err := h.pool.QueryRow(r.Context(),
		`SELECT COALESCE(openrouter_token_enc, '') FROM tenants WHERE id = $1`,
		sess.Tenant.ID).Scan(&encToken); err != nil {
		httpx.Message(w, http.StatusNotFound, "Empresa ativa não encontrada.")
		return
	}
	if strings.TrimSpace(encToken) == "" {
		httpx.Message(w, http.StatusBadRequest, "O Assistente IA ainda não possui um token OpenRouter configurado para esta empresa. Solicite ativação ao administrador Master.")
		return
	}
	apiToken, err := secretbox.Decrypt(encToken, h.encryptionKey)
	if err != nil || strings.TrimSpace(apiToken) == "" {
		h.log.Error("descriptografar token OpenRouter", "tenant", sess.Tenant.ID, "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Não foi possível ler a credencial OpenRouter desta empresa. Peça ao Master para atualizar o token.")
		return
	}

	// Resolver ou criar conversa isolada (tenant_id + user_id)
	convID := strings.TrimSpace(in.ConversationID)
	if convID != "" {
		var exists bool
		_ = h.pool.QueryRow(r.Context(),
			`SELECT EXISTS(SELECT 1 FROM ai_conversations WHERE id = $1 AND tenant_id = $2 AND user_id = $3)`,
			convID, sess.Tenant.ID, sess.User.ID).Scan(&exists)
		if !exists {
			convID = ""
		}
	}
	if convID == "" {
		title := buildConversationTitle(userMsg)
		if err := h.pool.QueryRow(r.Context(),
			`INSERT INTO ai_conversations (tenant_id, user_id, title) VALUES ($1, $2, $3) RETURNING id`,
			sess.Tenant.ID, sess.User.ID, title).Scan(&convID); err != nil {
			h.log.Error("criar conversa IA", "err", err)
			httpx.Message(w, http.StatusInternalServerError, "Não foi possível iniciar a conversa.")
			return
		}
	}

	// Montar snapshot somente-leitura EXCLUSIVO da empresa ativa + módulos liberados pela Role
	snap, err := BuildTenantSnapshot(r.Context(), h.pool, sess)
	if err != nil {
		h.log.Error("montar snapshot tenant IA", "err", err)
		httpx.Message(w, http.StatusInternalServerError, "Erro ao consultar dados da empresa.")
		return
	}

	// Carregar últimas 8 mensagens da conversa para continuidade
	history := []ChatMessage{}
	if rows, qErr := h.pool.Query(r.Context(),
		`SELECT role, content FROM (
		   SELECT role, content, created_at
		     FROM ai_messages
		    WHERE conversation_id = $1 AND tenant_id = $2
		    ORDER BY created_at DESC LIMIT 8
		 ) sub ORDER BY created_at ASC`, convID, sess.Tenant.ID); qErr == nil {
		for rows.Next() {
			var m ChatMessage
			if rows.Scan(&m.Role, &m.Content) == nil {
				history = append(history, m)
			}
		}
		rows.Close()
	}

	systemPrompt := buildSystemPrompt(sess, snap)
	messages := make([]ChatMessage, 0, len(history)+2)
	messages = append(messages, ChatMessage{Role: "system", Content: systemPrompt})
	messages = append(messages, history...)
	messages = append(messages, ChatMessage{Role: "user", Content: userMsg})

	settings := h.loadSettings(r.Context())
	result, err := h.client.Complete(r.Context(), apiToken, settings, messages)
	if err != nil {
		if errors.Is(err, ErrInvalidOpenRouterToken) {
			httpx.Message(w, http.StatusBadGateway, "O token OpenRouter configurado para esta empresa foi recusado (401/402). Peça ao Master para revisar o token em Gestão de empresas.")
			return
		}
		httpx.Message(w, http.StatusServiceUnavailable, "Os modelos gratuitos do OpenRouter estão instáveis ou lentos no momento. Tente novamente em alguns instantes.")
		return
	}

	// Persistir pergunta do usuário e resposta da IA
	_, _ = h.pool.Exec(r.Context(),
		`INSERT INTO ai_messages (conversation_id, tenant_id, role, content) VALUES ($1, $2, 'user', $3)`,
		convID, sess.Tenant.ID, userMsg)

	var assistantMsgID, createdAt string
	_ = h.pool.QueryRow(r.Context(),
		`INSERT INTO ai_messages (conversation_id, tenant_id, role, content, model_used, latency_ms, fallback_count)
		 VALUES ($1, $2, 'assistant', $3, $4, $5, $6)
		 RETURNING id, to_char(created_at AT TIME ZONE 'America/Cuiaba', 'DD/MM/YYYY HH24:MI')`,
		convID, sess.Tenant.ID, result.Content, result.ModelUsed, result.LatencyMs, result.FallbackCount).
		Scan(&assistantMsgID, &createdAt)

	_, _ = h.pool.Exec(r.Context(),
		`UPDATE ai_conversations SET updated_at = now() WHERE id = $1`, convID)

	httpx.Write(w, http.StatusOK, map[string]any{
		"ok":             true,
		"conversationId": convID,
		"message": map[string]any{
			"id":        assistantMsgID,
			"role":      "assistant",
			"content":   result.Content,
			"createdAt": createdAt,
		},
		"allowedModules": snap.AllowedModules,
	})
}

func buildConversationTitle(msg string) string {
	runes := []rune(strings.TrimSpace(msg))
	if len(runes) <= 56 {
		return string(runes)
	}
	return string(runes[:55]) + "…"
}

func buildSystemPrompt(sess *auth.SessionContext, snap *TenantSnapshot) string {
	return fmt.Sprintf(`Você é o Assistente Analítico, de Suporte e de Relatórios da plataforma Tercerize.
Você está atendendo o usuário "%s" (função: %s) EXCLUSIVAMENTE dentro da empresa "%s" (CNPJ: %s).

REGRAS ESTRITAS:
1. Responda sempre em português do Brasil (PT-BR), de forma clara, objetiva e profissional.
2. Para perguntas sobre números, cadastros ou relatórios, baseie-se EXCLUSIVAMENTE no JSON de dados reais da empresa abaixo. Nunca invente números, contratos, clientes, valores ou datas.
3. Para dúvidas operacionais ("como cadastrar contrato", "como abrir OS", "como liberar IA para funcionários", etc.), oriente com o passo a passo exato da plataforma Tercerize descrito abaixo.
4. Se um módulo não aparecer no JSON (porque o perfil do usuário não tem permissão de visualização), informe educadamente que o perfil atual não tem acesso a esse módulo.
5. Você é estritamente SOMENTE LEITURA: nunca diga que criou, editou ou excluiu registros no banco.
6. Ao gerar relatórios, organize com títulos claros (## / ###), listas objetivas, tabelas Markdown quando útil (com valores em formato brasileiro R$ 1.234,56) e uma seção curta de "Pontos de atenção / recomendações".
7. Nunca mencione chaves de API, nomes técnicos de tabelas SQL ou dados de outras empresas.

GUIA RÁPIDO DA PLATAFORMA TERCERIZE (menus e telas reais):
- Clientes e contratos (/admin/contracts): primeiro cadastre o cliente tomador clicando em "Novo cliente" (Razão Social, CNPJ, Telefone e E-mail obrigatórios). Depois clique em "Novo contrato", selecione o cliente, preencha código, objeto/escopo, quantidade de postos, valor mensal (R$), vigência em meses e salve.
- Colaboradores e escalas (/admin/employees): clique em "Novo colaborador" para alocar um funcionário em um contrato e definir sua escala. Clicando no nome do colaborador você vê OS, EPIs e troca a escala com detecção automática de conflito.
- Ordens de serviço (/admin/service-orders): clique em "Nova OS" para despachar chamados vinculados a contratos/colaboradores e acompanhe o status (aberta, em andamento, concluída).
- Controle de EPIs (/admin/epis): clique em "Registrar entrega" informando colaborador, equipamento, CA (formato CA-XXXXX) e validade.
- Almoxarifado e ativos (/admin/inventory-items): clique em "Novo item" com SKU, estoque mínimo e custo unitário, e registre entradas/saídas.
- Gestão financeira (/admin/finance): clique em "Novo lançamento" para receitas ou despesas, informando valor (R$), vencimento e status.
- Roles e permissões (/admin/permissions — exclusivo Dono/Master): gerencie funções, convide usuários por e-mail e marque/desmarque "Assistente IA e relatórios" por função.

DADOS REAIS DA EMPRESA INSTANCIADA (JSON):
%s`, sess.User.Name, sess.Role.Name, sess.Tenant.Name, sess.Tenant.CNPJ, snap.JSON())
}
