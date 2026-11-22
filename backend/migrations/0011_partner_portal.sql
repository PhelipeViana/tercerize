-- Migration 0011: Ambiente Dedicado Parceiros (3 Níveis Isolados: MASTER -> Parceiros -> Empresas Clientes)

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_partner boolean NOT NULL DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS partner_features jsonb NOT NULL DEFAULT '{"companies:create":true,"companies:edit":true,"companies:toggle_active":true,"companies:impersonate":true,"companies:ai_token":true,"companies:ai_paid_plans":false,"analytics:portfolio":false}'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS partner_max_companies integer NOT NULL DEFAULT 0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS partner_notes text NOT NULL DEFAULT '';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS partner_enabled_at timestamptz;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS parent_partner_tenant_id uuid REFERENCES tenants (id) ON DELETE SET NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tenants_is_partner_idx
  ON tenants (is_partner)
  WHERE is_partner = true;

CREATE INDEX IF NOT EXISTS tenants_parent_partner_idx
  ON tenants (parent_partner_tenant_id)
  WHERE parent_partner_tenant_id IS NOT NULL;

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS context_mode text NOT NULL DEFAULT 'tenant';

UPDATE sessions
SET context_mode = 'master'
WHERE active_tenant_id IS NULL AND context_mode = 'tenant';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sessions_context_mode_check'
  ) THEN
    ALTER TABLE sessions
      ADD CONSTRAINT sessions_context_mode_check
      CHECK (context_mode IN ('master', 'partner', 'tenant'));
  END IF;
END $$;
