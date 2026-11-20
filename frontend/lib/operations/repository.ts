import "server-only";
import { getPool } from "@/lib/db/pool";

export interface CompanyRow {
  id: string;
  name: string;
  cnpj: string;
  ownerName: string;
  ownerEmail: string;
  active: boolean;
  userRoleName: string;
  userRoleKey: string;
  clientsCount: number;
  contractsCount: number;
  employeesCount: number;
  serviceOrdersCount: number;
}

export interface TenantRoleRow {
  id: string;
  key: string;
  name: string;
  description: string;
  permissions: Record<string, boolean>;
  isSystem: boolean;
  membersCount: number;
}

export interface TenantMemberRow {
  membershipId: string;
  userId: string;
  userName: string;
  userEmail: string;
  isMaster: boolean;
  totpConfigured: boolean;
  roleId: string;
  roleKey: string;
  roleName: string;
  otherCompaniesCount: number;
  createdAt: string;
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
  clientId: string | null;
  clientName: string | null;
  workstation: string | null;
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
  expiresAtIso: string;
  daysUntilExpiry: number;
  receiptSigned: boolean;
  signedAt: string | null;
  signedBy: string;
  evidenceCode: string;
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
  itemId: string;
  itemSku: string;
  itemDescription: string;
  employeeName: string | null;
  serviceOrderCode: string | null;
  movementType: "Entrada" | "Saída" | "Cautela" | "Devolução";
  previousQuantity: number;
  quantity: number;
  newQuantity: number;
  unit: string;
  notes: string;
  createdAt: string;
}

export interface ServiceOrderRow {
  id: string;
  code: string;
  clientId: string;
  clientName: string;
  contractId: string | null;
  contractCode: string | null;
  workstation: string | null;
  employeeId: string | null;
  employeeName: string | null;
  description: string;
  priority: "Normal" | "Alta" | "Urgente";
  status: "Agendada" | "Em Execução" | "Concluída";
  scheduledFor: string | null;
  createdAt: string;
}

export interface FinancialEntryRow {
  id: string;
  contractId: string | null;
  contractCode: string | null;
  clientName: string | null;
  entryType: "Receita" | "Despesa";
  description: string;
  amount: number;
  dueDate: string;
  competence: string;
  reconciliationStatus: "Pendente" | "Conciliado";
  updatedAt: string;
}

export async function listCompanies(userId?: string, isMaster = true): Promise<CompanyRow[]> {
  if (isMaster || !userId) {
    const { rows } = await getPool().query<{
      id: string;
      name: string;
      cnpj: string;
      owner_name: string;
      owner_email: string;
      active: boolean;
      clients_count: string;
      contracts_count: string;
      employees_count: string;
      os_count: string;
    }>(
      `SELECT t.id, t.name, t.cnpj,
              COALESCE(t.owner_name, '') AS owner_name,
              COALESCE(t.owner_email, '') AS owner_email,
              t.active,
              (SELECT count(*) FROM clients cl WHERE cl.tenant_id = t.id) AS clients_count,
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
      ownerName: r.owner_name,
      ownerEmail: r.owner_email,
      active: r.active,
      userRoleName: "Master",
      userRoleKey: "master",
      clientsCount: Number(r.clients_count),
      contractsCount: Number(r.contracts_count),
      employeesCount: Number(r.employees_count),
      serviceOrdersCount: Number(r.os_count),
    }));
  }

  const { rows } = await getPool().query<{
    id: string;
    name: string;
    cnpj: string;
    owner_name: string;
    owner_email: string;
    active: boolean;
    role_name: string;
    role_key: string;
    clients_count: string;
    contracts_count: string;
    employees_count: string;
    os_count: string;
  }>(
    `SELECT t.id, t.name, t.cnpj,
            COALESCE(t.owner_name, '') AS owner_name,
            COALESCE(t.owner_email, '') AS owner_email,
            t.active,
            tr.name AS role_name,
            tr.key AS role_key,
            (SELECT count(*) FROM clients cl WHERE cl.tenant_id = t.id) AS clients_count,
            (SELECT count(*) FROM contracts c WHERE c.tenant_id = t.id) AS contracts_count,
            (SELECT count(*) FROM employees e WHERE e.tenant_id = t.id) AS employees_count,
            (SELECT count(*) FROM service_orders o WHERE o.tenant_id = t.id) AS os_count
       FROM tenant_memberships tm
       JOIN tenants t ON t.id = tm.tenant_id
       JOIN tenant_roles tr ON tr.id = tm.role_id
      WHERE tm.user_id = $1 AND t.active = true
      ORDER BY t.created_at ASC`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    cnpj: r.cnpj,
    ownerName: r.owner_name,
    ownerEmail: r.owner_email,
    active: r.active,
    userRoleName: r.role_name,
    userRoleKey: r.role_key,
    clientsCount: Number(r.clients_count),
    contractsCount: Number(r.contracts_count),
    employeesCount: Number(r.employees_count),
    serviceOrdersCount: Number(r.os_count),
  }));
}

export async function listTenantRoles(tenantId: string): Promise<TenantRoleRow[]> {
  const { rows } = await getPool().query<{
    id: string;
    key: string;
    name: string;
    description: string;
    permissions: Record<string, boolean> | null;
    is_system: boolean;
    members_count: string;
  }>(
    `SELECT r.id, r.key, r.name, r.description, r.permissions, r.is_system,
            (SELECT count(*) FROM tenant_memberships tm WHERE tm.role_id = r.id) AS members_count
       FROM tenant_roles r
      WHERE r.tenant_id = $1
      ORDER BY CASE r.key WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 WHEN 'operator' THEN 2 WHEN 'financial' THEN 3 ELSE 4 END, r.name ASC`,
    [tenantId],
  );
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    permissions: r.permissions ?? {},
    isSystem: r.is_system,
    membersCount: Number(r.members_count),
  }));
}

export async function listTenantMembers(tenantId: string): Promise<TenantMemberRow[]> {
  const { rows } = await getPool().query<{
    membership_id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    is_master: boolean;
    totp_configured_at: string | null;
    role_id: string;
    role_key: string;
    role_name: string;
    other_companies_count: string;
    created_at: string;
  }>(
    `SELECT tm.id AS membership_id, u.id AS user_id, u.name AS user_name, u.email AS user_email,
            u.is_master, u.totp_configured_at,
            tr.id AS role_id, tr.key AS role_key, tr.name AS role_name,
            (SELECT count(*) FROM tenant_memberships tm2 WHERE tm2.user_id = u.id AND tm2.tenant_id <> $1) AS other_companies_count,
            to_char(tm.created_at, 'DD/MM/YYYY') AS created_at
       FROM tenant_memberships tm
       JOIN users u ON u.id = tm.user_id
       JOIN tenant_roles tr ON tr.id = tm.role_id
      WHERE tm.tenant_id = $1
      ORDER BY CASE WHEN tr.key = 'owner' THEN 0 ELSE 1 END, u.name ASC`,
    [tenantId],
  );
  return rows.map((r) => ({
    membershipId: r.membership_id,
    userId: r.user_id,
    userName: r.user_name,
    userEmail: r.user_email,
    isMaster: r.is_master,
    totpConfigured: Boolean(r.totp_configured_at),
    roleId: r.role_id,
    roleKey: r.role_key,
    roleName: r.role_name,
    otherCompaniesCount: Number(r.other_companies_count),
    createdAt: r.created_at,
  }));
}

export async function listClients(tenantId: string): Promise<ClientRow[]> {
  const { rows } = await getPool().query<ClientRow>(
    `SELECT id, name, cnpj, contact
       FROM clients
      WHERE tenant_id = $1
      ORDER BY created_at DESC, name ASC`,
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
    client_id: string | null;
    client_name: string | null;
    workstation: string | null;
    name: string;
    role_title: string;
    schedule: string;
    status: string;
  }>(
    `SELECT e.id, e.contract_id, c.code AS contract_code, c.client_id, cl.name AS client_name,
            c.workstation, e.name, e.role_title, e.schedule, e.status
       FROM employees e
       LEFT JOIN contracts c ON c.id = e.contract_id
       LEFT JOIN clients cl ON cl.id = c.client_id
      WHERE e.tenant_id = $1
      ORDER BY e.created_at DESC, e.name ASC`,
    [tenantId],
  );
  return rows.map((r) => ({
    id: r.id,
    contractId: r.contract_id,
    contractCode: r.contract_code,
    clientId: r.client_id,
    clientName: r.client_name,
    workstation: r.workstation,
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
    expires_at_iso: string;
    days_until_expiry: number;
    receipt_signed: boolean;
    signed_at: string | null;
    signed_by: string;
    evidence_code: string;
  }>(
    `SELECT d.id, d.employee_id, e.name AS employee_name, e.role_title AS employee_role,
            d.epi_name, d.ca_number,
            to_char(d.delivered_at, 'DD/MM/YYYY') AS delivered_at,
            to_char(d.expires_at, 'DD/MM/YYYY') AS expires_at,
            to_char(d.expires_at, 'YYYY-MM-DD') AS expires_at_iso,
            (d.expires_at - CURRENT_DATE)::int AS days_until_expiry,
            d.receipt_signed,
            CASE WHEN d.signed_at IS NOT NULL THEN to_char(d.signed_at, 'DD/MM/YYYY HH24:MI') ELSE NULL END AS signed_at,
            COALESCE(d.signed_by, '') AS signed_by,
            COALESCE(d.evidence_code, '') AS evidence_code
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
    expiresAtIso: r.expires_at_iso,
    daysUntilExpiry: Number(r.days_until_expiry),
    receiptSigned: r.receipt_signed,
    signedAt: r.signed_at,
    signedBy: r.signed_by,
    evidenceCode: r.evidence_code,
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
    item_id: string;
    item_sku: string;
    item_description: string;
    employee_name: string | null;
    service_order_code: string | null;
    movement_type: "Entrada" | "Saída" | "Cautela" | "Devolução";
    previous_quantity: number;
    quantity: number;
    new_quantity: number;
    unit: string;
    notes: string;
    created_at: string;
  }>(
    `SELECT m.id, m.item_id, i.sku AS item_sku, i.description AS item_description, i.unit,
            e.name AS employee_name,
            o.code AS service_order_code,
            m.movement_type,
            COALESCE(m.previous_quantity, 0) AS previous_quantity,
            m.quantity,
            COALESCE(m.new_quantity, i.quantity) AS new_quantity,
            m.notes,
            to_char(m.created_at, 'DD/MM/YYYY HH24:MI') AS created_at
       FROM inventory_movements m
       JOIN inventory_items i ON i.id = m.item_id
       LEFT JOIN employees e ON e.id = m.employee_id
       LEFT JOIN service_orders o ON o.id = m.service_order_id
      WHERE m.tenant_id = $1
      ORDER BY m.created_at DESC
      LIMIT 40`,
    [tenantId],
  );
  return rows.map((r) => ({
    id: r.id,
    itemId: r.item_id,
    itemSku: r.item_sku,
    itemDescription: r.item_description,
    employeeName: r.employee_name,
    serviceOrderCode: r.service_order_code,
    movementType: r.movement_type,
    previousQuantity: Number(r.previous_quantity),
    quantity: r.quantity,
    newQuantity: Number(r.new_quantity),
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
    contract_id: string | null;
    contract_code: string | null;
    workstation: string | null;
    employee_id: string | null;
    employee_name: string | null;
    description: string;
    priority: "Normal" | "Alta" | "Urgente";
    status: "Agendada" | "Em Execução" | "Concluída";
    scheduled_for: string | null;
    created_at: string;
  }>(
    `SELECT o.id, o.code, o.client_id, cl.name AS client_name,
            o.contract_id, c.code AS contract_code, c.workstation,
            o.employee_id, e.name AS employee_name,
            o.description, o.priority, o.status,
            CASE WHEN o.scheduled_for IS NOT NULL THEN to_char(o.scheduled_for, 'DD/MM/YYYY HH24:MI') ELSE NULL END AS scheduled_for,
            to_char(o.created_at, 'DD/MM/YYYY') AS created_at
       FROM service_orders o
       JOIN clients cl ON cl.id = o.client_id
       LEFT JOIN contracts c ON c.id = o.contract_id
       LEFT JOIN employees e ON e.id = o.employee_id
      WHERE o.tenant_id = $1
      ORDER BY o.created_at DESC, o.code ASC`,
    [tenantId],
  );
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    clientId: r.client_id,
    clientName: r.client_name,
    contractId: r.contract_id,
    contractCode: r.contract_code,
    workstation: r.workstation,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    description: r.description,
    priority: r.priority,
    status: r.status,
    scheduledFor: r.scheduled_for,
    createdAt: r.created_at,
  }));
}

export async function listFinancialEntries(tenantId: string): Promise<FinancialEntryRow[]> {
  const { rows } = await getPool().query<{
    id: string;
    contract_id: string | null;
    contract_code: string | null;
    client_name: string | null;
    entry_type: "Receita" | "Despesa";
    description: string;
    amount: string;
    due_date: string;
    competence: string;
    reconciliation_status: "Pendente" | "Conciliado";
    updated_at: string;
  }>(
    `SELECT f.id, f.contract_id, c.code AS contract_code, cl.name AS client_name,
            f.entry_type, f.description, f.amount,
            to_char(f.due_date, 'DD/MM/YYYY') AS due_date,
            to_char(f.due_date, 'MM/YYYY') AS competence,
            f.reconciliation_status,
            to_char(COALESCE(f.updated_at, f.created_at), 'DD/MM/YYYY HH24:MI') AS updated_at
       FROM financial_entries f
       LEFT JOIN contracts c ON c.id = f.contract_id
       LEFT JOIN clients cl ON cl.id = c.client_id
      WHERE f.tenant_id = $1
      ORDER BY f.due_date ASC, f.created_at DESC`,
    [tenantId],
  );
  return rows.map((r) => ({
    id: r.id,
    contractId: r.contract_id,
    contractCode: r.contract_code,
    clientName: r.client_name,
    entryType: r.entry_type,
    description: r.description,
    amount: Number(r.amount),
    dueDate: r.due_date,
    competence: r.competence,
    reconciliationStatus: r.reconciliation_status,
    updatedAt: r.updated_at,
  }));
}
