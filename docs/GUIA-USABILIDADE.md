# Guia de Usabilidade e Operação — Plataforma Tercerize

Este guia resume o funcionamento padronizado de todas as funções da plataforma **Tercerize**, suas regras de segurança, perfis de acesso e o fluxo operacional recomendado.

---

## 1. Perfis de Acesso e Isolamento de Visão

| Perfil | O que visualiza | O que pode gerenciar |
|---|---|---|
| **MASTER** (`phelipegabriel1988@gmail.com`) | Ao entrar, acessa exclusivamente o **Painel Global MASTER** (`Gestão de empresas`). Pode alternar no seletor do topo (ou em **Ver sistema**) para ver exatamente o ambiente de qualquer empresa cliente e retornar em 1 clique (**Voltar para MASTER**). | Cadastrar empresas, editar razão social/CNPJ/responsável, ativar/desativar empresas, reenviar links do Authenticator, acompanhar telemetria de acesso dos clientes e gerenciar qualquer empresa. |
| **Dono da empresa** | Apenas a(s) empresa(s) ativa(s) em que possui vínculo. Nunca visualiza o painel MASTER nem altera os dados cadastrais da empresa. | Todos os 6 módulos operacionais + **Roles e permissões** (criar/editar funções, convidar e-mails com 1 função única na empresa e bloquear/remover subpermissões). |
| **Subpermissão (Gerente, Operador, Financeiro, personalizado)** | Apenas os módulos liberados pela sua função (Role) naquela empresa. | Apenas visualização ou criação/edição conforme matriz da Role. |

> **Regra multi-empresa**: Um mesmo e-mail pode ser Dono de várias empresas (CNPJs distintos) e ter subpermissão em outra empresa, mas **jamais** pode possuir duas funções simultâneas na mesma empresa.

---

## 2. Acesso Seguro (Sem Senha Tradicional)

1. **Ativação inicial (sem QR Code)**:
   - Ao cadastrar uma empresa ou convidar um membro, o sistema envia automaticamente um e-mail com o link seguro `/ativar-autenticador?token=...`.
   - O usuário abre o link, copia a chave secreta (ou toca no botão direto do **Google Authenticator** no celular) e confirma com o código de 6 dígitos.
2. **Login em 2 etapas (`/login`)**:
   - **Etapa 1**: Informar o e-mail (valida cadastro, se não está bloqueado e se há empresa ativa).
   - **Etapa 2**: Informar o código de 6 dígitos do Google Authenticator.
3. **Recuperação de Autenticação (`/recuperar-autenticador`)**:
   - **Etapa 1**: Validar e-mail e confirmar que o acesso não está bloqueado.
   - **Etapa 2**: Para usuários não-Master, exige e valida o **CNPJ de qualquer empresa ativa vinculada** àquele e-mail antes de disparar novo link por SMTP. Para Master, libera o envio direto.
4. **Bloqueio com desconexão imediata**:
   - Desativar uma empresa (Master) ou bloquear um usuário (Master/Dono) revoga imediatamente as sessões ativas no banco e bloqueia qualquer requisição subsequente.

---

## 3. Padrão Visual e de Interação (Todas as Telas)

Todas as telas da plataforma seguem a mesma anatomia previsível para reduzir a curva de aprendizado:

1. **Cabeçalho único**: Título claro + subtítulo com contexto da empresa ativa + **Ação principal à direita** (botão azul em destaque).
2. **Faixa de resumo (KPIs)**: 3 ou 4 indicadores alinhados horizontalmente com `tabular-nums`, sem cartões redundantes.
3. **Tabela em largura total**: Filtros e busca na barra superior da tabela, colunas objetivas e ações alinhadas à direita.
4. **Sistema de Modais acessíveis (WCAG 2.2 AA)**:
   - Cadastros, edições e inspeção de detalhes abrem em **janelas modais centralizadas** (fechamento com `Esc`, clique fora ou botão `X`, foco gerenciado por teclado).
   - Ações críticas (desativar empresa, bloquear usuário, revogar acesso, excluir função) abrem **Modal de Confirmação** explicitando o impacto antes da execução.
5. **Botão `Guia` no topo**: Sempre acessível na barra superior, exibindo instruções rápidas adaptadas ao contexto atual (**MASTER** ou **Empresa Cliente**).

---

## 4. Roteiro Operacional Recomendado (Empresa Cliente)

1. **Clientes e contratos (`/admin/contracts`)**:
   - Clique em **Novo cliente** (abre modal) → cadastre o cliente tomador com CNPJ válido.
   - Clique em **Novo contrato** → vincule cliente, objeto, unidade/postos, vigência e valor mensal.
2. **Colaboradores e escalas (`/admin/employees`)**:
   - Clique em **Novo colaborador** (abre modal) → vincule ao contrato e turno.
   - Clique no nome do colaborador para abrir o modal de **Histórico + Troca de escala** (com alerta automático de sobreposição de turno).
3. **Ordens de serviço (`/admin/service-orders`)**:
   - Clique em **Nova ordem** (abre modal) → selecione cliente, contrato, técnico e data/hora.
   - Use **Iniciar** e **Concluir** diretamente na linha da tabela ou no modal de detalhes.
4. **Controle de EPIs (`/admin/epis`)**:
   - Clique em **Registrar entrega** (abre modal) → escolha se o termo fica pendente ou já assinado.
   - Use **Registrar assinatura** / **Ver evidência** para auditar o protocolo do termo.
5. **Almoxarifado e ativos (`/admin/inventory-items`)**:
   - Cadastre SKUs em **Novo item** (Material ou Ferramenta).
   - Clique em **Movimentar** na linha do item → visualize a prévia do saldo antes de confirmar e acompanhe o histórico auditável (`antes → alteração → final`).
6. **Gestão financeira (`/admin/finance`)**:
   - Filtre a competência no topo para inspecionar receitas, despesas e saldo do período.
   - Registre em **Novo lançamento** (campo valor inicia em branco) e use **Conciliar / Reabrir** na tabela.
7. **Roles e permissões (`/admin/permissions`)**:
   - Use **Convidar usuário** para conceder subpermissões e **Nova função** / **Editar permissões** para customizar a matriz granular por módulo.

---

## 5. Padrão de Tipos de Dados e Máscaras nos Formulários

Todos os formulários aplicam formatação em tempo real e validação dupla (navegador + API Go):

| Tipo de Campo | Máscara / Formato | Onde é aplicado |
|---|---|---|
| **CNPJ** | `00.000.000/0000-00` (14 dígitos + validação oficial módulo-11) | Nova/Editar Empresa, Novo Cliente, Recuperação de Autenticação |
| **Telefone de contato** | `(00) 0000-0000` (fixo) ou `(00) 00000-0000` (celular), DDD válido | Novo Cliente (obrigatório) |
| **E-mail** | `usuario@dominio.com` (minúsculas, sem espaços, validação RFC) | Login, Recuperação, Nova/Editar Empresa, Novo Cliente, Convidar Usuário |
| **Valor monetário (R$)** | `18.500,00` (centavos automáticos em tempo real, prefixo `R$`) | Novo Contrato, Novo Lançamento Financeiro, Novo Item de Estoque |
| **Número do CA** | `CA-00000` (prefixo automático + dígitos) | Registro de Entrega de EPI |
| **Código SKU** | `AAA-000` (maiúsculas, alfanumérico e hífen) | Novo Item de Almoxarifado |
| **Inteiros** | Apenas dígitos positivos (`inputMode="numeric"`) | Vigência em meses (`1–120`), Saldo inicial e Quantidade de estoque |
| **Código Google Authenticator** | `000000` (exatamente 6 dígitos numéricos) | Login Etapa 2, Ativação do Autenticador |

---

## 7. Assistente IA & Relatórios (`/admin/assistant`)

- **Ativação e planos por empresa (exclusivo MASTER)**:
  - Ao cadastrar ou editar uma empresa em **Gestão de empresas**, o Master pode preencher (opcionalmente) o **Token OpenRouter** (`sk-or-v1-...`), escolher entre os 3 níveis (**Free** padrão gratuito, **Padrão** pago econômico ou **Premium** pago máxima análise) e definir um limite mensal opcional de respostas.
  - No topo de **Gestão de empresas**, o botão **Planos e Modelos de IA** oferece 4 abas (**Free**, **Padrão**, **Premium** e **Consumo (Mês)**) para gerenciar a ordem dos modelos, timeout, cooldown, limite/hora e acompanhar mensagens e tokens consumidos por empresa.
  - Caso o crédito OpenRouter de uma empresa em plano pago (`Padrão` ou `Premium`) acabe (`HTTP 402`), o sistema **avisa o usuário e o Master** e **muda automaticamente o plano da empresa para Free**, concluindo o atendimento sem interrupção.
- **Liberação para funcionários (controle do Dono)**:
  - Por padrão, apenas o **Dono da empresa** (e o Master em visão cliente) tem acesso ao **Assistente IA**.
  - Em **Roles e permissões**, o Dono pode marcar ou desmarcar **Assistente IA e relatórios** (`ai_chat:use`) por função.
- **Isolamento de dados, foco em negócios e relatórios em Excel/PDF**:
  - A IA lê **apenas** os dados da empresa ativa e somente dos módulos que o usuário tem permissão para visualizar — e responde **exclusivamente** sobre negócios e operação da plataforma (perguntas fora do escopo empresarial são recusadas automaticamente).
  - A lista de **Contexto** no topo e o painel de **Histórico** lateral são **retráteis**, mantendo a tela limpa para leitura de relatórios.
  - Em cada resposta (ou ao solicitar *"gerar em Excel"* / *"gerar em PDF"* no chat), utilize **Excel (.xlsx)** (planilha formatada com valores numéricos em R$ e aba de dados filtrável), **Baixar PDF** (documento A4 com cabeçalho oficial da empresa e paginação), **Copiar** ou **Imprimir**.

---

## 8. Ambiente Dedicado Parceiros (3 Níveis: MASTER · Parceiros · Clientes)

- **Aba exclusiva do Admin Master (`/admin/partners`)**:
  - Cadastre uma nova empresa parceira (**Novo parceiro**) ou promova uma empresa já existente (**Promover empresa**) para liberar o ambiente dedicado **Parceiros**.
  - Controle por parceiro a **cota máxima de empresas** (`0` = ilimitada) e a matriz evolutiva de **recursos liberados** (`Cadastrar empresas`, `Editar`, `Ativar/Desativar`, `Ver sistema`, `Token OpenRouter` e futuros módulos). Os planos de IA (`Free`, `Padrão`, `Premium`) permanecem exclusivos do Admin Master.
  - Ao **Remover promoção**, o acesso ao ambiente **Parceiros** é revogado imediatamente sem apagar as empresas clientes já cadastradas.
- **Ambiente Parceiros (`/partner/companies`)**:
  - Totalmente isolado do **MASTER** (`context_mode = 'partner'`).
  - O Dono Parceiro alterna pelo seletor no topo entre **Parceiros**, a sua própria empresa e as empresas clientes que ele mesmo cadastrou.
  - Pode cadastrar novas empresas com **Token OpenRouter** opcional, editar, ativar/desativar e entrar em **Ver sistema** exclusivamente na própria carteira.



