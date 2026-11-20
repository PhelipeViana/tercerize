"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api/server";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";
import { validateCNPJ } from "@/lib/utils/cnpj";

export type LoginStepState =
  | {
      step: "email" | "code";
      email?: string;
      userName?: string;
      isMaster?: boolean;
      errors?: Partial<Record<"email" | "code", string[]>>;
      message?: string;
    }
  | undefined;

export type RecoveryStepState =
  | {
      step: "email" | "confirm" | "sent";
      email?: string;
      userName?: string;
      isMaster?: boolean;
      requiresCnpj?: boolean;
      cnpj?: string;
      companyName?: string;
      errors?: Partial<Record<"email" | "cnpj", string[]>>;
      message?: string;
      successMessage?: string;
    }
  | undefined;

export type ActivateAuthState =
  | {
      error?: string;
    }
  | undefined;

export type CompanyFormState =
  | {
      ok?: boolean;
      createdName?: string;
      createdCnpj?: string;
      ownerName?: string;
      ownerEmail?: string;
      emailSent?: boolean;
      emailWarning?: string;
      fieldError?: { field: "name" | "cnpj" | "ownerName" | "ownerEmail"; message: string };
      message?: string;
      values?: { name?: string; cnpj?: string; ownerName?: string; ownerEmail?: string };
    }
  | undefined;

export type CompanyEditState =
  | {
      ok?: boolean;
      updatedId?: string;
      updatedName?: string;
      emailSent?: boolean;
      emailWarning?: string;
      fieldError?: { field: "name" | "cnpj" | "ownerName" | "ownerEmail"; message: string };
      message?: string;
    }
  | undefined;

export type RBACActionState =
  | {
      ok?: boolean;
      message?: string;
      warning?: string;
      error?: string;
    }
  | undefined;

interface Entered {
  session: { token: string; expiresAt: string };
}

const OFFLINE = "O servidor não respondeu. Tente de novo em instantes.";
const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

// Login em 2 etapas: Etapa 1 valida o e-mail; Etapa 2 valida o código do Google Authenticator
export async function loginTwoStepAction(
  prevState: LoginStepState,
  formData: FormData,
): Promise<LoginStepState> {
  const intent = text(formData.get("intent")) || "check-email";
  const email = text(formData.get("email")).trim();

  if (intent === "reset") {
    return { step: "email", email: "" };
  }

  if (intent === "check-email") {
    let response: Response;
    let data: {
      ok?: boolean;
      email?: string;
      name?: string;
      isMaster?: boolean;
      errors?: Partial<Record<"email" | "code", string[]>>;
      message?: string;
    };
    try {
      response = await apiFetch("/api/auth/check-email", { method: "POST", body: { email } });
      data = (await response.json().catch(() => ({}))) as typeof data;
    } catch {
      return { step: "email", email, message: OFFLINE };
    }

    if (!response.ok || !data.ok) {
      return {
        step: "email",
        email,
        errors: data.errors,
        message: data.errors ? undefined : (data.message ?? OFFLINE),
      };
    }

    return {
      step: "code",
      email: data.email ?? email,
      userName: data.name,
      isMaster: data.isMaster,
    };
  }

  // Etapa 2: validar código TOTP do Google Authenticator
  const code = text(formData.get("code")).trim();
  const confirmedEmail = email || prevState?.email || "";
  let response: Response;
  let data: Partial<Entered> & {
    errors?: Partial<Record<"email" | "code", string[]>>;
    message?: string;
  };
  try {
    response = await apiFetch("/api/auth/login", {
      method: "POST",
      body: { email: confirmedEmail, code },
    });
    data = (await response.json().catch(() => ({}))) as typeof data;
  } catch {
    return {
      step: "code",
      email: confirmedEmail,
      userName: prevState?.userName,
      isMaster: prevState?.isMaster,
      message: OFFLINE,
    };
  }

  if (!response.ok || !data.session) {
    return {
      step: "code",
      email: confirmedEmail,
      userName: prevState?.userName,
      isMaster: prevState?.isMaster,
      errors: data.errors,
      message: data.errors ? undefined : (data.message ?? OFFLINE),
    };
  }

  await setSessionCookie(data.session.token, new Date(data.session.expiresAt));
  redirect("/admin/contracts");
}

// Recuperação de Autenticação em 2 etapas:
// Etapa 1 valida e-mail (e se não está bloqueado);
// Etapa 2 envia o link (exigindo CNPJ de qualquer empresa vinculada quando o e-mail não for Master)
export async function recoverAuthenticatorStepAction(
  prevState: RecoveryStepState,
  formData: FormData,
): Promise<RecoveryStepState> {
  const intent = text(formData.get("intent")) || "check-email";
  const email = text(formData.get("email")).trim();

  if (intent === "reset") {
    return { step: "email", email: "" };
  }

  if (intent === "check-email") {
    let response: Response;
    let data: {
      ok?: boolean;
      email?: string;
      name?: string;
      isMaster?: boolean;
      requiresCnpj?: boolean;
      errors?: Partial<Record<"email" | "cnpj", string[]>>;
      message?: string;
    };
    try {
      response = await apiFetch("/api/auth/recovery/check-email", {
        method: "POST",
        body: { email },
      });
      data = (await response.json().catch(() => ({}))) as typeof data;
    } catch {
      return { step: "email", email, message: OFFLINE };
    }

    if (!response.ok || !data.ok) {
      return {
        step: "email",
        email,
        errors: data.errors,
        message: data.errors ? undefined : (data.message ?? OFFLINE),
      };
    }

    return {
      step: "confirm",
      email: data.email ?? email,
      userName: data.name,
      isMaster: Boolean(data.isMaster),
      requiresCnpj: Boolean(data.requiresCnpj),
    };
  }

  // Etapa 2: Validar CNPJ (se não-Master) e enviar link de recuperação por e-mail
  const confirmedEmail = email || prevState?.email || "";
  const rawCnpj = text(formData.get("cnpj")).trim();
  const requiresCnpj = Boolean(prevState?.requiresCnpj);

  let cnpjToSend = "";
  if (requiresCnpj) {
    const cnpjCheck = validateCNPJ(rawCnpj);
    if (!cnpjCheck.valid) {
      return {
        step: "confirm",
        email: confirmedEmail,
        userName: prevState?.userName,
        isMaster: prevState?.isMaster,
        requiresCnpj: true,
        cnpj: cnpjCheck.formatted,
        errors: { cnpj: [cnpjCheck.error ?? "Informe um CNPJ válido."] },
      };
    }
    cnpjToSend = cnpjCheck.formatted;
  }

  let response: Response;
  let data: {
    ok?: boolean;
    email?: string;
    companyName?: string;
    message?: string;
    errors?: Partial<Record<"email" | "cnpj", string[]>>;
  };
  try {
    response = await apiFetch("/api/auth/recovery/send-link", {
      method: "POST",
      body: { email: confirmedEmail, cnpj: cnpjToSend },
    });
    data = (await response.json().catch(() => ({}))) as typeof data;
  } catch {
    return {
      step: "confirm",
      email: confirmedEmail,
      userName: prevState?.userName,
      isMaster: prevState?.isMaster,
      requiresCnpj,
      cnpj: rawCnpj,
      message: OFFLINE,
    };
  }

  if (!response.ok || !data.ok) {
    return {
      step: "confirm",
      email: confirmedEmail,
      userName: prevState?.userName,
      isMaster: prevState?.isMaster,
      requiresCnpj,
      cnpj: cnpjToSend || rawCnpj,
      errors: data.errors,
      message: data.errors ? undefined : (data.message ?? OFFLINE),
    };
  }

  return {
    step: "sent",
    email: data.email ?? confirmedEmail,
    userName: prevState?.userName,
    companyName: data.companyName,
    successMessage:
      data.message ??
      `Link de recuperação do Google Authenticator enviado para ${confirmedEmail}.`,
  };
}

export async function completeSetupLinkAction(
  _state: ActivateAuthState,
  formData: FormData,
): Promise<ActivateAuthState> {
  const token = text(formData.get("token")).trim();
  const code = text(formData.get("code")).trim();
  if (!token || code.replace(/\D/g, "").length !== 6) {
    return { error: "Informe o código de 6 dígitos gerado pelo Google Authenticator." };
  }

  let response: Response;
  let data: Partial<Entered> & { message?: string };
  try {
    response = await apiFetch("/api/auth/setup-link/verify", {
      method: "POST",
      body: { token, code },
    });
    data = (await response.json().catch(() => ({}))) as typeof data;
  } catch {
    return { error: OFFLINE };
  }
  if (!response.ok || !data.session) {
    return { error: data.message ?? "Código do Google Authenticator inválido." };
  }

  await setSessionCookie(data.session.token, new Date(data.session.expiresAt));
  redirect("/admin/contracts");
}

export async function logout(): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  await clearSessionCookie();
  redirect("/login");
}

export async function switchTenantAction(formData: FormData): Promise<void> {
  const tenantId = text(formData.get("tenantId")).trim();
  if (!tenantId) return;
  const isMasterContext = tenantId.toUpperCase() === "MASTER";
  await apiFetch("/api/tenants/switch", {
    method: "POST",
    body: { tenantId: isMasterContext ? "MASTER" : tenantId },
  });
  revalidatePath("/", "layout");
  if (isMasterContext) {
    redirect("/admin/companies");
  }
  redirect("/admin/contracts");
}

export async function createCompanyStateAction(
  _prevState: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const name = text(formData.get("name")).trim();
  const rawCnpj = text(formData.get("cnpj")).trim();
  const ownerName = text(formData.get("ownerName")).trim();
  const ownerEmail = text(formData.get("ownerEmail")).trim();

  const values = { name, cnpj: rawCnpj, ownerName, ownerEmail };

  if (name.length < 2) {
    return {
      fieldError: { field: "name", message: "Informe a razão social da empresa (mínimo 2 caracteres)." },
      values,
    };
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

  if (!ownerEmail.includes("@")) {
    return {
      fieldError: { field: "ownerEmail", message: "Informe um e-mail válido para o responsável." },
      values: { ...values, cnpj: cnpjCheck.formatted },
    };
  }

  try {
    const res = await apiFetch("/api/tenants", {
      method: "POST",
      body: { name, cnpj: cnpjCheck.formatted, ownerName, ownerEmail },
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
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
      return {
        message: data.message ?? "Não foi possível cadastrar a empresa.",
        values: { ...values, cnpj: cnpjCheck.formatted },
      };
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

export async function addMemberStateAction(
  _prev: RBACActionState,
  formData: FormData,
): Promise<RBACActionState> {
  const name = text(formData.get("name")).trim();
  const email = text(formData.get("email")).trim();
  const roleId = text(formData.get("roleId")).trim();
  if (!name || !email || !roleId) {
    return { error: "Preencha nome, e-mail e selecione uma função (Role)." };
  }
  try {
    const res = await apiFetch("/api/rbac/members", {
      method: "POST",
      body: { name, email, roleId },
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      email?: string;
      roleName?: string;
      emailSent?: boolean;
      emailWarning?: string;
      message?: string;
    };
    if (!res.ok) {
      return { error: data.message ?? "Não foi possível conceder o acesso." };
    }
    revalidatePath("/admin/permissions");
    return {
      ok: true,
      message: data.emailSent
        ? `Acesso (${data.roleName}) concedido para ${data.email} e link do Google Authenticator enviado por e-mail!`
        : `Acesso (${data.roleName}) concedido para ${data.email}.`,
      warning: data.emailWarning || undefined,
    };
  } catch {
    return { error: OFFLINE };
  }
}

export async function updateMemberRoleAction(formData: FormData): Promise<void> {
  const membershipId = text(formData.get("membershipId")).trim();
  const roleId = text(formData.get("roleId")).trim();
  if (!membershipId || !roleId) return;
  await apiFetch("/api/rbac/members/role", { method: "POST", body: { membershipId, roleId } });
  revalidatePath("/admin/permissions");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const membershipId = text(formData.get("membershipId")).trim();
  if (!membershipId) return;
  await apiFetch("/api/rbac/members/remove", { method: "POST", body: { membershipId } });
  revalidatePath("/admin/permissions");
}

export async function resendMemberLinkAction(
  _prev: RBACActionState,
  formData: FormData,
): Promise<RBACActionState> {
  const userId = text(formData.get("userId")).trim();
  if (!userId) return { error: "Usuário inválido." };
  try {
    const res = await apiFetch("/api/rbac/members/resend-link", {
      method: "POST",
      body: { userId },
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    if (!res.ok) return { error: data.message ?? "Falha ao reenviar e-mail." };
    return { ok: true, message: data.message };
  } catch {
    return { error: OFFLINE };
  }
}

const PERMISSION_KEYS = [
  "contracts:view",
  "contracts:write",
  "service_orders:view",
  "service_orders:write",
  "employees:view",
  "employees:write",
  "epis:view",
  "epis:write",
  "inventory:view",
  "inventory:write",
  "finance:view",
  "finance:write",
];

export async function saveRoleStateAction(
  _prev: RBACActionState,
  formData: FormData,
): Promise<RBACActionState> {
  const id = text(formData.get("id")).trim();
  const name = text(formData.get("name")).trim();
  const description = text(formData.get("description")).trim();
  const permissions: Record<string, boolean> = {};
  for (const k of PERMISSION_KEYS) {
    permissions[k] = formData.get(`perm_${k}`) === "on";
  }

  if (name.length < 2) {
    return { error: "Informe o nome da função (mínimo 2 caracteres)." };
  }

  try {
    const res = await apiFetch("/api/rbac/roles", {
      method: "POST",
      body: { id, name, description, permissions },
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) return { error: data.message ?? "Erro ao salvar função." };
    revalidatePath("/admin/permissions");
    return {
      ok: true,
      message: id ? `Função "${name}" atualizada com sucesso.` : `Nova função "${name}" criada com sucesso.`,
    };
  } catch {
    return { error: OFFLINE };
  }
}

export async function deleteRoleAction(formData: FormData): Promise<void> {
  const id = text(formData.get("id")).trim();
  if (!id) return;
  await apiFetch("/api/rbac/roles/delete", { method: "POST", body: { id } });
  revalidatePath("/admin/permissions");
}

export async function updateCompanyStateAction(
  _prevState: CompanyEditState,
  formData: FormData,
): Promise<CompanyEditState> {
  const tenantId = text(formData.get("tenantId")).trim();
  const name = text(formData.get("name")).trim();
  const rawCnpj = text(formData.get("cnpj")).trim();
  const ownerName = text(formData.get("ownerName")).trim();
  const ownerEmail = text(formData.get("ownerEmail")).trim();
  const active = text(formData.get("active")) !== "false";
  const resendLink = formData.get("resendLink") === "on";

  if (!tenantId) {
    return { message: "Empresa inválida." };
  }
  if (name.length < 2) {
    return {
      fieldError: { field: "name", message: "Informe a razão social da empresa (mínimo 2 caracteres)." },
    };
  }
  const cnpjCheck = validateCNPJ(rawCnpj);
  if (!cnpjCheck.valid) {
    return {
      fieldError: { field: "cnpj", message: cnpjCheck.error ?? "CNPJ inválido." },
    };
  }
  if (ownerName.length < 2) {
    return {
      fieldError: { field: "ownerName", message: "Informe o nome do responsável (dono da empresa)." },
    };
  }
  if (!ownerEmail.includes("@")) {
    return {
      fieldError: { field: "ownerEmail", message: "Informe um e-mail válido para o responsável." },
    };
  }

  try {
    const res = await apiFetch("/api/tenants/update", {
      method: "POST",
      body: {
        tenantId,
        name,
        cnpj: cnpjCheck.formatted,
        ownerName,
        ownerEmail,
        active,
        resendLink,
      },
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      id?: string;
      name?: string;
      emailSent?: boolean;
      emailWarning?: string;
      field?: "name" | "cnpj" | "ownerName" | "ownerEmail";
      message?: string;
    };
    if (!res.ok) {
      if (data.field) {
        return { fieldError: { field: data.field, message: data.message ?? "Verifique o campo informado." } };
      }
      return { message: data.message ?? "Não foi possível salvar as alterações da empresa." };
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

export async function toggleTenantActiveAction(formData: FormData): Promise<void> {
  const tenantId = text(formData.get("tenantId")).trim();
  if (!tenantId) return;
  await apiFetch("/api/tenants/toggle-active", { method: "POST", body: { tenantId } });
  revalidatePath("/", "layout");
}

export async function resendCompanyOwnerLinkAction(
  _prev: RBACActionState,
  formData: FormData,
): Promise<RBACActionState> {
  const tenantId = text(formData.get("tenantId")).trim();
  if (!tenantId) return { error: "Empresa inválida." };
  try {
    const res = await apiFetch("/api/tenants/resend-owner-link", {
      method: "POST",
      body: { tenantId },
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    if (!res.ok) return { error: data.message ?? "Não foi possível reenviar o link de acesso." };
    revalidatePath("/admin/companies");
    return { ok: true, message: data.message ?? "Link de ativação enviado com sucesso." };
  } catch {
    return { error: OFFLINE };
  }
}

export async function toggleUserBlockAction(formData: FormData): Promise<void> {
  const userId = text(formData.get("userId")).trim();
  if (!userId) return;
  await apiFetch("/api/rbac/members/block", { method: "POST", body: { userId } });
  revalidatePath("/admin/permissions");
}
