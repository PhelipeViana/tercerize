# Tercerize — Arquitetura de Software e Domínio Multi-Empresas

Este documento descreve a arquitetura técnica, organização de módulos, infraestrutura de containers, segurança de sessão e isolamento multi-empresas (*multi-tenant*) da plataforma **Tercerize**.

---

## 1. Topologia e Stack Tecnológica

A plataforma utiliza uma arquitetura composta por **Backend em Go 1.26** e **Frontend em Next.js 16 (App Router)** sobre **PostgreSQL 17** (única fonte de verdade para persistência relacional) e **Redis 7** (exclusivo para controle efêmero de tentativas de autenticação).

```
tercerize/
├── docker-compose.yml          # Orquestração: db (Postgres 17), redis (Redis 7), api (Go), app (Next.js)
├── .env.example                # Variáveis de ambiente necessárias
├── docs/
│   └── SDD.md                  # Especificação funcional e modelo de dados (SDD)
├── backend/                    # API HTTP, Autenticação, Migrations, Seed e Regras de Negócio (Go 1.26)
│   ├── Dockerfile
│   ├── go.mod
│   ├── cmd/api/main.go         # Inicialização do servidor HTTP, migrations e seed
│   ├── migrations/             # Migrations SQL versionadas e embutidas no binário (embed.FS)
│   └── internal/
│       ├── api/router.go       # Roteamento HTTP (go-chi/chi/v5)
│       ├── config/             # Leitura de variáveis de ambiente
│       ├── db/                 # Pool pgx/v5 e executor transacional de migrations
│       ├── httpx/              # Padronização de leitura e escrita JSON
│       ├── auth/               # Cadastro, login, recuperação de senha, sessão SHA-256 e rate limiter
│       ├── operations/         # Handlers dos 6 módulos operacionais e gestão multi-empresas
│       └── seed/               # Provisionamento inicial multi-empresas e conta de desenvolvedor
└── frontend/                   # Aplicação Web (Next.js 16 + React 19 + TypeScript 5)
    ├── Dockerfile
    ├── app/
    │   ├── actions/            # Server Actions (autenticação e operações)
    │   ├── login/              # Autenticação de usuários
    │   ├── cadastro/           # Registro de nova empresa prestadora e gestor
    │   ├── recuperar-senha/    # Fluxo de recuperação e redefinição de senha
    │   └── admin/              # Módulos operacionais autenticados
    └── lib/
        ├── db/pool.ts          # Conexão server-only com PostgreSQL para leitura SSR
        ├── api/server.ts       # Comunicação server-to-server com a API Go via Bearer token
        ├── auth/               # Validação de sessão e controle de acesso (DAL)
        └── operations/         # Consultas relacionais escopadas por active_tenant_id
```

---

## 2. Princípios Arquiteturais

### 2.1. Persistência Centralizada e Migrations Automatizadas
- **PostgreSQL 17:** armazena empresas (`tenants`), usuários (`users`), sessões (`sessions`), tokens de recuperação de senha (`password_resets`), clientes tomadores (`clients`), contratos (`contracts`), colaboradores (`employees`), entregas de EPIs (`epi_deliveries`), itens de estoque (`inventory_items`), movimentações/cautelas (`inventory_movements`), ordens de serviço (`service_orders`) e lançamentos financeiros (`financial_entries`).
- **Migrations no Boot:** arquivos `.sql` em `backend/migrations/` são aplicados automaticamente em transação única com trava `pg_advisory_lock` antes da abertura da porta HTTP da API.

### 2.2. Autenticação, Recuperação de Senha e Sessão Multi-Tenant (`active_tenant_id`)
- **Senhas com Argon2id:** todas as senhas são processadas com Argon2id no formato PHC (`$argon2id$v=19$m=19456,t=2,p=1$...`) e comparadas em tempo constante.
- **Recuperação de Senha (`/recuperar-senha`):** geração de código de verificação temporário com expiração de 15 minutos (`password_resets`) e redefinição segura do hash Argon2id.
- **Sessão Compartilhada:** o cookie `HttpOnly` (`tercerize_session`) carrega apenas o token aleatório; o banco grava exclusivamente o hash `SHA-256` (`token_hash`) vinculado ao `user_id` e ao `active_tenant_id`.
- **Isolamento Estrito por Empresa:** todas as leituras e gravações nos módulos operacionais filtram obrigatoriamente por `active_tenant_id` obtido da sessão validada no servidor.

### 2.3. Governança Multi-Empresas e Acesso Desenvolvedor
- **Credencial de Nível Desenvolvedor (`role = 'developer'`):**
  - **E-mail:** `phelipegabriel1988@gmail.com`
  - **Senha:** `password`
- O perfil `developer` pode provisionar novas empresas prestadoras (`POST /api/tenants`) e alternar o contexto operacional ativo da sessão (`POST /api/tenants/switch`) entre qualquer empresa cadastrada.

---

## 3. Ambiente de Execução

- **Porta da Aplicação:** `3200` (`0.0.0.0:3200 -> 3000/tcp`)
- **Especificação Detalhada (SDD):** consulte [`docs/SDD.md`](file:///root/tercerize/docs/SDD.md).
