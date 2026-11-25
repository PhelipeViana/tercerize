-- Migration 0014: Versionamento atômico de dados/RBAC para invalidação instantânea de cache
-- + telemetria completa de cache (cached_tokens, cost_usd, cache_status, ttft_ms, prompt_hash)

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS ai_data_version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ai_rbac_version bigint NOT NULL DEFAULT 1;

-- Atualiza o trigger existente das 8 tabelas operacionais para incrementar ai_data_version
-- atomicamente no mesmo commit (0ms de janela de staleness!)
CREATE OR REPLACE FUNCTION enqueue_ai_knowledge_sync() RETURNS trigger AS $$
DECLARE
  affected_tenant uuid;
  affected_id uuid;
  action text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_tenant := OLD.tenant_id;
    affected_id := OLD.id;
    action := 'delete';
  ELSE
    affected_tenant := NEW.tenant_id;
    affected_id := NEW.id;
    action := 'upsert';
  END IF;

  INSERT INTO ai_outbox (tenant_id, entity_type, entity_id, event_type)
  VALUES (affected_tenant, TG_TABLE_NAME, affected_id, action);

  UPDATE tenants
     SET ai_data_version = ai_data_version + 1
   WHERE id = affected_tenant;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Invalidação atômica imediata para alterações de RBAC (roles, permissões e vínculos de usuários)
CREATE OR REPLACE FUNCTION bump_ai_rbac_version() RETURNS trigger AS $$
DECLARE
  affected_tenant uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_tenant := OLD.tenant_id;
  ELSE
    affected_tenant := NEW.tenant_id;
  END IF;

  IF affected_tenant IS NOT NULL THEN
    UPDATE tenants
       SET ai_rbac_version = ai_rbac_version + 1
     WHERE id = affected_tenant;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_rbac_version_roles ON tenant_roles;
CREATE TRIGGER ai_rbac_version_roles
  AFTER INSERT OR UPDATE OR DELETE ON tenant_roles
  FOR EACH ROW
  EXECUTE FUNCTION bump_ai_rbac_version();

DROP TRIGGER IF EXISTS ai_rbac_version_memberships ON tenant_memberships;
CREATE TRIGGER ai_rbac_version_memberships
  AFTER INSERT OR UPDATE OR DELETE ON tenant_memberships
  FOR EACH ROW
  EXECUTE FUNCTION bump_ai_rbac_version();

-- Telemetria real de cache, tokens cacheados, TTFT, hash determinístico e custo efetivo
ALTER TABLE ai_messages
  ADD COLUMN IF NOT EXISTS cached_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_usd numeric(12,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_status text NOT NULL DEFAULT 'MISS',
  ADD COLUMN IF NOT EXISTS openrouter_cache_status text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ttft_ms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prompt_hash text NOT NULL DEFAULT '';
