"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api/server";

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value.trim() : "");

export async function createClientAction(formData: FormData): Promise<void> {
  const name = text(formData.get("name"));
  const cnpj = text(formData.get("cnpj"));
  const contact = text(formData.get("contact"));
  if (!name || !cnpj) return;

  await apiFetch("/api/clients", {
    method: "POST",
    body: { name, cnpj, contact },
  });
  revalidatePath("/admin/contracts");
  revalidatePath("/admin/contracts/create");
  revalidatePath("/admin/service-orders");
}

export async function createContractAction(formData: FormData): Promise<void> {
  const clientId = text(formData.get("clientId"));
  const code = text(formData.get("code"));
  const object = text(formData.get("object"));
  const scopeNotes = text(formData.get("scopeNotes"));
  const workstation = text(formData.get("workstation"));
  const durationMonths = Number(text(formData.get("durationMonths")) || "12");
  const monthlyValue = Number(text(formData.get("monthlyValue")).replace(",", ".") || "0");

  if (!clientId || !object) return;

  await apiFetch("/api/contracts", {
    method: "POST",
    body: {
      clientId,
      code,
      object,
      scopeNotes: scopeNotes || object,
      workstation,
      durationMonths,
      monthlyValue,
    },
  });
  revalidatePath("/admin/contracts");
  redirect("/admin/contracts");
}

export async function createEmployeeAction(formData: FormData): Promise<void> {
  const name = text(formData.get("name"));
  const roleTitle = text(formData.get("roleTitle"));
  const contractId = text(formData.get("contractId"));
  const schedule = text(formData.get("schedule"));
  const status = text(formData.get("status")) || "Alocado";

  if (!name || !roleTitle) return;

  await apiFetch("/api/employees", {
    method: "POST",
    body: { name, roleTitle, contractId, schedule, status },
  });
  revalidatePath("/admin/employees");
  revalidatePath("/admin/epis");
  revalidatePath("/admin/service-orders");
}

export async function createEPIAction(formData: FormData): Promise<void> {
  const employeeId = text(formData.get("employeeId"));
  const epiName = text(formData.get("epiName"));
  const caNumber = text(formData.get("caNumber"));
  const expiresAt = text(formData.get("expiresAt"));

  if (!employeeId || !epiName || !caNumber) return;

  await apiFetch("/api/epis", {
    method: "POST",
    body: { employeeId, epiName, caNumber, expiresAt },
  });
  revalidatePath("/admin/epis");
}

export async function createInventoryItemAction(formData: FormData): Promise<void> {
  const sku = text(formData.get("sku"));
  const description = text(formData.get("description"));
  const category = text(formData.get("category")) || "Material";
  const quantity = Number(text(formData.get("quantity")) || "0");
  const unit = text(formData.get("unit")) || "un.";
  const unitValue = Number(text(formData.get("unitValue")).replace(",", ".") || "0");
  const minQuantity = Number(text(formData.get("minQuantity")) || "2");

  if (!sku || !description) return;

  await apiFetch("/api/inventory-items", {
    method: "POST",
    body: { sku, description, category, quantity, unit, unitValue, minQuantity },
  });
  revalidatePath("/admin/inventory-items");
}

export async function createInventoryMovementAction(formData: FormData): Promise<void> {
  const itemId = text(formData.get("itemId"));
  const employeeId = text(formData.get("employeeId"));
  const movementType = text(formData.get("movementType")) || "Saída";
  const quantity = Number(text(formData.get("quantity")) || "1");
  const notes = text(formData.get("notes"));

  if (!itemId || quantity <= 0) return;

  await apiFetch("/api/inventory-movements", {
    method: "POST",
    body: { itemId, employeeId, movementType, quantity, notes },
  });
  revalidatePath("/admin/inventory-items");
}

export async function createServiceOrderAction(formData: FormData): Promise<void> {
  const clientId = text(formData.get("clientId"));
  const employeeId = text(formData.get("employeeId"));
  const description = text(formData.get("description"));
  const priority = text(formData.get("priority")) || "Normal";
  const status = text(formData.get("status")) || "Agendada";

  if (!clientId || !description) return;

  await apiFetch("/api/service-orders", {
    method: "POST",
    body: { clientId, employeeId, description, priority, status },
  });
  revalidatePath("/admin/service-orders");
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

export async function createFinancialEntryAction(formData: FormData): Promise<void> {
  const contractId = text(formData.get("contractId"));
  const entryType = text(formData.get("entryType")) || "Receita";
  const description = text(formData.get("description"));
  const amount = Number(text(formData.get("amount")).replace(",", ".") || "0");
  const dueDate = text(formData.get("dueDate"));
  const status = text(formData.get("status")) || "Pendente";

  if (!description || amount <= 0) return;

  await apiFetch("/api/financial-entries", {
    method: "POST",
    body: { contractId, entryType, description, amount, dueDate, status },
  });
  revalidatePath("/admin/finance");
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
