# SDD — Specification-Driven Development & System Design Document
## Plataforma de Gestão de Terceirização e Serviços (Tercerize)

- **Versão:** 1.1.0
- **Status:** Implementado (Multi-Empresas + Autenticação Completa + 6 Módulos Operacionais)
- **Porta de Operação:** `3200` (`0.0.0.0:3200 -> 3000/tcp`)
- **Stack:** Go 1.26 (`chi/v5`, `pgx/v5`, `argon2id`, `redis`) + Next.js 16 (`React 19`, `TypeScript 5`) + PostgreSQL 17.

---

## 1. Escopo Funcional do Sistema

O sistema implementa os fluxos de autenticação e governança multi-empresas, além dos 6 módulos operacionais interdependentes descritos no briefing funcional:

| # | Módulo / Fluxo | Rota no Sistema | Funcionalidades e Regras de Negócio |
|---|---|---|---|
| **0.1** | **Autenticação, Cadastro e Recuperação de Senha** | `/login`, `/cadastro`, `/recuperar-senha` | Login com rate-limit por IP/e-mail, cadastro de novas empresas prestadoras com criação automática de tenant + administrador, e recuperação de senha com código temporário de 6 dígitos e redefinição Argon2id. |
| **0.2** | **Governança Multi-Empresas (Multi-Tenant)** | `/admin/companies` + Seletor Global | Isolamento de dados por `tenant_id`. Usuários `developer` podem cadastrar novas empresas prestadoras e alternar o `active_tenant_id` da sessão a qualquer momento. |
| **1** | **Clientes e Contratos** | `/admin/contracts` e `/admin/contracts/create` | Cadastro de clientes tomadores (`razão social`, `CNPJ`, `contato`) e contratos (`código`, `client_id` obrigatório, `objeto`, `escopo`, `posto de trabalho`, `vigência em meses`, `valor mensal`, `situação`). |
| **2** | **Colaboradores e Escalas** | `/admin/employees` | Registro da equipe técnica (`nome`, `função/cargo`, `contract_id` alocado, `escala/turno operacional`, `situação: Alocado \| Disponível \| Afastado`). |
| **3** | **Controle de EPIs** | `/admin/epis` | Entrega de Equipamentos de Proteção Individual por colaborador (`employee_id`, `descrição do EPI`, `número do CA`, `data de entrega`, `data de validade`, `termo assinado`). |
| **4** | **Almoxarifado e Ferramentas** | `/admin/inventory-items` | Gestão de saldo de estoque (`SKU`, `descrição`, `categoria: Material \| Ferramenta`, `quantidade`, `unidade`, `valor unitário`, `nível: Normal \| Baixo`) e registro transacional de movimentações (`Entrada`, `Saída`, `Cautela`, `Devolução`) vinculado ao colaborador. |
| **5** | **Ordens de Serviço (OS)** | `/admin/service-orders` | Fila de execução operacional (`código`, `client_id`, `employee_id` técnico alocado, `descrição do serviço`, `prioridade: Normal \| Alta \| Urgente`, `status: Agendada \| Em Execução \| Concluída`) com transição rápida de status. |
| **6** | **Gestão Financeira** | `/admin/finance` | Controle de receitas e despesas vinculadas aos contratos (`tipo: Receita \| Despesa`, `contract_id`, `descrição`, `valor`, `vencimento`, `status: Pendente \| Conciliado`) e cálculo de fluxo de caixa operacional. |

---

## 2. Credenciais e Controle de Acesso

### 2.1. Acesso Nível Desenvolvedor (Seed Automático)
- **E-mail:** `phelipegabriel1988@gmail.com`
- **Senha:** `password`
- **Papel (`role`):** `developer`

### 2.2. Contratos de API (Backend Go)
- `POST /api/auth/login` — Autentica usuário e inicia sessão (`tercerize_session`).
- `POST /api/auth/register` — Cria novo `tenant` + usuário `admin` e inicia sessão.
- `POST /api/auth/logout` — Encerra a sessão ativa no banco e remove o cookie.
- `POST /api/auth/forgot-password` — Gera código de recuperação de 6 dígitos com validade de 15 minutos para o e-mail informado.
- `POST /api/auth/reset-password` — Valida o código de recuperação e redefine a senha (Argon2id).
- `GET /api/me` — Retorna dados do usuário autenticado e da empresa ativa na sessão.
- `POST /api/tenants/switch` — Alterna `active_tenant_id` na sessão (exclusivo `developer`).
- `POST /api/tenants` — Provisiona nova empresa terceirizadora (exclusivo `developer`).
- `POST /api/clients` — Cadastra cliente tomador na empresa ativa.
- `POST /api/contracts` — Cadastra contrato vinculado a um cliente tomador da empresa ativa.
- `POST /api/employees` — Cadastra colaborador e escala na empresa ativa.
- `POST /api/epis` — Registra entrega de EPI e termo assinado para colaborador da empresa ativa.
- `POST /api/inventory-items` — Cadastra material ou ferramenta no almoxarifado da empresa ativa.
- `POST /api/inventory-movements` — Registra entrada, saída, cautela ou devolução atualizando o saldo do item em transação atômica.
- `POST /api/service-orders` — Abre nova Ordem de Serviço na empresa ativa.
- `POST /api/service-orders/status` — Avança ou conclui o status de uma Ordem de Serviço.
- `POST /api/financial-entries` — Registra lançamento financeiro (receita ou despesa).
- `POST /api/financial-entries/reconcile` — Alterna o status de conciliação do lançamento financeiro.

---

## 3. Modelo de Dados Relacional (PostgreSQL 17)

1. `tenants` (`id`, `name`, `cnpj`, `active`, `created_at`)
2. `users` (`id`, `tenant_id`, `name`, `email`, `password_hash`, `role`, `created_at`)
3. `sessions` (`id`, `user_id`, `active_tenant_id`, `token_hash`, `expires_at`, `created_at`)
4. `password_resets` (`id`, `user_id`, `code`, `expires_at`, `used`, `created_at`)
5. `clients` (`id`, `tenant_id`, `name`, `cnpj`, `contact`, `created_at`)
6. `contracts` (`id`, `tenant_id`, `client_id`, `code`, `object`, `scope_notes`, `workstation`, `duration_months`, `monthly_value`, `status`, `created_at`)
7. `employees` (`id`, `tenant_id`, `contract_id`, `name`, `role_title`, `schedule`, `status`, `created_at`)
8. `epi_deliveries` (`id`, `tenant_id`, `employee_id`, `epi_name`, `ca_number`, `delivered_at`, `expires_at`, `receipt_signed`, `created_at`)
9. `inventory_items` (`id`, `tenant_id`, `sku`, `description`, `category`, `quantity`, `unit`, `unit_value`, `min_quantity`, `created_at`)
10. `inventory_movements` (`id`, `tenant_id`, `item_id`, `employee_id`, `movement_type`, `quantity`, `notes`, `created_at`)
11. `service_orders` (`id`, `tenant_id`, `client_id`, `employee_id`, `code`, `description`, `priority`, `status`, `created_at`, `completed_at`)
12. `financial_entries` (`id`, `tenant_id`, `contract_id`, `entry_type`, `description`, `amount`, `due_date`, `reconciliation_status`, `created_at`)

---

## 4. Registro de Alterações (Changelog SDD)

- **[2026-11-19] SDD-001 — Bootstrap Arquitetural & Multi-Tenant:**
  - Criação da infraestrutura Docker (`db`, `redis`, `api` em Go 1.26, `app` em Next.js 16) operando na porta `3200`.
  - Implementação de autenticação Argon2id + sessão compartilhada via hash SHA-256 com suporte a `active_tenant_id` e seed automático do usuário desenvolvedor (`phelipegabriel1988@gmail.com` / `password`).
- **[2026-11-19] SDD-002 — Implementação dos 6 Módulos Operacionais:**
  - Implementação completa de Clientes e Contratos, Colaboradores e Escalas, Controle de EPIs, Almoxarifado e Cautela de Ferramentas, Ordens de Serviço e Gestão Financeira.
- **[2026-11-20] SDD-003 — Fluxo de Cadastro, Recuperação de Senha e Limpeza Documental:**
  - Adição da migration `0002_password_resets.sql` e endpoints `/api/auth/forgot-password` e `/api/auth/reset-password`.
  - Implementação da tela e fluxo completo de Recuperação de Senha (`/recuperar-senha`) e Cadastro Empresarial (`/cadastro`).
  - Remoção de referências visuais dos arquivos `.md` para manter a documentação estritamente focada em arquitetura e regras de negócio.
