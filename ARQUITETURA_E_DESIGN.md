# Tercerize — Arquitetura de Projeto & Schema Visual (Baseado no Padrão RangoBrasil)

Este documento consolida a arquitetura de software, organização de módulos, infraestrutura em containers, contrato de inteligência conversacional e o **Design System / Schema Visual (`OKLCH` + Tailwind v4 + shadcn `base-nova`)** extraídos do projeto **RangoBrasil**, servindo como especificação mestre para a construção do projeto **Tercerize**.

---

## 1. Visão Geral da Arquitetura (Stack & Topologia)

O projeto adota uma arquitetura **Monolito Modular em Go + Frontend Next.js (App Router)** sobre **PostgreSQL 17** (única fonte de verdade) e **Redis 7** (exclusivo para dados efêmeros: rate-limiting e fila de jobs assíncronos).

```
tercerize/
├── docker-compose.yml          # Orquestração: db (Postgres 17), redis (Redis 7), api (Go), app (Next.js)
├── .env                        # Segredos e credenciais locais (fora do Git)
├── docs/
│   └── architecture.md         # Registro de Decisões de Arquitetura (ADRs: D1, D2, ...)
├── deploy/
│   └── nginx/                  # Configuração de proxy reverso para produção
├── backend/                    # API, Autenticação, Jobs, Webhooks, Pagamentos e Atendimento (Go 1.26)
│   ├── Dockerfile
│   ├── go.mod
│   ├── cmd/
│   │   ├── api/main.go         # Entrypoint do servidor HTTP + worker Asynq + migrator
│   │   └── migrate/main.go     # CLI para execução isolada de migrations
│   ├── migrations/             # Migrations SQL sequenciais (0001_*.sql ...) embutidas via embed.FS
│   └── internal/
│       ├── api/router.go       # Composição de rotas HTTP (go-chi/chi/v5)
│       ├── config/             # Carregamento e validação de variáveis de ambiente
│       ├── db/                 # Pool pgx/v5 e executor de migrations transacionais
│       ├── httpx/              # Helpers padronizados de leitura/resposta JSON e erros HTTP
│       ├── auth/               # Cadastro, login, sessão (cookie + SHA-256 no banco), rate limiter
│       ├── jobs/               # Cliente, servidor e scheduler de tarefas em background (hibiken/asynq)
│       ├── retention/          # Expurgo automático de dados temporários (janela de 30 dias)
│       ├── attendance/         # Omnichannel WhatsApp, criptografia AES-GCM de tokens, Kanban
│       ├── customerbot/        # Robô de atendimento automatizado para clientes finais
│       ├── payment/            # Gateways de pagamento, carteira de créditos e webhooks assinados
│       └── areas/              # Regras de progresso de configuração por tenant
└── frontend/                   # Interface Web (Next.js 16 + React 19 + Tailwind CSS v4 + TypeScript 5)
    ├── Dockerfile
    ├── components.json         # Configuração shadcn (style: "base-nova", baseUI + Lucide)
    ├── AGENTS.md               # Regras de engenharia para agentes (contrato do assistente)
    ├── app/
    │   ├── globals.css         # Tokens OKLCH, variáveis CSS e tema escuro nativo
    │   ├── layout.tsx          # Fontes Geist Sans / Geist Mono, viewport dark (#0a0a0a)
    │   ├── page.tsx            # Redirecionamento inteligente para a próxima área ou painel
    │   ├── actions/            # Server Actions que conversam com o banco ou com a API Go
    │   ├── login/ & cadastro/  # Fluxo de autenticação com AuthShell
    │   ├── atendimento/        # Caixa única Omnichannel + Quadro Kanban de 4 estágios
    │   ├── configuracao/       # Hub visual de configuração em colunas por área
    │   ├── chat/               # Aba única de escrita livre com Assistente IA + histórico 30 dias
    │   ├── creditos/           # Carteira de créditos pré-pagos e recargas via PIX/Checkout
    │   └── recebiveis/         # Gestão de recebíveis e parametrização de gateway do tenant
    ├── components/
    │   ├── ui/                 # Primitivas @base-ui/react + CVA (Button, Dialog, Card, Input, Badge...)
    │   ├── brand/logo.tsx      # Identidade visual compacta e responsiva
    │   ├── auth/               # AuthShell, LoginForm, RegisterForm, Field
    │   ├── guided/             # Sidebar, AreaScreen, Composer, ChoicesBlock, SummaryBlock, PinMap
    │   ├── config/             # ConfigScreen, ConfigTile, ToggleTile com confirmação inline
    │   ├── attendance/         # OmnichannelScreen, KanbanBoard, ChannelsBar, ConnectModal
    │   ├── credits/            # CreditsScreen
    │   └── receivables/        # ReceivablesScreen
    ├── hooks/                  # Hooks de motor guiado (use-guided-engine) e tempo real (use-attendances)
    └── lib/
        ├── db/pool.ts          # Pool PostgreSQL server-only para leitura rápida de sessão/SSR
        ├── api/server.ts       # Cliente HTTP server-to-server para a API Go (Bearer token)
        ├── auth/               # DAL de sessão (lê cookie e valida hash SHA-256 no Postgres)
        ├── guided/             # Motor de chat guiado determinístico (base.ts, types.ts, hub.ts)
        ├── assistant/          # Contrato de intenções IA (contract.ts, plan.ts, prompt.ts, service.ts)
        ├── areas.ts            # Definição sequencial das áreas de onboarding/configuração
        └── config-hub.ts       # Mapeamento de todas as configurações em blocos de status (done/pending/locked)
```

---

## 2. Princípios Arquiteturais Fundamentais

### 2.1. PostgreSQL como Única Fonte de Verdade & Redis Efêmero
- **PostgreSQL 17 (`pgx/v5` no Go, `pg` no Next.js):** armazena absolutamente todo estado persistente (contas, tenants, sessões, configurações, contatos, conversas, mensagens, carteira de créditos, eventos de uso).
- **Migrations Embutidas:** arquivos SQL puros em `backend/migrations/` (`0001_*.sql`, `0002_*.sql`, ...) compilados dentro do binário Go via `embed.FS` e aplicados automaticamente na subida do container `api`.
- **Redis 7 Opcional/Passageiro:** utilizado apenas para *rate-limiting* de autenticação e fila de jobs (`asynq`). Se o Redis cair, o sistema não perde dados de negócio.

### 2.2. Sessão Compartilhada e Escopo Multi-Tenant Estrito (`tenant_id`)
- O **Go** cria e encerra a sessão: gera um token aleatório, entrega ao cliente em cookie `HttpOnly` e grava apenas o **hash SHA-256** do token na tabela `sessions`.
- O **Next.js** lê a sessão diretamente na tabela `sessions` no carregamento SSR (evitando round-trip HTTP desnecessário) e repassa o token via header `Authorization: Bearer <token>` ao invocar rotas da API Go em `lib/api/server.ts`.
- **Isolamento por Tenant:** toda query SQL e toda rota de API exige `tenant_id` validado a partir da sessão no servidor. A interface nunca é a barreira de segurança.

### 2.3. Separação entre Configuração Guiada (Sem Digitação) e Aba Chat (IA com Confirmação)
1. **Onboarding & Áreas Sequenciais (`lib/areas.ts`):**
   - O sistema divide a configuração inicial em **Áreas** sequenciais. Uma área só é desbloqueada quando todas as etapas da área anterior estão concluídas (`tenants.config_done`).
   - Cada área usa um **Motor Guiado Determinístico** (`lib/guided/base.ts`), respondido exclusivamente por botões, seletores e formulários estruturados (sem caixa de texto livre).
2. **Hub de Configuração (`/configuracao`):**
   - Quadro em colunas (uma coluna por área, com barra de progresso `done/total` e cartões `ConfigTile` numerados).
   - Cada tile exibe seu estado: **Configurado** (`done`, ícone verde), **Pendente** (`pending`, borda destacada) ou **Bloqueado** (`locked`, opacidade reduzida).
   - Opções booleanas (ex.: atendimento automático) usam `ToggleTile` com chave `role="switch"` que abre uma confirmação explícita (**Sim / Não / Cancelar**) antes de persistir.
3. **Aba Chat (`/chat`) + Assistente IA com Contrato Determinístico (`lib/assistant/`):**
   - Único local onde o usuário digita livremente em linguagem natural.
   - O fluxo segue 4 passos invioláveis:
     1. **Entender (`interpretMessage`):** o LLM recebe o snapshot atual do tenant e o catálogo de intenções (`INTENTS` em `contract.ts`) e devolve JSON estruturado.
     2. **Planejar (`plan.ts`):** aplica as alterações em um rascunho em memória, valida com `zod` e gera frases canônicas no infinitivo (nunca usa texto livre da IA para descrever a mudança).
     3. **Confirmar:** exibe `"Deseja <frase do plano>?"` com botões **Sim**, **Não** e **Cancelar**. Nenhuma alteração ocorre antes do clique em **Sim**.
     4. **Gravar (`confirmActions`):** executa exatamente as mesmas funções de validação e persistência utilizadas pelos formulários da interface.

### 2.4. Atendimento Omnichannel & Quadro Kanban
- **Caixa Única por Tenant:** contatos e conversas pertencem ao `tenant_id`, independentemente de quantos números/canais de WhatsApp estejam conectados.
- **Segurança de Credenciais e Webhooks:** tokens de instância e segredos de webhook são cifrados no banco com **AES-GCM** (`WHATSAPP_MASTER_KEY`). Webhooks exigem assinatura HMAC + timestamp e são idempotentes pelo ID externo da mensagem.
- **Kanban Operacional em 4 Estágios:** cada conversa ativa transita por 4 colunas operacionais com cores semânticas próprias e ação rápida de avanço de estágio.

---

## 3. Schema Visual & Design System

O projeto utiliza **Tailwind CSS v4** (`@import "tailwindcss";`), **`tw-animate-css`**, **`shadcn` (`style: "base-nova"`)** sobre primitivas **`@base-ui/react`** e ícones **`lucide-react`**, operando em **Dark Mode Nativo de Alto Contraste** com espaço de cor perceptual **OKLCH**.

### 3.1. Paleta de Cores em Espaço Perceptual `OKLCH`

Definida em `frontend/app/globals.css`, a paleta evita pretos puros chapados combinando superfícies neutras acromáticas (`chroma = 0`) com um **Amarelo-Âmbar Solar (`Hue 95°`)** de alta visibilidade como cor primária de ação e foco:

| Token CSS | Valor `OKLCH` | Papel Visual na Interface |
|---|---|---|
| `--background` | `oklch(0.145 0 0)` | Fundo principal da aplicação (`~#0a0a0a`, neutro profundo) |
| `--foreground` | `oklch(0.97 0 0)` | Texto primário de leitura com contraste máximo |
| `--sidebar` | `oklch(0.17 0 0)` | Superfície da barra lateral fixa (`w-72`) |
| `--card` / `--popover` | `oklch(0.19 0 0)` | Superfície elevada de cartões, modais e blocos de formulário |
| `--secondary` / `--muted` | `oklch(0.25 0 0)` | Superfície de controles secundários, avatares e chips inativos |
| `--muted-foreground` | `oklch(0.72 0 0)` | Texto secundário, subtítulos, legendas e metadados |
| `--primary` | `oklch(0.88 0.18 95)` | Cor de destaque principal (Amarelo-Ouro energético, `L=88%, C=0.18, H=95°`) |
| `--primary-foreground` | `oklch(0.18 0 0)` | Texto escuro sobre botões `--primary` (contraste > 10:1) |
| `--accent` | `oklch(0.28 0.04 95)` | Superfície de realce sutil aquecida pelo matiz `95°` |
| `--ring` | `oklch(0.88 0.18 95)` | Anel de foco de teclado (`:focus-visible`) visível e nítido |
| `--border` | `oklch(1 0 0 / 11%)` | Bordas estruturais translúcidas de 1px (`11%` branco) |
| `--input` | `oklch(1 0 0 / 15%)` | Bordas e fundos translúcidos de campos de entrada |
| `--success` | `oklch(0.75 0.17 150)` | Verde semântico (etapa concluída, bot ativo, pagamento confirmado) |
| `--warning` | `oklch(0.8 0.16 70)` | Âmbar semântico (pendências, alertas operacionais) |
| `--info` | `oklch(0.72 0.14 240)` | Azul semântico (cliente atendido, status informativo) |
| `--destructive` | `oklch(0.704 0.191 22.216)` | Vermelho coral para erros de validação e ações destrutivas |

#### Cores Semânticas de Estágios do Kanban (`KanbanBoard`)
Cada coluna operacional utiliza bordas de `25%` de opacidade, cabeçalho de `10%` e badge de `15%`:
1. **Estágio 1 (Entrada / Pedido):** `amber-500` (`border-amber-500/25`, `bg-amber-500/10`, `text-amber-400`)
2. **Estágio 2 (Execução / Produção):** `orange-500` (`border-orange-500/25`, `bg-orange-500/10`, `text-orange-400`)
3. **Estágio 3 (Trânsito / Entrega):** `purple-500` (`border-purple-500/25`, `bg-purple-500/10`, `text-purple-400`)
4. **Estágio 4 (Concluído / Confirmado):** `emerald-500` (`border-emerald-500/25`, `bg-emerald-500/10`, `text-emerald-400`)

---

### 3.2. Tipografia & Escala Geométrica de Raios

- **Família Tipográfica (`next/font/google`):**
  - `--font-sans`: **Geist Sans** (interface, títulos, formulários e chat).
  - `--font-mono`: **Geist Mono** (códigos, chaves PIX, NSU, identificadores técnicos).
- **Disciplina Numérica:** contadores (`done/total`), valores monetários, cronômetros e índices de etapas usam obrigatoriamente `tabular-nums` para evitar deslocamento horizontal (*layout shift*).
- **Escala de Border Radius (`--radius: 0.75rem` / `12px`):**
  Calculada proporcionalmente via CSS `calc()` no bloco `@theme inline`:
  - `--radius-sm`: `calc(var(--radius) * 0.6)` (`~7.2px`)
  - `--radius-md`: `calc(var(--radius) * 0.8)` (`~9.6px`)
  - `--radius-lg`: `var(--radius)` (`12px`)
  - `--radius-xl`: `calc(var(--radius) * 1.4)` (`~16.8px` — padrão de `ConfigTile`)
  - `--radius-2xl`: `calc(var(--radius) * 1.8)` (`~21.6px` — padrão de `AuthShell` e colunas de área)

---

### 3.3. Padrões de Layout, Navegação e Componentes

1. **Shell Principal de Aplicação (`flex h-dvh overflow-hidden bg-background`):**
   - **Viewport travada em `h-dvh`** com rolagem interna isolada por painel (`overflow-y-auto`), eliminando scroll duplo de página no desktop e no mobile.
   - **Sidebar (`w-72`):** fixa à esquerda no desktop (`md:static md:translate-x-0`) e *drawer* deslizante com backdrop `bg-black/60` no mobile (`fixed inset-y-0 left-0 z-40 transition-transform`).
   - **Rodapé da Sidebar:** indicador ao vivo (`aria-live="polite"`) do estado do robô (`size-2 rounded-full bg-success` quando ligado) + avatar circular com inicial do usuário, nome truncado (`min-w-0 flex-1 truncate`) e botão de logout.
2. **Shell de Autenticação (`AuthShell`):**
   - Centralizado em `min-h-dvh` com container `max-w-sm`, logo centralizada no topo e cartão `rounded-2xl border border-border bg-card p-6 shadow-lg shadow-black/30`.
3. **Colunas Responsivas com Snap Horizontal no Mobile (`ConfigScreen` / `KanbanBoard`):**
   - No mobile, grupos de colunas usam `flex h-full min-w-max snap-x snap-mandatory gap-4 overflow-x-auto`, com cada coluna ocupando `w-[min(85vw,20rem)] shrink-0 snap-center`.
   - No desktop (`lg:`), as colunas expandem automaticamente para `lg:w-auto lg:min-w-0 lg:flex-1 lg:snap-align-none`.
4. **Acessibilidade & Semântica Incorporadas:**
   - Uso estrito de `<ol>` / `<ul>` com `aria-label` e `aria-labelledby` para colunas e listas de etapas.
   - Regiões dinâmicas de status marcadas com `aria-live="polite"` e erros com `role="alert"`.
   - Botões de alternância construídos com `role="switch"` e `aria-checked`.
   - Anéis de foco sempre presentes (`outline-none focus-visible:ring-2 focus-visible:ring-ring/50`).
   - Ícones meramente visuais marcados com `aria-hidden`, nunca usando emojis como ícones estruturais.

---

## 4. Implementação Realizada & Documentação SDD (`Tercerize` — Porta `3200`)

A especificação completa orientada a domínio (SDD — *Specification-Driven Development*), incluindo o modelo de dados multi-empresas, rotas dos 6 módulos do Briefing Executivo e registro de alterações, encontra-se em:
- **[`docs/SDD.md`](file:///root/tercerize/docs/SDD.md)**

### Resumo Operacional do Ambiente:
1. **Porta Web Exposta:** `3200` (`http://localhost:3200` / `0.0.0.0:3200 -> 3000/tcp`), sem repetição de portas com os demais serviços do servidor.
2. **Acesso de Nível Desenvolvedor (Seed Automático Multi-Empresas):**
   - **E-mail:** `phelipegabriel1988@gmail.com`
   - **Senha:** `password`
   - **Capacidades:** Alternância instantânea entre empresas prestadoras (`tenants`) pela barra lateral e provisionamento de novas empresas em `/admin/companies`.
3. **Módulos Implementados (Escopo Estrito do Anexo):**
   - **Clientes e Contratos:** `/admin/contracts` e `/admin/contracts/create`
   - **Ordens de Serviço (OS):** `/admin/service-orders`
   - **Inventário, Materiais e Cautela de Ferramentas:** `/admin/inventory-items`
   - **Colaboradores e Escalas:** `/admin/employees`
   - **Controle de EPIs:** `/admin/epis`
   - **Gestão Financeira:** `/admin/finance`
