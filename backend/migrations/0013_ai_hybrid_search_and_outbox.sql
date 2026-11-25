-- Migration 0013: Busca híbrida (pg_trgm + FTS + pgvector), dead-letter na ai_outbox e propagação de relações

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice trigram para busca tolerante a erros de digitação em nomes, códigos e descrições
CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_trgm_idx
  ON ai_knowledge_chunks USING gin (content gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- Dead-letter na outbox para impedir retries infinitos em falhas permanentes (ex.: 401/402 ou registro removido)
ALTER TABLE ai_outbox
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;

CREATE INDEX IF NOT EXISTS ai_outbox_dead_letter_idx
  ON ai_outbox (tenant_id, dead_lettered_at)
  WHERE dead_lettered_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_outbox_active_pending_idx
  ON ai_outbox (available_at, occurred_at)
  WHERE processed_at IS NULL AND dead_lettered_at IS NULL;

-- Propagação automática: quando o nome de um cliente muda, reindexa contratos e OS vinculados
CREATE OR REPLACE FUNCTION propagate_client_name_to_ai_outbox() RETURNS trigger AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    INSERT INTO ai_outbox (tenant_id, entity_type, entity_id, event_type)
    SELECT c.tenant_id, 'contracts', c.id, 'upsert'
      FROM contracts c
     WHERE c.tenant_id = NEW.tenant_id AND c.client_id = NEW.id;

    INSERT INTO ai_outbox (tenant_id, entity_type, entity_id, event_type)
    SELECT o.tenant_id, 'service_orders', o.id, 'upsert'
      FROM service_orders o
     WHERE o.tenant_id = NEW.tenant_id AND o.client_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_knowledge_client_propagate ON clients;
CREATE TRIGGER ai_knowledge_client_propagate
  AFTER UPDATE OF name ON clients
  FOR EACH ROW
  EXECUTE FUNCTION propagate_client_name_to_ai_outbox();
