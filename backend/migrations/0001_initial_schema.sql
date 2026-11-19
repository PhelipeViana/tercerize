-- Schema Multi-Empresas: Plataforma de Gestão de Terceirização e Serviços (Tercerize)

CREATE TABLE tenants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  cnpj       text NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name          text NOT NULL,
  email         text NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'admin' CHECK (role IN ('developer', 'admin', 'operator')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email));
CREATE INDEX users_tenant_idx ON users (tenant_id);

CREATE TABLE sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  active_tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  token_hash       text NOT NULL UNIQUE,
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

-- Módulo 1: Clientes Tomadores e Contratos
CREATE TABLE clients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name       text NOT NULL,
  cnpj       text NOT NULL,
  contact    text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX clients_tenant_idx ON clients (tenant_id);

CREATE TABLE contracts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  client_id       uuid NOT NULL REFERENCES clients (id) ON DELETE RESTRICT,
  code            text NOT NULL,
  object          text NOT NULL,
  scope_notes     text NOT NULL DEFAULT '',
  workstation     text NOT NULL DEFAULT 'Sede / Unidade Principal',
  duration_months integer NOT NULL DEFAULT 12 CHECK (duration_months > 0),
  monthly_value   numeric(12,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Suspenso', 'Encerrado')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contracts_tenant_idx ON contracts (tenant_id);

-- Módulo 2: Colaboradores e Escalas
CREATE TABLE employees (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  contract_id uuid REFERENCES contracts (id) ON DELETE SET NULL,
  name        text NOT NULL,
  role_title  text NOT NULL,
  schedule    text NOT NULL DEFAULT 'Comercial 44h (Seg-Sex)',
  status      text NOT NULL DEFAULT 'Alocado' CHECK (status IN ('Alocado', 'Disponível', 'Afastado')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX employees_tenant_idx ON employees (tenant_id);

-- Módulo 3: Controle de EPIs
CREATE TABLE epi_deliveries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  employee_id    uuid NOT NULL REFERENCES employees (id) ON DELETE CASCADE,
  epi_name       text NOT NULL,
  ca_number      text NOT NULL,
  delivered_at   date NOT NULL DEFAULT CURRENT_DATE,
  expires_at     date NOT NULL,
  receipt_signed boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX epi_deliveries_tenant_idx ON epi_deliveries (tenant_id);

-- Módulo 4: Almoxarifado e Ferramentas (Inventário e Ativos + Movimentações / Cautela)
CREATE TABLE inventory_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  sku          text NOT NULL,
  description  text NOT NULL,
  category     text NOT NULL DEFAULT 'Material' CHECK (category IN ('Material', 'Ferramenta')),
  quantity     integer NOT NULL DEFAULT 0,
  unit         text NOT NULL DEFAULT 'un.',
  unit_value   numeric(12,2) NOT NULL DEFAULT 0,
  min_quantity integer NOT NULL DEFAULT 2,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventory_items_tenant_idx ON inventory_items (tenant_id);

CREATE TABLE inventory_movements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  item_id       uuid NOT NULL REFERENCES inventory_items (id) ON DELETE CASCADE,
  employee_id   uuid REFERENCES employees (id) ON DELETE SET NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('Entrada', 'Saída', 'Cautela', 'Devolução')),
  quantity      integer NOT NULL CHECK (quantity > 0),
  notes         text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventory_movements_tenant_idx ON inventory_movements (tenant_id);

-- Módulo 5: Ordens de Serviço (OS)
CREATE TABLE service_orders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  client_id    uuid NOT NULL REFERENCES clients (id) ON DELETE RESTRICT,
  employee_id  uuid REFERENCES employees (id) ON DELETE SET NULL,
  code         text NOT NULL,
  description  text NOT NULL,
  priority     text NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Normal', 'Alta', 'Urgente')),
  status       text NOT NULL DEFAULT 'Agendada' CHECK (status IN ('Agendada', 'Em Execução', 'Concluída')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX service_orders_tenant_idx ON service_orders (tenant_id);

-- Módulo 6: Gestão Financeira
CREATE TABLE financial_entries (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  contract_id           uuid REFERENCES contracts (id) ON DELETE SET NULL,
  entry_type            text NOT NULL CHECK (entry_type IN ('Receita', 'Despesa')),
  description           text NOT NULL,
  amount                numeric(12,2) NOT NULL CHECK (amount >= 0),
  due_date              date NOT NULL DEFAULT CURRENT_DATE,
  reconciliation_status text NOT NULL DEFAULT 'Pendente' CHECK (reconciliation_status IN ('Pendente', 'Conciliado')),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX financial_entries_tenant_idx ON financial_entries (tenant_id);
