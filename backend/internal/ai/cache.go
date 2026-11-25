package ai

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"golang.org/x/sync/singleflight"

	"tercerize/backend/internal/auth"
)

// PipelineTimings instrumenta separadamente cada fase da requisição de IA (em milissegundos).
type PipelineTimings struct {
	DBQueryMs     int64 `json:"dbQueryMs"`
	KnowledgeMs   int64 `json:"knowledgeMs"`
	PromptBuildMs int64 `json:"promptBuildMs"`
	CacheLookupMs int64 `json:"cacheLookupMs"`
	TTFTMs        int64 `json:"ttftMs"`
	GenerationMs  int64 `json:"generationMs"`
	TotalMs       int64 `json:"totalMs"`
}

// CacheTelemetry registra HIT/MISS/COALESCED, idade, validade restante, headers OpenRouter e hash determinístico.
type CacheTelemetry struct {
	Status                string `json:"status"` // HIT | MISS | COALESCED | BYPASS
	AgeSeconds            int64  `json:"ageSeconds"`
	RemainingSeconds      int64  `json:"remainingSeconds"`
	TTLSeconds            int    `json:"ttlSeconds"`
	OpenRouterCacheStatus string `json:"openRouterCacheStatus,omitempty"`
	OpenRouterCacheAge    string `json:"openRouterCacheAge,omitempty"`
	PromptHash            string `json:"promptHash,omitempty"`
	SessionID             string `json:"sessionId,omitempty"`
	DataVersion           int64  `json:"dataVersion"`
	RBACVersion           int64  `json:"rbacVersion"`
}

// ResponseCacheEntry é o payload persistido no Redis existente da arquitetura Tercerize.
type ResponseCacheEntry struct {
	Content              string           `json:"content"`
	ModelUsed            string           `json:"modelUsed"`
	ProfileKey           ExecutionProfile `json:"profileKey"`
	ReportMode           ReportDepth      `json:"reportMode"`
	Citations            []Citation       `json:"citations,omitempty"`
	PromptHash           string           `json:"promptHash"`
	CachedAtUnix         int64            `json:"cachedAtUnix"`
	TTLSeconds           int              `json:"ttlSeconds"`
	OrigPromptTokens     int              `json:"origPromptTokens"`
	OrigCachedTokens     int              `json:"origCachedTokens"`
	OrigCompletionTokens int              `json:"origCompletionTokens"`
	OrigCostUSD          float64          `json:"origCostUsd"`
}

// ResponseCache combina cache interno no Redis existente com singleflight para evitar
// chamadas simultâneas duplicadas ao OpenRouter.
type ResponseCache struct {
	rdb        *redis.Client
	defaultTTL time.Duration
	sf         singleflight.Group
}

func NewResponseCache(rdb *redis.Client, ttlSeconds int) *ResponseCache {
	if ttlSeconds < 30 || ttlSeconds > 86400 {
		ttlSeconds = 600
	}
	return &ResponseCache{
		rdb:        rdb,
		defaultTTL: time.Duration(ttlSeconds) * time.Second,
	}
}

func (rc *ResponseCache) TTLSeconds() int {
	return int(rc.defaultTTL.Seconds())
}

// Get consulta o cache interno e retorna também a idade (segundos) e validade restante.
func (rc *ResponseCache) Get(ctx context.Context, key string) (*ResponseCacheEntry, int64, int64, bool) {
	if rc == nil || rc.rdb == nil || key == "" {
		return nil, 0, 0, false
	}
	raw, err := rc.rdb.Get(ctx, key).Bytes()
	if err != nil || len(raw) == 0 {
		return nil, 0, 0, false
	}
	var entry ResponseCacheEntry
	if err := json.Unmarshal(raw, &entry); err != nil || strings.TrimSpace(entry.Content) == "" {
		return nil, 0, 0, false
	}
	nowUnix := time.Now().Unix()
	age := nowUnix - entry.CachedAtUnix
	if age < 0 {
		age = 0
	}
	ttl := int64(entry.TTLSeconds)
	if ttl <= 0 {
		ttl = int64(rc.defaultTTL.Seconds())
	}
	remaining := ttl - age
	if remaining < 0 {
		remaining = 0
	}
	return &entry, age, remaining, true
}

// Set grava a resposta no cache interno com TTL configurado.
func (rc *ResponseCache) Set(ctx context.Context, key string, entry ResponseCacheEntry) {
	if rc == nil || rc.rdb == nil || key == "" || strings.TrimSpace(entry.Content) == "" {
		return
	}
	if entry.CachedAtUnix == 0 {
		entry.CachedAtUnix = time.Now().Unix()
	}
	if entry.TTLSeconds <= 0 {
		entry.TTLSeconds = int(rc.defaultTTL.Seconds())
	}
	encoded, err := json.Marshal(entry)
	if err != nil {
		return
	}
	_ = rc.rdb.Set(ctx, key, encoded, time.Duration(entry.TTLSeconds)*time.Second).Err()
}

// Do deduplica chamadas concorrentes idênticas usando singleflight (evita chamadas duplicadas simultâneas).
func (rc *ResponseCache) Do(key string, fn func() (chatPipelineOutput, error)) (chatPipelineOutput, bool, error) {
	if rc == nil || key == "" {
		out, err := fn()
		return out, false, err
	}
	v, err, shared := rc.sf.Do(key, func() (any, error) {
		return fn()
	})
	if err != nil {
		return chatPipelineOutput{}, shared, err
	}
	return v.(chatPipelineOutput), shared, nil
}

// ComputePermissionsHash gera um hash determinístico das permissões efetivas do usuário na empresa ativa.
func ComputePermissionsHash(sess *auth.SessionContext) string {
	if sess == nil {
		return "none"
	}
	if sess.User.IsMaster {
		return "master_all"
	}
	perms := make([]string, 0, len(sess.Role.Permissions))
	for p, allowed := range sess.Role.Permissions {
		if allowed {
			if trimmed := strings.TrimSpace(p); trimmed != "" {
				perms = append(perms, trimmed)
			}
		}
	}
	sort.Strings(perms)
	sum := sha256.Sum256([]byte(sess.Role.ID + "|" + sess.Role.Key + "|" + strings.Join(perms, ",")))
	return hex.EncodeToString(sum[:8])
}

// ComputeHistoryHash resume deterministicamente o histórico recente (vazio para novas conversas).
func ComputeHistoryHash(history []ChatMessage) string {
	if len(history) == 0 {
		return "root"
	}
	var b strings.Builder
	for _, m := range history {
		b.WriteString(m.Role)
		b.WriteByte(':')
		b.WriteString(normalizeCacheQuery(m.Content))
		b.WriteByte('\n')
	}
	sum := sha256.Sum256([]byte(b.String()))
	return hex.EncodeToString(sum[:8])
}

// IsStandaloneCacheableQuery identifica perguntas/relatórios autocontidos que podem reaproveitar
// a chave de cache raiz ("root") mesmo quando repetidos dentro da mesma conversa, preservando
// o isolamento de histórico para continuações, referências anafóricas e pedidos de revisão.
func IsStandaloneCacheableQuery(userMsg string, history []ChatMessage) bool {
	if len(history) == 0 {
		return true
	}
	if lastAssistantWasClarification(history) {
		return false
	}
	norm := normalizeText(userMsg)
	trimmed := strings.TrimSpace(norm)
	// Mensagens muito curtas em conversa ativa costumam ser respostas contextuais ("sim", "todos", "ativos")
	if len(trimmed) < 18 {
		return false
	}
	// Continuação explícita iniciada por conectivos ou referências ao turno anterior
	followUpPrefixes := []string{
		"e ", "mas ", "porem ", "agora ", "entao ", "tambem ", "ja ", "ou ",
		"so ", "apenas ", "somente ", "filtre ", "ordene ", "agrupe ", "detalhe ",
		"aprofunde ", "explique ", "continue ", "continuar ", "refaca ", "refazer ",
		"corrija ", "corrigir ", "confira ", "conferir ", "regerar ", "reprocesse ",
	}
	for _, p := range followUpPrefixes {
		if strings.HasPrefix(trimmed, p) {
			return false
		}
	}
	// Referências anafóricas ou pedidos explícitos de revalidação/reprocessamento
	if containsAny(norm,
		" dele ", " dela ", " deles ", " delas ",
		" disso ", " nisso ", " disto ", " nisto ",
		" desse ", " dessa ", " desses ", " dessas ",
		" deste ", " desta ", " destes ", " destas ",
		" esse ", " essa ", " esses ", " essas ",
		" acima ", " anterior ", " anteriores ", " citado ", " citados ",
		" tambem ", " tem certeza ", " confira ", " verifique de novo ",
		" de novo ", " novamente ", " outra vez ", " sem cache ", " regerar ",
		" refaca ", " corrija ", " errado ", " errada ", " incorreto ", " incorreta ",
		" mesmo relatorio ", " mesma lista ", " nesse caso ", " nessa lista ",
	) {
		return false
	}
	return true
}

// ComputeResponseCacheKey cria a chave determinística do cache interno garantindo isolamento absoluto por:
// tenant_id + user_id + permissões + versão de dados + versão RBAC + nível/modo + pergunta normalizada + histórico.
func ComputeResponseCacheKey(
	tenantID string,
	userID string,
	permHash string,
	dataVersion int64,
	rbacVersion int64,
	tier ExecutionProfile,
	depth ReportDepth,
	effectiveMsg string,
	historyHash string,
) string {
	canonical := fmt.Sprintf(
		"v2|t=%s|u=%s|p=%s|dv=%d|rv=%d|tier=%s|depth=%s|h=%s|q=%s",
		tenantID,
		userID,
		permHash,
		dataVersion,
		rbacVersion,
		tier,
		depth,
		historyHash,
		normalizeCacheQuery(effectiveMsg),
	)
	sum := sha256.Sum256([]byte(canonical))
	return "ai:resp:v2:" + hex.EncodeToString(sum[:20])
}

// ComputeStableSessionID gera um identificador opaco (sem PII, <= 32 chars) estável por
// (tenant + permissões) para manter afinidade de provedor (sticky routing) no OpenRouter
// entre Turno 1, Turno 2+ da mesma conversa e novas conversas da mesma empresa, maximizando
// o reaproveitamento do Prompt Cache (KV-cache) no DeepSeek e Qwen.
func ComputeStableSessionID(tenantID, permHash, _ string) string {
	sum := sha256.Sum256([]byte("tercerize-or-sess:v2:" + tenantID + ":" + permHash))
	return "trz_" + hex.EncodeToString(sum[:14])
}

// ComputePromptHash calcula o hash SHA-256 determinístico dos conteúdos exatos enviados ao modelo.
func ComputePromptHash(model string, messages []ChatMessage, tools []ToolDef) string {
	payload := struct {
		Model    string        `json:"model"`
		Messages []ChatMessage `json:"messages"`
		Tools    []ToolDef     `json:"tools,omitempty"`
	}{
		Model:    model,
		Messages: messages,
		Tools:    tools,
	}
	raw, _ := json.Marshal(payload)
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:16])
}

func normalizeCacheQuery(s string) string {
	fields := strings.Fields(strings.ToLower(strings.TrimSpace(s)))
	return strings.Join(fields, " ")
}

// EstimateModelCostUSD estima o custo efetivo quando o provedor não retorna usage.cost diretamente,
// aplicando desconto de prompt cache (cached_tokens ~ 0.1x–0.25x do input normal).
func EstimateModelCostUSD(model string, promptTokens, cachedTokens, completionTokens int) float64 {
	type rate struct{ inPerM, cachedInPerM, outPerM float64 }
	table := map[string]rate{
		"deepseek/deepseek-v4.1-flash":  {0.0507, 0.0127, 0.2028},
		"qwen/qwen3.7-flash":            {0.0300, 0.0075, 0.1300},
		"qwen/qwen3.8-flash":            {0.1500, 0.0375, 0.4700},
		"google/gemini-2.5-flash-lite":  {0.1000, 0.0100, 0.4000},
		"google/gemini-2.5-flash":       {0.3000, 0.0750, 2.5000},
		"google/gemini-4-carbon":        {2.0000, 0.5000, 10.0000},
	}
	r, ok := table[model]
	if !ok {
		if strings.HasSuffix(model, ":free") || model == "openrouter/free" || model == "guardrail" || model == "clarification_gate" {
			return 0
		}
		r = rate{0.0507, 0.0127, 0.2028}
	}
	uncached := promptTokens - cachedTokens
	if uncached < 0 {
		uncached = 0
	}
	return (float64(uncached)/1e6)*r.inPerM +
		(float64(cachedTokens)/1e6)*r.cachedInPerM +
		(float64(completionTokens)/1e6)*r.outPerM
}
