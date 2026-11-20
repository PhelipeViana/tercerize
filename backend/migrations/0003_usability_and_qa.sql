-- Migration 0003: Melhorias de Usabilidade, Fluxo Guiado e Garantias de QA

-- 1. Remover empresa de teste com CNPJ zerado (se a sessão ativa apontar para ela, redirecionar para a empresa matriz)
UPDATE sessions
SET active_tenant_id = (SELECT id FROM tenants WHERE cnpj <> '00.000.000/0000-00' ORDER BY created_at ASC LIMIT 1)
WHERE active_tenant_id IN (SELECT id FROM tenants WHERE cnpj = '00.000.000/0000-00');

DELETE FROM tenants WHERE cnpj = '00.000.000/0000-00';

-- Normalizar CNPJs existentes para formato oficial com dígitos verificadores válidos
UPDATE tenants SET cnpj = '14.520.890/0001-77' WHERE cnpj = '14.520.890/0001-45';
UPDATE tenants SET cnpj = '28.910.440/0001-03' WHERE cnpj = '28.910.440/0001-12';
UPDATE clients SET cnpj = '12.345.678/0001-95' WHERE cnpj = '12.345.678/0001-90';
UPDATE clients SET cnpj = '23.456.789/0001-95' WHERE cnpj = '23.456.789/0001-11';
UPDATE clients SET cnpj = '26.876.717/0001-95' WHERE cnpj = '26876717000195';

-- Evitar duplicidade de CNPJ de cliente dentro da mesma empresa
CREATE UNIQUE INDEX IF NOT EXISTS clients_tenant_cnpj_unique ON clients (tenant_id, cnpj);

-- 2. Controle de EPIs: separar entrega e assinatura com evidência auditável
ALTER TABLE epi_deliveries ALTER COLUMN receipt_signed SET DEFAULT false;
ALTER TABLE epi_deliveries ADD COLUMN IF NOT EXISTS signed_at timestamptz;
ALTER TABLE epi_deliveries ADD COLUMN IF NOT EXISTS signed_by text NOT NULL DEFAULT '';
ALTER TABLE epi_deliveries ADD COLUMN IF NOT EXISTS evidence_code text NOT NULL DEFAULT '';

UPDATE epi_deliveries
SET signed_at = COALESCE(signed_at, created_at),
    signed_by = CASE WHEN signed_by = '' THEN 'Assinatura digital no recebimento' ELSE signed_by END,
    evidence_code = CASE WHEN evidence_code = '' THEN 'TRM-' || upper(substr(id::text, 1, 8)) ELSE evidence_code END
WHERE receipt_signed = true;

-- 3. Almoxarifado: rastreabilidade de saldo anterior/final e vínculo com OS
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS previous_quantity integer NOT NULL DEFAULT 0;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS new_quantity integer NOT NULL DEFAULT 0;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS service_order_id uuid REFERENCES service_orders (id) ON DELETE SET NULL;

UPDATE inventory_movements m
SET previous_quantity = CASE
      WHEN m.movement_type IN ('Saída', 'Cautela') THEN i.quantity + m.quantity
      ELSE GREATEST(0, i.quantity - m.quantity)
    END,
    new_quantity = i.quantity
FROM inventory_items i
WHERE i.id = m.item_id AND m.previous_quantity = 0 AND m.new_quantity = 0;

-- 4. Ordens de Serviço: agendamento com data/hora e vínculo opcional de contrato
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES contracts (id) ON DELETE SET NULL;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

UPDATE service_orders
SET scheduled_for = created_at + INTERVAL '1 day'
WHERE status = 'Agendada' AND scheduled_for IS NULL;

-- 5. Gestão Financeira: registro de última conciliação/reabertura
ALTER TABLE financial_entries ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
