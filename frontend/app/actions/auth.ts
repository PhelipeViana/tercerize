"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api/server";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";
import { validateCNPJ } from "@/lib/utils/cnpj";

export type AuthFormState =
  | {
      errors?: Partial<Record<"companyName" | "cnpj" | "name" | "email" | "password", string[]>>;
      message?: string;
      values?: { companyName?: string; cnpj?: string; name?: string; email?: string };
    }
  | undefined;

export type CompanyFormState =
  | {
      ok?: boolean;
      createdName?: string;
      createdCnpj?: string;
      fieldError?: { field: "name" | "cnpj"; message: string };
      message?: string;
      values?: { name?: string; cnpj?: string };
    }
  | undefined;

export type RecoverState =
  | {
      step: "request" | "verify" | "done";
      email?: string;
      previewCode?: string;
      message?: string;
      error?: string;
    }
  | undefined;

interface Entered {
  session: { token: string; expiresAt: string };
}

const OFFLINE = "O servidor não respondeu. Tente de novo em instantes.";
const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

type Values = { companyName?: string; cnpj?: string; name?: string; email?: string };
type Reply = Partial<Entered> & { errors?: NonNullable<AuthFormState>["errors"]; message?: string };

async function enter(
  path: string,
  body: Record<string, string>,
  values: Values,
  redirectTo = "/admin/contracts",
): Promise<AuthFormState> {
  let response: Response;
  let data: Reply;
  try {
    response = await apiFetch(path, { method: "POST", body });
    data = (await response.json().catch(() => ({}))) as Reply;
  } catch {
    return { message: OFFLINE, values };
  }
  if (!response.ok || !data.session) {
    return { errors: data.errors, message: data.errors ? undefined : (data.message ?? OFFLINE), values };
  }

  await setSessionCookie(data.session.token, new Date(data.session.expiresAt));
  redirect(redirectTo);
}

export async function register(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const companyName = text(formData.get("companyName")).trim();
  const rawCnpj = text(formData.get("cnpj")).trim();
  const name = text(formData.get("name")).trim();
  const email = text(formData.get("email")).trim();
  const password = text(formData.get("password"));

  const cnpjCheck = validateCNPJ(rawCnpj);
  if (!cnpjCheck.valid) {
    return {
      errors: { cnpj: [cnpjCheck.error ?? "CNPJ inválido."] },
      values: { companyName, cnpj: cnpjCheck.formatted, name, email },
    };
  }

  return enter(
    "/api/auth/register",
    { companyName, cnpj: cnpjCheck.formatted, name, email, password },
    { companyName, cnpj: cnpjCheck.formatted, name, email },
    "/admin/contracts?tab=clientes&welcome=1",
  );
}

export async function login(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = text(formData.get("email")).trim();
  return enter("/api/auth/login", { email, password: text(formData.get("password")) }, { email });
}

export async function loginDemoAction(): Promise<void> {
  let response: Response;
  let data: Reply;
  try {
    response = await apiFetch("/api/auth/login", {
      method: "POST",
      body: { email: "phelipegabriel1988@gmail.com", password: "password" },
    });
    data = (await response.json().catch(() => ({}))) as Reply;
  } catch {
    redirect("/login");
  }
  if (response.ok && data.session) {
    await setSessionCookie(data.session.token, new Date(data.session.expiresAt));
    redirect("/admin/contracts?demo=1");
  }
  redirect("/login");
}

export async function recoverPasswordAction(prevState: RecoverState, formData: FormData): Promise<RecoverState> {
  const intent = text(formData.get("intent")) || "request";
  const email = text(formData.get("email")).trim();

  if (intent === "request") {
    try {
      const res = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        email?: string;
        previewCode?: string;
        message?: string;
        errors?: { email?: string[] };
      };
      if (!res.ok || !data.ok) {
        return {
          step: "request",
          email,
          error: data.errors?.email?.[0] ?? data.message ?? "Não foi possível gerar o código de recuperação.",
        };
      }
      return {
        step: "verify",
        email: data.email ?? email,
        previewCode: data.previewCode,
        message: data.message,
      };
    } catch {
      return { step: "request", email, error: OFFLINE };
    }
  }

  const code = text(formData.get("code")).trim();
  const newPassword = text(formData.get("newPassword"));
  try {
    const res = await apiFetch("/api/auth/reset-password", {
      method: "POST",
      body: { email, code, newPassword },
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    if (!res.ok || !data.ok) {
      return {
        step: "verify",
        email,
        previewCode: prevState?.previewCode,
        error: data.message ?? "Código inválido ou falha ao redefinir a senha.",
      };
    }
    return {
      step: "done",
      email,
      message: data.message ?? "Senha redefinida com sucesso!",
    };
  } catch {
    return {
      step: "verify",
      email,
      previewCode: prevState?.previewCode,
      error: OFFLINE,
    };
  }
}

export async function logout(): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  await clearSessionCookie();
  redirect("/login");
}

export async function switchTenantAction(formData: FormData): Promise<void> {
  const tenantId = text(formData.get("tenantId"));
  if (!tenantId) return;
  await apiFetch("/api/tenants/switch", { method: "POST", body: { tenantId } });
  revalidatePath("/", "layout");
}

export async function createCompanyStateAction(
  _prevState: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const name = text(formData.get("name")).trim();
  const rawCnpj = text(formData.get("cnpj")).trim();

  if (name.length < 2) {
    return {
      fieldError: { field: "name", message: "Informe a razão social da empresa (mínimo 2 caracteres)." },
      values: { name, cnpj: rawCnpj },
    };
  }

  const cnpjCheck = validateCNPJ(rawCnpj);
  if (!cnpjCheck.valid) {
    return {
      fieldError: { field: "cnpj", message: cnpjCheck.error ?? "CNPJ inválido." },
      values: { name, cnpj: cnpjCheck.formatted },
    };
  }

  try {
    const res = await apiFetch("/api/tenants", {
      method: "POST",
      body: { name, cnpj: cnpjCheck.formatted },
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      name?: string;
      cnpj?: string;
      field?: "name" | "cnpj";
      message?: string;
    };
    if (!res.ok) {
      if (data.field) {
        return {
          fieldError: { field: data.field, message: data.message ?? "Verifique o campo informado." },
          values: { name, cnpj: cnpjCheck.formatted },
        };
      }
      return {
        message: data.message ?? "Não foi possível cadastrar a empresa.",
        values: { name, cnpj: cnpjCheck.formatted },
      };
    }

    if (data.id) {
      await apiFetch("/api/tenants/switch", { method: "POST", body: { tenantId: data.id } });
    }
    revalidatePath("/", "layout");
    return {
      ok: true,
      createdName: data.name ?? name,
      createdCnpj: data.cnpj ?? cnpjCheck.formatted,
    };
  } catch {
    return { message: OFFLINE, values: { name, cnpj: cnpjCheck.formatted } };
  }
}

export async function createCompanyAction(formData: FormData): Promise<void> {
  await createCompanyStateAction(undefined, formData);
}
