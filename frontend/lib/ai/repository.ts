import "server-only";
import { getPool } from "@/lib/db/pool";

export type AIQualityTier = "simple" | "good" | "great" | "excellent" | "brute";

export interface AIInternalProfileRow {
  key: string;
  label: string;
  description: string;
  models: string[];
  ttftTimeoutSeconds: number;
  totalTimeoutSeconds: number;
  maxTokens: number;
}

export interface AIModelStatRow {
  model: string;
  profileKey: string;
  calls: number;
  avgLatencyMs: number;
  totalFallback: number;
  totalTokens: number;
}

export interface TenantMonthlyUsageRow {
  tenantId: string;
  tenantName: string;
  cnpj: string;
  hasToken: boolean;
  monthlyLimit: number;
  messagesThisMonth: number;
  tokensThisMonth: number;
  avgLatencyMs: number;
  creditDepleted: boolean;
}

export interface TenantKnowledgeHealthRow {
  tenantId: string;
  tenantName: string;
  indexedChunks: number;
  embeddedChunks: number;
  monthlySummaries: number;
  pendingOutbox: number;
  deadLetterOutbox: number;
  oldestPendingMinutes: number;
  lastIndexedAt: string;
}

export interface AIObservabilityDashboardData {
  profiles: AIInternalProfileRow[];
  embeddingModel: string;
  embeddingDimensions: number;
  stats: AIModelStatRow[];
  monthlyUsage: TenantMonthlyUsageRow[];
  knowledgeHealth: TenantKnowledgeHealthRow[];
}

export interface AICitation {
  code: string;
  module: string;
  href: string;
  label: string;
}

export interface AIQuickReply {
  label: string;
  value: string;
}

export interface AIConversationRow {
  id: string;
  title: string;
  updatedAt: string;
}

export interface AIMessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  modelUsed?: string;
  latencyMs?: number;
  cacheStatus?: string;
  citations?: AICitation[];
  quickReplies?: AIQuickReply[];
}

const INTERNAL_PROFILES: AIInternalProfileRow[] = [
  {
    key: "simple",
    label: "1. Simples (Ultra-econômico)",
    description: "Qwen 3.7 Flash para consultas objetivas, contagens rápidas e dúvidas do dia a dia.",
    models: ["qwen/qwen3.7-flash", "deepseek/deepseek-v4.1-flash", "google/gemini-2.5-flash-lite"],
    ttftTimeoutSeconds: 12,
    totalTimeoutSeconds: 35,
    maxTokens: 1800,
  },
  {
    key: "good",
    label: "2. Bom (Padrão)",
    description: "DeepSeek v4.1 Flash com fallback Qwen — melhor equilíbrio de custo, precisão e tools.",
    models: ["deepseek/deepseek-v4.1-flash", "qwen/qwen3.7-flash", "qwen/qwen3.8-flash"],
    ttftTimeoutSeconds: 15,
    totalTimeoutSeconds: 50,
    maxTokens: 3200,
  },
  {
    key: "great",
    label: "3. Ótimo (Qwen Avançado)",
    description: "Qwen 3.8 Flash para relatórios detalhados, tabelas extensas e cruzamentos ricos.",
    models: ["qwen/qwen3.8-flash", "deepseek/deepseek-v4.1-flash", "qwen/qwen3.7-flash"],
    ttftTimeoutSeconds: 18,
    totalTimeoutSeconds: 55,
    maxTokens: 4200,
  },
  {
    key: "excellent",
    label: "4. Excelente (Google Flash Forte)",
    description: "Google Gemini 2.5 Flash para relatórios gerenciais sofisticados e alta aderência em PT-BR.",
    models: ["google/gemini-2.5-flash", "qwen/qwen3.8-flash", "deepseek/deepseek-v4.1-flash"],
    ttftTimeoutSeconds: 18,
    totalTimeoutSeconds: 60,
    maxTokens: 5000,
  },
  {
    key: "brute",
    label: "5. Bruto (Máxima Inteligência + Raciocínio)",
    description: "Google Gemini 4 Carbon com raciocínio ativado para auditorias e diagnósticos profundos.",
    models: ["google/gemini-4-carbon", "google/gemini-2.5-flash", "qwen/qwen3.8-flash"],
    ttftTimeoutSeconds: 25,
    totalTimeoutSeconds: 85,
    maxTokens: 6400,
  },
  {
    key: "contingency_free",
    label: "Contingência gratuita (HTTP 402)",
    description: "Acionada automaticamente apenas quando os créditos OpenRouter da empresa se esgotam.",
    models: [
      "nvidia/nemotron-3.5-lightning:free",
      "google/gemma-4-31b-it:free",
      "openrouter/free",
    ],
    ttftTimeoutSeconds: 18,
    totalTimeoutSeconds: 50,
    maxTokens: 2400,
  },
];

function stripLegacyTelemetryFooter(content: string): string {
  const idx = content.indexOf("\n\n---\n*Modelo:");
  if (idx > 0) return content.slice(0, idx).trim();
  return content;
}

export async function getAIObservabilityDashboard(): Promise<AIObservabilityDashboardData> {
  const pool = getPool();

  const stats: AIModelStatRow[] = [];
  try {
    const { rows } = await pool.query<{
      model_used: string;
      profile_key: string;
      calls: string;
      avg_ms: number;
      total_fb: number;
      total_tokens: string;
    }>(
      `SELECT model_used,
              COALESCE(plan_key, 'fast_numbers') AS profile_key,
              count(*) AS calls,
              COALESCE(avg(latency_ms)::int, 0) AS avg_ms,
              COALESCE(sum(fallback_count)::int, 0) AS total_fb,
              COALESCE(sum(total_tokens), 0) AS total_tokens
         FROM ai_messages
        WHERE role = 'assistant' AND model_used <> ''
        GROUP BY model_used, COALESCE(plan_key, 'fast_numbers')
        ORDER BY count(*) DESC`,
    );
    for (const r of rows) {
      stats.push({
        model: r.model_used,
        profileKey: r.profile_key,
        calls: Number(r.calls),
        avgLatencyMs: Number(r.avg_ms),
        totalFallback: Number(r.total_fb),
        totalTokens: Number(r.total_tokens || 0),
      });
    }
  } catch {
    // ignore
  }

  const monthlyUsage: TenantMonthlyUsageRow[] = [];
  try {
    const { rows } = await pool.query<{
      tenant_id: string;
      tenant_name: string;
      cnpj: string;
      has_token: boolean;
      monthly_limit: number;
      messages_count: string;
      tokens_total: string;
      avg_ms: number;
      credit_depleted: boolean;
    }>(
      `SELECT t.id AS tenant_id,
              t.name AS tenant_name,
              t.cnpj,
              (COALESCE(t.openrouter_token_enc, '') <> '') AS has_token,
              COALESCE(t.ai_monthly_message_limit, 0) AS monthly_limit,
              COALESCE(count(m.id), 0) AS messages_count,
              COALESCE(sum(m.total_tokens), 0) AS tokens_total,
              COALESCE(avg(m.latency_ms)::int, 0) AS avg_ms,
              (t.ai_credit_depleted_at IS NOT NULL) AS credit_depleted
         FROM tenants t
         LEFT JOIN ai_messages m
           ON m.tenant_id = t.id
          AND m.role = 'assistant'
          AND m.created_at >= date_trunc('month', now())
        GROUP BY t.id
        ORDER BY COALESCE(sum(m.total_tokens), 0) DESC, t.name ASC`,
    );
    for (const r of rows) {
      monthlyUsage.push({
        tenantId: r.tenant_id,
        tenantName: r.tenant_name,
        cnpj: r.cnpj,
        hasToken: Boolean(r.has_token),
        monthlyLimit: Number(r.monthly_limit || 0),
        messagesThisMonth: Number(r.messages_count || 0),
        tokensThisMonth: Number(r.tokens_total || 0),
        avgLatencyMs: Number(r.avg_ms || 0),
        creditDepleted: Boolean(r.credit_depleted),
      });
    }
  } catch {
    // ignore
  }

  const knowledgeHealth: TenantKnowledgeHealthRow[] = [];
  try {
    const { rows } = await pool.query<{
      tenant_id: string;
      tenant_name: string;
      indexed_chunks: number;
      embedded_chunks: number;
      monthly_summaries: number;
      pending_outbox: number;
      dead_letter_outbox: number;
      oldest_pending_min: number;
      last_indexed_at: string;
    }>(
      `SELECT t.id::text AS tenant_id,
              t.name AS tenant_name,
              COALESCE(c.indexed_chunks, 0)::int AS indexed_chunks,
              COALESCE(c.embedded_chunks, 0)::int AS embedded_chunks,
              COALESCE(c.monthly_summaries, 0)::int AS monthly_summaries,
              COALESCE(o.pending_outbox, 0)::int AS pending_outbox,
              COALESCE(o.dead_letter_outbox, 0)::int AS dead_letter_outbox,
              COALESCE(o.oldest_pending_min, 0)::int AS oldest_pending_min,
              COALESCE(to_char(c.last_indexed_at AT TIME ZONE 'America/Cuiaba', 'DD/MM/YYYY HH24:MI'), '—') AS last_indexed_at
         FROM tenants t
         LEFT JOIN (
           SELECT tenant_id,
                  count(*) FILTER (WHERE chunk_type = 'entity' AND deleted_at IS NULL) AS indexed_chunks,
                  count(*) FILTER (WHERE chunk_type = 'entity' AND deleted_at IS NULL AND embedding IS NOT NULL) AS embedded_chunks,
                  count(*) FILTER (WHERE chunk_type = 'monthly_summary' AND deleted_at IS NULL) AS monthly_summaries,
                  max(indexed_at) FILTER (WHERE deleted_at IS NULL) AS last_indexed_at
             FROM ai_knowledge_chunks
            GROUP BY tenant_id
         ) c ON c.tenant_id = t.id
         LEFT JOIN (
           SELECT tenant_id,
                  count(*) FILTER (WHERE processed_at IS NULL AND dead_lettered_at IS NULL) AS pending_outbox,
                  count(*) FILTER (WHERE dead_lettered_at IS NOT NULL AND processed_at IS NULL) AS dead_letter_outbox,
                  COALESCE(EXTRACT(EPOCH FROM (now() - min(occurred_at) FILTER (WHERE processed_at IS NULL AND dead_lettered_at IS NULL))) / 60, 0)::int AS oldest_pending_min
             FROM ai_outbox
            GROUP BY tenant_id
         ) o ON o.tenant_id = t.id
        ORDER BY t.name ASC`,
    );
    for (const r of rows) {
      knowledgeHealth.push({
        tenantId: r.tenant_id,
        tenantName: r.tenant_name,
        indexedChunks: Number(r.indexed_chunks || 0),
        embeddedChunks: Number(r.embedded_chunks || 0),
        monthlySummaries: Number(r.monthly_summaries || 0),
        pendingOutbox: Number(r.pending_outbox || 0),
        deadLetterOutbox: Number(r.dead_letter_outbox || 0),
        oldestPendingMinutes: Number(r.oldest_pending_min || 0),
        lastIndexedAt: r.last_indexed_at || "—",
      });
    }
  } catch {
    // Fallback se migration 0013 ainda não rodou no primeiro boot
  }

  return {
    profiles: INTERNAL_PROFILES,
    embeddingModel: process.env.AI_EMBEDDING_MODEL || "openai/text-embedding-3-small",
    embeddingDimensions: Number(process.env.AI_EMBEDDING_DIMENSIONS || 1536),
    stats,
    monthlyUsage,
    knowledgeHealth,
  };
}

export async function listAIConversations(tenantId: string, userId: string): Promise<AIConversationRow[]> {
  if (!tenantId) return [];
  const { rows } = await getPool().query<{
    id: string;
    title: string;
    updated_at: string;
  }>(
    `SELECT id, title, to_char(updated_at AT TIME ZONE 'America/Cuiaba', 'DD/MM/YYYY HH24:MI') AS updated_at
       FROM ai_conversations
      WHERE tenant_id = $1 AND user_id = $2
      ORDER BY updated_at DESC
      LIMIT 40`,
    [tenantId, userId],
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updated_at,
  }));
}

export async function listAIMessages(
  conversationId: string,
  tenantId: string,
  userId: string,
): Promise<AIMessageRow[]> {
  if (!conversationId || !tenantId) return [];
  const { rows } = await getPool().query<{
    id: string;
    role: "user" | "assistant";
    content: string;
    model_used: string | null;
    latency_ms: number | null;
    cache_status: string | null;
    created_at: string;
  }>(
    `SELECT m.id, m.role, m.content,
            COALESCE(m.model_used, '') AS model_used,
            COALESCE(m.latency_ms, 0) AS latency_ms,
            COALESCE(m.cache_status, '') AS cache_status,
            to_char(m.created_at AT TIME ZONE 'America/Cuiaba', 'DD/MM/YYYY HH24:MI') AS created_at
       FROM ai_messages m
       JOIN ai_conversations c ON c.id = m.conversation_id
      WHERE m.conversation_id = $1
        AND c.tenant_id = $2
        AND c.user_id = $3
      ORDER BY m.created_at ASC`,
    [conversationId, tenantId, userId],
  );
  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    content: r.role === "assistant" ? stripLegacyTelemetryFooter(r.content) : r.content,
    createdAt: r.created_at,
    modelUsed: r.model_used || undefined,
    latencyMs: r.latency_ms ? Number(r.latency_ms) : undefined,
    cacheStatus: r.cache_status || undefined,
  }));
}
