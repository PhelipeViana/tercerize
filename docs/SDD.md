# SDD — Specification-Driven Development & System Design Document
## Plataforma de Gestão de Terceirização e Serviços (Tercerize)

- **Versão:** 2.0.0
- **Status:** Implementado (Google Authenticator TOTP Exclusivo + Link via SMTP + Master + RBAC Multi-Empresas N:N)
- **Porta de Operação:** `3200` (`0.0.0.0:3200 -> 3000/tcp`)
- **Stack:** Go 1.26 (`chi/v5`, `pgx/v5`, `totp RFC 6238`, `smtp SSL`, `redis`) + Next.js 16 (`React 19`, `TypeScript 5`) + PostgreSQL 17.

---

## 1. Arquitetura de Autenticação e Governança Multi-Empresas

| Pilar | Regra de Negócio Implementada |
|---|---|
| **Autenticação Exclusiva (Sem Exceções)** | Todos os usuários entram exclusivamente via **E-mail + Código de 6 dígitos do Google Authenticator (TOTP RFC 6238)** em `/login`. Não existem páginas públicas de cadastro (`/cadastro`) nem de recuperação de senha (`/recuperar-senha`). |
| **Ativação por Link no E-mail (Sem QR Code)** | Ao cadastrar uma empresa (ou uma subpermissão), o backend envia automaticamente via SMTP (`MAIL_*` no `.env`) um link pessoal para `/ativar-autenticador?token=...`, que oferece o deep-link direto `otpauth://` e a chave Base32 copiável para configuração no aplicativo Google Authenticator sem QR Code. |
| **Acesso Master** | O e-mail `phelipegabriel1988@gmail.com` possui `is_master = true`, com acesso irrestrito a todas as empresas, cadastro de empresas em `/admin/companies` e gestão de roles e permissões em qualquer empresa. |
| **Dono por Empresa & Vínculo N:N** | Cada empresa (`tenants`) possui `CNPJ` único (`UNIQUE (cnpj)`), `owner_name` (Nome do responsável) e `owner_email` (E-mail do responsável). Um mesmo e-mail pode ser Dono de múltiplas empresas com CNPJs distintos e atuar como subpermissão em outras empresas. |
| **Função Única por Empresa** | A tabela `tenant_memberships` impõe `UNIQUE (tenant_id, user_id)`: um usuário **jamais** pode possuir 2 funções dentro da mesma empresa. |
| **Roles e Permissões (`/admin/permissions`)** | Gerenciamento exclusivo do **Dono da empresa ativa (`role = 'owner'`)** ou de acesso **Master**. Permite criar/editar funções com matriz granular por módulo (`:view` e `:write`) e gerenciar subpermissões por e-mail. |

---

## 2. Contratos de API (Backend Go)

### 2.1. Autenticação (TOTP + Link por E-mail)
- `POST /api/auth/login` — Autentica exclusivamente com `{ email, code }` (6 dígitos TOTP).
- `POST /api/auth/logout` — Encerra a sessão ativa e limpa o cookie `tercerize_session`.
- `POST /api/auth/request-link` — Envia um novo link de configuração do Google Authenticator via SMTP para o e-mail informado.
- `GET /api/auth/setup-link?token=...` — Valida o token recebido por e-mail e retorna a chave Base32 e o deep-link `otpauth://`.
- `POST /api/auth/setup-link/verify` — Valida o primeiro código de 6 dígitos do Google Authenticator, consome o link e inicia sessão.

### 2.2. Multi-Empresas & RBAC
- `GET /api/me` — Retorna `{ user, tenant, role }` com as permissões efetivas na empresa ativa.
- `POST /api/tenants/switch` — Alterna a empresa ativa (Master pode alternar para qualquer empresa; usuários comuns alternam entre as empresas em que possuem vínculo em `tenant_memberships`).
- `POST /api/tenants` — Exclusivo Master. Cadastra nova empresa (`name`, `cnpj`, `ownerName`, `ownerEmail`), cria roles padrão, vincula o dono e envia o link de ativação por e-mail.
- `POST /api/rbac/roles` — Exclusivo Dono ou Master. Cria ou atualiza função e permissões na empresa ativa.
- `POST /api/rbac/roles/delete` — Exclusivo Dono ou Master. Remove função customizada sem vínculos.
- `POST /api/rbac/members` — Exclusivo Dono ou Master. Adiciona e-mail com 1 função única na empresa ativa (retorna `HTTP 409` se já possuir função nesta empresa) e envia link por e-mail.
- `POST /api/rbac/members/role` — Exclusivo Dono ou Master. Altera a função única de um membro.
- `POST /api/rbac/members/remove` — Exclusivo Dono ou Master. Revoga o acesso de um membro (exceto Dono).
- `POST /api/rbac/members/resend-link` — Exclusivo Dono ou Master. Reenvia link do Google Authenticator por e-mail.

### 2.3. Módulos Operacionais (Validados por Permissão)
- `POST /api/clients` (`contracts:write`)
- `POST /api/contracts` (`contracts:write`)
- `POST /api/employees`, `POST /api/employees/schedule` (`employees:write`)
- `POST /api/epis`, `POST /api/epis/sign` (`epis:write`)
- `POST /api/inventory-items`, `POST /api/inventory-movements` (`inventory:write`)
- `POST /api/service-orders`, `POST /api/service-orders/status` (`service_orders:write`)
- `POST /api/financial-entries`, `POST /api/financial-entries/reconcile` (`finance:write`)

---

## 3. Changelog SDD

- **[2026-11-20] SDD-005 — Google Authenticator Exclusivo, Link por E-mail SMTP, Acesso Master e RBAC Multi-Empresas (`0004_authenticator_master_rbac.sql`):**
  - Remoção de `/cadastro`, `/recuperar-senha` e da tabela `password_resets`.
  - Autenticação estrita via E-mail + Google Authenticator (RFC 6238 TOTP) sem exceções.
  - Envio automático de link de ativação por e-mail (sem QR Code) via SMTP SSL (`MAIL_*` no `.env`) ao cadastrar empresa ou conceder subpermissão.
  - Acesso Master para `phelipegabriel1988@gmail.com`, propriedade de empresa (`owner_name`, `owner_email`, `CNPJ` único), vínculos N:N em `tenant_memberships` com trava `UNIQUE (tenant_id, user_id)` e módulo `/admin/permissions` exclusivo para Dono ou Master.
- **[2026-11-21] SDD-006 — Login em 2 Etapas, Recuperação de Autenticação com Validação de CNPJ e Deslogue Imediato por Bloqueio (`0005_user_block_and_recovery.sql`):**
  - Login em 2 etapas (`/login`): Etapa 1 (`POST /api/auth/check-email`) valida o e-mail e status de bloqueio; Etapa 2 (`POST /api/auth/login`) valida o código de 6 dígitos do Google Authenticator.
  - Página dedicada de Recuperação de Autenticação (`/recuperar-autenticador`): Etapa 1 (`POST /api/auth/recovery/check-email`) valida e-mail e bloqueio; Etapa 2 (`POST /api/auth/recovery/send-link`) exige a confirmação do CNPJ de qualquer empresa vinculada para e-mails não-Master antes do envio do link de recuperação.
  - Bloqueio com revogação imediata de sessão: bloquear um usuário (`POST /api/rbac/members/block`) ou bloquear/desativar uma empresa (`POST /api/tenants/toggle-active`) executa `DELETE FROM sessions` e rejeita imediatamente qualquer sessão ativa no backend Go e no middleware/DAL Next.js.
