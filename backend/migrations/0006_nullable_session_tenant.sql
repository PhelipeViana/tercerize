-- Migration 0006: Permitir sessão Master sem empresa ativa (zero empresas) e proteger usuários ao remover empresas

ALTER TABLE sessions ALTER COLUMN active_tenant_id DROP NOT NULL;

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_active_tenant_id_fkey;
ALTER TABLE sessions
  ADD CONSTRAINT sessions_active_tenant_id_fkey
  FOREIGN KEY (active_tenant_id) REFERENCES tenants (id) ON DELETE SET NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tenant_id_fkey;
ALTER TABLE users
  ADD CONSTRAINT users_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE SET NULL;
