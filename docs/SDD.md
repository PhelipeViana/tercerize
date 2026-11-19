# SDD — Specification-Driven Development & System Design Document
## Plataforma de Gestão de Terceirização e Serviços (Tercerize)

- **Versão:** 1.0.0
- **Status:** Implementado (MVP Multi-Empresas com Campos Básicos)
- **Porta de Operação Web:** `3200` (`0.0.0.0:3200 -> 3000/tcp`)
- **Padrão Arquitetural:** Monolito Modular em Go 1.26 (`chi`, `pgx/v5`, `argon2id`, `redis`) + Frontend Next.js 16 (`React 19`, `Tailwind CSS v4`, `OKLCH Design System`) + PostgreSQL 17.

---

## 1. Escopo Funcional Estrito (Briefing Executivo)

Este sistema implementa **exclusivamente** os módulos e fluxos especificados no *Briefing Executivo — Plataforma de Gestão de Terceirização e Serviços*, acrescidos da parametrização **Multi-Empresas (Multi-Tenant)** e do **Acesso de Nível Desenvolvedor**:

| # | Módulo | Rota no Sistema | Escopo e Campos Básicos Implementados |
|---|---|---|---|
| **0** | **Multi-Empresas & Acesso Desenvolvedor** | `/admin/companies` + Seletor Global na Sidebar | Isolamento estrito por `tenant_id`. Usuários com `role = 'developer'` podem cadastrar novas empresas prestadoras e alternar a empresa ativa na sessão em tempo real. |
| **1** | **Clientes e Contratos** | `/admin/contracts` e `/admin/contracts/create` | Cadastro de Clientes Tomadores (`razão social`, `CNPJ`, `contato`) e Contratos (`código #CT-xxx`, `cliente_id` obrigatório, `objeto/escopo`, `posto de trabalho`, `vigência em meses`, `valor mensal`, `situação: Ativo \| Encerrado`). |
| **2** | **Colaboradores e Escalas** | `/admin/employees` | Registro da equipe técnica (`nome`, `função/cargo`, `contrato_id` alocado, `escala/turno operacional`, `situação: Alocado \| Disponível`). |
| **3** | **Controle de EPIs** | `/admin/epis` | Entrega de EPIs vinculada ao colaborador (`employee_id`, `nome do EPI`, `CA`, `data de entrega`, `data de validade`, `termo assinado: boolean`). |
| **4** | **Almoxarifado e Ferramentas (Inventário e Ativos)** | `/admin/inventory-items` | Posição atual de estoque (`SKU`, `descrição`, `categoria: Material \| Ferramenta`, `qtd em estoque`, `unidade`, `valor unitário`, `nível: Normal \| Baixo`) + Registro de Movimentação (`Entrada`, `Saída`, `Cautela de Ferramenta`, `Devolução`) vinculado ao colaborador. |
| **5** | **Ordens de Serviço (OS)** | `/admin/service-orders` | Fila de execução operacional (`código #OS-xxx`, `client_id` / unidade, `employee_id` técnico alocado, `descrição do serviço`, `prioridade`, `status: Agendada \| Em Execução \| Concluída`) com transição rápida de status. |
| **6** | **Gestão Financeira** | `/admin/finance` | Lançamentos de receitas e despesas vinculados aos contratos (`tipo: Receita \| Despesa`, `contract_id`, `descrição`, `valor`, `vencimento`, `status: Pendente \| Conciliado`) e resumo de fluxo de caixa. |

---

## 2. Credenciais e Controle de Acesso (RBAC & Multi-Tenant)

### 2.1. Credencial Mestre de Desenvolvedor (Seed Automático)
Na inicialização da API Go (`internal/seed`), o sistema garante a existência do usuário de nível desenvolvedor:
- **E-mail:** `phelipegabriel1988@gmail.com`
- **Senha:** `password` (hash Argon2id PHC `$argon2id$v=19$m=19456,t=2,p=1$...`)
- **Nível (`role`):** `developer`

### 2.2. Modelo de Sessão Multi-Empresa
- O cookie `HttpOnly` (`tercerize_session`) armazena apenas o token opaco de 256 bits.
- A tabela `sessions` armazena `token_hash` (SHA-256), `user_id` e `active_tenant_id`.
- Todas as consultas e gravações dos 6 módulos filtram obrigatoriamente por `sessions.active_tenant_id`.
- Usuários `developer` possuem permissão para chamar `POST /api/tenants/switch` (alterando `active_tenant_id` na sessão atual) e `POST /api/tenants` (criando uma nova empresa terceirizadora).

---

## 3. Modelo de Dados Relacional (PostgreSQL 17)

Definido em [`backend/migrations/0001_initial_schema.sql`](file:///root/tercerize/backend/migrations/0001_initial_schema.sql):

1. `tenants` (`id`, `name`, `cnpj`, `active`, `created_at`)
2. `users` (`id`, `tenant_id`, `name`, `email`, `password_hash`, `role`, `created_at`)
3. `sessions` (`id`, `user_id`, `active_tenant_id`, `token_hash`, `expires_at`, `created_at`)
4. `clients` (`id`, `tenant_id`, `name`, `cnpj`, `contact`, `created_at`)
5. `contracts` (`id`, `tenant_id`, `client_id`, `code`, `object`, `scope_notes`, `workstation`, `duration_months`, `monthly_value`, `status`, `created_at`)
6. `employees` (`id`, `tenant_id`, `contract_id`, `name`, `role_title`, `schedule`, `status`, `created_at`)
7. `epi_deliveries` (`id`, `tenant_id`, `employee_id`, `epi_name`, `ca_number`, `delivered_at`, `expires_at`, `receipt_signed`, `created_at`)
8. `inventory_items` (`id`, `tenant_id`, `sku`, `description`, `category`, `quantity`, `unit`, `unit_value`, `min_quantity`, `created_at`)
9. `inventory_movements` (`id`, `tenant_id`, `item_id`, `employee_id`, `movement_type`, `quantity`, `notes`, `created_at`)
10. `service_orders` (`id`, `tenant_id`, `client_id`, `employee_id`, `code`, `description`, `priority`, `status`, `created_at`, `completed_at`)
11. `financial_entries` (`id`, `tenant_id`, `contract_id`, `entry_type`, `description`, `amount`, `due_date`, `reconciliation_status`, `created_at`)

---

## 4. Schema Visual Adotado (Padrão RangoBrasil + Identidade Azul Leve do Briefing)

Seguindo a arquitetura visual do `rangobrasil` (`Tailwind CSS v4`, `@theme inline` com variáveis `OKLCH`, tipografia `Geist Sans` + `Geist Mono`, `tabular-nums`, layout `h-dvh` com `Sidebar w-72`) e a diretriz estética do Briefing Executivo (*"interface limpa em tons leves de azul, projetada para reduzir a fadiga visual durante o uso contínuo pela equipe administrativa e operacional"*):

- **Superfícies em Tons Leves de Azul (`OKLCH Hue 240°–252°`):**
  - `--background`: `oklch(0.975 0.01 245)` (Fundo azul-gelo suave de baixíssima fadiga visual)
  - `--card`: `oklch(1 0 0)` (Branco puro para tabelas e formulários com bordas `oklch(0.89 0.02 245)`)
  - `--sidebar`: `oklch(0.955 0.018 245)` (Barra lateral em azul-ardósia claro)
  - `--primary`: `oklch(0.52 0.17 250)` (Azul Corporativo de alto contraste para botões `+ Novo Contrato`, `+ Nova Ordem de Serviço`, `+ Registrar Movimentação`)
  - `--primary-foreground`: `oklch(0.99 0 0)`
  - `--accent`: `oklch(0.92 0.035 245)` (Cabeçalhos de tabela e faixas de breadcrumb como no PDF: `Painel Administrativo › Contratos`)

---

## 5. Registro de Alterações (Changelog SDD)

- **[2026-11-19] SDD-001 — Bootstrap Arquitetural & Multi-Tenant:**
  - Criação da infraestrutura Docker (`db`, `redis`, `api` em Go 1.26, `app` em Next.js 16) operando na porta `3200`.
  - Implementação de autenticação Argon2id + sessão compartilhada via hash SHA-256 com suporte a `active_tenant_id` e seed automático do usuário desenvolvedor (`phelipegabriel1988@gmail.com` / `password`).
- **[2026-11-19] SDD-002 — Implementação dos 6 Módulos Básicos do Anexo:**
  - **Tela 1 & Tela 4 (`/admin/contracts`, `/admin/contracts/create`):** Listagem de contratos ativos, cadastro rápido de clientes tomadores e formulário inteligente de novo contrato com seleção relacional obrigatória.
  - **Tela 2 (`/admin/service-orders`):** Fila de execução operacional de Ordens de Serviço com vínculo relacional de Cliente e Técnico Alocado e atualização rápida de status (`Agendada` → `Em Execução` → `Concluída`).
  - **Tela 3 (`/admin/inventory-items`):** Posição atual de estoque (`SKU`, `Qtd`, `Valor Unitário`, `Nível`) e modal/formulário de movimentação (`Entrada`, `Saída`, `Cautela de Ferramenta`, `Devolução`) com ajuste transacional de saldo.
  - **Módulos Complementares do Quadro 2 do Anexo:** Colaboradores e Escalas (`/admin/employees`), Controle de EPIs (`/admin/epis`) e Gestão Financeira (`/admin/finance`).
- **[2026-11-19] SDD-003 — Refatoração Visual Estilo PortoCercado (Filament Laravel) + Dark Mode & Domínio de Produção:**
  - Adoção integral da estética inspirada no Filament / `portocercado`: cards com `rounded-2xl shadow-xl border-b-4`, tipografia `font-black uppercase tracking-widest` nos rótulos e cabeçalhos de tabela, títulos `text-2xl font-black italic` e botões de ação com `shadow-lg shadow-blue-500/25`.
  - Implementação do seletor **Dark Mode / Modo Claro** (`ThemeToggle`) na barra superior e na tela de login, com persistência em `localStorage` (`tercerize_theme`) e script anti-flicker no `<head>`.
  - Configuração de `experimental.serverActions.allowedOrigins` para `tercerize.dataweb3.com.br` e `localhost:3200`.
