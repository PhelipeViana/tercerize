package ai

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"tercerize/backend/internal/secretbox"
)

const (
	maxOutboxAttempts  = 5
	outboxBatchSize    = 32
	queryEmbedCacheTTL = 24 * time.Hour
)

type KnowledgeWorker struct {
	pool                 *pgxpool.Pool
	rdb                  *redis.Client
	client               *OpenRouterClient
	key                  string
	model                string
	dimensions           int
	platformEmbeddingKey string
	log                  *slog.Logger
}

type KnowledgeHit struct {
	SourceType string         `json:"sourceType"`
	SourceID   string         `json:"sourceId"`
	ChunkType  string         `json:"chunkType"`
	ModuleKey  string         `json:"moduleKey"`
	Content    string         `json:"content"`
	Metadata   map[string]any `json:"metadata,omitempty"`
	Score      float64        `json:"score"`
	Refreshed  bool           `json:"refreshed,omitempty"`
}

type KnowledgeHealthRow struct {
	TenantID         string `json:"tenantId"`
	TenantName       string `json:"tenantName"`
	IndexedChunks    int    `json:"indexedChunks"`
	EmbeddedChunks   int    `json:"embeddedChunks"`
	MonthlySummaries int    `json:"monthlySummaries"`
	PendingOutbox    int    `json:"pendingOutbox"`
	DeadLetterOutbox int    `json:"deadLetterOutbox"`
	OldestPendingMin int    `json:"oldestPendingMinutes"`
	LastIndexedAt    string `json:"lastIndexedAt"`
}

func NewKnowledgeWorker(
	pool *pgxpool.Pool,
	rdb *redis.Client,
	client *OpenRouterClient,
	encryptionKey string,
	model string,
	dimensions int,
	platformEmbeddingKey string,
	log *slog.Logger,
) *KnowledgeWorker {
	if strings.TrimSpace(model) == "" {
		model = DefaultEmbeddingModel
	}
	if dimensions <= 0 {
		dimensions = 1536
	}
	return &KnowledgeWorker{
		pool:                 pool,
		rdb:                  rdb,
		client:               client,
		key:                  encryptionKey,
		model:                model,
		dimensions:           dimensions,
		platformEmbeddingKey: strings.TrimSpace(platformEmbeddingKey),
		log:                  log,
	}
}

func (w *KnowledgeWorker) Run(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	summaryTicker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	defer summaryTicker.Stop()

	// Gera resumos mensais logo na subida para consultas comparativas instantâneas
	w.syncAllMonthlySummaries(ctx)

	for {
		w.process(ctx)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		case <-summaryTicker.C:
			w.syncAllMonthlySummaries(ctx)
		}
	}
}

type outboxEvent struct {
	ID         string
	TenantID   string
	EntityType string
	EntityID   string
	EventType  string
	Attempts   int
}

type pendingUpsert struct {
	Events   []outboxEvent
	EntityID string
	Type     string
	Module   string
	Content  string
	MetaJSON string
	Hash     string
}

func (w *KnowledgeWorker) process(ctx context.Context) {
	rows, err := w.pool.Query(ctx, `
		WITH next AS (
			SELECT id
			  FROM ai_outbox
			 WHERE processed_at IS NULL
			   AND dead_lettered_at IS NULL
			   AND available_at <= now()
			 ORDER BY occurred_at ASC
			 FOR UPDATE SKIP LOCKED
			 LIMIT $1
		)
		UPDATE ai_outbox o
		   SET attempts = o.attempts + 1,
		       available_at = now() + interval '2 minutes'
		  FROM next
		 WHERE o.id = next.id
		RETURNING o.id, o.tenant_id, o.entity_type, o.entity_id, o.event_type, o.attempts`,
		outboxBatchSize)
	if err != nil {
		return
	}
	events := make([]outboxEvent, 0, outboxBatchSize)
	for rows.Next() {
		var ev outboxEvent
		if err := rows.Scan(&ev.ID, &ev.TenantID, &ev.EntityType, &ev.EntityID, &ev.EventType, &ev.Attempts); err == nil {
			events = append(events, ev)
		}
	}
	rows.Close()
	if len(events) == 0 {
		return
	}

	// Agrupa e deduplica eventos por (tenant_id, entity_type, entity_id), mantendo a última ação
	type entityKey struct{ tenantID, entityType, entityID string }
	grouped := make(map[entityKey][]outboxEvent)
	order := make([]entityKey, 0, len(events))
	for _, ev := range events {
		k := entityKey{ev.TenantID, ev.EntityType, ev.EntityID}
		if _, ok := grouped[k]; !ok {
			order = append(order, k)
		}
		grouped[k] = append(grouped[k], ev)
	}

	// Separa deletes e upserts por tenant para chamar EmbedBatch com eficiência
	upsertsByTenant := make(map[string][]*pendingUpsert)
	touchedTenants := make(map[string]bool)

	for _, k := range order {
		evs := grouped[k]
		latest := evs[len(evs)-1]
		touchedTenants[k.tenantID] = true

		if latest.EventType == "delete" {
			if _, err := w.pool.Exec(ctx,
				`UPDATE ai_knowledge_chunks
				    SET deleted_at = now()
				  WHERE tenant_id = $1 AND source_type = $2 AND source_id = $3`,
				k.tenantID, k.entityType, k.entityID); err != nil {
				w.markBatchRetry(ctx, evs, err)
				continue
			}
			w.markBatchDone(ctx, evs)
			continue
		}

		content, module, metaJSON, err := w.source(ctx, k.tenantID, k.entityType, k.entityID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				// Registro não existe mais: marca soft-delete no chunk e conclui o evento
				_, _ = w.pool.Exec(ctx,
					`UPDATE ai_knowledge_chunks
					    SET deleted_at = now()
					  WHERE tenant_id = $1 AND source_type = $2 AND source_id = $3`,
					k.tenantID, k.entityType, k.entityID)
				w.markBatchDone(ctx, evs)
				continue
			}
			w.markBatchRetry(ctx, evs, err)
			continue
		}

		hashBytes := sha256.Sum256([]byte(content))
		contentHash := hex.EncodeToString(hashBytes[:])

		// SDD 6.6: verifica content_hash ANTES de chamar a API de embedding (zera chamadas desperdiçadas)
		var existingHash string
		var hasEmbedding bool
		var deletedAt *time.Time
		checkErr := w.pool.QueryRow(ctx,
			`SELECT content_hash, (embedding IS NOT NULL), deleted_at
			   FROM ai_knowledge_chunks
			  WHERE tenant_id = $1 AND source_type = $2 AND source_id = $3 AND chunk_type = 'entity'`,
			k.tenantID, k.entityType, k.entityID).Scan(&existingHash, &hasEmbedding, &deletedAt)
		if checkErr == nil && existingHash == contentHash && hasEmbedding && deletedAt == nil {
			w.markBatchDone(ctx, evs)
			continue
		}

		upsertsByTenant[k.tenantID] = append(upsertsByTenant[k.tenantID], &pendingUpsert{
			Events:   evs,
			EntityID: k.entityID,
			Type:     k.entityType,
			Module:   module,
			Content:  content,
			MetaJSON: metaJSON,
			Hash:     contentHash,
		})
	}

	for tenantID, items := range upsertsByTenant {
		w.processTenantUpserts(ctx, tenantID, items)
	}
	for tenantID := range touchedTenants {
		w.invalidateTenantKPICache(ctx, tenantID)
	}
}

func (w *KnowledgeWorker) processTenantUpserts(ctx context.Context, tenantID string, items []*pendingUpsert) {
	if len(items) == 0 {
		return
	}

	// Sempre grava o texto + metadata para que FTS Português e pg_trgm funcionem imediatamente
	// mesmo que a empresa não tenha saldo/token OpenRouter para o vetor!
	token, tokErr := w.resolveEmbeddingToken(ctx, tenantID)
	if tokErr != nil || token == "" {
		for _, item := range items {
			_ = w.upsertChunk(ctx, tenantID, item, nil)
			w.markBatchDeadLetter(ctx, item.Events, "sem token OpenRouter para embedding (FTS/trigram ativo)")
		}
		return
	}

	inputs := make([]string, len(items))
	for i, item := range items {
		inputs[i] = item.Content
	}

	batchRes, err := w.client.EmbedBatch(ctx, token, w.model, inputs, w.dimensions, "search_document")
	if err != nil {
		// Se 401/402, grava texto (FTS/trigram continua 100% funcional!) e marca dead-letter sem loop infinito
		if errors.Is(err, ErrInsufficientCredits) || errors.Is(err, ErrInvalidOpenRouterToken) {
			w.log.Warn("embedding pausado por credencial/crédito OpenRouter — mantendo busca lexical FTS/pg_trgm ativa",
				"tenant", tenantID, "err", err)
			for _, item := range items {
				_ = w.upsertChunk(ctx, tenantID, item, nil)
				w.markBatchDeadLetter(ctx, item.Events, err.Error())
			}
			return
		}
		w.log.Warn("falha transitória em EmbedBatch", "tenant", tenantID, "count", len(items), "err", err)
		for _, item := range items {
			_ = w.upsertChunk(ctx, tenantID, item, nil)
			w.markBatchRetry(ctx, item.Events, err)
		}
		return
	}

	for i, item := range items {
		if err := w.upsertChunk(ctx, tenantID, item, batchRes.Vectors[i]); err != nil {
			w.markBatchRetry(ctx, item.Events, err)
			continue
		}
		w.markBatchDone(ctx, item.Events)
	}
}

func (w *KnowledgeWorker) upsertChunk(ctx context.Context, tenantID string, item *pendingUpsert, vec []float32) error {
	if len(vec) > 0 {
		_, err := w.pool.Exec(ctx, `
			INSERT INTO ai_knowledge_chunks (
				tenant_id, source_type, source_id, chunk_type, module_key,
				content, metadata, content_hash, embedding, indexed_at, deleted_at
			)
			VALUES ($1, $2, $3, 'entity', $4, $5, $6::jsonb, $7, $8::vector, now(), NULL)
			ON CONFLICT (tenant_id, source_type, source_id, chunk_type) DO UPDATE
			   SET module_key = EXCLUDED.module_key,
			       content = EXCLUDED.content,
			       metadata = EXCLUDED.metadata,
			       content_hash = EXCLUDED.content_hash,
			       embedding = EXCLUDED.embedding,
			       indexed_at = now(),
			       deleted_at = NULL`,
			tenantID, item.Type, item.EntityID, item.Module,
			item.Content, item.MetaJSON, item.Hash, formatVectorLiteral(vec))
		return err
	}
	_, err := w.pool.Exec(ctx, `
		INSERT INTO ai_knowledge_chunks (
			tenant_id, source_type, source_id, chunk_type, module_key,
			content, metadata, content_hash, indexed_at, deleted_at
		)
		VALUES ($1, $2, $3, 'entity', $4, $5, $6::jsonb, $7, now(), NULL)
		ON CONFLICT (tenant_id, source_type, source_id, chunk_type) DO UPDATE
		   SET module_key = EXCLUDED.module_key,
		       content = EXCLUDED.content,
		       metadata = EXCLUDED.metadata,
		       content_hash = EXCLUDED.content_hash,
		       indexed_at = now(),
		       deleted_at = NULL`,
		tenantID, item.Type, item.EntityID, item.Module,
		item.Content, item.MetaJSON, item.Hash)
	return err
}

func (w *KnowledgeWorker) resolveEmbeddingToken(ctx context.Context, tenantID string) (string, error) {
	if w.platformEmbeddingKey != "" {
		return w.platformEmbeddingKey, nil
	}
	var encrypted string
	if err := w.pool.QueryRow(ctx, `SELECT COALESCE(openrouter_token_enc, '') FROM tenants WHERE id = $1`, tenantID).Scan(&encrypted); err != nil {
		return "", err
	}
	if strings.TrimSpace(encrypted) == "" {
		return "", errors.New("empresa sem token OpenRouter")
	}
	return secretbox.Decrypt(encrypted, w.key)
}

func (w *KnowledgeWorker) markBatchDone(ctx context.Context, events []outboxEvent) {
	ids := make([]string, len(events))
	for i, ev := range events {
		ids[i] = ev.ID
	}
	_, _ = w.pool.Exec(ctx, `UPDATE ai_outbox SET processed_at = now(), dead_lettered_at = NULL, last_error = '' WHERE id = ANY($1::uuid[])`, ids)
}

func (w *KnowledgeWorker) markBatchDeadLetter(ctx context.Context, events []outboxEvent, reason string) {
	ids := make([]string, len(events))
	for i, ev := range events {
		ids[i] = ev.ID
	}
	_, _ = w.pool.Exec(ctx,
		`UPDATE ai_outbox SET dead_lettered_at = now(), last_error = $1 WHERE id = ANY($2::uuid[])`,
		truncateErr(reason, 500), ids)
}

func (w *KnowledgeWorker) markBatchRetry(ctx context.Context, events []outboxEvent, err error) {
	msg := truncateErr(err.Error(), 500)
	for _, ev := range events {
		if ev.Attempts >= maxOutboxAttempts {
			_, _ = w.pool.Exec(ctx,
				`UPDATE ai_outbox SET dead_lettered_at = now(), last_error = $1 WHERE id = $2`,
				msg, ev.ID)
			continue
		}
		_, _ = w.pool.Exec(ctx,
			`UPDATE ai_outbox
			    SET last_error = $1,
			        available_at = now() + make_interval(secs => LEAST(3600, 30 * attempts * attempts))
			  WHERE id = $2`,
			msg, ev.ID)
	}
}

// HybridSearch executa busca híbrida RRF (FTS Português + pg_trgm + pgvector HNSW) em uma única consulta
// filtrada obrigatoriamente por tenant_id e módulos liberados pelo RBAC, com Freshness Check na ai_outbox.
func (w *KnowledgeWorker) HybridSearch(
	ctx context.Context,
	tenantID string,
	apiToken string,
	query string,
	modules []string,
	limit int,
) ([]KnowledgeHit, error) {
	cleanQuery := strings.TrimSpace(query)
	if len(modules) == 0 || cleanQuery == "" {
		return nil, nil
	}
	if limit <= 0 || limit > 25 {
		limit = 10
	}

	// Tenta obter embedding da query (com cache Redis 24h). Em falha (ex.: 402), degrada graciosamente para FTS + Trigram!
	var vecLiteral string
	embedToken := apiToken
	if w.platformEmbeddingKey != "" {
		embedToken = w.platformEmbeddingKey
	}
	if strings.TrimSpace(embedToken) != "" {
		if vec, err := w.embedQueryCached(ctx, embedToken, cleanQuery); err == nil && len(vec) == w.dimensions {
			vecLiteral = formatVectorLiteral(vec)
		}
	}

	var rows pgx.Rows
	var err error
	if vecLiteral != "" {
		rows, err = w.pool.Query(ctx, `
			WITH fts AS (
				SELECT id,
				       row_number() OVER (ORDER BY ts_rank_cd(to_tsvector('portuguese', content), websearch_to_tsquery('portuguese', $3)) DESC) AS r
				  FROM ai_knowledge_chunks
				 WHERE tenant_id = $1
				   AND module_key = ANY($2)
				   AND deleted_at IS NULL
				   AND to_tsvector('portuguese', content) @@ websearch_to_tsquery('portuguese', $3)
				 LIMIT 25
			),
			trgm AS (
				SELECT id,
				       row_number() OVER (ORDER BY similarity(content, $3) DESC) AS r
				  FROM ai_knowledge_chunks
				 WHERE tenant_id = $1
				   AND module_key = ANY($2)
				   AND deleted_at IS NULL
				   AND (similarity(content, $3) >= 0.14 OR content ILIKE '%' || $3 || '%')
				 LIMIT 25
			),
			vec AS (
				SELECT id,
				       row_number() OVER (ORDER BY embedding <=> $4::vector ASC) AS r
				  FROM ai_knowledge_chunks
				 WHERE tenant_id = $1
				   AND module_key = ANY($2)
				   AND deleted_at IS NULL
				   AND embedding IS NOT NULL
				   AND (1 - (embedding <=> $4::vector)) >= 0.22
				 ORDER BY embedding <=> $4::vector ASC
				 LIMIT 25
			),
			rrf AS (
				SELECT COALESCE(fts.id, trgm.id, vec.id) AS id,
				       (COALESCE(1.2 / (60.0 + fts.r), 0)
				      + COALESCE(1.0 / (60.0 + trgm.r), 0)
				      + COALESCE(1.0 / (60.0 + vec.r), 0))::float8 AS score
				  FROM fts
				  FULL OUTER JOIN trgm ON trgm.id = fts.id
				  FULL OUTER JOIN vec ON vec.id = COALESCE(fts.id, trgm.id)
			)
			SELECT c.source_type, c.source_id::text, c.chunk_type, c.module_key, c.content, c.metadata, rrf.score
			  FROM rrf
			  JOIN ai_knowledge_chunks c ON c.id = rrf.id
			 ORDER BY rrf.score DESC, c.source_type ASC, c.source_id ASC
			 LIMIT $5`,
			tenantID, modules, cleanQuery, vecLiteral, limit)
	} else {
		rows, err = w.pool.Query(ctx, `
			WITH fts AS (
				SELECT id,
				       row_number() OVER (ORDER BY ts_rank_cd(to_tsvector('portuguese', content), websearch_to_tsquery('portuguese', $3)) DESC) AS r
				  FROM ai_knowledge_chunks
				 WHERE tenant_id = $1
				   AND module_key = ANY($2)
				   AND deleted_at IS NULL
				   AND to_tsvector('portuguese', content) @@ websearch_to_tsquery('portuguese', $3)
				 LIMIT 25
			),
			trgm AS (
				SELECT id,
				       row_number() OVER (ORDER BY similarity(content, $3) DESC) AS r
				  FROM ai_knowledge_chunks
				 WHERE tenant_id = $1
				   AND module_key = ANY($2)
				   AND deleted_at IS NULL
				   AND (similarity(content, $3) >= 0.14 OR content ILIKE '%' || $3 || '%')
				 LIMIT 25
			),
			rrf AS (
				SELECT COALESCE(fts.id, trgm.id) AS id,
				       (COALESCE(1.2 / (60.0 + fts.r), 0)
				      + COALESCE(1.0 / (60.0 + trgm.r), 0))::float8 AS score
				  FROM fts
				  FULL OUTER JOIN trgm ON trgm.id = fts.id
			)
			SELECT c.source_type, c.source_id::text, c.chunk_type, c.module_key, c.content, c.metadata, rrf.score
			  FROM rrf
			  JOIN ai_knowledge_chunks c ON c.id = rrf.id
			 ORDER BY rrf.score DESC, c.source_type ASC, c.source_id ASC
			 LIMIT $4`,
			tenantID, modules, cleanQuery, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	hits := make([]KnowledgeHit, 0, limit)
	sourceIDs := make([]string, 0, limit)
	for rows.Next() {
		var h KnowledgeHit
		var rawMeta []byte
		if err := rows.Scan(&h.SourceType, &h.SourceID, &h.ChunkType, &h.ModuleKey, &h.Content, &rawMeta, &h.Score); err != nil {
			return nil, err
		}
		if len(rawMeta) > 0 {
			_ = json.Unmarshal(rawMeta, &h.Metadata)
		}
		hits = append(hits, h)
		if h.ChunkType == "entity" {
			sourceIDs = append(sourceIDs, h.SourceID)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// SDD 7.5 — Freshness Check: se existir evento pendente na ai_outbox para algum registro recuperado,
	// recarrega o conteúdo atualizado diretamente da tabela relacional antes de entregar ao LLM!
	if len(sourceIDs) > 0 {
		pendingMap := make(map[string]bool)
		pRows, pErr := w.pool.Query(ctx,
			`SELECT DISTINCT entity_id::text
			   FROM ai_outbox
			  WHERE tenant_id = $1
			    AND entity_id = ANY($2::uuid[])
			    AND processed_at IS NULL
			    AND dead_lettered_at IS NULL`,
			tenantID, sourceIDs)
		if pErr == nil {
			for pRows.Next() {
				var sid string
				if pRows.Scan(&sid) == nil {
					pendingMap[sid] = true
				}
			}
			pRows.Close()
		}
		for i := range hits {
			if hits[i].ChunkType == "entity" && pendingMap[hits[i].SourceID] {
				if fresh, _, freshMeta, fErr := w.source(ctx, tenantID, hits[i].SourceType, hits[i].SourceID); fErr == nil {
					hits[i].Content = fresh
					hits[i].Refreshed = true
					_ = json.Unmarshal([]byte(freshMeta), &hits[i].Metadata)
				}
			}
		}
	}

	return hits, nil
}

// Search mantém compatibilidade com chamadas legadas apontando para HybridSearch.
func (w *KnowledgeWorker) Search(ctx context.Context, tenantID, token, query string, modules []string) ([]KnowledgeHit, error) {
	return w.HybridSearch(ctx, tenantID, token, query, modules, 8)
}

func (w *KnowledgeWorker) embedQueryCached(ctx context.Context, token, query string) ([]float32, error) {
	normQ := strings.ToLower(strings.TrimSpace(query))
	sum := sha256.Sum256([]byte(w.model + ":" + normQ))
	cacheKey := "ai:qembed:" + hex.EncodeToString(sum[:16])

	if w.rdb != nil {
		if raw, err := w.rdb.Get(ctx, cacheKey).Bytes(); err == nil && len(raw) > 0 {
			var cached []float32
			if json.Unmarshal(raw, &cached) == nil && len(cached) == w.dimensions {
				return cached, nil
			}
		}
	}

	res, err := w.client.EmbedWithType(ctx, token, w.model, normQ, w.dimensions, "search_query")
	if err != nil {
		return nil, err
	}
	if w.rdb != nil {
		if encoded, mErr := json.Marshal(res.Vector); mErr == nil {
			_ = w.rdb.Set(ctx, cacheKey, encoded, queryEmbedCacheTTL).Err()
		}
	}
	return res.Vector, nil
}

// SyncMonthlySummaries gera/atualiza chunks derivados por competência (YYYY-MM) de Financeiro e OS
// para acelerar consultas comparativas entre meses.
func (w *KnowledgeWorker) SyncMonthlySummaries(ctx context.Context, tenantID string) error {
	// 1. Resumo mensal financeiro por competência
	finRows, err := w.pool.Query(ctx, `
		SELECT to_char(date_trunc('month', due_date), 'YYYY-MM') AS ym,
		       count(*)::int AS total_entries,
		       COALESCE(sum(amount) FILTER (WHERE entry_type = 'Receita'), 0)::float8 AS revenues,
		       COALESCE(sum(amount) FILTER (WHERE entry_type = 'Despesa'), 0)::float8 AS expenses,
		       COALESCE(sum(amount) FILTER (WHERE reconciliation_status = 'Pendente'), 0)::float8 AS pending_total,
		       count(*) FILTER (WHERE reconciliation_status = 'Pendente')::int AS pending_count
		  FROM financial_entries
		 WHERE tenant_id = $1
		 GROUP BY 1
		 ORDER BY 1 DESC
		 LIMIT 18`, tenantID)
	if err == nil {
		type finMonth struct {
			ym           string
			entries      int
			revenues     float64
			expenses     float64
			pendingTotal float64
			pendingCount int
		}
		list := []finMonth{}
		for finRows.Next() {
			var fm finMonth
			if finRows.Scan(&fm.ym, &fm.entries, &fm.revenues, &fm.expenses, &fm.pendingTotal, &fm.pendingCount) == nil {
				list = append(list, fm)
			}
		}
		finRows.Close()

		for _, fm := range list {
			balance := fm.revenues - fm.expenses
			content := fmt.Sprintf(
				"Resumo financeiro mensal %s: %d lançamentos; receitas: R$ %.2f; despesas: R$ %.2f; saldo: R$ %.2f; pendentes: %d (R$ %.2f)",
				fm.ym, fm.entries, fm.revenues, fm.expenses, balance, fm.pendingCount, fm.pendingTotal,
			)
			meta, _ := json.Marshal(map[string]any{
				"month": fm.ym, "revenues": fm.revenues, "expenses": fm.expenses,
				"balance": balance, "pendingCount": fm.pendingCount,
			})
			w.upsertMonthlySummaryChunk(ctx, tenantID, "financial_monthly", fm.ym, "finance", content, string(meta))
		}
	}

	// 2. Resumo mensal de Ordens de Serviço
	osRows, err := w.pool.Query(ctx, `
		SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS ym,
		       count(*)::int AS total_os,
		       count(*) FILTER (WHERE status = 'Agendada')::int AS scheduled,
		       count(*) FILTER (WHERE status = 'Em Execução')::int AS in_progress,
		       count(*) FILTER (WHERE status = 'Concluída')::int AS completed,
		       count(*) FILTER (WHERE priority = 'Urgente')::int AS urgent
		  FROM service_orders
		 WHERE tenant_id = $1
		 GROUP BY 1
		 ORDER BY 1 DESC
		 LIMIT 18`, tenantID)
	if err == nil {
		type osMonth struct {
			ym         string
			total      int
			scheduled  int
			inProgress int
			completed  int
			urgent     int
		}
		list := []osMonth{}
		for osRows.Next() {
			var om osMonth
			if osRows.Scan(&om.ym, &om.total, &om.scheduled, &om.inProgress, &om.completed, &om.urgent) == nil {
				list = append(list, om)
			}
		}
		osRows.Close()

		for _, om := range list {
			content := fmt.Sprintf(
				"Resumo mensal de Ordens de Serviço %s: total %d OS; agendadas: %d; em execução: %d; concluídas: %d; urgentes: %d",
				om.ym, om.total, om.scheduled, om.inProgress, om.completed, om.urgent,
			)
			meta, _ := json.Marshal(map[string]any{
				"month": om.ym, "total": om.total, "completed": om.completed, "urgent": om.urgent,
			})
			w.upsertMonthlySummaryChunk(ctx, tenantID, "service_orders_monthly", om.ym, "service_orders", content, string(meta))
		}
	}
	return nil
}

func (w *KnowledgeWorker) upsertMonthlySummaryChunk(ctx context.Context, tenantID, sourceType, ym, moduleKey, content, metaJSON string) {
	sum := sha256.Sum256([]byte(content))
	contentHash := hex.EncodeToString(sum[:])
	// Gera UUID determinístico em Go (evita conflito de inferência de tipo $1::uuid vs $1::text no pgx)
	idSum := sha256.Sum256([]byte(tenantID + ":" + sourceType + ":" + ym))
	idHex := hex.EncodeToString(idSum[:16])
	detUUID := fmt.Sprintf("%s-%s-%s-%s-%s", idHex[0:8], idHex[8:12], idHex[12:16], idHex[16:20], idHex[20:32])

	if _, err := w.pool.Exec(ctx, `
		INSERT INTO ai_knowledge_chunks (
			tenant_id, source_type, source_id, chunk_type, module_key,
			content, metadata, content_hash, indexed_at, deleted_at
		)
		VALUES ($1, $2, $3, 'monthly_summary', $4, $5, $6::jsonb, $7, now(), NULL)
		ON CONFLICT (tenant_id, source_type, source_id, chunk_type) DO UPDATE
		   SET content = EXCLUDED.content,
		       metadata = EXCLUDED.metadata,
		       content_hash = EXCLUDED.content_hash,
		       indexed_at = now(),
		       deleted_at = NULL
		 WHERE ai_knowledge_chunks.content_hash IS DISTINCT FROM EXCLUDED.content_hash
		    OR ai_knowledge_chunks.deleted_at IS NOT NULL`,
		tenantID, sourceType, detUUID, moduleKey, content, metaJSON, contentHash); err != nil {
		w.log.Warn("falha ao gravar resumo mensal", "tenant", tenantID, "source", sourceType, "ym", ym, "err", err)
	}
}

func (w *KnowledgeWorker) syncAllMonthlySummaries(ctx context.Context) {
	rows, err := w.pool.Query(ctx, `SELECT id::text FROM tenants WHERE active = true`)
	if err != nil {
		return
	}
	ids := []string{}
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	rows.Close()
	for _, id := range ids {
		_ = w.SyncMonthlySummaries(ctx, id)
	}
}

// ReindexTenant limpa dead-letters da empresa, enfileira todos os registros operacionais na ai_outbox
// e atualiza os resumos mensais.
func (w *KnowledgeWorker) ReindexTenant(ctx context.Context, tenantID string) (int64, error) {
	_, _ = w.pool.Exec(ctx,
		`DELETE FROM ai_outbox WHERE tenant_id = $1 AND (processed_at IS NULL OR dead_lettered_at IS NOT NULL)`,
		tenantID)

	tag, err := w.pool.Exec(ctx, `
		INSERT INTO ai_outbox (tenant_id, entity_type, entity_id, event_type)
		SELECT tenant_id, 'clients', id, 'upsert' FROM clients WHERE tenant_id = $1
		UNION ALL SELECT tenant_id, 'contracts', id, 'upsert' FROM contracts WHERE tenant_id = $1
		UNION ALL SELECT tenant_id, 'employees', id, 'upsert' FROM employees WHERE tenant_id = $1
		UNION ALL SELECT tenant_id, 'epi_deliveries', id, 'upsert' FROM epi_deliveries WHERE tenant_id = $1
		UNION ALL SELECT tenant_id, 'inventory_items', id, 'upsert' FROM inventory_items WHERE tenant_id = $1
		UNION ALL SELECT tenant_id, 'inventory_movements', id, 'upsert' FROM inventory_movements WHERE tenant_id = $1
		UNION ALL SELECT tenant_id, 'service_orders', id, 'upsert' FROM service_orders WHERE tenant_id = $1
		UNION ALL SELECT tenant_id, 'financial_entries', id, 'upsert' FROM financial_entries WHERE tenant_id = $1`,
		tenantID)
	if err != nil {
		return 0, err
	}
	_ = w.SyncMonthlySummaries(ctx, tenantID)
	w.invalidateTenantKPICache(ctx, tenantID)
	return tag.RowsAffected(), nil
}

// GetKnowledgeHealth retorna a saúde da indexação por empresa para observabilidade Master.
func (w *KnowledgeWorker) GetKnowledgeHealth(ctx context.Context) ([]KnowledgeHealthRow, error) {
	rows, err := w.pool.Query(ctx, `
		SELECT t.id::text,
		       t.name,
		       COALESCE(c.indexed_chunks, 0)::int,
		       COALESCE(c.embedded_chunks, 0)::int,
		       COALESCE(c.monthly_summaries, 0)::int,
		       COALESCE(o.pending_outbox, 0)::int,
		       COALESCE(o.dead_letter_outbox, 0)::int,
		       COALESCE(o.oldest_pending_min, 0)::int,
		       COALESCE(to_char(c.last_indexed_at AT TIME ZONE 'America/Cuiaba', 'DD/MM/YYYY HH24:MI'), '—')
		  FROM tenants t
		  LEFT JOIN (
		    SELECT tenant_id,
		           count(*) FILTER (WHERE chunk_type = 'entity' AND deleted_at IS NULL) AS indexed_chunks,
		           count(*) FILTER (WHERE chunk_type = 'entity' AND deleted_at IS NULL AND embedding IS NOT NULL) AS embedded_chunks,
		           count(*) FILTER (WHERE chunk_type = 'monthly_summary' AND deleted_at IS NULL) AS monthly_summaries,
		           max(indexed_at) FILTER (WHERE deleted_at IS NULL) AS last_indexed_at
		      FROM ai_knowledge_chunks
		     GROUP BY tenant_id
		  ) c ON c.tenant_id = t.id
		  LEFT JOIN (
		    SELECT tenant_id,
		           count(*) FILTER (WHERE processed_at IS NULL AND dead_lettered_at IS NULL) AS pending_outbox,
		           count(*) FILTER (WHERE dead_lettered_at IS NOT NULL AND processed_at IS NULL) AS dead_letter_outbox,
		           COALESCE(EXTRACT(EPOCH FROM (now() - min(occurred_at) FILTER (WHERE processed_at IS NULL AND dead_lettered_at IS NULL))) / 60, 0)::int AS oldest_pending_min
		      FROM ai_outbox
		     GROUP BY tenant_id
		  ) o ON o.tenant_id = t.id
		 ORDER BY t.name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []KnowledgeHealthRow{}
	for rows.Next() {
		var r KnowledgeHealthRow
		if err := rows.Scan(
			&r.TenantID, &r.TenantName, &r.IndexedChunks, &r.EmbeddedChunks,
			&r.MonthlySummaries, &r.PendingOutbox, &r.DeadLetterOutbox,
			&r.OldestPendingMin, &r.LastIndexedAt,
		); err == nil {
			out = append(out, r)
		}
	}
	return out, rows.Err()
}

func (w *KnowledgeWorker) invalidateTenantKPICache(ctx context.Context, tenantID string) {
	if w.rdb == nil || tenantID == "" {
		return
	}
	// Invalida por versão monotônica para evitar SCAN pesado no Redis
	_ = w.rdb.Incr(ctx, "ai:kpi:ver:"+tenantID).Err()
}

func (w *KnowledgeWorker) source(ctx context.Context, tenantID, typ, id string) (string, string, string, error) {
	queries := map[string]struct{ module, sql string }{
		"clients": {
			"contracts",
			`SELECT 'Cliente: ' || COALESCE(name, ''),
			        jsonb_build_object('name', COALESCE(name, ''))::text
			   FROM clients
			  WHERE tenant_id = $1 AND id = $2`,
		},
		"contracts": {
			"contracts",
			`SELECT 'Contrato ' || COALESCE(c.code, '') || '; cliente: ' || COALESCE(cl.name, 'Não informado')
			        || '; objeto: ' || COALESCE(c.object, '') || '; posto: ' || COALESCE(c.workstation, '')
			        || '; situação: ' || COALESCE(c.status, '') || '; valor mensal: R$ ' || COALESCE(c.monthly_value::text, '0'),
			        jsonb_build_object('code', COALESCE(c.code, ''), 'client', COALESCE(cl.name, ''), 'status', COALESCE(c.status, ''), 'monthlyValue', COALESCE(c.monthly_value, 0))::text
			   FROM contracts c
			   LEFT JOIN clients cl ON cl.id = c.client_id AND cl.tenant_id = c.tenant_id
			  WHERE c.tenant_id = $1 AND c.id = $2`,
		},
		"employees": {
			"employees",
			`SELECT 'Colaborador: ' || COALESCE(e.name, '') || '; função: ' || COALESCE(e.role_title, '')
			        || '; escala: ' || COALESCE(e.schedule, '') || '; situação: ' || COALESCE(e.status, '')
			        || CASE WHEN c.code IS NOT NULL THEN '; contrato: ' || c.code ELSE '' END,
			        jsonb_build_object('name', COALESCE(e.name, ''), 'role', COALESCE(e.role_title, ''), 'status', COALESCE(e.status, ''), 'contractCode', COALESCE(c.code, ''))::text
			   FROM employees e
			   LEFT JOIN contracts c ON c.id = e.contract_id AND c.tenant_id = e.tenant_id
			  WHERE e.tenant_id = $1 AND e.id = $2`,
		},
		"epi_deliveries": {
			"epis",
			`SELECT 'EPI: ' || COALESCE(d.epi_name, '') || '; CA: ' || COALESCE(d.ca_number, '')
			        || '; colaborador: ' || COALESCE(e.name, 'Não informado')
			        || '; validade: ' || COALESCE(to_char(d.expires_at, 'DD/MM/YYYY'), '')
			        || '; assinado: ' || CASE WHEN COALESCE(d.receipt_signed, false) THEN 'Sim' ELSE 'Não' END,
			        jsonb_build_object('code', COALESCE(d.ca_number, ''), 'epi', COALESCE(d.epi_name, ''), 'employee', COALESCE(e.name, ''), 'signed', COALESCE(d.receipt_signed, false))::text
			   FROM epi_deliveries d
			   LEFT JOIN employees e ON e.id = d.employee_id AND e.tenant_id = d.tenant_id
			  WHERE d.tenant_id = $1 AND d.id = $2`,
		},
		"inventory_items": {
			"inventory",
			`SELECT 'Item de estoque: ' || COALESCE(sku, '') || '; descrição: ' || COALESCE(description, '')
			        || '; categoria: ' || COALESCE(category, '') || '; saldo: ' || COALESCE(quantity::text, '0') || ' ' || COALESCE(unit, '')
			        || '; mínimo: ' || COALESCE(min_quantity::text, '0') || '; valor unitário: R$ ' || COALESCE(unit_value::text, '0'),
			        jsonb_build_object('code', COALESCE(sku, ''), 'category', COALESCE(category, ''), 'quantity', COALESCE(quantity, 0), 'minQuantity', COALESCE(min_quantity, 0))::text
			   FROM inventory_items
			  WHERE tenant_id = $1 AND id = $2`,
		},
		"inventory_movements": {
			"inventory",
			`SELECT 'Movimentação de estoque: ' || COALESCE(i.sku, '') || ' (' || COALESCE(i.description, '') || ')'
			        || '; tipo: ' || COALESCE(m.movement_type, '') || '; quantidade: ' || COALESCE(m.quantity::text, '0')
			        || CASE WHEN e.name IS NOT NULL THEN '; colaborador: ' || e.name ELSE '' END
			        || CASE WHEN COALESCE(m.notes, '') <> '' THEN '; observação: ' || m.notes ELSE '' END,
			        jsonb_build_object('code', COALESCE(i.sku, ''), 'type', COALESCE(m.movement_type, ''), 'quantity', COALESCE(m.quantity, 0))::text
			   FROM inventory_movements m
			   LEFT JOIN inventory_items i ON i.id = m.item_id AND i.tenant_id = m.tenant_id
			   LEFT JOIN employees e ON e.id = m.employee_id AND e.tenant_id = m.tenant_id
			  WHERE m.tenant_id = $1 AND m.id = $2`,
		},
		"service_orders": {
			"service_orders",
			`SELECT 'OS ' || COALESCE(o.code, '') || '; cliente: ' || COALESCE(cl.name, 'Não informado')
			        || '; descrição: ' || COALESCE(o.description, '') || '; prioridade: ' || COALESCE(o.priority, '')
			        || '; situação: ' || COALESCE(o.status, '')
			        || CASE WHEN e.name IS NOT NULL THEN '; técnico: ' || e.name ELSE '' END,
			        jsonb_build_object('code', COALESCE(o.code, ''), 'client', COALESCE(cl.name, ''), 'priority', COALESCE(o.priority, ''), 'status', COALESCE(o.status, ''))::text
			   FROM service_orders o
			   LEFT JOIN clients cl ON cl.id = o.client_id AND cl.tenant_id = o.tenant_id
			   LEFT JOIN employees e ON e.id = o.employee_id AND e.tenant_id = o.tenant_id
			  WHERE o.tenant_id = $1 AND o.id = $2`,
		},
		"financial_entries": {
			"finance",
			`SELECT 'Lançamento ' || COALESCE(f.entry_type, '') || '; descrição: ' || COALESCE(f.description, '')
			        || '; valor: R$ ' || COALESCE(f.amount::text, '0')
			        || '; vencimento: ' || COALESCE(to_char(f.due_date, 'DD/MM/YYYY'), '')
			        || '; situação: ' || COALESCE(f.reconciliation_status, '')
			        || CASE WHEN c.code IS NOT NULL THEN '; contrato: ' || c.code ELSE '' END,
			        jsonb_build_object('type', COALESCE(f.entry_type, ''), 'amount', COALESCE(f.amount, 0), 'status', COALESCE(f.reconciliation_status, ''), 'contractCode', COALESCE(c.code, ''))::text
			   FROM financial_entries f
			   LEFT JOIN contracts c ON c.id = f.contract_id AND c.tenant_id = f.tenant_id
			  WHERE f.tenant_id = $1 AND f.id = $2`,
		},
	}
	q, ok := queries[typ]
	if !ok {
		return "", "", "{}", fmt.Errorf("tipo não indexável: %s", typ)
	}
	var content, meta string
	if err := w.pool.QueryRow(ctx, q.sql, tenantID, id).Scan(&content, &meta); err != nil {
		return "", "", "{}", err
	}
	if strings.TrimSpace(meta) == "" {
		meta = "{}"
	}
	return content, q.module, meta, nil
}

func formatVectorLiteral(vec []float32) string {
	var b strings.Builder
	b.Grow(len(vec) * 10)
	b.WriteByte('[')
	for i, n := range vec {
		if i > 0 {
			b.WriteByte(',')
		}
		fmt.Fprintf(&b, "%g", n)
	}
	b.WriteByte(']')
	return b.String()
}
