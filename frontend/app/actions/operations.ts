"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api/server";
import {
  formatCANumber,
  formatSKU,
  parseCurrencyBRL,
  validateCNPJ,
  validateEmail,
  validatePhoneBR,
} from "@/lib/utils/masks";

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value.trim() : "");

function parseBRLNumber(raw: string): number {
  return parseCurrencyBRL(raw);
}

export type ClientActionState =
  | {
    ok?: boolean;
    clientId?: string;
    clientName?: string;
    clientCnpj?: string;
    fieldError?: { field: "name" | "cnpj" | "phone" | "email"; message: string };
    error?: string;
    values?: { name?: string; cnpj?: string; phone?: string; email?: string };
  }
  | undefined;

export async function createClientStateAction(
  _prev: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const name = text(formData.get("name"));
  const rawCnpj = text(formData.get("cnpj"));
  const rawPhone = text(formData.get("phone"));
  const rawEmail = text(formData.get("email"));

  const baseValues = { name, cnpj: rawCnpj, phone: rawPhone, email: rawEmail };

  if (name.length < 2) {
    return {
      fieldError: { field: "name", message: "Informe a razão social do cliente (mínimo 2 caracteres)." },
      values: baseValues,
    };
  }

  const cnpjCheck = validateCNPJ(rawCnpj);
  if (!cnpjCheck.valid) {
    return {
      fieldError: { field: "cnpj", message: cnpjCheck.error ?? "CNPJ inválido." },
      values: { ...baseValues, cnpj: cnpjCheck.formatted },
    };
  }

  const phoneCheck = validatePhoneBR(rawPhone);
  if (!phoneCheck.valid) {
    return {
      fieldError: { field: "phone", message: phoneCheck.error ?? "Telefone inválido." },
      values: { ...baseValues, cnpj: cnpjCheck.formatted, phone: phoneCheck.formatted },
    };
  }

  const emailCheck = validateEmail(rawEmail);
  if (!emailCheck.valid) {
    return {
      fieldError: { field: "email", message: emailCheck.error ?? "E-mail inválido." },
      values: { ...baseValues, cnpj: cnpjCheck.formatted, phone: phoneCheck.formatted, email: emailCheck.normalized },
    };
  }

  const res = await apiFetch("/api/clients", {
    method: "POST",
    body: {
      name,
      cnpj: cnpjCheck.formatted,
      phone: phoneCheck.formatted,
      email: emailCheck.normalized,
    },
  });
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    cnpj?: string;
    field?: "name" | "cnpj" | "phone" | "email";
    message?: string;
  };

  if (!res.ok) {
    const preserved = {
      name,
      cnpj: cnpjCheck.formatted,
      phone: phoneCheck.formatted,
      email: emailCheck.normalized,
    };
    if (data.field) {
      return {
        fieldError: { field: data.field, message: data.message ?? "Dado inválido." },
        values: preserved,
      };
    }
    return {
      error: data.message ?? "Não foi possível salvar o cliente.",
      values: preserved,
    };
  }

  revalidatePath("/admin/contracts");
  revalidatePath("/admin/contracts/create");
  revalidatePath("/admin/service-orders");

  return {
    ok: true,
    clientId: data.id,
    clientName: data.name ?? name,
    clientCnpj: data.cnpj ?? cnpjCheck.formatted,
  };
}

export async function createClientAction(formData: FormData): Promise<void> {
  await createClientStateAction(undefined, formData);
}

export type ContractActionState =
  | {
    fieldError?: { field: string; message: string };
    error?: string;
    values?: {
      clientId?: string;
      object?: string;
      durationMonths?: string;
      monthlyValue?: string;
      workstation?: string;
      scopeNotes?: string;
    };
  }
  | undefined;

export async function createContractStateAction(
  _prev: ContractActionState,
  formData: FormData,
): Promise<ContractActionState> {
  const clientId = text(formData.get("clientId"));
  const code = text(formData.get("code"));
  const object = text(formData.get("object"));
  const scopeNotes = text(formData.get("scopeNotes"));
  const workstation = text(formData.get("workstation"));
  const rawDuration = text(formData.get("durationMonths")) || "12";
  const rawValue = text(formData.get("monthlyValue"));
  const durationMonths = Number(rawDuration);
  const monthlyValue = parseBRLNumber(rawValue);

  const values = {
    clientId,
    object,
    durationMonths: rawDuration,
    monthlyValue: rawValue,
    workstation,
    scopeNotes,
  };

  if (!clientId) {
    return {
      fieldError: { field: "clientId", message: "Selecione ou cadastre um cliente tomador." },
      values,
    };
  }
  if (object.length < 3) {
    return {
      fieldError: { field: "object", message: "Descreva o objeto do contrato." },
      values,
    };
  }
  if (!Number.isFinite(monthlyValue) || monthlyValue <= 0) {
    return {
      fieldError: { field: "monthlyValue", message: "Informe um valor mensal válido maior que zero." },
      values,
    };
  }

  const res = await apiFetch("/api/contracts", {
    method: "POST",
    body: {
      clientId,
      code,
      object,
      scopeNotes: scopeNotes || object,
      workstation: workstation || "Unidade Principal",
      durationMonths: durationMonths > 0 ? durationMonths : 12,
      monthlyValue,
    },
  });
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    code?: string;
    field?: string;
    message?: string;
  };

  if (!res.ok) {
    if (data.field) {
      return { fieldError: { field: data.field, message: data.message ?? "Campo inválido." }, values };
    }
    return { error: data.message ?? "Não foi possível salvar o contrato.", values };
  }

  revalidatePath("/admin/contracts");
  revalidatePath("/admin/employees");
  revalidatePath("/admin/finance");
  const params = new URLSearchParams();
  if (data.id) params.set("createdContractId", data.id);
  if (data.code) params.set("createdCode", data.code);
  params.set("clientId", clientId);
  redirect(`/admin/contracts?${params.toString()}`);
}

export async function createContractAction(formData: FormData): Promise<void> {
  await createContractStateAction(undefined, formData);
}

export type EmployeeActionState =
  | {
    ok?: boolean;
    employeeId?: string;
    employeeName?: string;
    contractId?: string;
    clientId?: string;
    error?: string;
  }
  | undefined;

export async function createEmployeeStateAction(
  _prev: EmployeeActionState,
  formData: FormData,
): Promise<EmployeeActionState> {
  const name = text(formData.get("name"));
  const roleTitle = text(formData.get("roleTitle"));
  const contractId = text(formData.get("contractId"));
  const schedule = text(formData.get("schedule"));
  const status = contractId ? text(formData.get("status")) || "Alocado" : "Disponível";

  if (!name || !roleTitle) {
    return { error: "Informe o nome completo e a função/cargo do colaborador." };
  }

  const res = await apiFetch("/api/employees", {
    method: "POST",
    body: { name, roleTitle, contractId, schedule, status },
  });
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    clientId?: string;
    contractId?: string;
    message?: string;
  };
  if (!res.ok) {
    return { error: data.message ?? "Não foi possível cadastrar o colaborador." };
  }

  revalidatePath("/admin/employees");
  revalidatePath("/admin/epis");
  revalidatePath("/admin/service-orders");
  revalidatePath("/admin/inventory-items");

  return {
    ok: true,
    employeeId: data.id,
    employeeName: name,
    contractId: data.contractId || contractId,
    clientId: data.clientId || "",
  };
}

export async function createEmployeeAction(formData: FormData): Promise<void> {
  await createEmployeeStateAction(undefined, formData);
}

export async function updateEmployeeScheduleAction(formData: FormData): Promise<void> {
  const id = text(formData.get("id"));
  const contractId = text(formData.get("contractId"));
  const schedule = text(formData.get("schedule"));
  const status = text(formData.get("status")) || (contractId ? "Alocado" : "Disponível");
  if (!id) return;

  await apiFetch("/api/employees/schedule", {
    method: "POST",
    body: { id, contractId, schedule, status },
  });
  revalidatePath("/admin/employees");
  revalidatePath("/admin/service-orders");
}

export type EPIActionState =
  | {
    ok?: boolean;
    epiName?: string;
    receiptSigned?: boolean;
    error?: string;
  }
  | undefined;

export async function createEPIStateAction(
  _prev: EPIActionState,
  formData: FormData,
): Promise<EPIActionState> {
  const employeeId = text(formData.get("employeeId"));
  const epiName = text(formData.get("epiName"));
  const caNumber = formatCANumber(text(formData.get("caNumber")));
  const deliveredAt = text(formData.get("deliveredAt"));
  const expiresAt = text(formData.get("expiresAt"));
  const signMode = text(formData.get("signMode")); // "pending" | "signed"
  const signedBy = text(formData.get("signedBy"));
  const evidenceCode = text(formData.get("evidenceCode"));

  if (!employeeId || !epiName || !caNumber || !expiresAt) {
    return { error: "Preencha o colaborador, descrição do EPI, número numérico do CA e validade." };
  }

  const receiptSigned = signMode === "signed";
  const res = await apiFetch("/api/epis", {
    method: "POST",
    body: {
      employeeId,
      epiName,
      caNumber,
      deliveredAt,
      expiresAt,
      receiptSigned,
      signedBy,
      evidenceCode,
    },
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    return { error: data.message ?? "Não foi possível registrar a entrega de EPI." };
  }

  revalidatePath("/admin/epis");
  return { ok: true, epiName, receiptSigned };
}

export async function createEPIAction(formData: FormData): Promise<void> {
  await createEPIStateAction(undefined, formData);
}

export async function signEPIAction(formData: FormData): Promise<void> {
  const id = text(formData.get("id"));
  const signedBy = text(formData.get("signedBy"));
  const evidenceCode = text(formData.get("evidenceCode"));
  if (!id) return;

  await apiFetch("/api/epis/sign", {
    method: "POST",
    body: { id, signedBy, evidenceCode },
  });
  revalidatePath("/admin/epis");
}

export type InventoryMovementState =
  | {
    ok?: boolean;
    message?: string;
    error?: string;
    field?: string;
    values?: {
      itemId?: string;
      movementType?: string;
      quantity?: string;
      employeeId?: string;
      serviceOrderId?: string;
      notes?: string;
    };
  }
  | undefined;

export async function createInventoryMovementStateAction(
  _prev: InventoryMovementState,
  formData: FormData,
): Promise<InventoryMovementState> {
  const itemId = text(formData.get("itemId"));
  const employeeId = text(formData.get("employeeId"));
  const serviceOrderId = text(formData.get("serviceOrderId"));
  const movementType = text(formData.get("movementType"));
  const rawQty = text(formData.get("quantity"));
  const quantity = Number(rawQty || "0");
  const notes = text(formData.get("notes"));

  const values = {
    itemId,
    movementType,
    quantity: rawQty,
    employeeId,
    serviceOrderId,
    notes,
  };

  if (!itemId) {
    return { field: "itemId", error: "Selecione o item ou ferramenta do estoque.", values };
  }
  if (!movementType) {
    return { field: "movementType", error: "Selecione a operação que deseja realizar.", values };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { field: "quantity", error: "Informe uma quantidade inteira maior que zero.", values };
  }
  if ((movementType === "Cautela" || movementType === "Devolução") && !employeeId) {
    return {
      field: "employeeId",
      error: "Selecione o técnico responsável pela cautela ou devolução da ferramenta.",
      values,
    };
  }

  const res = await apiFetch("/api/inventory-movements", {
    method: "POST",
    body: { itemId, employeeId, serviceOrderId, movementType, quantity, notes },
  });
  const data = (await res.json().catch(() => ({}))) as {
    field?: string;
    message?: string;
    previousQuantity?: number;
    newQuantity?: number;
  };

  if (!res.ok) {
    return {
      field: data.field ?? "quantity",
      error: data.message ?? "Não foi possível registrar a movimentação de estoque.",
      values,
    };
  }

  revalidatePath("/admin/inventory-items");
  return {
    ok: true,
    message: `Movimentação (${movementType}) registrada: saldo atualizado de ${data.previousQuantity ?? 0} para ${data.newQuantity ?? 0}.`,
  };
}

export async function createInventoryMovementAction(formData: FormData): Promise<void> {
  await createInventoryMovementStateAction(undefined, formData);
}

export type InventoryItemState =
  | {
    ok?: boolean;
    sku?: string;
    error?: string;
  }
  | undefined;

export async function createInventoryItemStateAction(
  _prev: InventoryItemState,
  formData: FormData,
): Promise<InventoryItemState> {
  const sku = formatSKU(text(formData.get("sku")));
  const description = text(formData.get("description"));
  const category = text(formData.get("category")) || "Material";
  const quantity = Number(text(formData.get("quantity")) || "0");
  const unit = text(formData.get("unit")) || "un.";
  const unitValue = parseBRLNumber(text(formData.get("unitValue")));
  const minQuantity = Number(text(formData.get("minQuantity")) || "2");

  if (!sku || !description) {
    return { error: "Informe o código SKU e a descrição do item." };
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    return { error: "O saldo inicial deve ser um número inteiro maior ou igual a zero." };
  }
  if (!Number.isFinite(unitValue) || unitValue < 0) {
    return { error: "Informe um valor unitário válido em reais (R$)." };
  }

  const res = await apiFetch("/api/inventory-items", {
    method: "POST",
    body: { sku, description, category, quantity, unit, unitValue, minQuantity },
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    return { error: data.message ?? "Erro ao cadastrar item no estoque." };
  }

  revalidatePath("/admin/inventory-items");
  return { ok: true, sku: sku.toUpperCase() };
}

export async function createInventoryItemAction(formData: FormData): Promise<void> {
  await createInventoryItemStateAction(undefined, formData);
}

export type ServiceOrderActionState =
  | {
    ok?: boolean;
    code?: string;
    error?: string;
  }
  | undefined;

export async function createServiceOrderStateAction(
  _prev: ServiceOrderActionState,
  formData: FormData,
): Promise<ServiceOrderActionState> {
  const clientId = text(formData.get("clientId"));
  const contractId = text(formData.get("contractId"));
  const employeeId = text(formData.get("employeeId"));
  const description = text(formData.get("description"));
  const priority = text(formData.get("priority")) || "Normal";
  const status = text(formData.get("status")) || "Agendada";
  const scheduledFor = text(formData.get("scheduledFor"));

  if (!clientId || !description) {
    return { error: "Selecione o cliente tomador e informe a descrição do serviço." };
  }
  if (status === "Agendada" && !scheduledFor) {
    return { error: "Informe a data e hora programada para a ordem agendada." };
  }

  const res = await apiFetch("/api/service-orders", {
    method: "POST",
    body: { clientId, contractId, employeeId, description, priority, status, scheduledFor },
  });
  const data = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
  if (!res.ok) {
    return { error: data.message ?? "Não foi possível abrir a ordem de serviço." };
  }

  revalidatePath("/admin/service-orders");
  revalidatePath("/admin/inventory-items");
  return { ok: true, code: data.code };
}

export async function createServiceOrderAction(formData: FormData): Promise<void> {
  await createServiceOrderStateAction(undefined, formData);
}

export async function updateServiceOrderStatusAction(formData: FormData): Promise<void> {
  const id = text(formData.get("id"));
  const status = text(formData.get("status"));
  if (!id || !status) return;

  await apiFetch("/api/service-orders/status", {
    method: "POST",
    body: { id, status },
  });
  revalidatePath("/admin/service-orders");
}

export type FinancialEntryState =
  | {
    ok?: boolean;
    error?: string;
    field?: string;
    values?: {
      entryType?: string;
      contractId?: string;
      description?: string;
      amount?: string;
      dueDate?: string;
      status?: string;
    };
  }
  | undefined;

export async function createFinancialEntryStateAction(
  _prev: FinancialEntryState,
  formData: FormData,
): Promise<FinancialEntryState> {
  const contractId = text(formData.get("contractId"));
  const entryType = text(formData.get("entryType")) || "Receita";
  const description = text(formData.get("description"));
  const rawAmount = text(formData.get("amount"));
  const amount = parseBRLNumber(rawAmount);
  const dueDate = text(formData.get("dueDate"));
  const status = text(formData.get("status")) || "Pendente";

  const values = { entryType, contractId, description, amount: rawAmount, dueDate, status };

  if (description.length < 3) {
    return { field: "description", error: "Informe a descrição do lançamento financeiro.", values };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      field: "amount",
      error: "Informe um valor em reais maior que zero (ex.: 1.500,00 ou 150,50).",
      values,
    };
  }
  if (!dueDate) {
    return { field: "dueDate", error: "Informe a data de vencimento.", values };
  }

  const res = await apiFetch("/api/financial-entries", {
    method: "POST",
    body: { contractId, entryType, description, amount, dueDate, status },
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    return { error: data.message ?? "Não foi possível salvar o lançamento financeiro.", values };
  }

  revalidatePath("/admin/finance");
  return { ok: true };
}

export async function createFinancialEntryAction(formData: FormData): Promise<void> {
  await createFinancialEntryStateAction(undefined, formData);
}

export async function reconcileFinancialEntryAction(formData: FormData): Promise<void> {
  const id = text(formData.get("id"));
  if (!id) return;

  await apiFetch("/api/financial-entries/reconcile", {
    method: "POST",
    body: { id },
  });
  revalidatePath("/admin/finance");
}
