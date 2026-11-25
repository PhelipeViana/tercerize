package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	ErrInvalidOpenRouterToken = errors.New("openrouter_invalid_token")
	ErrInsufficientCredits    = errors.New("openrouter_insufficient_credits")
	ErrAllModelsUnavailable   = errors.New("openrouter_all_models_unavailable")
)

type ToolCallFunction struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type ToolCall struct {
	ID       string           `json:"id"`
	Type     string           `json:"type"`
	Function ToolCallFunction `json:"function"`
}

type ChatMessage struct {
	Role       string     `json:"role"`
	Content    string     `json:"content"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
	Name       string     `json:"name,omitempty"`
}

type ToolFunctionDef struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

type ToolDef struct {
	Type     string          `json:"type"`
	Function ToolFunctionDef `json:"function"`
}

type Settings struct {
	Models                  []string
	TimeoutSeconds          int // Mantido por retrocompatibilidade (usado como TotalTimeoutSeconds se este for 0)
	TTFTTimeoutSeconds      int // Timeout para receber o primeiro byte/token no streaming
	TotalTimeoutSeconds     int // Timeout total da geração
	CooldownSeconds         int
	MaxTokens               int
	Temperature             *float64
	ReasoningEnabled        bool
	ReasoningEffort         string
	ProviderSort            string
	SessionID               string // Afinidade de provedor (sticky routing) p/ Prompt Cache DeepSeek/Qwen
	OpenRouterResponseCache bool   // Habilita X-OpenRouter-Cache (DESABILITADO por padrão p/ dados sensíveis)
	OpenRouterCacheTTL      int    // TTL em segundos para X-OpenRouter-Cache-TTL quando habilitado
}

type ChatResult struct {
	Content               string
	ModelUsed             string
	LatencyMs             int
	TTFTMs                int
	GenerationMs          int
	FallbackCount         int
	PromptTokens          int
	CachedTokens          int
	CacheWriteTokens      int
	CompletionTokens      int
	TotalTokens           int
	CostUSD               float64
	OpenRouterCacheStatus string
	OpenRouterCacheAge    string
	ToolCalls             []ToolCall
	FinishReason          string
}

type EmbeddingResult struct {
	Vector       []float32
	ModelUsed    string
	PromptTokens int
}

type BatchEmbeddingResult struct {
	Vectors      [][]float32
	ModelUsed    string
	PromptTokens int
}

// DefaultModels aponta para a cadeia interna padrão (DeepSeek v4.1 Flash + fallbacks Qwen).
var DefaultModels = []string{
	PrimaryAssistantModel,
	QwenFastFallbackModel,
	QwenDetailFallbackModel,
}

type OpenRouterClient struct {
	httpClient *http.Client
	endpoint   string
	embedURL   string
	appURL     string
	appName    string
	rdb        *redis.Client
	log        *slog.Logger
}

func NewOpenRouterClient(appURL, appName string, rdb *redis.Client, log *slog.Logger) *OpenRouterClient {
	return &OpenRouterClient{
		httpClient: &http.Client{
			Timeout: 115 * time.Second,
		},
		endpoint: "https://openrouter.ai/api/v1/chat/completions",
		embedURL: "https://openrouter.ai/api/v1/embeddings",
		appURL:   appURL,
		appName:  appName,
		rdb:      rdb,
		log:      log,
	}
}

func (c *OpenRouterClient) cooldownKey(model string) string {
	return "ai:or:cooldown:" + model
}

func (c *OpenRouterClient) isInCooldown(ctx context.Context, model string) bool {
	if c.rdb == nil {
		return false
	}
	n, err := c.rdb.Exists(ctx, c.cooldownKey(model)).Result()
	return err == nil && n > 0
}

func (c *OpenRouterClient) markCooldown(ctx context.Context, model string, seconds int) {
	if c.rdb == nil || seconds <= 0 {
		return
	}
	_ = c.rdb.Set(ctx, c.cooldownKey(model), "1", time.Duration(seconds)*time.Second).Err()
}

func (c *OpenRouterClient) ClearCooldowns(ctx context.Context, models []string) {
	if c.rdb == nil {
		return
	}
	for _, m := range models {
		_ = c.rdb.Del(ctx, c.cooldownKey(m)).Err()
	}
}

func (c *OpenRouterClient) IsModelInCooldown(ctx context.Context, model string) bool {
	return c.isInCooldown(ctx, model)
}

func (c *OpenRouterClient) prepareOrderedModels(ctx context.Context, rawModels []string) []string {
	models := dedupeModels(rawModels)
	if len(models) == 0 {
		models = DefaultModels
	}
	healthy := make([]string, 0, len(models))
	cooled := make([]string, 0, len(models))
	for _, m := range models {
		if c.isInCooldown(ctx, m) {
			cooled = append(cooled, m)
		} else {
			healthy = append(healthy, m)
		}
	}
	ordered := append(healthy, cooled...)
	if len(ordered) == 0 {
		ordered = DefaultModels
	}
	return ordered
}

func (c *OpenRouterClient) resolveTimeouts(cfg Settings) (ttftSec, totalSec, cooldownSec, maxTokens int) {
	totalSec = cfg.TotalTimeoutSeconds
	if totalSec <= 0 {
		totalSec = cfg.TimeoutSeconds
	}
	if totalSec < 8 || totalSec > 90 {
		totalSec = 40
	}
	ttftSec = cfg.TTFTTimeoutSeconds
	if ttftSec <= 0 {
		ttftSec = 10
	}
	if ttftSec > totalSec {
		ttftSec = totalSec
	}
	cooldownSec = cfg.CooldownSeconds
	if cooldownSec < 30 || cooldownSec > 1800 {
		cooldownSec = 120
	}
	maxTokens = cfg.MaxTokens
	if maxTokens < 256 || maxTokens > 8192 {
		maxTokens = 2400
	}
	return
}

// Complete executa completion padrão (sem tools, não-streaming) com circuit breaker + fallback.
func (c *OpenRouterClient) Complete(ctx context.Context, apiToken string, cfg Settings, messages []ChatMessage) (ChatResult, error) {
	return c.CompleteWithTools(ctx, apiToken, cfg, messages, nil)
}

// CompleteWithTools executa completion com suporte opcional a function calling (tools) e fallback automático.
func (c *OpenRouterClient) CompleteWithTools(
	ctx context.Context,
	apiToken string,
	cfg Settings,
	messages []ChatMessage,
	tools []ToolDef,
) (ChatResult, error) {
	ordered := c.prepareOrderedModels(ctx, cfg.Models)
	_, totalSec, cooldownSec, maxTokens := c.resolveTimeouts(cfg)

	startAll := time.Now()
	fallbacks := 0
	var lastErr error

	for idx, model := range ordered {
		attemptTimeout := time.Duration(totalSec) * time.Second
		if idx == len(ordered)-1 && attemptTimeout < 35*time.Second {
			attemptTimeout = 35 * time.Second
		}

		res, statusCode, err := c.callSingle(ctx, apiToken, model, messages, tools, maxTokens, cfg, attemptTimeout)
		// Se o provedor/modelo recusou o parâmetro tools (400/422), tenta novamente sem tools no mesmo modelo
		if err != nil && len(tools) > 0 && (statusCode == http.StatusBadRequest || statusCode == http.StatusUnprocessableEntity) {
			c.log.Warn("modelo recusou tools — tentando sem function calling", "model", model, "status", statusCode)
			res, statusCode, err = c.callSingle(ctx, apiToken, model, messages, nil, maxTokens, cfg, attemptTimeout)
		}

		if err == nil {
			res.LatencyMs = int(time.Since(startAll).Milliseconds())
			res.FallbackCount = fallbacks
			return res, nil
		}

		if statusCode == http.StatusUnauthorized || statusCode == http.StatusForbidden {
			return ChatResult{}, ErrInvalidOpenRouterToken
		}
		if statusCode == http.StatusPaymentRequired {
			return ChatResult{}, ErrInsufficientCredits
		}
		if ctx.Err() != nil {
			return ChatResult{}, ctx.Err()
		}

		lastErr = err
		fallbacks++
		c.log.Warn("modelo OpenRouter falhou — acionando fallback",
			"model", model,
			"status", statusCode,
			"err", err,
		)
		c.markCooldown(ctx, model, cooldownSec)
	}

	if lastErr != nil {
		return ChatResult{}, fmt.Errorf("%w: %v", ErrAllModelsUnavailable, lastErr)
	}
	return ChatResult{}, ErrAllModelsUnavailable
}

// StreamComplete executa streaming SSE da OpenRouter com TTFT timeout separado do timeout total.
// Se um modelo falhar ANTES de emitir qualquer token, o fallback troca transparentemente para o próximo.
func (c *OpenRouterClient) StreamComplete(
	ctx context.Context,
	apiToken string,
	cfg Settings,
	messages []ChatMessage,
	onDelta func(delta string),
) (ChatResult, error) {
	ordered := c.prepareOrderedModels(ctx, cfg.Models)
	ttftSec, totalSec, cooldownSec, maxTokens := c.resolveTimeouts(cfg)

	startAll := time.Now()
	fallbacks := 0
	var lastErr error

	for idx, model := range ordered {
		ttftTimeout := time.Duration(ttftSec) * time.Second
		totalTimeout := time.Duration(totalSec) * time.Second
		if idx == len(ordered)-1 && totalTimeout < 45*time.Second {
			totalTimeout = 45 * time.Second
		}

		res, statusCode, emittedAny, err := c.callSingleStream(ctx, apiToken, model, messages, maxTokens, cfg, ttftTimeout, totalTimeout, onDelta)
		// Se o provedor devolveu HTTP 200 com stream vazio (comum quando o upstream ignora SSE), tenta 1 chamada síncrona no mesmo modelo!
		if err != nil && !emittedAny && statusCode == http.StatusOK && ctx.Err() == nil {
			syncRes, syncStatus, syncErr := c.callSingle(ctx, apiToken, model, messages, nil, maxTokens, cfg, totalTimeout)
			if syncErr == nil && strings.TrimSpace(syncRes.Content) != "" {
				if onDelta != nil {
					emitChunkedDelta(syncRes.Content, onDelta)
				}
				syncRes.LatencyMs = int(time.Since(startAll).Milliseconds())
				syncRes.FallbackCount = fallbacks
				return syncRes, nil
			}
			if syncStatus == http.StatusPaymentRequired {
				return ChatResult{}, ErrInsufficientCredits
			}
		}
		if err == nil {
			res.LatencyMs = int(time.Since(startAll).Milliseconds())
			res.FallbackCount = fallbacks
			return res, nil
		}

		if statusCode == http.StatusUnauthorized || statusCode == http.StatusForbidden {
			return ChatResult{}, ErrInvalidOpenRouterToken
		}
		if statusCode == http.StatusPaymentRequired {
			return ChatResult{}, ErrInsufficientCredits
		}
		if ctx.Err() != nil {
			return ChatResult{}, ctx.Err()
		}
		// Se já enviou conteúdo parcial ao cliente e depois caiu, retorna o conteúdo parcial se suficiente ou erro sem duplicar texto
		if emittedAny {
			if len(strings.TrimSpace(res.Content)) > 20 {
				res.LatencyMs = int(time.Since(startAll).Milliseconds())
				res.FallbackCount = fallbacks
				return res, nil
			}
			return ChatResult{}, err
		}

		lastErr = err
		fallbacks++
		c.log.Warn("stream OpenRouter falhou antes do 1º token — acionando fallback",
			"model", model,
			"status", statusCode,
			"err", err,
		)
		c.markCooldown(ctx, model, cooldownSec)
	}

	if lastErr != nil {
		return ChatResult{}, fmt.Errorf("%w: %v", ErrAllModelsUnavailable, lastErr)
	}
	return ChatResult{}, ErrAllModelsUnavailable
}

func (c *OpenRouterClient) buildChatPayload(model string, messages []ChatMessage, tools []ToolDef, maxTokens int, cfg Settings, stream bool) map[string]any {
	t := 0.2
	if cfg.Temperature != nil {
		t = *cfg.Temperature
	}
	payload := map[string]any{
		"model":       model,
		"messages":    messages,
		"temperature": t,
		"max_tokens":  maxTokens,
		"stream":      stream,
	}
	if cfg.ReasoningEnabled {
		effort := strings.TrimSpace(cfg.ReasoningEffort)
		if effort == "" {
			effort = "medium"
		}
		payload["reasoning"] = map[string]any{"effort": effort}
	} else {
		// Desabilita reasoning oculto nos níveis rápidos/padrão para evitar latência extra e gasto oculto de tokens
		payload["reasoning"] = map[string]any{"enabled": false}
	}
	if sortMode := strings.TrimSpace(cfg.ProviderSort); sortMode != "" {
		payload["provider"] = map[string]any{"sort": sortMode}
	}
	if sid := strings.TrimSpace(cfg.SessionID); sid != "" {
		// Afinidade com provedor (sticky routing) no OpenRouter para preservar KV-cache do DeepSeek e Qwen
		payload["session_id"] = sid
	}
	if stream {
		payload["stream_options"] = map[string]any{"include_usage": true}
	}
	if len(tools) > 0 {
		payload["tools"] = tools
		payload["tool_choice"] = "auto"
	}
	return payload
}

func (c *OpenRouterClient) applyHeaders(req *http.Request, apiToken string) {
	req.Header.Set("Authorization", "Bearer "+apiToken)
	req.Header.Set("Content-Type", "application/json")
	if c.appURL != "" {
		req.Header.Set("HTTP-Referer", c.appURL)
	}
	if c.appName != "" {
		req.Header.Set("X-Title", c.appName)
	}
}

func (c *OpenRouterClient) applyChatCacheHeaders(req *http.Request, cfg Settings) {
	if sid := strings.TrimSpace(cfg.SessionID); sid != "" {
		req.Header.Set("X-Session-Id", sid)
	}
	if cfg.OpenRouterResponseCache {
		req.Header.Set("X-OpenRouter-Cache", "true")
		if cfg.OpenRouterCacheTTL > 0 {
			req.Header.Set("X-OpenRouter-Cache-TTL", fmt.Sprintf("%d", cfg.OpenRouterCacheTTL))
		}
	}
}

func (c *OpenRouterClient) callSingle(
	ctx context.Context,
	apiToken string,
	model string,
	messages []ChatMessage,
	tools []ToolDef,
	maxTokens int,
	cfg Settings,
	timeout time.Duration,
) (ChatResult, int, error) {
	body, err := json.Marshal(c.buildChatPayload(model, messages, tools, maxTokens, cfg, false))
	if err != nil {
		return ChatResult{}, 0, err
	}

	reqCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, c.endpoint, bytes.NewReader(body))
	if err != nil {
		return ChatResult{}, 0, err
	}
	c.applyHeaders(req, apiToken)
	c.applyChatCacheHeaders(req, cfg)

	callStart := time.Now()
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return ChatResult{}, 0, err
	}
	defer resp.Body.Close()

	orCacheStatus := strings.TrimSpace(resp.Header.Get("X-OpenRouter-Cache-Status"))
	orCacheAge := strings.TrimSpace(resp.Header.Get("Age"))

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return ChatResult{}, resp.StatusCode, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return ChatResult{}, resp.StatusCode, fmt.Errorf("HTTP %d: %s", resp.StatusCode, truncateErr(string(raw), 240))
	}

	var parsed struct {
		Model   string `json:"model"`
		Choices []struct {
			FinishReason string `json:"finish_reason"`
			Message      struct {
				Content   any        `json:"content"`
				ToolCalls []ToolCall `json:"tool_calls"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			PromptTokens        int     `json:"prompt_tokens"`
			CompletionTokens    int     `json:"completion_tokens"`
			TotalTokens         int     `json:"total_tokens"`
			Cost                float64 `json:"cost"`
			PromptTokensDetails struct {
				CachedTokens     int `json:"cached_tokens"`
				CacheWriteTokens int `json:"cache_write_tokens"`
			} `json:"prompt_tokens_details"`
		} `json:"usage"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return ChatResult{}, resp.StatusCode, fmt.Errorf("json inválido do OpenRouter: %w", err)
	}
	if parsed.Error != nil && parsed.Error.Message != "" {
		return ChatResult{}, resp.StatusCode, errors.New(parsed.Error.Message)
	}
	if len(parsed.Choices) == 0 {
		return ChatResult{}, resp.StatusCode, errors.New("resposta vazia sem choices")
	}

	choice := parsed.Choices[0]
	content := extractTextContent(choice.Message.Content)
	if strings.TrimSpace(content) == "" && len(choice.Message.ToolCalls) == 0 {
		return ChatResult{}, resp.StatusCode, errors.New("conteúdo vazio retornado pelo modelo")
	}

	usedModel := parsed.Model
	if strings.TrimSpace(usedModel) == "" {
		usedModel = model
	}

	totalTok := parsed.Usage.TotalTokens
	if totalTok == 0 {
		totalTok = parsed.Usage.PromptTokens + parsed.Usage.CompletionTokens
	}
	costUSD := parsed.Usage.Cost
	if costUSD <= 0 && orCacheStatus != "HIT" {
		costUSD = EstimateModelCostUSD(usedModel, parsed.Usage.PromptTokens, parsed.Usage.PromptTokensDetails.CachedTokens, parsed.Usage.CompletionTokens)
	}
	elapsedMs := int(time.Since(callStart).Milliseconds())

	return ChatResult{
		Content:               strings.TrimSpace(content),
		ModelUsed:             usedModel,
		TTFTMs:                elapsedMs,
		GenerationMs:          elapsedMs,
		PromptTokens:          parsed.Usage.PromptTokens,
		CachedTokens:          parsed.Usage.PromptTokensDetails.CachedTokens,
		CacheWriteTokens:      parsed.Usage.PromptTokensDetails.CacheWriteTokens,
		CompletionTokens:      parsed.Usage.CompletionTokens,
		TotalTokens:           totalTok,
		CostUSD:               costUSD,
		OpenRouterCacheStatus: orCacheStatus,
		OpenRouterCacheAge:    orCacheAge,
		ToolCalls:             choice.Message.ToolCalls,
		FinishReason:          choice.FinishReason,
	}, resp.StatusCode, nil
}

func (c *OpenRouterClient) callSingleStream(
	ctx context.Context,
	apiToken string,
	model string,
	messages []ChatMessage,
	maxTokens int,
	cfg Settings,
	ttftTimeout time.Duration,
	totalTimeout time.Duration,
	onDelta func(delta string),
) (ChatResult, int, bool, error) {
	body, err := json.Marshal(c.buildChatPayload(model, messages, nil, maxTokens, cfg, true))
	if err != nil {
		return ChatResult{}, 0, false, err
	}

	reqCtx, cancel := context.WithTimeout(ctx, totalTimeout)
	defer cancel()

	// Watchdog de TTFT: aborta a requisição se o primeiro token não chegar dentro de ttftTimeout
	firstTokenCh := make(chan struct{})
	go func() {
		timer := time.NewTimer(ttftTimeout)
		defer timer.Stop()
		select {
		case <-firstTokenCh:
			return
		case <-reqCtx.Done():
			return
		case <-timer.C:
			cancel()
		}
	}()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, c.endpoint, bytes.NewReader(body))
	if err != nil {
		return ChatResult{}, 0, false, err
	}
	c.applyHeaders(req, apiToken)
	c.applyChatCacheHeaders(req, cfg)
	req.Header.Set("Accept", "text/event-stream")

	streamStart := time.Now()
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return ChatResult{}, 0, false, err
	}
	defer resp.Body.Close()

	orCacheStatus := strings.TrimSpace(resp.Header.Get("X-OpenRouter-Cache-Status"))
	orCacheAge := strings.TrimSpace(resp.Header.Get("Age"))

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return ChatResult{}, resp.StatusCode, false, fmt.Errorf("HTTP %d: %s", resp.StatusCode, truncateErr(string(raw), 240))
	}

	var buf strings.Builder
	usedModel := model
	var promptTok, cachedTok, cacheWriteTok, completionTok, totalTok int
	var costUSD float64
	var ttftMs int
	emittedAny := false
	firstClosed := false
	markFirst := func() {
		if !firstClosed {
			firstClosed = true
			close(firstTokenCh)
		}
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, ":") {
			continue
		}
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			break
		}

		var chunk struct {
			Model   string `json:"model"`
			Choices []struct {
				Delta struct {
					Content   any    `json:"content"`
					Reasoning string `json:"reasoning"`
				} `json:"delta"`
				FinishReason string `json:"finish_reason"`
			} `json:"choices"`
			Usage *struct {
				PromptTokens        int     `json:"prompt_tokens"`
				CompletionTokens    int     `json:"completion_tokens"`
				TotalTokens         int     `json:"total_tokens"`
				Cost                float64 `json:"cost"`
				PromptTokensDetails struct {
					CachedTokens     int `json:"cached_tokens"`
					CacheWriteTokens int `json:"cache_write_tokens"`
				} `json:"prompt_tokens_details"`
			} `json:"usage"`
			Error *struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if chunk.Error != nil && chunk.Error.Message != "" {
			markFirst()
			return ChatResult{Content: buf.String(), ModelUsed: usedModel}, resp.StatusCode, emittedAny, errors.New(chunk.Error.Message)
		}
		if strings.TrimSpace(chunk.Model) != "" {
			usedModel = chunk.Model
		}
		if chunk.Usage != nil {
			promptTok = chunk.Usage.PromptTokens
			cachedTok = chunk.Usage.PromptTokensDetails.CachedTokens
			cacheWriteTok = chunk.Usage.PromptTokensDetails.CacheWriteTokens
			completionTok = chunk.Usage.CompletionTokens
			totalTok = chunk.Usage.TotalTokens
			if chunk.Usage.Cost > 0 {
				costUSD = chunk.Usage.Cost
			}
		}
		if len(chunk.Choices) > 0 {
			if chunk.Choices[0].Delta.Reasoning != "" {
				markFirst()
			}
			delta := extractTextContent(chunk.Choices[0].Delta.Content)
			if delta != "" {
				markFirst()
				if !emittedAny {
					ttftMs = int(time.Since(streamStart).Milliseconds())
				}
				emittedAny = true
				buf.WriteString(delta)
				if onDelta != nil {
					onDelta(delta)
				}
			}
		}
	}
	markFirst()

	totalStreamMs := int(time.Since(streamStart).Milliseconds())
	genMs := totalStreamMs - ttftMs
	if genMs < 0 {
		genMs = 0
	}

	if err := scanner.Err(); err != nil {
		return ChatResult{
			Content:               strings.TrimSpace(buf.String()),
			ModelUsed:             usedModel,
			TTFTMs:                ttftMs,
			GenerationMs:          genMs,
			PromptTokens:          promptTok,
			CachedTokens:          cachedTok,
			CacheWriteTokens:      cacheWriteTok,
			CompletionTokens:      completionTok,
			TotalTokens:           totalTok,
			CostUSD:               costUSD,
			OpenRouterCacheStatus: orCacheStatus,
			OpenRouterCacheAge:    orCacheAge,
		}, resp.StatusCode, emittedAny, err
	}

	content := strings.TrimSpace(buf.String())
	if content == "" {
		return ChatResult{}, resp.StatusCode, emittedAny, errors.New("stream vazio retornado pelo modelo")
	}
	if totalTok == 0 {
		totalTok = promptTok + completionTok
	}
	if costUSD <= 0 && orCacheStatus != "HIT" {
		costUSD = EstimateModelCostUSD(usedModel, promptTok, cachedTok, completionTok)
	}

	return ChatResult{
		Content:               content,
		ModelUsed:             usedModel,
		TTFTMs:                ttftMs,
		GenerationMs:          genMs,
		PromptTokens:          promptTok,
		CachedTokens:          cachedTok,
		CacheWriteTokens:      cacheWriteTok,
		CompletionTokens:      completionTok,
		TotalTokens:           totalTok,
		CostUSD:               costUSD,
		OpenRouterCacheStatus: orCacheStatus,
		OpenRouterCacheAge:    orCacheAge,
	}, resp.StatusCode, emittedAny, nil
}

// Embed gera um único embedding (atalho seguro sobre EmbedBatch).
func (c *OpenRouterClient) Embed(ctx context.Context, apiToken, model, input string, dimensions int) (EmbeddingResult, error) {
	return c.EmbedWithType(ctx, apiToken, model, input, dimensions, "search_query")
}

// EmbedWithType gera embedding único informando o papel (search_query ou search_document) quando suportado pelo provedor.
func (c *OpenRouterClient) EmbedWithType(ctx context.Context, apiToken, model, input string, dimensions int, inputType string) (EmbeddingResult, error) {
	batch, err := c.EmbedBatch(ctx, apiToken, model, []string{input}, dimensions, inputType)
	if err != nil {
		return EmbeddingResult{}, err
	}
	if len(batch.Vectors) != 1 {
		return EmbeddingResult{}, fmt.Errorf("embedding retornou %d vetores (esperado 1)", len(batch.Vectors))
	}
	return EmbeddingResult{
		Vector:       batch.Vectors[0],
		ModelUsed:    batch.ModelUsed,
		PromptTokens: batch.PromptTokens,
	}, nil
}

// EmbedBatch gera embeddings em lote com validação segura (sem risco de panic em payload vazio)
// e detecção explícita de HTTP 401/402.
func (c *OpenRouterClient) EmbedBatch(
	ctx context.Context,
	apiToken string,
	model string,
	inputs []string,
	dimensions int,
	inputType string,
) (BatchEmbeddingResult, error) {
	if len(inputs) == 0 {
		return BatchEmbeddingResult{}, nil
	}
	if strings.TrimSpace(model) == "" {
		model = DefaultEmbeddingModel
	}

	payload := map[string]any{
		"model": model,
		"input": inputs,
	}
	if dimensions > 0 && supportsMatryoshkaDimensions(model) {
		payload["dimensions"] = dimensions
	}
	if inputType != "" && supportsEmbeddingInputType(model) {
		payload["input_type"] = inputType
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return BatchEmbeddingResult{}, err
	}

	reqCtx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, c.embedURL, bytes.NewReader(body))
	if err != nil {
		return BatchEmbeddingResult{}, err
	}
	c.applyHeaders(req, apiToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return BatchEmbeddingResult{}, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return BatchEmbeddingResult{}, err
	}
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return BatchEmbeddingResult{}, ErrInvalidOpenRouterToken
	}
	if resp.StatusCode == http.StatusPaymentRequired {
		return BatchEmbeddingResult{}, ErrInsufficientCredits
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return BatchEmbeddingResult{}, fmt.Errorf("HTTP %d: %s", resp.StatusCode, truncateErr(string(raw), 240))
	}

	var parsed struct {
		Model string `json:"model"`
		Data  []struct {
			Index     int       `json:"index"`
			Embedding []float32 `json:"embedding"`
		} `json:"data"`
		Usage struct {
			PromptTokens int `json:"prompt_tokens"`
		} `json:"usage"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return BatchEmbeddingResult{}, fmt.Errorf("json inválido do OpenRouter embeddings: %w", err)
	}
	if parsed.Error != nil && parsed.Error.Message != "" {
		return BatchEmbeddingResult{}, errors.New(parsed.Error.Message)
	}
	if len(parsed.Data) != len(inputs) {
		return BatchEmbeddingResult{}, fmt.Errorf("embedding retornou %d itens (esperado %d)", len(parsed.Data), len(inputs))
	}

	sort.Slice(parsed.Data, func(i, j int) bool {
		return parsed.Data[i].Index < parsed.Data[j].Index
	})

	vectors := make([][]float32, len(parsed.Data))
	for i, item := range parsed.Data {
		if dimensions > 0 && len(item.Embedding) != dimensions {
			return BatchEmbeddingResult{}, fmt.Errorf("embedding[%d] com dimensão inesperada: %d (esperado %d)", i, len(item.Embedding), dimensions)
		}
		vectors[i] = item.Embedding
	}

	usedModel := parsed.Model
	if strings.TrimSpace(usedModel) == "" {
		usedModel = model
	}

	return BatchEmbeddingResult{
		Vectors:      vectors,
		ModelUsed:    usedModel,
		PromptTokens: parsed.Usage.PromptTokens,
	}, nil
}

func supportsMatryoshkaDimensions(model string) bool {
	low := strings.ToLower(model)
	return strings.HasPrefix(low, "openai/text-embedding-3") ||
		strings.Contains(low, "qwen3-embedding") ||
		strings.Contains(low, "gemini-embedding")
}

func supportsEmbeddingInputType(model string) bool {
	low := strings.ToLower(model)
	return strings.HasPrefix(low, "nvidia/") || strings.HasPrefix(low, "cohere/")
}

func extractTextContent(raw any) string {
	switch v := raw.(type) {
	case string:
		return v
	case []any:
		var sb strings.Builder
		for _, part := range v {
			if m, ok := part.(map[string]any); ok {
				if t, ok := m["text"].(string); ok {
					sb.WriteString(t)
				}
			}
		}
		return sb.String()
	default:
		return ""
	}
}

func truncateErr(s string, max int) string {
	r := []rune(strings.TrimSpace(s))
	if len(r) <= max {
		return string(r)
	}
	return string(r[:max]) + "…"
}
