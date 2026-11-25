package ai

import (
	"regexp"
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

// QueryIntent classifica a natureza da mensagem do usuário antes de executar consultas pesadas.
type QueryIntent string

const (
	IntentOffTopic      QueryIntent = "off_topic"
	IntentPlatformGuide QueryIntent = "platform_guide"
	IntentDirectQuery   QueryIntent = "direct_query"
	IntentHeavyReport   QueryIntent = "heavy_report"
)

// ReportDepth define o modo de execução adaptativo do Assistente.
type ReportDepth string

const (
	DepthSummaryNumbers ReportDepth = "summary_numbers"
	DepthDetailedFull   ReportDepth = "detailed_full"
)

// QuickReplyOption representa um chip de resposta rápida de 1 clique exibido na UI durante clarificações.
type QuickReplyOption struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

// ClarificationResult contém as perguntas objetivas (no máximo 2) antes de uma execução pesada.
type ClarificationResult struct {
	Needed       bool               `json:"needed"`
	Questions    []string           `json:"questions,omitempty"`
	Message      string             `json:"message,omitempty"`
	QuickReplies []QuickReplyOption `json:"quickReplies,omitempty"`
}

// GateDecision resume a decisão tomada em < 5ms pelo classificador determinístico.
type GateDecision struct {
	Intent        QueryIntent
	Depth         ReportDepth
	Profile       ModelProfileConfig
	EffectiveMsg  string
	Clarification ClarificationResult
	OffTopicReply string
}

const (
	MaxClarificationQuestions = 2
	offTopicRefusalText       = "Desculpe, sou o Assistente Empresarial da plataforma Tercerize e atendo exclusivamente dúvidas e relatórios sobre a gestão e os dados desta empresa. Como posso ajudar com seus clientes, contratos, ordens de serviço, colaboradores, EPIs, almoxarifado ou financeiro?"
)

var (
	codeTokenRe = regexp.MustCompile(`(?i)\b(ctr|ct|os|ca|sku)[-\s]?\d{2,}\b`)
	yearMonthRe = regexp.MustCompile(`\b(20\d{2}[-/]\d{1,2}|\d{1,2}/20\d{2})\b`)
	lastDaysRe  = regexp.MustCompile(`(?i)\b(ultim[oa]s?\s+\d+\s+(dia|dias|mes|meses|semana|semanas)|hoje|ontem|esta semana|este mes|mes atual|mes passado|trimestre|semestre|ano atual|20\d{2})\b`)
)

// EvaluateGate analisa a mensagem atual e o histórico recente para:
// 1) Bloquear assuntos fora de negócios sem gastar SQL/LLM;
// 2) Identificar dúvidas de uso da plataforma;
// 3) Antes de uma execução pesada e ambígua, fazer NO MÁXIMO 2 perguntas objetivas (profundidade + recorte);
// 4) Definir se a resposta deve correr em modo "Só Números" (rápido/barato) ou "Relatório Completo" (Excel/PDF).
func EvaluateGate(userMsg string, history []ChatMessage) GateDecision {
	normMsg := normalizeText(userMsg)
	priorClarifications := countRecentClarifications(history)
	replyingToClarification := lastAssistantWasClarification(history)

	// Se o usuário estiver respondendo à nossa clarificação anterior, combina contexto e EXECUTA sem perguntar de novo.
	if replyingToClarification {
		origReq := findRequestBeforeClarification(history)
		combined := strings.TrimSpace(origReq + " — Preferência do usuário: " + userMsg)
		combinedNorm := normalizeText(combined)
		depth := inferReportDepth(normMsg, combinedNorm)
		return GateDecision{
			Intent:       IntentHeavyReport,
			Depth:        depth,
			Profile:      ProfileForMode(string(depth)),
			EffectiveMsg: combined,
		}
	}

	// 1. Guardrail determinístico para assuntos obviamente fora de negócios
	if isClearlyOffTopic(normMsg) {
		return GateDecision{
			Intent:        IntentOffTopic,
			Depth:         DepthSummaryNumbers,
			Profile:       ProfileForMode(string(DepthSummaryNumbers)),
			EffectiveMsg:  userMsg,
			OffTopicReply: offTopicRefusalText,
		}
	}

	// 2. Dúvida operacional / tutorial de uso da plataforma Tercerize
	if isPlatformGuideQuestion(normMsg) {
		return GateDecision{
			Intent:       IntentPlatformGuide,
			Depth:        DepthSummaryNumbers,
			Profile:      ProfileForMode(string(DepthSummaryNumbers)),
			EffectiveMsg: userMsg,
		}
	}

	// 3. Consulta direta, específica ou com código de registro -> 0 perguntas, executa imediatamente!
	if isDirectOrSpecificQuery(normMsg) {
		depth := inferReportDepth(normMsg, normMsg)
		return GateDecision{
			Intent:       IntentDirectQuery,
			Depth:        depth,
			Profile:      ProfileForMode(string(depth)),
			EffectiveMsg: userMsg,
		}
	}

	// 4. Pedido amplo/pesado de relatório ou análise gerencial
	if isBroadHeavyReportRequest(normMsg) {
		hasDepth := hasExplicitDepth(normMsg)
		hasScope := hasExplicitScope(normMsg)

		// Respeita rigorosamente o teto de no máximo 2 perguntas (e não pergunta se já estiver claro)
		if (!hasDepth || !hasScope) && priorClarifications < MaxClarificationQuestions {
			questions := make([]string, 0, MaxClarificationQuestions)
			quickReplies := make([]QuickReplyOption, 0, 4)

			if !hasDepth {
				questions = append(questions, "Você precisa apenas de um **resumo com os números principais (KPIs/totais)** ou de um **relatório completo detalhado em tabela** (pronto para Excel/PDF)?")
			}
			if !hasScope && len(questions) < MaxClarificationQuestions {
				questions = append(questions, "Deseja considerar **todos os registros ativos** ou filtrar por algum **período, status ou cliente específico**?")
			}

			if !hasDepth && !hasScope {
				quickReplies = []QuickReplyOption{
					{Label: "Só números · Todos ativos", Value: "Quero apenas um resumo com os números principais (KPIs e totais) de todos os registros ativos."},
					{Label: "Relatório completo · Todos ativos", Value: "Quero o relatório completo detalhado em tabela (pronto para Excel/PDF) de todos os registros ativos."},
					{Label: "Só números · Últimos 30 dias", Value: "Quero apenas os números principais (KPIs e totais) dos últimos 30 dias."},
					{Label: "Relatório completo · Últimos 30 dias", Value: "Quero o relatório completo detalhado em tabela (pronto para Excel/PDF) dos últimos 30 dias."},
				}
			} else if !hasDepth {
				quickReplies = []QuickReplyOption{
					{Label: "Só números (rápido)", Value: "Quero apenas um resumo com os números principais (KPIs e totais)."},
					{Label: "Relatório completo (Excel/PDF)", Value: "Quero o relatório completo detalhado em tabela, pronto para baixar em Excel e PDF."},
				}
			} else {
				quickReplies = []QuickReplyOption{
					{Label: "Todos os registros ativos", Value: "Considerar todos os registros ativos."},
					{Label: "Últimos 30 dias", Value: "Filtrar pelos últimos 30 dias."},
					{Label: "Mês atual", Value: "Filtrar apenas pelo mês atual."},
					{Label: "Somente pendentes / críticos", Value: "Filtrar apenas pelos itens pendentes, abertos ou críticos."},
				}
			}

			var sb strings.Builder
			sb.WriteString("Antes de montar esse relatório para você, só para evitar trabalho desnecessário e trazer exatamente o que precisa:\n\n")
			for i, q := range questions {
				sb.WriteString(string(rune('1'+i)))
				sb.WriteString(". ")
				sb.WriteString(q)
				sb.WriteString("\n")
			}

			return GateDecision{
				Intent:       IntentHeavyReport,
				Depth:        DepthSummaryNumbers,
				Profile:      ProfileForMode(string(DepthSummaryNumbers)),
				EffectiveMsg: userMsg,
				Clarification: ClarificationResult{
					Needed:       true,
					Questions:    questions,
					Message:      strings.TrimSpace(sb.String()),
					QuickReplies: quickReplies,
				},
			}
		}

		depth := inferReportDepth(normMsg, normMsg)
		return GateDecision{
			Intent:       IntentHeavyReport,
			Depth:        depth,
			Profile:      ProfileForMode(string(depth)),
			EffectiveMsg: userMsg,
		}
	}

	// Demais perguntas de negócios -> executa direto com perfil adaptado à profundidade
	depth := inferReportDepth(normMsg, normMsg)
	return GateDecision{
		Intent:       IntentDirectQuery,
		Depth:        depth,
		Profile:      ProfileForMode(string(depth)),
		EffectiveMsg: userMsg,
	}
}

func inferReportDepth(currentNorm, combinedNorm string) ReportDepth {
	// Palavras que explicitamente pedem modo "Só Números"
	if containsAny(currentNorm,
		"so numero", "so numeros", "somente numero", "somente numeros",
		"apenas numero", "apenas numeros", "resumo rapido", "so kpi",
		"apenas resumo", "so resumo", "so totais", "apenas totais",
		"so o total", "resumo com os numeros", "so indicadores",
	) {
		return DepthSummaryNumbers
	}
	// Palavras que explicitamente pedem relatório completo / tabela / exportação
	if containsAny(combinedNorm,
		"completo", "detalhado", "detalhada", "excel", "xlsx", "planilha",
		"pdf", "tabela", "listando", "liste todos", "listar todos",
		"relatorio gerencial", "demonstrativo", "relatorio consolidado",
		"pontos de atencao", "analise completa", "visao detalhada",
	) {
		return DepthDetailedFull
	}
	return DepthSummaryNumbers
}

func hasExplicitDepth(normMsg string) bool {
	return containsAny(normMsg,
		"so numero", "so numeros", "somente numero", "somente numeros",
		"apenas numero", "apenas numeros", "so kpi", "apenas totais",
		"so totais", "resumo rapido", "so resumo",
		"completo", "completa", "detalhado", "detalhada",
		"excel", "xlsx", "planilha", "pdf", "tabela", "listando",
	)
}

func hasExplicitScope(normMsg string) bool {
	if lastDaysRe.MatchString(normMsg) || yearMonthRe.MatchString(normMsg) || codeTokenRe.MatchString(normMsg) {
		return true
	}
	return containsAny(normMsg,
		"ativos", "ativas", "abertos", "abertas", "em andamento", "concluidas",
		"pendentes", "atrasados", "atrasadas", "vencidos", "vencidas", "criticos",
		"abaixo do minimo", "todos os", "todas as", "da empresa", "do cliente",
		"janeiro", "fevereiro", "marco", "abril", "maio", "junho",
		"julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
		"receitas", "despesas", "acima de", "maior que", "menor que", "top ",
	)
}

func isBroadHeavyReportRequest(normMsg string) bool {
	hasReportVerb := containsAny(normMsg,
		"relatorio", "levantamento", "panorama", "balanco", "consolidado",
		"auditoria", "diagnostico", "dossie", "extrato geral", "resumo executivo",
		"visao geral", "fechamento",
	)
	if !hasReportVerb {
		return false
	}
	// Se tem código específico (ex.: "relatório do contrato CTR-001"), é busca direcionada, não relatório amplo
	if codeTokenRe.MatchString(normMsg) {
		return false
	}
	return true
}

func isDirectOrSpecificQuery(normMsg string) bool {
	if codeTokenRe.MatchString(normMsg) {
		return true
	}
	// Perguntas diretas de contagem/soma/localização sem pedir relatório amplo
	if isBroadHeavyReportRequest(normMsg) {
		return false
	}
	return containsAny(normMsg,
		"quantos", "quantas", "qual o total", "qual total", "valor total",
		"soma ", "quanto ", "qual o status", "qual status", "quem ", "onde esta",
		"existe ", "tem algum", "ha algum", "me diga", "buscar ", "procure ",
		"encontre ", "localizar ", "mostrar ", "mostre ", "saldo",
	)
}

func isPlatformGuideQuestion(normMsg string) bool {
	return containsAny(normMsg,
		"como cadastrar", "como criar", "como abrir", "como registrar",
		"como editar", "como excluir", "como liberar", "como configurar",
		"onde fica", "onde acesso", "passo a passo", "como usar a plataforma",
		"como baixar excel", "como exportar", "como convidar",
	)
}

func isClearlyOffTopic(normMsg string) bool {
	// Frases explícitas de prompt injection ou culinária/entretenimento (avaliadas ANTES de "receita")
	if containsAny(normMsg,
		"receita de bolo", "receita culinaria", "receita de torta", "receita de pizza",
		"como fazer bolo", "ignore as instrucoes", "ignore regras anteriores",
		"finja ser outro", "conte uma piada", "me conta uma piada",
	) {
		return true
	}
	// Se menciona qualquer termo de negócio do Tercerize, nunca classifica como off-topic
	if containsAny(normMsg,
		"contrato", "cliente", "ordem de servico", " os ", "os-", "colaborador",
		"funcionario", "escala", "epi", "estoque", "almoxarifado", "sku",
		"financeiro", "receita", "despesa", "faturamento", "relatorio", "empresa",
		"tercerize", "posto", "custo", "saldo", "vencimento", "sla", "permissao",
		"role", "excel", "pdf", "indicador", "kpi", "lucro", "margem", "nota",
		"lancamento", "conciliacao", "manutencao", "chamado", "patrimonio",
	) {
		return false
	}
	return containsAny(normMsg,
		"flamengo", "corinthians", "palmeiras", "futebol", "copa do mundo",
		"campeonato brasileiro", "piada", "horoscopo", "signo",
		"previsao do tempo", "vai chover", "eleicao", "presidente", "partido politico",
		"filme bom", "serie netflix", "letra de musica", "poema de amor",
		"codigo python", "codigo javascript", "escreva um script",
	)
}

func lastAssistantWasClarification(history []ChatMessage) bool {
	if len(history) == 0 {
		return false
	}
	last := history[len(history)-1]
	if last.Role != "assistant" {
		return false
	}
	return isClarificationMessage(last.Content)
}

func countRecentClarifications(history []ChatMessage) int {
	count := 0
	for i := len(history) - 1; i >= 0 && i >= len(history)-6; i-- {
		if history[i].Role == "assistant" && isClarificationMessage(history[i].Content) {
			count++
		}
	}
	return count
}

func isClarificationMessage(content string) bool {
	norm := normalizeText(content)
	return strings.Contains(norm, "antes de montar esse relatorio") ||
		(strings.Contains(norm, "numeros principais") && strings.Contains(norm, "relatorio completo"))
}

func findRequestBeforeClarification(history []ChatMessage) string {
	for i := len(history) - 2; i >= 0; i-- {
		if history[i].Role == "user" {
			return history[i].Content
		}
	}
	return ""
}

func containsAny(haystack string, needles ...string) bool {
	for _, n := range needles {
		if strings.Contains(haystack, n) {
			return true
		}
	}
	return false
}

// normalizeText converte para minúsculas e remove acentos/diacríticos para classificação determinística PT-BR.
func normalizeText(s string) string {
	t := norm.NFD.String(strings.ToLower(strings.TrimSpace(s)))
	var b strings.Builder
	b.Grow(len(t))
	for _, r := range t {
		if unicode.Is(unicode.Mn, r) {
			continue
		}
		b.WriteRune(r)
	}
	return " " + b.String() + " "
}
