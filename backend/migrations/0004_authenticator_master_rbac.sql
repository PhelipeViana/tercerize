-- Migration 0004: Google Authenticator (TOTP), Acesso Master, Dono por Empresa e RBAC Multi-Empresa (N:N)

-- 1. Remover tabela de recuperação de senha tradicional
DROP TABLE IF EXISTS password_resets;

-- 2. Atualizar usuários para suportar Master global e Google Authenticator (TOTP RFC 6238)
ALTER TABLE users ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash SET DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_master boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_configured_at timestamptz;

-- 3. Atualizar empresas com Nome do Responsável, E-mail do Responsável, Dono e CNPJ único
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_name text NOT NULL DEFAULT '';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_email text NOT NULL DEFAULT '';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_cnpj_unique ON tenants (cnpj);

-- 4. Tabela de Roles (Funções) por empresa com matriz granular de permissões
CREATE TABLE IF NOT EXISTS tenant_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  key         text NOT NULL,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);

CREATE INDEX IF NOT EXISTS tenant_roles_tenant_idx ON tenant_roles (tenant_id);

-- 5. Vínculos N:N entre usuários e empresas (trava UNIQUE garante que o usuário JAMAIS tenha 2 funções na mesma empresa)
CREATE TABLE IF NOT EXISTS tenant_memberships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role_id    uuid NOT NULL REFERENCES tenant_roles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS tenant_memberships_tenant_idx ON tenant_memberships (tenant_id);
CREATE INDEX IF NOT EXISTS tenant_memberships_user_idx ON tenant_memberships (user_id);

-- 6. Links de configuração do Google Authenticator enviados por e-mail (sem QR Code)
CREATE TABLE IF NOT EXISTS auth_setup_links (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  tenant_id  uuid REFERENCES tenants (id) ON DELETE SET NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_setup_links_user_idx ON auth_setup_links (user_id);

-- 7. Popular roles padrão em todas as empresas existentes
INSERT INTO tenant_roles (tenant_id, key, name, description, permissions, is_system)
SELECT t.id, 'owner', 'Dono da empresa', 'Acesso total à empresa e gestão exclusiva de funções e subpermissões.',
       '{"contracts:view":true,"contracts:write":true,"service_orders:view":true,"service_orders:write":true,"employees:view":true,"employees:write":true,"epis:view":true,"epis:write":true,"inventory:view":true,"inventory:write":true,"finance:view":true,"finance:write":true,"access:manage":true}'::jsonb,
       true
FROM tenants t
ON CONFLICT (tenant_id, key) DO NOTHING;

INSERT INTO tenant_roles (tenant_id, key, name, description, permissions, is_system)
SELECT t.id, 'manager', 'Gerente operacional', 'Gestão completa dos módulos operacionais sem gerenciar funções ou acessos.',
       '{"contracts:view":true,"contracts:write":true,"service_orders:view":true,"service_orders:write":true,"employees:view":true,"employees:write":true,"epis:view":true,"epis:write":true,"inventory:view":true,"inventory:write":true,"finance:view":true,"finance:write":true,"access:manage":false}'::jsonb,
       true
FROM tenants t
ON CONFLICT (tenant_id, key) DO NOTHING;

INSERT INTO tenant_roles (tenant_id, key, name, description, permissions, is_system)
SELECT t.id, 'operator', 'Operador técnico', 'Acesso a ordens de serviço, colaboradores, EPIs e almoxarifado.',
       '{"contracts:view":true,"contracts:write":false,"service_orders:view":true,"service_orders:write":true,"employees:view":true,"employees:write":false,"epis:view":true,"epis:write":true,"inventory:view":true,"inventory:write":true,"finance:view":false,"finance:write":false,"access:manage":false}'::jsonb,
       true
FROM tenants t
ON CONFLICT (tenant_id, key) DO NOTHING;

INSERT INTO tenant_roles (tenant_id, key, name, description, permissions, is_system)
SELECT t.id, 'financial', 'Analista financeiro', 'Acesso à gestão financeira e visualização de contratos.',
       '{"contracts:view":true,"contracts:write":false,"service_orders:view":false,"service_orders:write":false,"employees:view":false,"employees:write":false,"epis:view":false,"epis:write":false,"inventory:view":false,"inventory:write":false,"finance:view":true,"finance:write":true,"access:manage":false}'::jsonb,
       true
FROM tenants t
ON CONFLICT (tenant_id, key) DO NOTHING;

-- 8. Garantir Master para phelipegabriel1988@gmail.com e vincular donos iniciais às empresas existentes
UPDATE users
SET is_master = true,
    name = 'Phelipe Viana',
    role = 'developer'
WHERE lower(email) = 'phelipegabriel1988@gmail.com';

UPDATE tenants t
SET owner_name = CASE WHEN owner_name = '' THEN 'Phelipe Viana' ELSE owner_name END,
    owner_email = CASE WHEN owner_email = '' THEN 'phelipegabriel1988@gmail.com' ELSE owner_email END,
    owner_user_id = COALESCE(owner_user_id, (SELECT id FROM users WHERE lower(email) = 'phelipegabriel1988@gmail.com' LIMIT 1));

INSERT INTO tenant_memberships (tenant_id, user_id, role_id)
SELECT t.id, t.owner_user_id, r.id
FROM tenants t
JOIN tenant_roles r ON r.tenant_id = t.id AND r.key = 'owner'
WHERE t.owner_user_id IS NOT NULL
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Migrar usuários legados (não-master) para tenant_memberships caso ainda não tenham vínculo
INSERT INTO tenant_memberships (tenant_id, user_id, role_id)
SELECT u.tenant_id, u.id, r.id
FROM users u
JOIN tenant_roles r ON r.tenant_id = u.tenant_id AND r.key = CASE WHEN u.role = 'admin' THEN 'owner' ELSE 'operator' END
WHERE u.tenant_id IS NOT NULL AND u.is_master = false
ON CONFLICT (tenant_id, user_id) DO NOTHING;
