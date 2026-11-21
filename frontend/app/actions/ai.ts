"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api/server";

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value.trim() : "");

export type AISettingsActionState =
  | {
      ok?: boolean;
      message?: string;
      error?: string;
    }
  | undefined;

export async function updateAISettingsStateAction(
  _prev: AISettingsActionState,
  formData: FormData,
): Promise<AISettingsActionState> {
  const rawModels = text(formData.get("models"));
  const timeoutSeconds = Number(text(formData.get("timeoutSeconds")) || "12");
  const cooldownSeconds = Number(text(formData.get("cooldownSeconds")) || "180");
  const clearCooldowns = formData.get("clearCooldowns") === "on";

  const models = rawModels
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (models.length === 0) {
    return { error: "Informe pelo menos um modelo OpenRouter (um por linha)." };
  }

  try {
    const res = await apiFetch("/api/ai/settings", {
      method: "POST",
      body: { models, timeoutSeconds, cooldownSeconds, clearCooldowns },
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      return { error: data.message ?? "Não foi possível salvar a configuração de modelos." };
    }
    revalidatePath("/admin/companies");
    return {
      ok: true,
      message: `Cadeia de modelos atualizada (${models.length} modelo(s), timeout de ${timeoutSeconds}s).`,
    };
  } catch {
    return { error: "Servidor indisponível no momento." };
  }
}

export interface AIChatReplyResult {
  ok: boolean;
  conversationId?: string;
  message?: {
    id: string;
    role: "assistant";
    content: string;
    createdAt: string;
  };
  error?: string;
}

export async function sendAIChatAction(input: {
  conversationId?: string;
  message: string;
}): Promise<AIChatReplyResult> {
  const message = input.message.trim();
  if (message.length < 2) {
    return { ok: false, error: "Digite uma pergunta ou o relatório desejado." };
  }

  try {
    const res = await apiFetch("/api/ai/chat", {
      method: "POST",
      timeoutMs: 85_000,
      body: {
        conversationId: input.conversationId ?? "",
        message,
      },
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      conversationId?: string;
      message?: {
        id: string;
        role: "assistant";
        content: string;
        createdAt: string;
      };
      messageError?: string;
      error?: string;
    } & { message?: unknown };

    if (!res.ok) {
      const errText =
        typeof data.message === "string"
          ? data.message
          : data.error ?? "Não foi possível obter resposta do Assistente IA.";
      return { ok: false, error: errText };
    }

    revalidatePath("/admin/assistant");
    return {
      ok: true,
      conversationId: data.conversationId,
      message: data.message as AIChatReplyResult["message"],
    };
  } catch {
    return { ok: false, error: "Tempo limite excedido ou servidor indisponível. Tente novamente." };
  }
}

export async function deleteAIConversationAction(formData: FormData): Promise<void> {
  const id = text(formData.get("id"));
  if (!id) return;
  await apiFetch("/api/ai/conversations/delete", {
    method: "POST",
    body: { id },
  });
  revalidatePath("/admin/assistant");
}
