package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	ErrInvalidOpenRouterToken = errors.New("token OpenRouter inválido, expirado ou sem permissão")
	ErrInsufficientCredits    = errors.New("créditos OpenRouter insuficientes para o plano pago")
	ErrAllModelsFailed        = errors.New("todos os modelos configurados estão indisponíveis ou lentos no momento")
)

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type CompletionResult struct {
	Content          string
	ModelUsed        string
	LatencyMs        int
	FallbackCount    int
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
}

type Settings struct {
	Models          []string `json:"models"`
	TimeoutSeconds  int      `json:"timeoutSeconds"`
	CooldownSeconds int      `json:"cooldownSeconds"`
	MaxTokens       int      `json:"maxTokens"`
}

var DefaultModels = []string{
	"nvidia/nemotron-3-ultra-550b-a55b:free",
	"nvidia/nemotron-3.5-lightning:free",
	"meta-llama/llama-3.3-70b-instruct:free",
	"openrouter/free",
}

type OpenRouterClient struct {
	endpoint string
	appURL   string
	appName  string
	rdb      *redis.Client
	log      *slog.Logger
}

func NewOpenRouterClient(appURL, appName string, rdb *redis.Client, log *slog.Logger) *OpenRouterClient {
	return &OpenRouterClient{
		endpoint: "https://openrouter.ai/api/v1/chat/completions",
		appURL:   appURL,
		appName:  appName,
		rdb:      rdb,
		log:      log,
	}
}

func cooldownKey(model string) string {
	return "ai:model:cooldown:" + model
}

func (c *OpenRouterClient) IsModelInCooldown(ctx context.Context, model string) bool {
	if c.rdb == nil {
		return false
	}
	n, err := c.rdb.Exists(ctx, cooldownKey(model)).Result()
	return err == nil && n > 0
}

func (c *OpenRouterClient) MarkModelCooldown(ctx context.Context, model string, seconds int) {
	if c.rdb == nil || seconds <= 0 {
		return
	}
	_ = c.rdb.Set(ctx, cooldownKey(model), "1", time.Duration(seconds)*time.Second).Err()
}

func (c *OpenRouterClient) ClearCooldowns(ctx context.Context, models []string) {
	if c.rdb == nil || len(models) == 0 {
		return
	}
	keys := make([]string, 0, len(models))
	for _, m := range models {
		keys = append(keys, cooldownKey(m))
	}
	_ = c.rdb.Del(ctx, keys...).Err()
}

// Complete executa a chamada ao OpenRouter com a chave exclusiva da empresa (token),
// percorrendo a cadeia de modelos gratuitos e trocando automaticamente em caso de lentidão (timeout) ou erro.
func (c *OpenRouterClient) Complete(
	ctx context.Context,
	apiToken string,
	settings Settings,
	messages []ChatMessage,
) (*CompletionResult, error) {
	models := settings.Models
	if len(models) == 0 {
		models = DefaultModels
	}
	baseTimeout := settings.TimeoutSeconds
	if baseTimeout < 5 {
		baseTimeout = 15
	}
	cooldownSec := settings.CooldownSeconds
	if cooldownSec < 30 {
		cooldownSec = 180
	}
	maxTokens := settings.MaxTokens
	if maxTokens < 500 || maxTokens > 8192 {
		maxTokens = 2400
	}

	// Prioriza modelos fora de cooldown; mantém os em cooldown no fim da fila para nunca ficar sem tentar.
	healthy := make([]string, 0, len(models))
	cooled := make([]string, 0, len(models))
	for _, m := range models {
		trimmed := strings.TrimSpace(m)
		if trimmed == "" {
			continue
		}
		if c.IsModelInCooldown(ctx, trimmed) {
			cooled = append(cooled, trimmed)
		} else {
			healthy = append(healthy, trimmed)
		}
	}
	ordered := append(healthy, cooled...)
	if len(ordered) == 0 {
		ordered = DefaultModels
	}

	var lastErr error
	fallbacks := 0

	for idx, model := range ordered {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		attemptTimeout := time.Duration(baseTimeout) * time.Second
		// Dá uma folga maior para o último fallback (especialmente openrouter/free)
		if idx == len(ordered)-1 && attemptTimeout < 20*time.Second {
			attemptTimeout = 20 * time.Second
		}

		start := time.Now()
		content, actualModel, usage, statusCode, err := c.callSingleModel(ctx, apiToken, model, messages, attemptTimeout, maxTokens)
		elapsedMs := int(time.Since(start).Milliseconds())

		if err == nil && strings.TrimSpace(content) != "" {
			if actualModel == "" {
				actualModel = model
			}
			return &CompletionResult{
				Content:          strings.TrimSpace(content),
				ModelUsed:        actualModel,
				LatencyMs:        elapsedMs,
				FallbackCount:    fallbacks,
				PromptTokens:     usage.PromptTokens,
				CompletionTokens: usage.CompletionTokens,
				TotalTokens:      usage.TotalTokens,
			}, nil
		}

		// Se o cliente desconectou ou o contexto pai expirou, não envenena o cooldown dos modelos.
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}

		// Token inválido (401) -> aborta imediatamente
		if statusCode == http.StatusUnauthorized {
			c.log.Warn("token OpenRouter rejeitado (401)", "status", statusCode, "model", model)
			return nil, ErrInvalidOpenRouterToken
		}

		// Créditos esgotados (402) -> sinaliza especificamente para aviso e downgrade automático ao plano Free
		if statusCode == http.StatusPaymentRequired {
			c.log.Warn("créditos OpenRouter esgotados (402)", "status", statusCode, "model", model)
			return nil, ErrInsufficientCredits
		}

		lastErr = err
		fallbacks++
		c.log.Warn("fallback de modelo OpenRouter acionado",
			"model", model,
			"status", statusCode,
			"latency_ms", elapsedMs,
			"err", err,
		)
		c.MarkModelCooldown(ctx, model, cooldownSec)
	}

	return nil, fmt.Errorf("%w: %v", ErrAllModelsFailed, lastErr)
}

type tokenUsage struct {
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
}

func (c *OpenRouterClient) callSingleModel(
	parentCtx context.Context,
	apiToken string,
	model string,
	messages []ChatMessage,
	timeout time.Duration,
	maxTokens int,
) (content string, resolvedModel string, usage tokenUsage, statusCode int, err error) {
	reqCtx, cancel := context.WithTimeout(parentCtx, timeout)
	defer cancel()

	payload := map[string]any{
		"model":       model,
		"messages":    messages,
		"temperature": 0.25,
		"max_tokens":  maxTokens,
		"reasoning":   map[string]any{"effort": "low"},
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return "", "", usage, 0, err
	}

	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, c.endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", "", usage, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(apiToken))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", c.appURL)
	req.Header.Set("X-Title", c.appName)

	httpClient := &http.Client{Timeout: timeout + 2*time.Second}
	resp, err := httpClient.Do(req)
	if err != nil {
		return "", "", usage, 0, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return "", "", usage, resp.StatusCode, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", usage, resp.StatusCode, fmt.Errorf("HTTP %d: %s", resp.StatusCode, truncateErr(string(respBody), 180))
	}

	var parsed struct {
		Model   string `json:"model"`
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage *struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", "", usage, resp.StatusCode, err
	}
	if parsed.Error != nil && parsed.Error.Message != "" {
		return "", "", usage, resp.StatusCode, errors.New(parsed.Error.Message)
	}
	if parsed.Usage != nil {
		usage = tokenUsage{
			PromptTokens:     parsed.Usage.PromptTokens,
			CompletionTokens: parsed.Usage.CompletionTokens,
			TotalTokens:      parsed.Usage.TotalTokens,
		}
		if usage.TotalTokens == 0 {
			usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
		}
	}
	if len(parsed.Choices) == 0 || strings.TrimSpace(parsed.Choices[0].Message.Content) == "" {
		return "", "", usage, resp.StatusCode, errors.New("resposta vazia do modelo")
	}
	return parsed.Choices[0].Message.Content, parsed.Model, usage, resp.StatusCode, nil
}

func truncateErr(s string, max int) string {
	s = strings.TrimSpace(s)
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}
