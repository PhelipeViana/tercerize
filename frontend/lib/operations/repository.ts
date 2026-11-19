import "server-only";
import { getPool } from "@/lib/db/pool";

export interface CompanyRow {
  id: string;
  name: string;
  cnpj: string;
  active: boolean;
  contractsCount: number;
  employeesCount: number;
  serviceOrdersCount: number;
}

export interface ClientRow {
  id: string;
  name: string;
  cnpj: string;
  contact: string;
}

export interface ContractRow {
  id: string;
  clientId: string;
  clientName: string;
  clientCnpj: string;
  code: string;
  object: string;
  scopeNotes: string;
  workstation: string;
  durationMonths: number;
  monthlyValue: number;
  status: string;
}

export interface EmployeeRow {
  id: string;
  contractId: string | null;
  contractCode: string | null;
  clientName: string | null;
  name: string;
  roleTitle: string;
  schedule: string;
  status: string;
}

export interface EPIDeliveryRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  epiName: string;
  caNumber: string;
  deliveredAt: string;
  expiresAt: string;
  receiptSigned: boolean;
}

export interface InventoryItemRow {
  id: string;
  sku: string;
  description: string;
  category: "Material" | "Ferramenta";
  quantity: number;
  unit: string;
  unitValue: number;
  minQuantity: number;
  level: "Normal" | "Baixo";
}

export interface InventoryMovementRow {
  id: string;
  itemSku: string;
  itemDescription: string;
  employeeName: string | null;
  movementType: "Entrada" | "Saída" | "Cautela" | "Devolução";
  quantity: number;
  unit: string;
  notes: string;
  createdAt: string;
}

export interface ServiceOrderRow {
  id: string;
  code: string;
  clientId: string;
  clientName: string;
  employeeId: string | null;
  employeeName: string | null;
  description: string;
  priority: "Normal" | "Alta" | "Urgente";
  status: "Agendada" | "Em Execução" | "Concluída";
}

export interface FinancialEntryRow {
  id: string;
  contractId: string | null;
  contractCode: string | null;
  entryType: "Receita" | "Despesa";
  description: string;
  amount: number;
  dueDate: string;
  reconciliationStatus: "Pendente" | "Conciliado";
}

export async function listCompanies(): Promise<CompanyRow[]> {
  const { rows } = await getPool().query<{
    id: string;
    name: string;
    cnpj: string;
    active: boolean;
    contracts_count: string;
    employees_count: string;
    os_count: string;
  }>(
    `SELECT t.id, t.name, t.cnpj, t.active,
            (SELECT count(*) FROM contracts c WHERE c.tenant_id = t.id) AS contracts_count,
            (SELECT count(*) FROM employees e WHERE e.tenant_id = t.id) AS employees_count,
            (SELECT count(*) FROM service_orders o WHERE o.tenant_id = t.id) AS os_count
       FROM tenants t
      ORDER BY t.created_at ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    cnpj: r.cnpj,
    active: r.active,
    contractsCount: Number(r.contracts_count),
    employeesCount: Number(r.employees_count),
    serviceOrdersCount: Number(r.os_count),
  }));
}

export async function listClients(tenantId: string): Promise<ClientRow[]> {
  const { rows } = await getPool().query<ClientRow>(
    `SELECT id, name, cnpj, contact
       FROM clients
      WHERE tenant_id = $1
      ORDER BY name ASC`,
    [tenantId],
  );
  return rows;
}

export async function listContracts(tenantId: string): Promise<ContractRow[]> {
  const { rows } = await getPool().query<{
    id: string;
    client_id: string;
    client_name: string;
    client_cnpj: string;
    code: string;
    object: string;
    scope_notes: string;
    workstation: string;
    duration_months: number;
    monthly_value: string;
    status: string;
  }>(
    `SELECT c.id, c.client_id, cl.name AS client_name, cl.cnpj AS client_cnpj,
            c.code, c.object, c.scope_notes, c.workstation, c.duration_months, c.monthly_value, c.status
       FROM contracts c
       JOIN clients cl ON cl.id = c.client_id
      WHERE c.tenant_id = $1
      ORDER BY c.code ASC, c.created_at DESC`,
    [tenantId],
  );
  return rows.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    clientName: r.client_name,
    clientCnpj: r.client_cnpj,
    code: r.code,
    object: r.object,
    scopeNotes: r.scope_notes,
    workstation: r.workstation,
    durationMonths: r.duration_months,
    monthlyValue: Number(r.monthly_value),
    status: r.status,
  }));
}

export async function listEmployees(tenantId: string): Promise<EmployeeRow[]> {
  const { rows } = await getPool().query<{
    id: string;
    contract_id: string | null;
    contract_code: string | null;
    client_name: string | null;
    name: string;
    role_title: string;
    schedule: string;
    status: string;
  }>(
    `SELECT e.id, e.contract_id, c.code AS contract_code, cl.name AS client_name,
            e.name, e.role_title, e.schedule, e.status
       FROM employees e
       LEFT JOIN contracts c ON c.id = e.contract_id
       LEFT JOIN clients cl ON cl.id = c.client_id
      WHERE e.tenant_id = $1
      ORDER BY e.name ASC`,
    [tenantId],
  );
  return rows.map((r) => ({
    id: r.id,
    contractId: r.contract_id,
    contractCode: r.contract_code,
    clientName: r.client_name,
    name: r.name,
    roleTitle: r.role_title,
    schedule: r.schedule,
    status: r.status,
  }));
}

export async function listEPIDeliveries(tenantId: string): Promise<EPIDeliveryRow[]> {
  const { rows } = await getPool().query<{
    id: string;
    employee_id: string;
    employee_name: string;
    employee_role: string;
    epi_name: string;
    ca_number: string;
    delivered_at: string;
    expires_at: string;
    receipt_signed: boolean;
  }>(
    `SELECT d.id, d.employee_id, e.name AS employee_name, e.role_title AS employee_role,
            d.epi_name, d.ca_number,
            to_char(d.delivered_at, 'DD/MM/YYYY') AS delivered_at,
            to_char(d.expires_at, 'DD/MM/YYYY') AS expires_at,
            d.receipt_signed
       FROM epi_deliveries d
       JOIN employees e ON e.id = d.employee_id
      WHERE d.tenant_id = $1
      ORDER BY d.created_at DESC`,
    [tenantId],
  );
  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    employeeRole: r.employee_role,
    epiName: r.epi_name,
    caNumber: r.ca_number,
    deliveredAt: r.delivered_at,
    expiresAt: r.expires_at,
    receiptSigned: r.receipt_signed,
  }));
}

export async function listInventoryItems(tenantId: string): Promise<InventoryItemRow[]> {
  const { rows } = await getPool().query<{
    id: string;
    sku: string;
    description: string;
    category: "Material" | "Ferramenta";
    quantity: number;
    unit: string;
    unit_value: string;
    min_quantity: number;
  }>(
    `SELECT id, sku, description, category, quantity, unit, unit_value, min_quantity
       FROM inventory_items
      WHERE tenant_id = $1
      ORDER BY sku ASC`,
    [tenantId],
  );
  return rows.map((r) => ({
    id: r.id,
    sku: r.sku,
    description: r.description,
    category: r.category,
    quantity: r.quantity,
    unit: r.unit,
    unitValue: Number(r.unit_value),
    minQuantity: r.min_quantity,
    level: r.quantity <= r.min_quantity ? "Baixo" : "Normal",
  }));
}

export async function listInventoryMovements(tenantId: string): Promise<InventoryMovementRow[]> {
  const { rows } = await getPool().query<{
    id: string;
    item_sku: string;
    item_description: string;
    employee_name: string | null;
    movement_type: "Entrada" | "Saída" | "Cautela" | "Devolução";
    quantity: number;
    unit: string;
    notes: string;
    created_at: string;
  }>(
    `SELECT m.id, i.sku AS item_sku, i.description AS item_description, i.unit,
            e.name AS employee_name, m.movement_type, m.quantity, m.notes,
            to_char(m.created_at, 'DD/MM/YYYY HH24:MI') AS created_at
       FROM inventory_movements m
       JOIN inventory_items i ON i.id = m.item_id
       LEFT JOIN employees e ON e.id = m.employee_id
      WHERE m.tenant_id = $1
      ORDER BY m.created_at DESC
      LIMIT 30`,
    [tenantId],
  );
  return rows.map((r) => ({
    id: r.id,
    itemSku: r.item_sku,
    itemDescription: r.item_description,
    employeeName: r.employee_name,
    movementType: r.movement_type,
    quantity: r.quantity,
    unit: r.unit,
    notes: r.notes,
    createdAt: r.created_at,
  }));
}

export async function listServiceOrders(tenantId: string): Promise<ServiceOrderRow[]> {
  const { rows } = await getPool().query<{
    id: string;
    code: string;
    client_id: string;
    client_name: string;
    employee_id: string | null;
    employee_name: string | null;
    description: string;
    priority: "Normal" | "Alta" | "Urgente";
    status: "Agendada" | "Em Execução" | "Concluída";
  }>(
    `SELECT o.id, o.code, o.client_id, cl.name AS client_name,
            o.employee_id, e.name AS employee_name,
            o.description, o.priority, o.status
       FROM service_orders o
       JOIN clients cl ON cl.id = o.client_id
       LEFT JOIN employees e ON e.id = o.employee_id
      WHERE o.tenant_id = $1
      ORDER BY o.code ASC, o.created_at DESC`,
    [tenantId],
  );
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    clientId: r.client_id,
    clientName: r.client_name,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    description: r.description,
    priority: r.priority,
    status: r.status,
  }));
}

export async function listFinancialEntries(tenantId: string): Promise<FinancialEntryRow[]> {
  const { rows } = await getPool().query<{
    id: string;
    contract_id: string | null;
    contract_code: string | null;
    entry_type: "Receita" | "Despesa";
    description: string;
    amount: string;
    due_date: string;
    reconciliation_status: "Pendente" | "Conciliado";
  }>(
    `SELECT f.id, f.contract_id, c.code AS contract_code,
            f.entry_type, f.description, f.amount,
            to_char(f.due_date, 'DD/MM/YYYY') AS due_date,
            f.reconciliation_status
       FROM financial_entries f
       LEFT JOIN contracts c ON c.id = f.contract_id
      WHERE f.tenant_id = $1
      ORDER BY f.due_date ASC, f.created_at DESC`,
    [tenantId],
  );
  return rows.map((r) => ({
    id: r.id,
    contractId: r.contract_id,
    contractCode: r.contract_code,
    entryType: r.entry_type,
    description: r.description,
    amount: Number(r.amount),
    dueDate: r.due_date,
    reconciliationStatus: r.reconciliation_status,
  }));
}
