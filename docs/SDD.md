# SDD — Specification-Driven Development & System Design Document
## Plataforma de Gestão de Terceirização e Serviços (Tercerize)

- **Versão:** 1.2.0
- **Status:** Implementado (Multi-Empresas + Autenticação + Jornada Guiada + Garantias Transacionais QA/UX)
- **Porta de Operação:** `3200` (`0.0.0.0:3200 -> 3000/tcp`)
- **Stack:** Go 1.26 (`chi/v5`, `pgx/v5`, `argon2id`, `redis`) + Next.js 16 (`React 19`, `TypeScript 5`) + PostgreSQL 17.

---

## 1. Escopo Funcional do Sistema

O sistema implementa os fluxos de autenticação, jornada guiada de primeira operação e governança multi-empresas, além dos 6 módulos operacionais interdependentes:

| # | Módulo / Fluxo | Rota no Sistema | Funcionalidades e Regras de Negócio |
|---|---|---|---|
| **0.1** | **Autenticação, Cadastro e Recuperação de Senha** | `/login`, `/cadastro`, `/recuperar-senha` | Login com rate-limit por IP/e-mail e entrada separada para modo demonstração; cadastro de novas empresas com validação algorítmica de CNPJ (14 dígitos + dígitos verificadores módulo 11) e regra explícita de senha; recuperação de senha com código temporário de 6 dígitos. |
| **0.2** | **Governança Multi-Empresas (Multi-Tenant)** | `/admin/companies` + Seletor Global | Isolamento de dados por `tenant_id`. Busca rápida no seletor de empresas, confirmação visual de contexto ativo e trilha guiada de primeira operação (`Empresa → Cliente → Contrato → Colaborador → Primeira OS`). |
| **1** | **Clientes e Contratos** | `/admin/contracts` e `/admin/contracts/create` | Ação principal dinâmica por aba (`Novo contrato` vs. `Novo cliente`), unicidade de CNPJ por empresa (`UNIQUE (tenant_id, cnpj)`), estados vazios diferenciados (empresa sem cadastros vs. filtro sem resultado com `Limpar filtros`) e painel de detalhes clicável por código ou cliente. |
| **2** | **Colaboradores e Escalas** | `/admin/employees` | Registro da equipe técnica, painel de detalhes e troca de turno/alocação pelo nome do colaborador, detecção preventiva de conflito de escala no mesmo contrato/turno e visão de cobertura semanal por posto. |
| **3** | **Controle de EPIs** | `/admin/epis` | Separação estrita entre entrega (`delivered_at`, `ca_number`, `expires_at`) e assinatura (`receipt_signed`, `signed_at`, `signed_by`, `evidence_code`). Novas entregas podem nascer pendentes de assinatura e receber confirmação posterior com protocolo consultável. |
| **4** | **Almoxarifado e Ferramentas** | `/admin/inventory-items` | Separação entre `Movimentar estoque` e `Novo item`, operações adaptadas à categoria (`Material` vs. `Ferramenta`), prévia de saldo antes da confirmação, trava transacional `SELECT ... FOR UPDATE` que recusa saídas/cautelas maiores que o saldo disponível e histórico `previous_quantity → delta → new_quantity` com vínculo de OS. |
| **5** | **Ordens de Serviço (OS)** | `/admin/service-orders` | Contador de chamados ativos calculado exclusivamente sobre estados operacionais ativos (`Agendada` + `Em Execução`), coleta de data e hora programada (`scheduled_for`) para ordens agendadas, vínculo com contrato/unidade e filtros por técnico, situação e busca. |
| **6** | **Gestão Financeira** | `/admin/finance` | Identificação explícita do período/competência nos indicadores, distinção entre valores previstos e conciliados, filtro por competência (`MM/YYYY`), tipo e conciliação, campo de valor iniciado em branco com suporte ao padrão monetário brasileiro e registro de data/hora da última conciliação/reabertura. |

---

## 2. Credenciais e Controle de Acesso

### 2.1. Acesso Nível Desenvolvedor (Seed Automático)
- **E-mail:** `phelipegabriel1988@gmail.com`
- **Senha:** `password`
- **Papel (`role`):** `developer`

### 2.2. Contratos de API (Backend Go)
- `POST /api/auth/login` — Autentica usuário e inicia sessão (`tercerize_session`).
- `POST /api/auth/register` — Valida CNPJ (módulo 11), cria novo `tenant` + usuário `admin` e inicia sessão.
- `POST /api/auth/logout` — Encerra a sessão ativa no banco e remove o cookie.
- `POST /api/auth/forgot-password` — Gera código de recuperação de 6 dígitos com validade de 15 minutos.
- `POST /api/auth/reset-password` — Valida o código de recuperação e redefine a senha (Argon2id).
- `GET /api/me` — Retorna dados do usuário autenticado e da empresa ativa na sessão.
- `POST /api/tenants/switch` — Alterna `active_tenant_id` na sessão (exclusivo `developer`).
- `POST /api/tenants` — Valida CNPJ (módulo 11) e provisiona nova empresa terceirizadora (exclusivo `developer`).
- `POST /api/clients` — Valida CNPJ (módulo 11 + unicidade no tenant) e cadastra cliente tomador.
- `POST /api/contracts` — Cadastra contrato vinculado a um cliente tomador da empresa ativa.
- `POST /api/employees` — Cadastra colaborador e escala na empresa ativa.
- `POST /api/employees/schedule` — Atualiza contrato/posto, turno/escala e situação operacional de um colaborador.
- `POST /api/epis` — Registra entrega de EPI (pendente de assinatura por padrão ou assinada com comprovante).
- `POST /api/epis/sign` — Registra assinatura e protocolo de evidência (`signed_by`, `evidence_code`, `signed_at`) em entrega de EPI pendente.
- `POST /api/inventory-items` — Cadastra material ou ferramenta no almoxarifado da empresa ativa.
- `POST /api/inventory-movements` — Bloqueia a linha do item (`FOR UPDATE`), recusa saída/cautela acima do saldo disponível (`HTTP 409`) e grava movimentação com `previous_quantity`, `quantity`, `new_quantity` e `service_order_id`.
- `POST /api/service-orders` — Abre nova Ordem de Serviço com suporte a `contract_id` e `scheduled_for`.
- `POST /api/service-orders/status` — Avança ou conclui o status de uma Ordem de Serviço.
- `POST /api/financial-entries` — Registra lançamento financeiro (receita ou despesa).
- `POST /api/financial-entries/reconcile` — Alterna o status de conciliação do lançamento financeiro e atualiza `updated_at`.

---

## 3. Modelo de Dados Relacional (PostgreSQL 17)

1. `tenants` (`id`, `name`, `cnpj`, `active`, `created_at`)
2. `users` (`id`, `tenant_id`, `name`, `email`, `password_hash`, `role`, `created_at`)
3. `sessions` (`id`, `user_id`, `active_tenant_id`, `token_hash`, `expires_at`, `created_at`)
4. `password_resets` (`id`, `user_id`, `code`, `expires_at`, `used`, `created_at`)
5. `clients` (`id`, `tenant_id`, `name`, `cnpj`, `contact`, `created_at`) — `UNIQUE (tenant_id, cnpj)`
6. `contracts` (`id`, `tenant_id`, `client_id`, `code`, `object`, `scope_notes`, `workstation`, `duration_months`, `monthly_value`, `status`, `created_at`)
7. `employees` (`id`, `tenant_id`, `contract_id`, `name`, `role_title`, `schedule`, `status`, `created_at`)
8. `epi_deliveries` (`id`, `tenant_id`, `employee_id`, `epi_name`, `ca_number`, `delivered_at`, `expires_at`, `receipt_signed`, `signed_at`, `signed_by`, `evidence_code`, `created_at`)
9. `inventory_items` (`id`, `tenant_id`, `sku`, `description`, `category`, `quantity`, `unit`, `unit_value`, `min_quantity`, `created_at`)
10. `inventory_movements` (`id`, `tenant_id`, `item_id`, `employee_id`, `service_order_id`, `movement_type`, `previous_quantity`, `quantity`, `new_quantity`, `notes`, `created_at`)
11. `service_orders` (`id`, `tenant_id`, `client_id`, `contract_id`, `employee_id`, `code`, `description`, `priority`, `status`, `scheduled_for`, `created_at`, `completed_at`)
12. `financial_entries` (`id`, `tenant_id`, `contract_id`, `entry_type`, `description`, `amount`, `due_date`, `reconciliation_status`, `updated_at`, `created_at`)

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
- **[2026-11-20] SDD-004 — Melhorias de Usabilidade, Fluxo Guiado e Garantias de QA (`0003_usability_and_qa.sql`):**
  - Bloqueio transacional (`FOR UPDATE`) contra saída/cautela de estoque maior que o saldo disponível (`QA-01`), com histórico de saldo anterior e final.
  - Separação entre registro de entrega de EPI e coleta auditável de assinatura/evidência (`QA-02`, `POST /api/epis/sign`).
  - Limpeza de credenciais pré-preenchidas no login público com entrada própria para demonstração (`QA-03`).
  - Validação oficial de CNPJ (14 dígitos, bloqueio de dígitos repetidos e cálculo de dígitos verificadores módulo 11) + unicidade por empresa (`QA-04`).
  - Contador de chamados ativos restrito a OS `Agendada` e `Em Execução` (`QA-05`), estados vazios diferenciados com botão `Limpar filtros` (`QA-06`) e fluxo guiado encadeado da primeira operação (`Empresa → Cliente → Contrato → Colaborador → Primeira OS`).
