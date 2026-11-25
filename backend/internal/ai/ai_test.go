package ai

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestInternalProfiles_DeepSeekAndQwenSlugs(t *testing.T) {
	profiles := InternalProfiles()
	for key, p := range profiles {
		if len(p.Models) == 0 {
			t.Fatalf("perfil %s sem modelos", key)
		}
		for _, m := range p.Models {
			if !strings.Contains(m, "/") || strings.Contains(m, " ") {
				t.Fatalf("perfil %s contém slug inválido: %q", key, m)
			}
		}
	}

	fast := ProfileForTier("simple", DepthSummaryNumbers)
	if fast.Models[0] != SimpleAssistantModel || fast.ReasoningEnabled {
		t.Fatalf("esperado simples=%s sem reasoning, obtido %+v", SimpleAssistantModel, fast)
	}

	good := ProfileForTier("good", DepthSummaryNumbers)
	if good.Models[0] != PrimaryAssistantModel || good.Models[1] != QwenFastFallbackModel || good.ReasoningEnabled {
		t.Fatalf("esperado bom=%s -> %s, obtido %+v", PrimaryAssistantModel, QwenFastFallbackModel, good)
	}

	great := ProfileForTier("great", DepthDetailedFull)
	if great.Models[0] != QwenDetailFallbackModel || great.ReasoningEnabled {
		t.Fatalf("esperado ótimo=%s, obtido %+v", QwenDetailFallbackModel, great)
	}

	excellent := ProfileForTier("excellent", DepthDetailedFull)
	if excellent.Models[0] != ExcellentAssistantModel || excellent.ReasoningEnabled {
		t.Fatalf("esperado excelente=%s, obtido %+v", ExcellentAssistantModel, excellent)
	}

	brute := ProfileForTier("brute", DepthDetailedFull)
	if brute.Models[0] != BruteAssistantModel || !brute.ReasoningEnabled {
		t.Fatalf("esperado bruto=%s com reasoning ativado, obtido %+v", BruteAssistantModel, brute)
	}
	if brute.MaxTokens <= good.MaxTokens {
		t.Fatalf("esperado maxTokens bruto (%d) > bom (%d)", brute.MaxTokens, good.MaxTokens)
	}
}

func TestEvaluateGate_MaxTwoQuestionsAndDirectExecution(t *testing.T) {
	// 1. Off-topic -> recusa imediata, 0 perguntas
	off := EvaluateGate("Me passe uma receita de bolo de cenoura", nil)
	if off.Intent != IntentOffTopic || off.Clarification.Needed {
		t.Fatalf("off-topic não bloqueado corretamente: %+v", off)
	}

	// 2. Consulta numérica direta -> 0 perguntas, modo summary_numbers
	direct := EvaluateGate("Quantas ordens de serviço abertas temos?", nil)
	if direct.Clarification.Needed || direct.Depth != DepthSummaryNumbers {
		t.Fatalf("consulta direta não deveria pedir clarificação: %+v", direct)
	}

	// 3. Busca por código específico -> 0 perguntas
	byCode := EvaluateGate("Me dê o relatório do contrato CTR-001", nil)
	if byCode.Clarification.Needed {
		t.Fatalf("busca por código específico não deveria pedir clarificação: %+v", byCode)
	}

	// 4. Relatório amplo ambíguo -> pede no máximo 2 perguntas + quickReplies
	broad := EvaluateGate("Gere um relatório financeiro", nil)
	if !broad.Clarification.Needed {
		t.Fatalf("relatório financeiro amplo deveria acionar gate de clarificação")
	}
	if len(broad.Clarification.Questions) == 0 || len(broad.Clarification.Questions) > MaxClarificationQuestions {
		t.Fatalf("quantidade de perguntas fora do limite 1..2: %d", len(broad.Clarification.Questions))
	}
	if len(broad.Clarification.QuickReplies) < 2 {
		t.Fatalf("esperado atalhos rápidos de clarificação")
	}

	// 5. Relatório com profundidade já definida, faltando só recorte -> apenas 1 pergunta
	partial := EvaluateGate("Gere um relatório completo em Excel de contratos", nil)
	if !partial.Clarification.Needed || len(partial.Clarification.Questions) != 1 {
		t.Fatalf("esperado exatamente 1 pergunta de recorte, obtido: needed=%v count=%d", partial.Clarification.Needed, len(partial.Clarification.Questions))
	}

	// 6. Relatório já com profundidade E recorte -> 0 perguntas, executa direto como detailed_full
	fullSpec := EvaluateGate("Gere um relatório completo em Excel de todos os contratos ativos", nil)
	if fullSpec.Clarification.Needed || fullSpec.Depth != DepthDetailedFull {
		t.Fatalf("relatório completo especificado deveria executar direto: %+v", fullSpec)
	}

	// 7. Resposta do usuário à clarificação -> NUNCA pergunta de novo e respeita "Só números"
	hist := []ChatMessage{
		{Role: "user", Content: "Gere um relatório financeiro"},
		{Role: "assistant", Content: broad.Clarification.Message},
	}
	replyNumbers := EvaluateGate("Quero apenas os números principais dos últimos 30 dias", hist)
	if replyNumbers.Clarification.Needed {
		t.Fatalf("não pode entrar em loop de clarificação após resposta do usuário")
	}
	if replyNumbers.Depth != DepthSummaryNumbers {
		t.Fatalf("esperado DepthSummaryNumbers, obtido %s", replyNumbers.Depth)
	}
	if !strings.Contains(replyNumbers.EffectiveMsg, "relatório financeiro") {
		t.Fatalf("contexto original perdido na resposta: %q", replyNumbers.EffectiveMsg)
	}

	// 8. Resposta do usuário escolhendo relatório completo -> DepthDetailedFull
	replyFull := EvaluateGate("Quero o relatório completo detalhado em tabela de todos ativos", hist)
	if replyFull.Clarification.Needed || replyFull.Depth != DepthDetailedFull {
		t.Fatalf("esperado DepthDetailedFull sem nova clarificação: %+v", replyFull)
	}
}

func TestOpenRouterEmbedBatch_NoPanicAndErrorMapping(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	t.Run("empty data array does not panic", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"model":"openai/text-embedding-3-small","data":[]}`))
		}))
		defer srv.Close()

		c := NewOpenRouterClient("https://tercerize.test", "Tercerize", nil, log)
		c.embedURL = srv.URL

		_, err := c.EmbedBatch(context.Background(), "sk-test", "openai/text-embedding-3-small", []string{"olá"}, 1536, "search_query")
		if err == nil {
			t.Fatalf("esperado erro quando data está vazio")
		}
	})

	t.Run("402 returns ErrInsufficientCredits", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusPaymentRequired)
			_, _ = w.Write([]byte(`{"error":{"message":"insufficient credits"}}`))
		}))
		defer srv.Close()

		c := NewOpenRouterClient("https://tercerize.test", "Tercerize", nil, log)
		c.embedURL = srv.URL

		_, err := c.EmbedBatch(context.Background(), "sk-test", "openai/text-embedding-3-small", []string{"olá"}, 1536, "search_query")
		if !errors.Is(err, ErrInsufficientCredits) {
			t.Fatalf("esperado ErrInsufficientCredits, obtido: %v", err)
		}
	})

	t.Run("openai model omits input_type and sorts batch indices", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var payload map[string]any
			_ = json.NewDecoder(r.Body).Decode(&payload)
			if _, hasInputType := payload["input_type"]; hasInputType {
				t.Errorf("modelo openai não deve receber input_type")
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"model":"openai/text-embedding-3-small","data":[{"index":1,"embedding":[0.4,0.5,0.6]},{"index":0,"embedding":[0.1,0.2,0.3]}],"usage":{"prompt_tokens":12}}`))
		}))
		defer srv.Close()

		c := NewOpenRouterClient("https://tercerize.test", "Tercerize", nil, log)
		c.embedURL = srv.URL

		res, err := c.EmbedBatch(context.Background(), "sk-test", "openai/text-embedding-3-small", []string{"a", "b"}, 3, "search_document")
		if err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		if len(res.Vectors) != 2 || res.Vectors[0][0] != 0.1 || res.Vectors[1][0] != 0.4 {
			t.Fatalf("vetores fora de ordem: %+v", res.Vectors)
		}
	})
}

func TestOpenRouterFallback_DeepSeekToQwenAndStream(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	calls := []string{}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload struct {
			Model  string `json:"model"`
			Stream bool   `json:"stream"`
		}
		_ = json.NewDecoder(r.Body).Decode(&payload)
		calls = append(calls, payload.Model)

		if payload.Model == PrimaryAssistantModel {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"error":{"message":"upstream overloaded"}}`))
			return
		}
		if payload.Stream {
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = w.Write([]byte("data: {\"model\":\"qwen/qwen3.7-flash\",\"choices\":[{\"delta\":{\"content\":\"Total: \"}}]}\n\n"))
			_, _ = w.Write([]byte("data: {\"model\":\"qwen/qwen3.7-flash\",\"choices\":[{\"delta\":{\"content\":\"42 contratos\"}}],\"usage\":{\"prompt_tokens\":100,\"completion_tokens\":12,\"total_tokens\":112}}\n\n"))
			_, _ = w.Write([]byte("data: [DONE]\n\n"))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"model":"qwen/qwen3.7-flash","choices":[{"finish_reason":"stop","message":{"content":"Resposta via Qwen"}}],"usage":{"prompt_tokens":50,"completion_tokens":10,"total_tokens":60}}`))
	}))
	defer srv.Close()

	c := NewOpenRouterClient("https://tercerize.test", "Tercerize", nil, log)
	c.endpoint = srv.URL

	var streamed strings.Builder
	res, err := c.StreamComplete(context.Background(), "sk-test", Settings{
		Models:              []string{PrimaryAssistantModel, QwenFastFallbackModel},
		TTFTTimeoutSeconds:  5,
		TotalTimeoutSeconds: 15,
	}, []ChatMessage{{Role: "user", Content: "teste"}}, func(delta string) {
		streamed.WriteString(delta)
	})
	if err != nil {
		t.Fatalf("stream falhou: %v", err)
	}
	if res.ModelUsed != QwenFastFallbackModel || res.FallbackCount != 1 {
		t.Fatalf("fallback incorreto: %+v", res)
	}
	if streamed.String() != "Total: 42 contratos" || res.TotalTokens != 112 {
		t.Fatalf("conteúdo/tokens stream incorretos: %q / %d", streamed.String(), res.TotalTokens)
	}
	if len(calls) != 2 || calls[0] != PrimaryAssistantModel || calls[1] != QwenFastFallbackModel {
		t.Fatalf("sequência de chamadas inesperada: %v", calls)
	}
}

func TestStripLegacyTelemetryFooter(t *testing.T) {
	in := "## Relatório\n\nDados reais.\n\n---\n*Modelo: `deepseek/deepseek-v4.1-flash` · Tempo de resposta do LLM: 2.34 s*"
	got := stripLegacyTelemetryFooter(in)
	if strings.Contains(got, "Tempo de resposta") || got != "## Relatório\n\nDados reais." {
		t.Fatalf("rodapé legado não removido: %q", got)
	}
}

func TestCacheKeyIsolationAndDeterministicHashes(t *testing.T) {
	base := ComputeResponseCacheKey("tenant-1", "user-1", "permA", 10, 2, ProfileGood, DepthDetailedFull, "Relatório  Financeiro ", "root")
	sameNormalized := ComputeResponseCacheKey("tenant-1", "user-1", "permA", 10, 2, ProfileGood, DepthDetailedFull, "relatório financeiro", "root")
	if base != sameNormalized {
		t.Fatalf("chaves equivalentes deveriam bater: %s != %s", base, sameNormalized)
	}

	diffTenant := ComputeResponseCacheKey("tenant-2", "user-1", "permA", 10, 2, ProfileGood, DepthDetailedFull, "relatório financeiro", "root")
	diffUser := ComputeResponseCacheKey("tenant-1", "user-2", "permA", 10, 2, ProfileGood, DepthDetailedFull, "relatório financeiro", "root")
	diffPerm := ComputeResponseCacheKey("tenant-1", "user-1", "permB", 10, 2, ProfileGood, DepthDetailedFull, "relatório financeiro", "root")
	diffDataVer := ComputeResponseCacheKey("tenant-1", "user-1", "permA", 11, 2, ProfileGood, DepthDetailedFull, "relatório financeiro", "root")
	diffRBACVer := ComputeResponseCacheKey("tenant-1", "user-1", "permA", 10, 3, ProfileGood, DepthDetailedFull, "relatório financeiro", "root")
	diffTier := ComputeResponseCacheKey("tenant-1", "user-1", "permA", 10, 2, ProfileBrute, DepthDetailedFull, "relatório financeiro", "root")
	for name, other := range map[string]string{
		"tenant": diffTenant, "user": diffUser, "perm": diffPerm,
		"dataVer": diffDataVer, "rbacVer": diffRBACVer, "tier": diffTier,
	} {
		if other == base {
			t.Fatalf("falha de isolamento de cache para dimensão %s", name)
		}
	}

	sid1 := ComputeStableSessionID("tenant-1", "permA", "")
	sid2 := ComputeStableSessionID("tenant-1", "permA", "conv-uuid-turn-2")
	sidOther := ComputeStableSessionID("tenant-2", "permA", "")
	sidOtherPerm := ComputeStableSessionID("tenant-1", "permB", "")
	if sid1 != sid2 || sid1 == sidOther || sid1 == sidOtherPerm || len(sid1) > 40 {
		t.Fatalf("session_id instável entre turnos ou sem isolamento: %q vs %q vs %q", sid1, sid2, sidOther)
	}

	h1 := ComputePromptHash("deepseek/deepseek-v4.1-flash", []ChatMessage{{Role: "system", Content: "abc"}}, nil)
	h2 := ComputePromptHash("deepseek/deepseek-v4.1-flash", []ChatMessage{{Role: "system", Content: "abc"}}, nil)
	if h1 != h2 || len(h1) == 0 {
		t.Fatalf("promptHash não determinístico: %q vs %q", h1, h2)
	}

	activeHistory := []ChatMessage{
		{Role: "user", Content: "Gere um resumo executivo completo da empresa"},
		{Role: "assistant", Content: "Resumo gerado..."},
	}
	if !IsStandaloneCacheableQuery("Gere um resumo executivo completo da empresa com os principais indicadores dos módulos disponíveis", activeHistory) {
		t.Fatalf("relatório completo repetido na mesma conversa deveria ser autocontido para HIT de cache")
	}
	if !IsStandaloneCacheableQuery("Quantos funcionários eu tenho?", activeHistory) {
		t.Fatalf("pergunta direta autocontida deveria reutilizar cache mesmo em conversa ativa")
	}
	for _, followUp := range []string{
		"E quais estão inativos?",
		"Tem certeza? Confira de novo",
		"Detalhe o segundo cliente acima",
		"Refaça sem erro",
		"Todos ativos",
	} {
		if IsStandaloneCacheableQuery(followUp, activeHistory) {
			t.Fatalf("mensagem contextual %q NÃO deveria ignorar histórico no cache", followUp)
		}
	}
}

func TestSingleflightCoalescesConcurrentCalls(t *testing.T) {
	rc := NewResponseCache(nil, 600)
	var execCount atomic.Int32
	var wg sync.WaitGroup
	sharedHits := atomic.Int32{}

	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			out, shared, err := rc.Do("same-report-key", func() (chatPipelineOutput, error) {
				execCount.Add(1)
				time.Sleep(40 * time.Millisecond)
				return chatPipelineOutput{Result: ChatResult{Content: "Relatório único"}}, nil
			})
			if err != nil || out.Result.Content != "Relatório único" {
				t.Errorf("resultado inesperado: %v %+v", err, out)
			}
			if shared {
				sharedHits.Add(1)
			}
		}()
	}
	wg.Wait()
	if execCount.Load() != 1 {
		t.Fatalf("singleflight falhou: executou %d vezes (esperado 1)", execCount.Load())
	}
	if sharedHits.Load() < 4 {
		t.Fatalf("esperado coalescência nas 5 chamadas concorrentes, shared=%d", sharedHits.Load())
	}
}

func TestOpenRouterCacheHeadersAndCachedTokensParsing(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	var gotSessionHdr, gotCacheHdr, gotTTLHdr, gotBodySession string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotSessionHdr = r.Header.Get("X-Session-Id")
		gotCacheHdr = r.Header.Get("X-OpenRouter-Cache")
		gotTTLHdr = r.Header.Get("X-OpenRouter-Cache-TTL")
		var payload map[string]any
		_ = json.NewDecoder(r.Body).Decode(&payload)
		if sid, ok := payload["session_id"].(string); ok {
			gotBodySession = sid
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-OpenRouter-Cache-Status", "HIT")
		w.Header().Set("Age", "14")
		_, _ = w.Write([]byte(`{
			"model":"deepseek/deepseek-v4.1-flash",
			"choices":[{"finish_reason":"stop","message":{"content":"Ok"}}],
			"usage":{
				"prompt_tokens":4000,
				"completion_tokens":200,
				"total_tokens":4200,
				"cost":0.00012,
				"prompt_tokens_details":{"cached_tokens":3200,"cache_write_tokens":0}
			}
		}`))
	}))
	defer srv.Close()

	c := NewOpenRouterClient("https://tercerize.test", "Tercerize", nil, log)
	c.endpoint = srv.URL

	res, err := c.Complete(context.Background(), "sk-test", Settings{
		Models:                  []string{PrimaryAssistantModel},
		SessionID:               "trz_stable_123",
		OpenRouterResponseCache: true,
		OpenRouterCacheTTL:      300,
	}, []ChatMessage{{Role: "user", Content: "teste"}})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if gotSessionHdr != "trz_stable_123" || gotBodySession != "trz_stable_123" {
		t.Fatalf("session_id não enviado corretamente: hdr=%q body=%q", gotSessionHdr, gotBodySession)
	}
	if gotCacheHdr != "true" || gotTTLHdr != "300" {
		t.Fatalf("headers X-OpenRouter-Cache incorretos: cache=%q ttl=%q", gotCacheHdr, gotTTLHdr)
	}
	if res.OpenRouterCacheStatus != "HIT" || res.OpenRouterCacheAge != "14" || res.CachedTokens != 3200 || res.CostUSD != 0.00012 {
		t.Fatalf("telemetria OpenRouter incorreta: %+v", res)
	}
}
