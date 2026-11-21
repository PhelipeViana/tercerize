-- Migration 0009: Assistente IA & Relatórios via OpenRouter (Token opcional por empresa + Gestão interna de modelos com fallback)

-- 1. Token OpenRouter opcional por empresa (criptografado AES-256-GCM no backend)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS openrouter_token_enc text NOT NULL DEFAULT '';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS openrouter_token_hint text NOT NULL DEFAULT '';

-- 2. Configuração global interna de modelos gratuitos OpenRouter + fallback por lentidão/erro (exclusivo Master)
CREATE TABLE IF NOT EXISTS ai_settings (
  id               integer PRIMARY KEY CHECK (id = 1),
  models           jsonb NOT NULL,
  timeout_seconds  integer NOT NULL DEFAULT 12,
  cooldown_seconds integer NOT NULL DEFAULT 180,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ai_settings (id, models, timeout_seconds, cooldown_seconds)
VALUES (
  1,
  '["nvidia/nemotron-3.5-lightning:free","nvidia/nemotron-3-ultra-550b-a55b:free","meta-llama/llama-3.3-70b-instruct:free","openrouter/free"]'::jsonb,
  12,
  180
)
ON CONFLICT (id) DO NOTHING;

-- 3. Histórico de conversas e mensagens isolado por empresa (tenant_id) e usuário (user_id)
CREATE TABLE IF NOT EXISTS ai_conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title      text NOT NULL DEFAULT 'Nova conversa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_conversations_tenant_user_idx ON ai_conversations (tenant_id, user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations (id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user', 'assistant')),
  content         text NOT NULL,
  model_used      text NOT NULL DEFAULT '',
  latency_ms      integer NOT NULL DEFAULT 0,
  fallback_count  integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_messages_conv_idx ON ai_messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS ai_messages_model_idx ON ai_messages (model_used) WHERE role = 'assistant' AND model_used <> '';

-- 4. Atualizar matriz RBAC das roles existentes com a nova permissão ai_chat:use (Dono=true, demais=false)
UPDATE tenant_roles
SET permissions = permissions || jsonb_build_object('ai_chat:use', CASE WHEN key = 'owner' THEN true ELSE false END)
WHERE NOT (permissions ? 'ai_chat:use');
