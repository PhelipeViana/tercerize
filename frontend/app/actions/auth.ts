"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api/server";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";

export type AuthFormState =
  | {
      errors?: Partial<Record<"companyName" | "cnpj" | "name" | "email" | "password", string[]>>;
      message?: string;
      values?: { companyName?: string; cnpj?: string; name?: string; email?: string };
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

async function enter(path: string, body: Record<string, string>, values: Values): Promise<AuthFormState> {
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
  redirect("/admin/contracts");
}

export async function register(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const companyName = text(formData.get("companyName"));
  const cnpj = text(formData.get("cnpj"));
  const name = text(formData.get("name"));
  const email = text(formData.get("email"));
  return enter(
    "/api/auth/register",
    { companyName, cnpj, name, email, password: text(formData.get("password")) },
    { companyName, cnpj, name, email },
  );
}

export async function login(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = text(formData.get("email"));
  return enter("/api/auth/login", { email, password: text(formData.get("password")) }, { email });
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

export async function createCompanyAction(formData: FormData): Promise<void> {
  const name = text(formData.get("name"));
  const cnpj = text(formData.get("cnpj"));
  if (!name || !cnpj) return;
  const res = await apiFetch("/api/tenants", { method: "POST", body: { name, cnpj } });
  if (res.ok) {
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    if (data.id) {
      await apiFetch("/api/tenants/switch", { method: "POST", body: { tenantId: data.id } });
    }
  }
  revalidatePath("/", "layout");
}
