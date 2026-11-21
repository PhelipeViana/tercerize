import "server-only";
import { getPool } from "@/lib/db/pool";

export interface AIModelStatRow {
  model: string;
  calls: number;
  avgLatencyMs: number;
  totalFallback: number;
}

export interface AISettingsData {
  models: string[];
  timeoutSeconds: number;
  cooldownSeconds: number;
  stats: AIModelStatRow[];
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

const DEFAULT_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3.5-lightning:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "openrouter/free",
];

export async function getAISettingsWithStats(): Promise<AISettingsData> {
  const pool = getPool();
  let models = DEFAULT_MODELS;
  let timeoutSeconds = 12;
  let cooldownSeconds = 180;

  try {
    const { rows } = await pool.query<{
      models: string[] | null;
      timeout_seconds: number;
      cooldown_seconds: number;
    }>(`SELECT models, timeout_seconds, cooldown_seconds FROM ai_settings WHERE id = 1`);
    if (rows[0]) {
      if (Array.isArray(rows[0].models) && rows[0].models.length > 0) {
        models = rows[0].models;
      }
      timeoutSeconds = rows[0].timeout_seconds || 12;
      cooldownSeconds = rows[0].cooldown_seconds || 180;
    }
  } catch {
    // Fallback para defaults se migration ainda estiver inicializando
  }

  const stats: AIModelStatRow[] = [];
  try {
    const { rows } = await pool.query<{
      model_used: string;
      calls: string;
      avg_ms: number;
      total_fb: number;
    }>(
      `SELECT model_used, count(*) AS calls,
              COALESCE(avg(latency_ms)::int, 0) AS avg_ms,
              COALESCE(sum(fallback_count)::int, 0) AS total_fb
         FROM ai_messages
        WHERE role = 'assistant' AND model_used <> ''
        GROUP BY model_used
        ORDER BY count(*) DESC`,
    );
    for (const r of rows) {
      stats.push({
        model: r.model_used,
        calls: Number(r.calls),
        avgLatencyMs: Number(r.avg_ms),
        totalFallback: Number(r.total_fb),
      });
    }
  } catch {
    // ignore
  }

  return { models, timeoutSeconds, cooldownSeconds, stats };
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
