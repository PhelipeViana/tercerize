# SDD — Sincronização Automática de Conhecimento para IA

## 1. Objetivo

Garantir que o conhecimento recuperável pelo Assistente IA reflita as alterações operacionais da empresa sem depender de reindexação manual. A fonte de verdade continua sendo o PostgreSQL transacional; o índice vetorial é uma projeção derivada, versionada e isolada por empresa.

## 2. Princípios

- Uma alteração de dados não gera uma nova intenção. A intenção é inferida somente quando o usuário envia uma pergunta.
- Cada alteração relevante gera um evento de sincronização confiável no mesmo commit da operação de negócio.
- A IA nunca lê diretamente o índice sem aplicar `tenant_id`, permissões da sessão e estado de sincronização.
- Enquanto um registro estiver pendente de indexação, respostas numéricas e operacionais devem consultar a fonte relacional; a IA não pode inventar dados ausentes do índice.
- Exclusões e revogações de permissão removem imediatamente o conteúdo correspondente do índice.

## 3. Gatilhos de sincronização

| Origem | Evento | Ação da IA |
|---|---|---|
| Clientes | criar, editar, excluir | Atualizar/remover o resumo do cliente e relações com contratos/OS |
| Contratos | criar, editar, status | Atualizar contrato, cliente relacionado, colaboradores e lançamentos associados |
| Colaboradores | criar, editar, alocação/escala | Atualizar colaborador, contrato, EPIs, OS e cautelas relacionados |
| Ordens de serviço | criar, editar, atribuição, status | Atualizar OS e relações com cliente, contrato, técnico e estoque |
| EPIs | entrega, assinatura, validade | Atualizar entrega, colaborador e alertas de validade |
| Estoque | item ou movimentação | Atualizar item, saldo, movimento, OS e colaborador relacionados |
| Financeiro | criar, editar, conciliar | Atualizar lançamento, contrato e resumo da competência afetada |
| RBAC | alterar permissões/funções | Invalidar cache de contexto; índice permanece, mas a recuperação deve refletir a nova permissão imediatamente |
| Empresa | desativar/excluir | Bloquear recuperação; em exclusão, apagar todos os chunks e eventos pendentes do tenant |

## 4. Fluxo obrigatório

```text
Operação de negócio
  → transação PostgreSQL
      → grava alteração na tabela de domínio
      → grava evento em ai_outbox
  → commit
  → worker de indexação consome ai_outbox
      → lê estado atual autorizado da entidade
      → gera representação textual normalizada
      → gera embedding
      → upsert em ai_knowledge_chunks
      → registra versão, hash e horário de sincronização
      → marca evento como processado
```

O evento é criado na mesma transação da operação de negócio. Caso o worker ou o provedor de embedding falhe, o dado operacional permanece válido e o evento é reprocessado com backoff. Nunca deve haver perda silenciosa de atualização.

## 5. Estruturas propostas

### 5.1 `ai_outbox`

| Campo | Finalidade |
|---|---|
| `id` | Identificador do evento |
| `tenant_id` | Barreira obrigatória de isolamento |
| `entity_type` | Tipo: contrato, OS, EPI, lançamento etc. |
| `entity_id` | Registro alterado |
| `event_type` | `upsert`, `delete` ou `rebuild` |
| `aggregate_id` | Entidade raiz para reindexar relações quando necessário |
| `version` | Versão monotônica da alteração |
| `occurred_at` | Momento da alteração confirmada |
| `attempts` / `available_at` | Retentativa controlada |
| `processed_at` / `last_error` | Auditoria e diagnóstico |

### 5.2 `ai_knowledge_chunks`

| Campo | Finalidade |
|---|---|
| `tenant_id` | Isolamento obrigatório |
| `source_type`, `source_id` | Origem do conhecimento |
| `chunk_type` | Registro, resumo mensal, relação ou orientação |
| `content` | Conteúdo factual preparado para busca |
| `metadata` | Datas, status, módulo, relações e versão; sem PII dispensável |
| `content_hash` | Evita re-embedding quando nada mudou |
| `embedding` | Vetor para busca semântica |
| `source_version`, `indexed_at` | Consistência e rastreabilidade |
| `deleted_at` | Exclusão lógica para auditoria e remoção de busca |

## 6. Comportamento do worker

1. Reserva um lote de eventos com bloqueio de linha (`FOR UPDATE SKIP LOCKED`).
2. Agrupa eventos repetidos da mesma entidade, mantendo a versão mais recente.
3. Para `delete`, remove ou desativa chunks da origem e suas projeções dependentes.
4. Para `upsert`, consulta o estado atual no banco com filtro por `tenant_id`.
5. Serializa somente campos necessários à busca, removendo telefone, e-mail, CNPJ e demais PII não essencial.
6. Compara o hash do conteúdo. Se não mudou, conclui o evento sem chamar o serviço de embedding.
7. Gera embedding, grava o chunk e confirma a versão indexada.
8. Em falha transitória, agenda retentativa exponencial; após o limite, mantém o evento para análise e gera alerta operacional.

## 7. Comportamento durante uma pergunta

1. Validar sessão, empresa ativa e RBAC.
2. Classificar a intenção da pergunta naquele momento.
3. Consultar dados numéricos, totais e status diretamente no PostgreSQL.
4. Consultar `ai_knowledge_chunks` por texto completo e vetor, sempre filtrando `tenant_id`, módulo permitido e `deleted_at IS NULL`.
5. Verificar se há eventos pendentes para entidades recuperadas.
6. Se houver pendência, buscar a versão atual da entidade no banco antes de responder.
7. Fornecer ao modelo somente contexto factual, datado e com identificadores internos de origem.
8. Caso não haja evidência suficiente, informar que o registro não foi localizado ou ainda está sendo atualizado; nunca deduzir dados.

## 8. Regras de consistência

- Consultas de valor, quantidade, prazo e status sempre priorizam SQL relacional.
- Busca vetorial complementa contexto textual; ela não é fonte de verdade para cálculos.
- Uma entidade só pode ser recuperada se `chunk.source_version` for igual à versão atual, ou se a versão relacional atual tiver sido consultada como fallback.
- Atraso de indexação não pode bloquear o cadastro/edição operacional.
- Alterações de RBAC não exigem re-embedding, mas devem invalidar imediatamente cache de sessão e contexto recuperado.

## 9. Observabilidade e alertas

Monitorar:

- tamanho e idade do backlog de `ai_outbox`;
- taxa de eventos processados, falhos e reprocessados;
- tempo entre alteração e indexação concluída;
- chunks desatualizados ou sem embedding;
- custo e latência de embeddings;
- consultas que usaram fallback relacional por índice pendente;
- violações de isolamento por tenant, que devem gerar alerta crítico.

Alertar quando existir evento pendente por mais de 10 minutos, falha recorrente da mesma origem ou diferença de versão entre a tabela de domínio e o chunk indexado.

## 10. Critérios de aceite

- Uma alteração de contrato, OS, EPI, estoque ou financeiro cria evento no mesmo commit da alteração.
- O worker atualiza ou remove o chunk correspondente de forma idempotente.
- Reprocessar o mesmo evento não cria duplicatas.
- Um usuário jamais recupera conteúdo de outro `tenant_id`.
- Uma mudança de permissão impede imediatamente a recuperação de módulos revogados.
- Dados numéricos permanecem corretos enquanto o índice estiver atrasado.
- Exclusões deixam de aparecer na busca após o processamento do evento.
