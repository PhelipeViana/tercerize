-- Migration 0007: Telemetria real de acesso de usuários e clientes (último acesso e contagem de acessos)

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count integer NOT NULL DEFAULT 0;
