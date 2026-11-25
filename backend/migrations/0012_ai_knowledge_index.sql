-- Índice derivado para RAG: a fonte de verdade continua nas tabelas operacionais.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS ai_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('upsert', 'delete')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ai_outbox_pending_idx ON ai_outbox (available_at, occurred_at)
  WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS ai_outbox_entity_idx ON ai_outbox (tenant_id, entity_type, entity_id)
  WHERE processed_at IS NULL;

CREATE TABLE IF NOT EXISTS ai_knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  chunk_type text NOT NULL DEFAULT 'entity',
  module_key text NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text NOT NULL,
  source_version timestamptz NOT NULL DEFAULT now(),
  embedding vector(1536),
  indexed_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (tenant_id, source_type, source_id, chunk_type)
);
CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_tenant_module_idx
  ON ai_knowledge_chunks (tenant_id, module_key, indexed_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_fts_idx
  ON ai_knowledge_chunks USING gin (to_tsvector('portuguese', content))
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_embedding_idx
  ON ai_knowledge_chunks USING hnsw (embedding vector_cosine_ops)
  WHERE deleted_at IS NULL AND embedding IS NOT NULL;

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
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION install_ai_knowledge_trigger(target_table regclass) RETURNS void AS $$
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS ai_knowledge_sync ON %s', target_table);
  EXECUTE format('CREATE TRIGGER ai_knowledge_sync AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION enqueue_ai_knowledge_sync()', target_table);
END;
$$ LANGUAGE plpgsql;

SELECT install_ai_knowledge_trigger('clients');
SELECT install_ai_knowledge_trigger('contracts');
SELECT install_ai_knowledge_trigger('employees');
SELECT install_ai_knowledge_trigger('epi_deliveries');
SELECT install_ai_knowledge_trigger('inventory_items');
SELECT install_ai_knowledge_trigger('inventory_movements');
SELECT install_ai_knowledge_trigger('service_orders');
SELECT install_ai_knowledge_trigger('financial_entries');
DROP FUNCTION install_ai_knowledge_trigger(regclass);

INSERT INTO ai_outbox (tenant_id, entity_type, entity_id, event_type)
SELECT tenant_id, 'clients', id, 'upsert' FROM clients
UNION ALL SELECT tenant_id, 'contracts', id, 'upsert' FROM contracts
UNION ALL SELECT tenant_id, 'employees', id, 'upsert' FROM employees
UNION ALL SELECT tenant_id, 'epi_deliveries', id, 'upsert' FROM epi_deliveries
UNION ALL SELECT tenant_id, 'inventory_items', id, 'upsert' FROM inventory_items
UNION ALL SELECT tenant_id, 'inventory_movements', id, 'upsert' FROM inventory_movements
UNION ALL SELECT tenant_id, 'service_orders', id, 'upsert' FROM service_orders
UNION ALL SELECT tenant_id, 'financial_entries', id, 'upsert' FROM financial_entries;
