"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api/server";
import type { AIPlanKey } from "@/lib/auth/repository";

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value.trim() : "");

export type AIPlanActionState =
  | {
    ok?: boolean;
    planKey?: AIPlanKey;
    message?: string;
    error?: string;
  }
  | undefined;

export async function updateAIPlanStateAction(
  _prev: AIPlanActionState,
  formData: FormData,
): Promise<AIPlanActionState> {
  const key = text(formData.get("key")) as AIPlanKey;
  const rawModels = text(formData.get("models"));
  const timeoutSeconds = Number(text(formData.get("timeoutSeconds")) || "15");
  const cooldownSeconds = Number(text(formData.get("cooldownSeconds")) || "180");
  const maxTokens = Number(text(formData.get("maxTokens")) || "2400");
  const rateLimitPerHour = Number(text(formData.get("rateLimitPerHour")) || "30");
  const clearCooldowns = formData.get("clearCooldowns") === "on";

  const models = rawModels
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (models.length === 0) {
    return { error: "Informe pelo menos um modelo OpenRouter (um por linha)." };
  }

  try {
    const res = await apiFetch("/api/ai/plans", {
      method: "POST",
      body: {
        key,
        models,
        timeoutSeconds,
        cooldownSeconds,
        maxTokens,
        rateLimitPerHour,
        clearCooldowns,
      },
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      return { error: data.message ?? "Não foi possível salvar a configuração do plano." };
    }
    revalidatePath("/admin/companies");
    revalidatePath("/admin/assistant");
    const planLabel = key === "premium" ? "Premium" : key === "standard" ? "Padrão" : "Free";
    return {
      ok: true,
      planKey: key,
      message: `Plano ${planLabel} atualizado (${models.length} modelo(s), timeout ${timeoutSeconds}s, ${rateLimitPerHour} msgs/hora).`,
    };
  } catch {
    return { error: "Servidor indisponível no momento." };
  }
}

export interface AIChatReplyResult {
  ok: boolean;
  conversationId?: string;
  planKey?: AIPlanKey;
  planName?: string;
  downgradedFromPlan?: string;
  creditNotice?: string;
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
      planKey?: AIPlanKey;
      planName?: string;
      downgradedFromPlan?: string;
      creditNotice?: string;
      message?: unknown;
      error?: string;
    };

    if (!res.ok) {
      const errText =
        typeof data.message === "string"
          ? data.message
          : data.error ?? "Não foi possível obter resposta do Assistente IA.";
      return { ok: false, error: errText };
    }

    revalidatePath("/admin/assistant");
    if (data.downgradedFromPlan) {
      revalidatePath("/admin/companies");
    }
    return {
      ok: true,
      conversationId: data.conversationId,
      planKey: data.planKey,
      planName: data.planName,
      downgradedFromPlan: data.downgradedFromPlan,
      creditNotice: data.creditNotice,
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
