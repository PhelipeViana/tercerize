package ai

import (
	"os"
	"strings"
)

// ExecutionProfile identifica o nível de qualidade/esforço selecionado para a pergunta.
// Níveis selecionáveis no chat: simple, good (default), great, excellent, brute.
// Nível interno de contingência: contingency_free (acionado apenas em HTTP 402).
type ExecutionProfile string

const (
	ProfileSimple          ExecutionProfile = "simple"
	ProfileGood            ExecutionProfile = "good"
	ProfileGreat           ExecutionProfile = "great"
	ProfileExcellent       ExecutionProfile = "excellent"
	ProfileBrute           ExecutionProfile = "brute"
	ProfileContingencyFree ExecutionProfile = "contingency_free"

	// Aliases de retrocompatibilidade para testes e chamadas internas
	ProfileFastNumbers    = ProfileGood
	ProfileDetailedReport = ProfileGood
)

// ModelProfileConfig define a cadeia ordenada de modelos, timeouts, reasoning e orçamento por nível.
type ModelProfileConfig struct {
	Key                 ExecutionProfile `json:"key"`
	Label               string           `json:"label"`
	Description         string           `json:"description"`
	Models              []string         `json:"models"`
	TTFTTimeoutSeconds  int              `json:"ttftTimeoutSeconds"`
	TotalTimeoutSeconds int              `json:"totalTimeoutSeconds"`
	CooldownSeconds     int              `json:"cooldownSeconds"`
	MaxTokens           int              `json:"maxTokens"`
	RateLimitPerHour    int              `json:"rateLimitPerHour"`
	ReasoningEnabled    bool             `json:"reasoningEnabled"`
	ReasoningEffort     string           `json:"reasoningEffort,omitempty"`
	ProviderSort        string           `json:"providerSort,omitempty"`
}

const (
	SimpleAssistantModel    = "qwen/qwen3.7-flash"
	PrimaryAssistantModel   = "deepseek/deepseek-v4.1-flash"
	QwenFastFallbackModel   = "qwen/qwen3.7-flash"
	QwenDetailFallbackModel = "qwen/qwen3.8-flash"
	ExcellentAssistantModel = "google/gemini-2.5-flash"
	BruteAssistantModel     = "google/gemini-4-carbon"
	DefaultEmbeddingModel   = "openai/text-embedding-3-small"
)

// NormalizeTier valida e normaliza o nível escolhido no chat, retornando "good" (Bom) como padrão seguro.
func NormalizeTier(raw string) ExecutionProfile {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "simple", "simples":
		return ProfileSimple
	case "good", "bom", "":
		return ProfileGood
	case "great", "otimo", "ótimo":
		return ProfileGreat
	case "excellent", "excelente":
		return ProfileExcellent
	case "brute", "bruto":
		return ProfileBrute
	case "contingency_free":
		return ProfileContingencyFree
	default:
		return ProfileGood
	}
}

// InternalProfiles retorna a escada coerente de 5 níveis + contingência gratuita em caso de 402.
func InternalProfiles() map[ExecutionProfile]ModelProfileConfig {
	primaryGood := PrimaryAssistantModel
	if custom := strings.TrimSpace(os.Getenv("AI_PRIMARY_MODEL")); custom != "" && strings.Contains(custom, "/") {
		primaryGood = custom
	}

	return map[ExecutionProfile]ModelProfileConfig{
		ProfileSimple: {
			Key:                 ProfileSimple,
			Label:               "Simples",
			Description:         "Qwen 3.7 Flash com escalada automática (Bom → Ótimo → Excelente).",
			Models:              dedupeModels([]string{SimpleAssistantModel, primaryGood, QwenDetailFallbackModel, ExcellentAssistantModel}),
			TTFTTimeoutSeconds:  12,
			TotalTimeoutSeconds: 35,
			CooldownSeconds:     90,
			MaxTokens:           1800,
			RateLimitPerHour:    150,
			ReasoningEnabled:    false,
			ProviderSort:        "price",
		},
		ProfileGood: {
			Key:                 ProfileGood,
			Label:               "Bom",
			Description:         "Padrão ativo (DeepSeek v4.1 Flash) com fallback automático progressivo (Qwen 3.7 → Qwen 3.8 → Gemini 2.5 Flash).",
			Models:              dedupeModels([]string{primaryGood, QwenFastFallbackModel, QwenDetailFallbackModel, ExcellentAssistantModel}),
			TTFTTimeoutSeconds:  15,
			TotalTimeoutSeconds: 50,
			CooldownSeconds:     90,
			MaxTokens:           3200,
			RateLimitPerHour:    120,
			ReasoningEnabled:    false,
		},
		ProfileGreat: {
			Key:                 ProfileGreat,
			Label:               "Ótimo",
			Description:         "Qwen 3.8 Flash com fallback automático (DeepSeek v4.1 Flash → Gemini 2.5 Flash).",
			Models:              dedupeModels([]string{QwenDetailFallbackModel, primaryGood, ExcellentAssistantModel, QwenFastFallbackModel}),
			TTFTTimeoutSeconds:  18,
			TotalTimeoutSeconds: 55,
			CooldownSeconds:     90,
			MaxTokens:           4200,
			RateLimitPerHour:    120,
			ReasoningEnabled:    false,
			ProviderSort:        "throughput",
		},
		ProfileExcellent: {
			Key:                 ProfileExcellent,
			Label:               "Excelente",
			Description:         "Google Gemini 2.5 Flash com fallback automático (Qwen 3.8 Flash → DeepSeek v4.1 Flash).",
			Models:              dedupeModels([]string{ExcellentAssistantModel, QwenDetailFallbackModel, primaryGood}),
			TTFTTimeoutSeconds:  18,
			TotalTimeoutSeconds: 60,
			CooldownSeconds:     90,
			MaxTokens:           5000,
			RateLimitPerHour:    100,
			ReasoningEnabled:    false,
			ProviderSort:        "throughput",
		},
		ProfileBrute: {
			Key:                 ProfileBrute,
			Label:               "Bruto",
			Description:         "Google Gemini 4 Carbon com raciocínio ativado e fallback automático (Gemini 2.5 Flash → Qwen 3.8 Flash).",
			Models:              dedupeModels([]string{BruteAssistantModel, ExcellentAssistantModel, QwenDetailFallbackModel}),
			TTFTTimeoutSeconds:  25,
			TotalTimeoutSeconds: 85,
			CooldownSeconds:     90,
			MaxTokens:           6400,
			RateLimitPerHour:    60,
			ReasoningEnabled:    true,
			ReasoningEffort:     "medium",
			ProviderSort:        "throughput",
		},
		ProfileContingencyFree: {
			Key:                 ProfileContingencyFree,
			Label:               "Contingência gratuita (HTTP 402)",
			Description:         "Acionado automaticamente apenas quando a chave OpenRouter da empresa retorna saldo esgotado.",
			Models:              []string{"nvidia/nemotron-3.5-lightning:free", "google/gemma-4-31b-it:free", "openrouter/free"},
			TTFTTimeoutSeconds:  18,
			TotalTimeoutSeconds: 50,
			CooldownSeconds:     120,
			MaxTokens:           2400,
			RateLimitPerHour:    60,
			ReasoningEnabled:    false,
		},
	}
}

// ProfileForTier resolve a configuração final combinando o nível escolhido pelo usuário com a profundidade do pedido.
func ProfileForTier(rawTier string, depth ReportDepth) ModelProfileConfig {
	tier := NormalizeTier(rawTier)
	profiles := InternalProfiles()
	cfg := profiles[tier]

	// Em relatórios completos (Excel/PDF), dá uma folga extra de tokens nos níveis menores para evitar cortes de tabela
	if depth == DepthDetailedFull && cfg.MaxTokens < 4200 && tier != ProfileContingencyFree {
		if tier == ProfileGood {
			cfg.MaxTokens = 4400
		} else if tier == ProfileSimple {
			cfg.MaxTokens = 2800
		}
	}
	return cfg
}

// ProfileForMode mantém compatibilidade com o Gate e testes existentes.
func ProfileForMode(mode string) ModelProfileConfig {
	switch mode {
	case "detailed_full":
		return ProfileForTier(string(ProfileGood), DepthDetailedFull)
	case "contingency_free":
		return InternalProfiles()[ProfileContingencyFree]
	default:
		return ProfileForTier(string(ProfileGood), DepthSummaryNumbers)
	}
}

// InternalModelsSummary expõe a escada de 5 níveis + contingência para o painel Master de observabilidade.
func InternalModelsSummary(embeddingModel string, embeddingDimensions int) []ModelProfileConfig {
	profiles := InternalProfiles()
	_ = embeddingModel
	_ = embeddingDimensions
	return []ModelProfileConfig{
		profiles[ProfileSimple],
		profiles[ProfileGood],
		profiles[ProfileGreat],
		profiles[ProfileExcellent],
		profiles[ProfileBrute],
		profiles[ProfileContingencyFree],
	}
}

func dedupeModels(in []string) []string {
	seen := make(map[string]bool, len(in))
	out := make([]string, 0, len(in))
	for _, raw := range in {
		clean := strings.TrimSpace(raw)
		if clean == "" || !strings.Contains(clean, "/") || seen[clean] {
			continue
		}
		seen[clean] = true
		out = append(out, clean)
	}
	return out
}
