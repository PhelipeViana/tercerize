import "server-only";
import type { AIPlanKey } from "@/lib/auth/repository";
import { getPool } from "@/lib/db/pool";

export interface AIPlanRow {
  key: AIPlanKey;
  name: string;
  description: string;
  sortOrder: number;
  isPaid: boolean;
  models: string[];
  timeoutSeconds: number;
  cooldownSeconds: number;
  maxTokens: number;
  rateLimitPerHour: number;
}

export interface AIModelStatRow {
  model: string;
  planKey: string;
  calls: number;
  avgLatencyMs: number;
  totalFallback: number;
  totalTokens: number;
}

export interface TenantMonthlyUsageRow {
  tenantId: string;
  tenantName: string;
  cnpj: string;
  planKey: AIPlanKey;
  monthlyLimit: number;
  messagesThisMonth: number;
  tokensThisMonth: number;
  avgLatencyMs: number;
  creditDepleted: boolean;
  creditDepletedFrom: string;
}

export interface AIPlansDashboardData {
  plans: AIPlanRow[];
  stats: AIModelStatRow[];
  monthlyUsage: TenantMonthlyUsageRow[];
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
}

const DEFAULT_PLANS: AIPlanRow[] = [
  {
    key: "free",
    name: "Free",
    description: "Sequência gratuita padrão (NVIDIA Nemotron + fallbacks gratuitos). Custo zero na OpenRouter.",
    sortOrder: 1,
    isPaid: false,
    models: [
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "nvidia/nemotron-3.5-lightning:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "openrouter/free",
    ],
    timeoutSeconds: 15,
    cooldownSeconds: 180,
    maxTokens: 2400,
    rateLimitPerHour: 30,
  },
  {
    key: "standard",
    name: "Padrão",
    description: "Sequência paga econômica de alta velocidade e excelente custo-benefício em português.",
    sortOrder: 2,
    isPaid: true,
    models: ["google/gemini-2.5-flash", "openai/gpt-4o-mini", "google/gemini-2.5-flash-lite"],
    timeoutSeconds: 18,
    cooldownSeconds: 120,
    maxTokens: 3200,
    rateLimitPerHour: 80,
  },
  {
    key: "premium",
    name: "Premium",
    description: "Sequência paga de topo para relatórios executivos profundos e máxima qualidade analítica.",
    sortOrder: 3,
    isPaid: true,
    models: ["anthropic/claude-sonnet-4", "google/gemini-2.5-pro", "openai/gpt-4.1", "google/gemini-2.5-flash"],
    timeoutSeconds: 25,
    cooldownSeconds: 90,
    maxTokens: 4800,
    rateLimitPerHour: 200,
  },
];

function normalizePlanKey(raw: string): AIPlanKey {
  if (raw === "standard" || raw === "premium") return raw;
  return "free";
}

export async function getAIPlansDashboard(): Promise<AIPlansDashboardData> {
  const pool = getPool();
  let plans: AIPlanRow[] = DEFAULT_PLANS;

  try {
    const { rows } = await pool.query<{
      key: string;
      name: string;
      description: string;
      sort_order: number;
      is_paid: boolean;
      models: string[] | null;
      timeout_seconds: number;
      cooldown_seconds: number;
      max_tokens: number;
      rate_limit_per_hour: number;
    }>(
      `SELECT key, name, description, sort_order, is_paid, models,
              timeout_seconds, cooldown_seconds, max_tokens, rate_limit_per_hour
         FROM ai_plans
        ORDER BY sort_order ASC`,
    );
    if (rows.length > 0) {
      plans = rows.map((r) => ({
        key: normalizePlanKey(r.key),
        name: r.name,
        description: r.description,
        sortOrder: Number(r.sort_order),
        isPaid: Boolean(r.is_paid),
        models: Array.isArray(r.models) && r.models.length > 0 ? r.models : DEFAULT_PLANS[0].models,
        timeoutSeconds: Number(r.timeout_seconds || 15),
        cooldownSeconds: Number(r.cooldown_seconds || 180),
        maxTokens: Number(r.max_tokens || 2400),
        rateLimitPerHour: Number(r.rate_limit_per_hour || 30),
      }));
    }
  } catch {
    // Fallback para defaults se migration ainda estiver inicializando
  }

  const stats: AIModelStatRow[] = [];
  try {
    const { rows } = await pool.query<{
      model_used: string;
      plan_key: string;
      calls: string;
      avg_ms: number;
      total_fb: number;
      total_tokens: string;
    }>(
      `SELECT model_used,
              COALESCE(plan_key, 'free') AS plan_key,
              count(*) AS calls,
              COALESCE(avg(latency_ms)::int, 0) AS avg_ms,
              COALESCE(sum(fallback_count)::int, 0) AS total_fb,
              COALESCE(sum(total_tokens), 0) AS total_tokens
         FROM ai_messages
        WHERE role = 'assistant' AND model_used <> ''
        GROUP BY model_used, COALESCE(plan_key, 'free')
        ORDER BY count(*) DESC`,
    );
    for (const r of rows) {
      stats.push({
        model: r.model_used,
        planKey: r.plan_key,
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
      plan_key: string;
      monthly_limit: number;
      messages_count: string;
      tokens_total: string;
      avg_ms: number;
      credit_depleted: boolean;
      credit_depleted_from: string;
    }>(
      `SELECT t.id AS tenant_id,
              t.name AS tenant_name,
              t.cnpj,
              COALESCE(t.ai_plan_key, 'free') AS plan_key,
              COALESCE(t.ai_monthly_message_limit, 0) AS monthly_limit,
              COALESCE(count(m.id), 0) AS messages_count,
              COALESCE(sum(m.total_tokens), 0) AS tokens_total,
              COALESCE(avg(m.latency_ms)::int, 0) AS avg_ms,
              (t.ai_credit_depleted_at IS NOT NULL) AS credit_depleted,
              COALESCE(t.ai_credit_depleted_from, '') AS credit_depleted_from
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
        planKey: normalizePlanKey(r.plan_key),
        monthlyLimit: Number(r.monthly_limit || 0),
        messagesThisMonth: Number(r.messages_count || 0),
        tokensThisMonth: Number(r.tokens_total || 0),
        avgLatencyMs: Number(r.avg_ms || 0),
        creditDepleted: Boolean(r.credit_depleted),
        creditDepletedFrom: r.credit_depleted_from || "",
      });
    }
  } catch {
    // ignore
  }

  return { plans, stats, monthlyUsage };
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
    created_at: string;
  }>(
    `SELECT m.id, m.role, m.content,
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
    content: r.content,
    createdAt: r.created_at,
  }));
}
