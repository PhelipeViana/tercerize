"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api/server";
import type { AICitation, AIQualityTier, AIQuickReply } from "@/lib/ai/repository";

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value.trim() : "");

export interface AIOpsActionResult {
  ok: boolean;
  message?: string;
  error?: string;
}

export async function reindexTenantKnowledgeAction(tenantId: string): Promise<AIOpsActionResult> {
  if (!tenantId.trim()) {
    return { ok: false, error: "Empresa inválida." };
  }
  try {
    const res = await apiFetch("/api/ai/knowledge/reindex", {
      method: "POST",
      body: { tenantId: tenantId.trim() },
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      return { ok: false, error: data.message ?? "Não foi possível reindexar esta empresa." };
    }
    revalidatePath("/admin/companies");
    return { ok: true, message: data.message ?? "Reindexação enfileirada com sucesso." };
  } catch {
    return { ok: false, error: "Servidor indisponível no momento." };
  }
}

export async function clearAICooldownsAction(): Promise<AIOpsActionResult> {
  try {
    const res = await apiFetch("/api/ai/cooldowns/clear", {
      method: "POST",
      body: {},
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      return { ok: false, error: data.message ?? "Não foi possível limpar cooldowns." };
    }
    revalidatePath("/admin/companies");
    return { ok: true, message: "Cooldowns temporários de modelos limpos no Redis." };
  } catch {
    return { ok: false, error: "Servidor indisponível no momento." };
  }
}

export interface AIChatReplyResult {
  ok: boolean;
  conversationId?: string;
  creditNotice?: string;
  message?: {
    id: string;
    role: "assistant";
    content: string;
    createdAt: string;
    modelUsed?: string;
    latencyMs?: number;
    citations?: AICitation[];
    quickReplies?: AIQuickReply[];
  };
  error?: string;
}

export async function sendAIChatAction(input: {
  conversationId?: string;
  message: string;
  tier?: AIQualityTier;
}): Promise<AIChatReplyResult> {
  const message = input.message.trim();
  if (message.length < 2) {
    return { ok: false, error: "Digite uma pergunta ou o relatório desejado." };
  }

  try {
    const res = await apiFetch("/api/ai/chat", {
      method: "POST",
      timeoutMs: 110_000,
      body: {
        conversationId: input.conversationId ?? "",
        message,
        tier: input.tier ?? "good",
      },
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      conversationId?: string;
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
    return {
      ok: true,
      conversationId: data.conversationId,
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
