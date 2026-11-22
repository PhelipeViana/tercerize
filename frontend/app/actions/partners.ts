"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api/server";
import { validateCNPJ } from "@/lib/utils/cnpj";
import { validateEmail } from "@/lib/utils/masks";
import type { CompanyEditState, CompanyFormState, RBACActionState } from "./auth";

const OFFLINE = "Servidor indisponível no momento.";
const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

const PARTNER_FEATURE_KEYS = [
  "companies:create",
  "companies:edit",
  "companies:toggle_active",
  "companies:impersonate",
  "companies:ai_token",
  "analytics:portfolio",
] as const;

function readPartnerFeatures(formData: FormData): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of PARTNER_FEATURE_KEYS) {
    out[key] = formData.get(`feat_${key}`) === "on";
  }
  return out;
}

// ---------- AÇÕES EXCLUSIVAS ADMIN MASTER (/api/partners/*) ----------

export async function createPartnerCompanyStateAction(
  _prev: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const name = text(formData.get("name"));
  const rawCnpj = text(formData.get("cnpj"));
  const ownerName = text(formData.get("ownerName"));
  const ownerEmail = text(formData.get("ownerEmail"));
  const openrouterToken = text(formData.get("openrouterToken"));
  const aiPlanKey = text(formData.get("aiPlanKey")) || "free";
  const partnerMaxCompanies = Math.max(0, Number(text(formData.get("partnerMaxCompanies")) || "0") || 0);
  const partnerNotes = text(formData.get("partnerNotes"));
  const partnerFeatures = readPartnerFeatures(formData);

  const values = { name, cnpj: rawCnpj, ownerName, ownerEmail };

  if (name.length < 2) {
    return { fieldError: { field: "name", message: "Informe a razão social da empresa parceira." }, values };
  }
  const cnpjCheck = validateCNPJ(rawCnpj);
  if (!cnpjCheck.valid) {
    return {
      fieldError: { field: "cnpj", message: cnpjCheck.error ?? "CNPJ inválido." },
      values: { ...values, cnpj: cnpjCheck.formatted },
    };
  }
  if (ownerName.length < 2) {
    return {
      fieldError: { field: "ownerName", message: "Informe o nome do dono parceiro." },
      values: { ...values, cnpj: cnpjCheck.formatted },
    };
  }
  const emailCheck = validateEmail(ownerEmail);
  if (!emailCheck.valid) {
    return {
      fieldError: { field: "ownerEmail", message: emailCheck.error ?? "E-mail inválido." },
      values: { ...values, cnpj: cnpjCheck.formatted },
    };
  }

  try {
    const res = await apiFetch("/api/partners", {
      method: "POST",
      body: {
        name,
        cnpj: cnpjCheck.formatted,
        ownerName,
        ownerEmail,
        openrouterToken,
        aiPlanKey,
        partnerMaxCompanies,
        partnerNotes,
        partnerFeatures,
      },
    });
    const data = (await res.json().catch(() => ({}))) as {
      name?: string;
      cnpj?: string;
      ownerName?: string;
      ownerEmail?: string;
      emailSent?: boolean;
      emailWarning?: string;
      field?: "name" | "cnpj" | "ownerName" | "ownerEmail";
      message?: string;
    };
    if (!res.ok) {
      if (data.field) {
        return {
          fieldError: { field: data.field, message: data.message ?? "Verifique o campo informado." },
          values: { ...values, cnpj: cnpjCheck.formatted },
        };
      }
      return { message: data.message ?? "Não foi possível cadastrar o parceiro.", values: { ...values, cnpj: cnpjCheck.formatted } };
    }
    revalidatePath("/", "layout");
    return {
      ok: true,
      createdName: data.name ?? name,
      createdCnpj: data.cnpj ?? cnpjCheck.formatted,
      ownerName: data.ownerName ?? ownerName,
      ownerEmail: data.ownerEmail ?? ownerEmail,
      emailSent: data.emailSent,
      emailWarning: data.emailWarning,
    };
  } catch {
    return { message: OFFLINE, values: { ...values, cnpj: cnpjCheck.formatted } };
  }
}

export type PartnerConfigState = { ok?: boolean; message?: string; error?: string } | undefined;

export async function promoteOrUpdatePartnerStateAction(
  _prev: PartnerConfigState,
  formData: FormData,
): Promise<PartnerConfigState> {
  const tenantId = text(formData.get("tenantId"));
  const mode = text(formData.get("mode")) || "promote";
  const partnerMaxCompanies = Math.max(0, Number(text(formData.get("partnerMaxCompanies")) || "0") || 0);
  const partnerNotes = text(formData.get("partnerNotes"));
  const partnerFeatures = readPartnerFeatures(formData);

  if (!tenantId) {
    return { error: "Selecione uma empresa válida." };
  }

  try {
    const res = await apiFetch(mode === "update" ? "/api/partners/update" : "/api/partners/promote", {
      method: "POST",
      body: { tenantId, partnerMaxCompanies, partnerNotes, partnerFeatures },
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; name?: string; message?: string };
    if (!res.ok) {
      return { error: data.message ?? "Não foi possível salvar a configuração de parceiro." };
    }
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        mode === "update"
          ? `Recursos e cota da parceira ${data.name ?? ""} atualizados com sucesso.`
          : `Empresa ${data.name ?? ""} promovida ao ambiente Parceiros com sucesso.`,
    };
  } catch {
    return { error: OFFLINE };
  }
}

export async function revokePartnerAction(formData: FormData): Promise<void> {
  const tenantId = text(formData.get("tenantId"));
  if (!tenantId) return;
  await apiFetch("/api/partners/revoke", { method: "POST", body: { tenantId } });
  revalidatePath("/", "layout");
}

// ---------- AÇÕES DO AMBIENTE PARCEIROS (/api/partner/*) ----------

export async function partnerCreateCompanyStateAction(
  _prev: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const name = text(formData.get("name"));
  const rawCnpj = text(formData.get("cnpj"));
  const ownerName = text(formData.get("ownerName"));
  const ownerEmail = text(formData.get("ownerEmail"));
  const openrouterToken = text(formData.get("openrouterToken"));

  const values = { name, cnpj: rawCnpj, ownerName, ownerEmail };

  if (name.length < 2) {
    return { fieldError: { field: "name", message: "Informe a razão social da empresa (mínimo 2 caracteres)." }, values };
  }
  const cnpjCheck = validateCNPJ(rawCnpj);
  if (!cnpjCheck.valid) {
    return {
      fieldError: { field: "cnpj", message: cnpjCheck.error ?? "CNPJ inválido." },
      values: { ...values, cnpj: cnpjCheck.formatted },
    };
  }
  if (ownerName.length < 2) {
    return {
      fieldError: { field: "ownerName", message: "Informe o nome do responsável (dono da empresa)." },
      values: { ...values, cnpj: cnpjCheck.formatted },
    };
  }
  const emailCheck = validateEmail(ownerEmail);
  if (!emailCheck.valid) {
    return {
      fieldError: { field: "ownerEmail", message: emailCheck.error ?? "Informe um e-mail válido." },
      values: { ...values, cnpj: cnpjCheck.formatted },
    };
  }

  try {
    const res = await apiFetch("/api/partner/companies", {
      method: "POST",
      body: { name, cnpj: cnpjCheck.formatted, ownerName, ownerEmail, openrouterToken },
    });
    const data = (await res.json().catch(() => ({}))) as {
      name?: string;
      cnpj?: string;
      ownerName?: string;
      ownerEmail?: string;
      emailSent?: boolean;
      emailWarning?: string;
      field?: "name" | "cnpj" | "ownerName" | "ownerEmail";
      message?: string;
    };
    if (!res.ok) {
      if (data.field) {
        return {
          fieldError: { field: data.field, message: data.message ?? "Verifique o campo informado." },
          values: { ...values, cnpj: cnpjCheck.formatted },
        };
      }
      return { message: data.message ?? "Não foi possível cadastrar a empresa.", values: { ...values, cnpj: cnpjCheck.formatted } };
    }
    revalidatePath("/", "layout");
    return {
      ok: true,
      createdName: data.name ?? name,
      createdCnpj: data.cnpj ?? cnpjCheck.formatted,
      ownerName: data.ownerName ?? ownerName,
      ownerEmail: data.ownerEmail ?? ownerEmail,
      emailSent: data.emailSent,
      emailWarning: data.emailWarning,
    };
  } catch {
    return { message: OFFLINE, values: { ...values, cnpj: cnpjCheck.formatted } };
  }
}

export async function partnerUpdateCompanyStateAction(
  _prev: CompanyEditState,
  formData: FormData,
): Promise<CompanyEditState> {
  const tenantId = text(formData.get("tenantId"));
  const name = text(formData.get("name"));
  const rawCnpj = text(formData.get("cnpj"));
  const ownerName = text(formData.get("ownerName"));
  const ownerEmail = text(formData.get("ownerEmail"));
  const active = text(formData.get("active")) !== "false";
  const resendLink = formData.get("resendLink") === "on";
  const openrouterToken = text(formData.get("openrouterToken"));
  const clearOpenrouterToken = formData.get("clearOpenrouterToken") === "on";

  if (!tenantId) return { message: "Empresa inválida." };
  if (name.length < 2) return { fieldError: { field: "name", message: "Informe a razão social da empresa." } };
  const cnpjCheck = validateCNPJ(rawCnpj);
  if (!cnpjCheck.valid) return { fieldError: { field: "cnpj", message: cnpjCheck.error ?? "CNPJ inválido." } };
  if (ownerName.length < 2) return { fieldError: { field: "ownerName", message: "Informe o nome do responsável." } };
  const emailCheck = validateEmail(ownerEmail);
  if (!emailCheck.valid) return { fieldError: { field: "ownerEmail", message: emailCheck.error ?? "E-mail inválido." } };

  try {
    const res = await apiFetch("/api/partner/companies/update", {
      method: "POST",
      body: {
        tenantId,
        name,
        cnpj: cnpjCheck.formatted,
        ownerName,
        ownerEmail,
        active,
        resendLink,
        openrouterToken,
        clearOpenrouterToken,
      },
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      name?: string;
      emailSent?: boolean;
      emailWarning?: string;
      field?: "name" | "cnpj" | "ownerName" | "ownerEmail";
      message?: string;
    };
    if (!res.ok) {
      if (data.field) return { fieldError: { field: data.field, message: data.message ?? "Campo inválido." } };
      return { message: data.message ?? "Não foi possível salvar as alterações." };
    }
    revalidatePath("/", "layout");
    return {
      ok: true,
      updatedId: data.id ?? tenantId,
      updatedName: data.name ?? name,
      emailSent: data.emailSent,
      emailWarning: data.emailWarning,
    };
  } catch {
    return { message: OFFLINE };
  }
}

export async function partnerToggleCompanyActiveAction(formData: FormData): Promise<void> {
  const tenantId = text(formData.get("tenantId"));
  if (!tenantId) return;
  await apiFetch("/api/partner/companies/toggle-active", { method: "POST", body: { tenantId } });
  revalidatePath("/", "layout");
}

export async function partnerResendCompanyOwnerLinkAction(
  _prev: RBACActionState,
  formData: FormData,
): Promise<RBACActionState> {
  const tenantId = text(formData.get("tenantId"));
  if (!tenantId) return { error: "Empresa inválida." };
  try {
    const res = await apiFetch("/api/partner/companies/resend-owner-link", {
      method: "POST",
      body: { tenantId },
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) return { error: data.message ?? "Não foi possível reenviar o link." };
    revalidatePath("/partner/companies");
    return { ok: true, message: data.message ?? "Link do Google Authenticator reenviado com sucesso." };
  } catch {
    return { error: OFFLINE };
  }
}
