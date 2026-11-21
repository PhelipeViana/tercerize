-- Migration 0010: 3 Níveis de Planos de IA (Free, Padrão, Premium) + Telemetria de Consumo (Tokens/Mensagens) + Downgrade Automático em 402

CREATE TABLE IF NOT EXISTS ai_plans (
  key                text PRIMARY KEY CHECK (key IN ('free', 'standard', 'premium')),
  name               text NOT NULL,
  description        text NOT NULL,
  sort_order         integer NOT NULL,
  is_paid            boolean NOT NULL DEFAULT false,
  models             jsonb NOT NULL,
  timeout_seconds    integer NOT NULL DEFAULT 15,
  cooldown_seconds   integer NOT NULL DEFAULT 180,
  max_tokens         integer NOT NULL DEFAULT 2400,
  rate_limit_per_hour integer NOT NULL DEFAULT 30,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Seed do plano Free (default) preservando a configuração atual de ai_settings quando existir
INSERT INTO ai_plans (key, name, description, sort_order, is_paid, models, timeout_seconds, cooldown_seconds, max_tokens, rate_limit_per_hour)
VALUES (
  'free',
  'Free',
  'Sequência gratuita padrão (NVIDIA Nemotron + fallbacks gratuitos). Custo zero na OpenRouter.',
  1,
  false,
  COALESCE(
    (SELECT models FROM ai_settings WHERE id = 1),
    '["nvidia/nemotron-3-ultra-550b-a55b:free","nvidia/nemotron-3.5-lightning:free","meta-llama/llama-3.3-70b-instruct:free","openrouter/free"]'::jsonb
  ),
  COALESCE((SELECT timeout_seconds FROM ai_settings WHERE id = 1), 15),
  COALESCE((SELECT cooldown_seconds FROM ai_settings WHERE id = 1), 180),
  2400,
  30
)
ON CONFLICT (key) DO NOTHING;

-- Seed do plano Padrão (pago econômico e veloz)
INSERT INTO ai_plans (key, name, description, sort_order, is_paid, models, timeout_seconds, cooldown_seconds, max_tokens, rate_limit_per_hour)
VALUES (
  'standard',
  'Padrão',
  'Sequência paga econômica de alta velocidade e excelente custo-benefício em português.',
  2,
  true,
  '["google/gemini-2.5-flash","openai/gpt-4o-mini","google/gemini-2.5-flash-lite"]'::jsonb,
  18,
  120,
  3200,
  80
)
ON CONFLICT (key) DO NOTHING;

-- Seed do plano Premium (pago de máxima inteligência analítica)
INSERT INTO ai_plans (key, name, description, sort_order, is_paid, models, timeout_seconds, cooldown_seconds, max_tokens, rate_limit_per_hour)
VALUES (
  'premium',
  'Premium',
  'Sequência paga de topo para relatórios executivos profundos e máxima qualidade analítica.',
  3,
  true,
  '["anthropic/claude-sonnet-4","google/gemini-2.5-pro","openai/gpt-4.1","google/gemini-2.5-flash"]'::jsonb,
  25,
  90,
  4800,
  200
)
ON CONFLICT (key) DO NOTHING;

-- Associação do plano e teto mensal opcional por empresa (default = 'free')
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_plan_key text NOT NULL DEFAULT 'free' REFERENCES ai_plans (key);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_monthly_message_limit integer NOT NULL DEFAULT 0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_credit_depleted_at timestamptz;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_credit_depleted_from text NOT NULL DEFAULT '';

-- Telemetria real de consumo por mensagem (plano usado + tokens prompt/completion/total)
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS plan_key text NOT NULL DEFAULT 'free';
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS prompt_tokens integer NOT NULL DEFAULT 0;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS completion_tokens integer NOT NULL DEFAULT 0;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS total_tokens integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS ai_messages_tenant_month_idx
  ON ai_messages (tenant_id, created_at DESC)
  WHERE role = 'assistant';
