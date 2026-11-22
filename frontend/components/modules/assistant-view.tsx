"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  Crown,
  FileDown,
  FileSpreadsheet,
  FileText,
  History,
  Loader2,
  Lock,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Printer,
  RotateCcw,
  Send,
  Shield,
  Sparkles,
  Trash2,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { deleteAIConversationAction, sendAIChatAction } from "@/app/actions/ai";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import type { AIConversationRow, AIMessageRow } from "@/lib/ai/repository";
import type { AIPlanKey } from "@/lib/auth/repository";
import { cn } from "@/lib/utils";
import { exportReportToExcel, exportReportToPDF } from "@/lib/utils/report-export";

export interface AllowedModuleInfo {
  key: "contracts" | "service_orders" | "employees" | "epis" | "inventory" | "finance";
  label: string;
}

interface AssistantViewProps {
  tenantName: string;
  tenantCnpj: string;
  hasOpenrouterToken: boolean;
  initialPlanKey: AIPlanKey;
  initialCreditDepleted: boolean;
  initialCreditDepletedFrom: string;
  isMaster: boolean;
  roleName: string;
  allowedModules: AllowedModuleInfo[];
  initialConversations: AIConversationRow[];
  initialConversationId: string;
  initialMessages: AIMessageRow[];
}

function formatPlanLabel(key: string): string {
  if (key === "premium") return "Premium";
  if (key === "standard") return "Padrão";
  return "Free";
}

interface QuickPromptCard {
  id: string;
  title: string;
  description: string;
  prompt: string;
  requiredModule?: AllowedModuleInfo["key"];
  icon: LucideIcon;
}

const QUICK_PROMPTS: QuickPromptCard[] = [
  {
    id: "executive-summary",
    title: "Resumo executivo da empresa",
    description: "Panorama geral com indicadores e pontos de atenção imediatos.",
    prompt:
      "Gere um resumo executivo completo da empresa com os principais indicadores dos módulos disponíveis, riscos prioritários e recomendações práticas em formato de tabela e tópicos.",
    icon: Sparkles,
  },
  {
    id: "contracts-report",
    title: "Relatório de contratos e receita",
    description: "Clientes ativos, postos alocados e valor mensal consolidado.",
    prompt:
      "Monte um relatório detalhado dos contratos cadastrados, listando cliente, objeto, postos, status e valor mensal em tabela, destacando a receita recorrente total.",
    requiredModule: "contracts",
    icon: Users,
  },
  {
    id: "os-priority",
    title: "Ordens de serviço pendentes",
    description: "Fila aberta, em andamento e prioridades operacionais.",
    prompt:
      "Analise as ordens de serviço abertas e em andamento, organize por prioridade em uma tabela e aponte quais exigem ação imediata da operação.",
    requiredModule: "service_orders",
    icon: ClipboardList,
  },
  {
    id: "finance-balance",
    title: "Demonstrativo financeiro",
    description: "Receitas, despesas, pendências e saldo consolidado.",
    prompt:
      "Elabore um relatório financeiro consolidado separando receitas, despesas, lançamentos pendentes e atrasados, com tabela resumo e análise de saldo.",
    requiredModule: "finance",
    icon: BarChart3,
  },
  {
    id: "epis-alerts",
    title: "Status de EPIs e conformidade",
    description: "Entregas registradas, alertas de vencimento e colaboradores.",
    prompt:
      "Faça um levantamento de conformidade dos EPIs entregues, destacando itens próximos do vencimento ou vencidos e a situação geral da equipe.",
    requiredModule: "epis",
    icon: Shield,
  },
  {
    id: "inventory-low",
    title: "Estoque e itens críticos",
    description: "Itens abaixo do mínimo e valor imobilizado no almoxarifado.",
    prompt:
      "Liste os itens do almoxarifado com foco em estoque abaixo do mínimo ou zerado, sugerindo prioridade de reposição em tabela.",
    requiredModule: "inventory",
    icon: Archive,
  },
];

const LOADING_PHRASES = [
  "Consultando dados seguros da empresa…",
  "Consolidando indicadores dos módulos liberados…",
  "Estruturando resposta e relatório…",
];

function detectRequestedExport(userPrompt: string): { excel: boolean; pdf: boolean } {
  const lower = userPrompt.toLowerCase();
  return {
    excel: /\b(excel|xlsx|planilha|csv)\b/.test(lower),
    pdf: /\b(pdf)\b/.test(lower),
  };
}

function nowFormattedBR(): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 16).replace("T", " ");
  }
}

/* ---------- Pure React Safe Markdown & GFM Table Renderer ---------- */

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={key++} className="font-bold text-slate-900 dark:text-white print:text-slate-950">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={key++}
          className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[12px] text-slate-900 dark:text-slate-100 print:bg-slate-100 print:text-slate-950"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(
        <em key={key++} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  const stripped = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  const parts = stripped.split("|").map((p) => p.trim());
  return parts.length > 0 && parts.every((p) => /^:?-{3,}:?$/.test(p));
}

function MarkdownReport({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push(
        <pre
          key={blockKey++}
          className="my-3 overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/70 p-3.5 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 print:border-slate-300 print:bg-slate-50 print:text-slate-900"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Headings
    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      if (level === 1) {
        blocks.push(
          <h2
            key={blockKey++}
            className="mt-4 first:mt-0 text-base sm:text-lg font-extrabold tracking-tight text-slate-950 dark:text-white border-b border-slate-200/80 dark:border-white/10 pb-1.5 print:text-slate-950 print:border-slate-300"
          >
            {renderInlineMarkdown(headingText)}
          </h2>,
        );
      } else if (level === 2) {
        blocks.push(
          <h3
            key={blockKey++}
            className="mt-4 first:mt-0 text-sm sm:text-base font-bold text-slate-900 dark:text-white print:text-slate-950"
          >
            {renderInlineMarkdown(headingText)}
          </h3>,
        );
      } else {
        blocks.push(
          <h4
            key={blockKey++}
            className="mt-3 first:mt-0 text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 print:text-slate-800"
          >
            {renderInlineMarkdown(headingText)}
          </h4>,
        );
      }
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={blockKey++} className="my-4 border-slate-200 dark:border-white/10 print:border-slate-300" />);
      i++;
      continue;
    }

    // GFM Table
    if (trimmed.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(lines[i]);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes("|") && lines[i].trim() !== "") {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      blocks.push(
        <div
          key={blockKey++}
          className="my-3 overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/12 print:overflow-visible print:rounded-lg print:border-slate-300"
        >
          <table className="w-full text-left text-xs sm:text-[13px] border-collapse tabular-nums">
            <thead className="bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 print:bg-slate-100 print:text-slate-900">
              <tr>
                {headers.map((h, idx) => (
                  <th
                    key={idx}
                    className="px-3.5 py-2.5 font-bold border-b border-slate-200 dark:border-white/10 whitespace-nowrap print:border-slate-300"
                  >
                    {renderInlineMarkdown(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/8 print:divide-slate-200">
              {rows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="odd:bg-white even:bg-slate-50/50 dark:odd:bg-slate-900/40 dark:even:bg-slate-800/30 print:odd:bg-white print:even:bg-slate-50"
                >
                  {headers.map((_, cIdx) => (
                    <td
                      key={cIdx}
                      className="px-3.5 py-2 text-slate-700 dark:text-slate-200 align-top print:text-slate-900"
                    >
                      {renderInlineMarkdown(row[cIdx] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={blockKey++}
          className="my-3 rounded-r-xl border-l-4 border-[#3B68F7] bg-blue-50/60 dark:bg-blue-950/30 px-4 py-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-200 print:bg-slate-50 print:text-slate-900"
        >
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx} className="leading-relaxed">
              {renderInlineMarkdown(ql)}
            </p>
          ))}
        </blockquote>,
      );
      continue;
    }

    // Unordered list
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul
          key={blockKey++}
          className="my-2.5 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-200 print:text-slate-900"
        >
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol
          key={blockKey++}
          className="my-2.5 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-200 print:text-slate-900"
        >
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph (group consecutive plain lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3}\s+|[-*•]\s+|\d+\.\s+|>\s?|```|(-{3,}|\*{3,}|_{3,})$)/.test(lines[i].trim()) &&
      !(lines[i].trim().includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p
        key={blockKey++}
        className="my-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200 text-pretty print:text-slate-900"
      >
        {renderInlineMarkdown(paraLines.join(" "))}
      </p>,
    );
  }

  return <div className="space-y-1">{blocks}</div>;
}

/* ---------- Main Assistant Component ---------- */

export function AssistantView({
  tenantName,
  tenantCnpj,
  hasOpenrouterToken,
  initialPlanKey,
  initialCreditDepleted,
  initialCreditDepletedFrom,
  isMaster,
  roleName,
  allowedModules,
  initialConversations,
  initialConversationId,
  initialMessages,
}: AssistantViewProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<AIConversationRow[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string>(initialConversationId);
  const [messages, setMessages] = useState<AIMessageRow[]>(initialMessages);
  const [planKey, setPlanKey] = useState<AIPlanKey>(initialPlanKey);
  const [creditNotice, setCreditNotice] = useState<string | null>(
    initialCreditDepleted
      ? `Os créditos OpenRouter do plano ${formatPlanLabel(initialCreditDepletedFrom)} acabaram e esta empresa foi alterada automaticamente para o plano Free.`
      : null,
  );
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingPhraseIdx, setLoadingPhraseIdx] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [contextOpen, setContextOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AIConversationRow | null>(null);
  const [printMessage, setPrintMessage] = useState<AIMessageRow | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Restaura preferência do painel lateral retrátil no desktop
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("tercerize_ai_sidebar_open");
      if (saved === "false") setSidebarOpen(false);
    } catch {
      // ignore storage errors
    }
  }, []);

  function toggleSidebar() {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("tercerize_ai_sidebar_open", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  // Sync server-fetched props when navigating between conversations (?c=...)
  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  useEffect(() => {
    setActiveConversationId(initialConversationId);
    setMessages(initialMessages);
    setErrorMsg(null);
  }, [initialConversationId, initialMessages]);

  // Smooth scroll to bottom on new messages or loading state
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

  // Rotate honest progress message while waiting for OpenRouter
  useEffect(() => {
    if (!sending) {
      setLoadingPhraseIdx(0);
      return;
    }
    const timer = window.setInterval(() => {
      setLoadingPhraseIdx((idx) => (idx + 1) % LOADING_PHRASES.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [sending]);

  // Auto-resize composer textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [draft]);

  // Trigger browser print right after printMessage portal renders
  useEffect(() => {
    if (!printMessage) return;
    const raf = window.requestAnimationFrame(() => {
      window.print();
    });
    const handleAfterPrint = () => setPrintMessage(null);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [printMessage]);

  const allowedKeys = useMemo(() => new Set(allowedModules.map((m) => m.key)), [allowedModules]);

  const visibleQuickPrompts = useMemo(
    () =>
      QUICK_PROMPTS.filter(
        (card) => !card.requiredModule || allowedKeys.has(card.requiredModule),
      ),
    [allowedKeys],
  );

  async function submitPrompt(rawText: string) {
    const clean = rawText.trim();
    if (clean.length < 2 || sending || !hasOpenrouterToken) return;

    setErrorMsg(null);
    setSending(true);

    const optimisticUser: AIMessageRow = {
      id: `temp-user-${Date.now()}`,
      role: "user",
      content: clean,
      createdAt: nowFormattedBR(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setDraft("");

    const result = await sendAIChatAction({
      conversationId: activeConversationId || undefined,
      message: clean,
    });

    setSending(false);

    if (!result.ok || !result.message) {
      // Remove optimistic message and restore draft so the user never loses text
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
      setDraft(clean);
      setErrorMsg(result.error ?? "Não foi possível obter resposta do Assistente IA.");
      return;
    }

    const nextConvId = result.conversationId || activeConversationId;
    setMessages((prev) => [...prev, result.message!]);
    if (result.planKey) {
      setPlanKey(result.planKey);
    }
    if (result.creditNotice) {
      setCreditNotice(result.creditNotice);
    }

    if (nextConvId && nextConvId !== activeConversationId) {
      setActiveConversationId(nextConvId);
      const previewTitle = clean.length > 72 ? `${clean.slice(0, 72)}…` : clean;
      setConversations((prev) => [
        { id: nextConvId, title: previewTitle, updatedAt: result.message!.createdAt },
        ...prev.filter((c) => c.id !== nextConvId),
      ]);
      router.replace(`/admin/assistant?c=${encodeURIComponent(nextConvId)}`, { scroll: false });
    } else if (nextConvId) {
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === nextConvId);
        if (!existing) return prev;
        return [
          { ...existing, updatedAt: result.message!.createdAt },
          ...prev.filter((c) => c.id !== nextConvId),
        ];
      });
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitPrompt(draft);
    }
  }

  function handleStartNewConversation() {
    setActiveConversationId("");
    setMessages([]);
    setErrorMsg(null);
    setHistoryModalOpen(false);
    router.push("/admin/assistant");
    textareaRef.current?.focus();
  }

  function handleSelectConversation(id: string) {
    setHistoryModalOpen(false);
    if (id === activeConversationId) return;
    router.push(`/admin/assistant?c=${encodeURIComponent(id)}`);
  }

  async function handleCopy(msg: AIMessageRow) {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedId(msg.id);
      window.setTimeout(() => {
        setCopiedId((cur) => (cur === msg.id ? null : cur));
      }, 2500);
    } catch {
      setErrorMsg("Não foi possível copiar para a área de transferência.");
    }
  }

  async function handleExportExcel(msg: AIMessageRow) {
    const key = `xlsx-${msg.id}`;
    setExportingKey(key);
    try {
      await exportReportToExcel({
        content: msg.content,
        tenantName,
        tenantCnpj,
        roleName,
        emittedAt: msg.createdAt || nowFormattedBR(),
      });
    } catch {
      setErrorMsg("Não foi possível gerar o arquivo Excel (.xlsx). Tente novamente.");
    } finally {
      setExportingKey(null);
    }
  }

  async function handleExportPDF(msg: AIMessageRow) {
    const key = `pdf-${msg.id}`;
    setExportingKey(key);
    try {
      await exportReportToPDF({
        content: msg.content,
        tenantName,
        tenantCnpj,
        roleName,
        emittedAt: msg.createdAt || nowFormattedBR(),
      });
    } catch {
      setErrorMsg("Não foi possível gerar o arquivo PDF. Tente novamente.");
    } finally {
      setExportingKey(null);
    }
  }

  const renderConversationList = () => (
    <div className="flex flex-col h-full gap-3">
      <button
        type="button"
        onClick={handleStartNewConversation}
        className="pill-gradient min-h-11 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
      >
        <Plus className="size-4" aria-hidden="true" />
        <span>Nova conversa</span>
      </button>

      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Histórico ({conversations.length})
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
        {conversations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-4 text-center space-y-1.5">
            <MessageSquare className="size-5 mx-auto text-slate-400" aria-hidden="true" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Nenhuma conversa ainda
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Suas perguntas e relatórios gerados aparecerão aqui.
            </p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isSelected = conv.id === activeConversationId;
            return (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-1 rounded-2xl border transition-colors",
                  isSelected
                    ? "border-blue-300 dark:border-blue-500/40 bg-blue-50/80 dark:bg-blue-950/50"
                    : "border-transparent hover:border-slate-200 dark:hover:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800/60",
                )}
              >
                <button
                  type="button"
                  onClick={() => handleSelectConversation(conv.id)}
                  className="min-h-11 flex-1 min-w-0 px-3 py-2 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] rounded-2xl"
                >
                  <p
                    className={cn(
                      "truncate text-xs font-semibold",
                      isSelected
                        ? "text-[#3B68F7] dark:text-blue-300"
                        : "text-slate-800 dark:text-slate-200",
                    )}
                  >
                    {conv.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {conv.updatedAt}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(conv)}
                  aria-label={`Excluir conversa ${conv.title}`}
                  title="Excluir conversa"
                  className="min-h-10 min-w-10 mr-1 inline-flex shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="flex h-[calc(100dvh-108px)] sm:h-[calc(100dvh-124px)] min-h-[540px] gap-4 overflow-hidden">
        {/* Desktop Left Sidebar: Conversation History (Retrátil) */}
        {sidebarOpen && (
          <aside
            aria-label="Histórico de conversas do Assistente IA"
            className="hidden lg:flex w-[272px] shrink-0 flex-col rounded-[28px] solid-surface p-4 overflow-hidden"
          >
            {renderConversationList()}
          </aside>
        )}

        {/* Main Chat & Reports Canvas */}
        <section
          aria-label="Área de chat e geração de relatórios"
          className="flex flex-1 min-w-0 flex-col rounded-[28px] solid-surface overflow-hidden"
        >
          {/* Transparent Scope Header com Lista de Contexto Retrátil */}
          <div className="shrink-0 border-b border-slate-200/80 dark:border-white/10 px-4 py-3 sm:px-6 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setHistoryModalOpen(true)}
                  aria-label="Abrir histórico de conversas"
                  className="lg:hidden min-h-11 min-w-11 inline-flex shrink-0 items-center justify-center rounded-2xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-[#3B68F7] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                >
                  <History className="size-4.5" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-expanded={sidebarOpen}
                  aria-label={sidebarOpen ? "Recolher painel de histórico" : "Expandir painel de histórico"}
                  title={sidebarOpen ? "Recolher histórico" : "Expandir histórico"}
                  className="hidden lg:inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-[#3B68F7] hover:text-[#3B68F7] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                >
                  {sidebarOpen ? (
                    <PanelLeftClose className="size-4" aria-hidden="true" />
                  ) : (
                    <PanelLeftOpen className="size-4" aria-hidden="true" />
                  )}
                </button>

                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3B68F7] to-[#5346E8] text-white shadow-xs">
                  <Sparkles className="size-5" aria-hidden="true" />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                      Assistente IA & Relatórios
                    </h1>
                    {isMaster && hasOpenrouterToken && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                          planKey === "premium"
                            ? "bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300"
                            : planKey === "standard"
                              ? "bg-blue-100 dark:bg-blue-950/80 text-[#3B68F7] dark:text-blue-300"
                              : "bg-emerald-100 dark:bg-emerald-950/75 text-emerald-700 dark:text-emerald-300",
                        )}
                      >
                        {planKey === "premium" ? (
                          <Crown className="size-3" aria-hidden="true" />
                        ) : planKey === "standard" ? (
                          <Zap className="size-3" aria-hidden="true" />
                        ) : (
                          <Sparkles className="size-3" aria-hidden="true" />
                        )}
                        <span>IA {formatPlanLabel(planKey)}</span>
                      </span>
                    )}
                  </div>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-xs text-slate-600 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                      <Building2 className="size-3 text-[#3B68F7] dark:text-blue-400" aria-hidden="true" />
                      {tenantName}
                    </span>
                    <span className="font-mono text-[11px]">{tenantCnpj}</span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                      <Lock className="size-3" aria-hidden="true" />
                      Exclusivo de negócios ({roleName})
                    </span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setContextOpen((v) => !v)}
                aria-expanded={contextOpen}
                aria-controls="assistant-context-panel"
                className="min-h-10 inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#3B68F7] hover:text-[#3B68F7] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              >
                <span>Contexto ({allowedModules.length})</span>
                {contextOpen ? (
                  <ChevronUp className="size-3.5" aria-hidden="true" />
                ) : (
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                )}
              </button>
            </div>

            {contextOpen && (
              <div
                id="assistant-context-panel"
                className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-slate-800/45 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">
                    Módulos lidos:
                  </span>
                  {allowedModules.map((mod) => (
                    <span
                      key={mod.key}
                      className="inline-flex items-center rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {mod.label}
                    </span>
                  ))}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Exportação disponível em Excel (.xlsx) e PDF
                </span>
              </div>
            )}
          </div>

          {creditNotice && (
            <div
              role="status"
              aria-live="polite"
              className="shrink-0 border-b border-amber-200 dark:border-amber-800/70 bg-amber-50/95 dark:bg-amber-950/55 px-4 py-2.5 sm:px-6 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200"
            >
              <div className="flex items-center gap-2 min-w-0 font-semibold">
                <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <span className="text-pretty">{creditNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setCreditNotice(null)}
                aria-label="Fechar aviso de créditos"
                className="min-h-8 min-w-8 inline-flex shrink-0 items-center justify-center rounded-full text-amber-700 dark:text-amber-300 hover:bg-amber-200/50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Body: Empty Token State OR Conversation Stream */}
          {!hasOpenrouterToken ? (
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 flex items-center justify-center">
              <div className="max-w-md w-full rounded-[24px] border border-slate-200 dark:border-white/12 bg-slate-50/80 dark:bg-slate-800/40 p-6 sm:p-8 text-center space-y-4">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-blue-100/80 dark:bg-blue-950/60 text-[#3B68F7] dark:text-blue-300">
                  <Sparkles className="size-7" aria-hidden="true" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white text-balance">
                    Assistente IA ainda não ativado para esta empresa
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 text-pretty leading-relaxed">
                    Para habilitar o chat inteligente e a geração de relatórios automáticos em{" "}
                    <strong>{tenantName}</strong>, o administrador <strong>MASTER</strong> precisa informar o token da
                    OpenRouter no cadastro da empresa.
                  </p>
                </div>
                {isMaster && (
                  <div className="pt-2">
                    <Link
                      href="/admin/companies"
                      className="pill-gradient min-h-11 inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                    >
                      <span>Configurar token em Gestão de empresas</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div
                className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 space-y-5"
                aria-busy={sending}
              >
                {messages.length === 0 && !sending ? (
                  <div className="mx-auto max-w-4xl space-y-6 py-2 sm:py-4">
                    <div className="space-y-2 text-center sm:text-left">
                      <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white text-balance">
                        Como posso ajudar na gestão de {tenantName}?
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 text-pretty max-w-2xl">
                        Escolha um atalho de relatório pronto abaixo ou faça qualquer pergunta livre. A análise consulta
                        exclusivamente os dados desta empresa nos módulos liberados para a sua função.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {visibleQuickPrompts.map((card) => {
                        const Icon = card.icon;
                        return (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() => void submitPrompt(card.prompt)}
                            className="group min-h-11 text-left rounded-2xl border border-slate-200/90 dark:border-white/10 bg-slate-50/70 dark:bg-slate-800/50 p-4 hover:border-[#3B68F7] hover:bg-blue-50/40 dark:hover:bg-blue-950/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] flex flex-col gap-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex size-9 items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 text-[#3B68F7] dark:text-blue-400 shadow-2xs">
                                <Icon className="size-4.5" aria-hidden="true" />
                              </span>
                              <span className="text-[11px] font-bold text-[#3B68F7] dark:text-blue-400 opacity-80 group-hover:opacity-100">
                                Gerar agora
                              </span>
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                                {card.title}
                              </p>
                              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                {card.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto max-w-4xl space-y-5">
                    {messages.map((msg, msgIdx) => {
                      if (msg.role === "user") {
                        return (
                          <div key={msg.id} className="flex justify-end">
                            <div className="max-w-[88%] sm:max-w-[78%] rounded-[22px] rounded-tr-md bg-gradient-to-r from-[#3B68F7] to-[#5346E8] px-4 py-3 text-white shadow-sm space-y-1">
                              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                {msg.content}
                              </p>
                              <p className="text-[10px] text-blue-100/90 text-right tabular-nums">
                                {msg.createdAt}
                              </p>
                            </div>
                          </div>
                        );
                      }

                      const prevUserMsg =
                        msgIdx > 0 && messages[msgIdx - 1]?.role === "user"
                          ? messages[msgIdx - 1].content
                          : "";
                      const requested = detectRequestedExport(prevUserMsg);
                      const hasTable = /\|.*\|/.test(msg.content);
                      const showFooterExport = requested.excel || requested.pdf || hasTable;

                      return (
                        <article
                          key={msg.id}
                          className="rounded-[24px] border border-slate-200/90 dark:border-white/12 bg-slate-50/70 dark:bg-slate-800/45 p-4 sm:p-6 shadow-2xs space-y-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 dark:border-white/10 pb-3">
                            <div className="flex items-center gap-2">
                              <span className="flex size-7 items-center justify-center rounded-lg bg-[#3B68F7]/12 text-[#3B68F7] dark:text-blue-300">
                                <FileText className="size-4" aria-hidden="true" />
                              </span>
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                Assistente Tercerize
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                · {msg.createdAt}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                disabled={exportingKey === `xlsx-${msg.id}`}
                                onClick={() => void handleExportExcel(msg)}
                                aria-label="Baixar relatório em Excel (.xlsx)"
                                className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/90 dark:bg-emerald-950/45 px-3 py-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/75 transition-colors cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                              >
                                {exportingKey === `xlsx-${msg.id}` ? (
                                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                ) : (
                                  <FileSpreadsheet className="size-3.5" aria-hidden="true" />
                                )}
                                <span>Excel (.xlsx)</span>
                              </button>

                              <button
                                type="button"
                                disabled={exportingKey === `pdf-${msg.id}`}
                                onClick={() => void handleExportPDF(msg)}
                                aria-label="Baixar relatório em PDF"
                                className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-blue-200 dark:border-blue-700/60 bg-blue-50/90 dark:bg-blue-950/45 px-3 py-1.5 text-[11px] font-bold text-[#3B68F7] dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/75 transition-colors cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                              >
                                {exportingKey === `pdf-${msg.id}` ? (
                                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                ) : (
                                  <FileDown className="size-3.5" aria-hidden="true" />
                                )}
                                <span>Baixar PDF</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => void handleCopy(msg)}
                                aria-label="Copiar relatório em texto"
                                className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-[#3B68F7] hover:text-[#3B68F7] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                              >
                                {copiedId === msg.id ? (
                                  <>
                                    <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
                                    <span className="text-emerald-700 dark:text-emerald-400">Copiado</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="size-3.5" aria-hidden="true" />
                                    <span>Copiar</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => setPrintMessage(msg)}
                                aria-label="Imprimir relatório"
                                className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-[#3B68F7] hover:text-[#3B68F7] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                              >
                                <Printer className="size-3.5" aria-hidden="true" />
                                <span>Imprimir</span>
                              </button>
                            </div>
                          </div>

                          <MarkdownReport content={msg.content} />

                          {showFooterExport && (
                            <div className="pt-3 border-t border-slate-200/70 dark:border-white/10 flex flex-wrap items-center justify-between gap-2.5">
                              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                {requested.excel || requested.pdf
                                  ? "Arquivo do relatório pronto para download:"
                                  : "Exportar este relatório:"}
                              </span>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  disabled={exportingKey === `xlsx-${msg.id}`}
                                  onClick={() => void handleExportExcel(msg)}
                                  className={cn(
                                    "min-h-10 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600",
                                    requested.excel
                                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                      : "border border-emerald-300 dark:border-emerald-700/70 bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50",
                                  )}
                                >
                                  {exportingKey === `xlsx-${msg.id}` ? (
                                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                  ) : (
                                    <FileSpreadsheet className="size-3.5" aria-hidden="true" />
                                  )}
                                  <span>Baixar Excel (.xlsx)</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={exportingKey === `pdf-${msg.id}`}
                                  onClick={() => void handleExportPDF(msg)}
                                  className={cn(
                                    "min-h-10 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]",
                                    requested.pdf
                                      ? "pill-gradient"
                                      : "border border-blue-300 dark:border-blue-700/70 bg-white dark:bg-slate-900 text-[#3B68F7] dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50",
                                  )}
                                >
                                  {exportingKey === `pdf-${msg.id}` ? (
                                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                  ) : (
                                    <FileDown className="size-3.5" aria-hidden="true" />
                                  )}
                                  <span>Baixar PDF (.pdf)</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}

                    {sending && (
                      <div
                        role="status"
                        aria-live="polite"
                        className="rounded-[24px] border border-blue-200/80 dark:border-blue-500/25 bg-blue-50/60 dark:bg-blue-950/30 p-5 space-y-3"
                      >
                        <div className="flex items-center gap-2.5 text-xs font-bold text-[#3B68F7] dark:text-blue-300">
                          <Loader2 className="size-4 animate-spin shrink-0" aria-hidden="true" />
                          <span>{LOADING_PHRASES[loadingPhraseIdx]}</span>
                        </div>
                        <div className="space-y-2">
                          <div className="h-3 w-3/4 rounded-full bg-blue-200/60 dark:bg-blue-900/50 animate-pulse" />
                          <div className="h-3 w-full rounded-full bg-blue-200/50 dark:bg-blue-900/40 animate-pulse" />
                          <div className="h-3 w-2/3 rounded-full bg-blue-200/40 dark:bg-blue-900/30 animate-pulse" />
                        </div>
                      </div>
                    )}
                    <div ref={endRef} />
                  </div>
                )}
              </div>

              {/* Sticky Composer */}
              <div className="shrink-0 border-t border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 px-4 py-3 sm:px-6 space-y-2">
                {errorMsg && (
                  <div
                    role="alert"
                    className="mx-auto max-w-4xl flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-rose-200 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/50 px-3.5 py-2.5 text-xs text-rose-800 dark:text-rose-200"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertCircle className="size-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                      <span className="break-words">{errorMsg}</span>
                    </div>
                    {draft.trim().length >= 2 && (
                      <button
                        type="button"
                        onClick={() => void submitPrompt(draft)}
                        className="min-h-9 inline-flex items-center gap-1.5 rounded-full bg-rose-600 hover:bg-rose-700 px-3 py-1 text-[11px] font-bold text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                        <span>Tentar novamente</span>
                      </button>
                    )}
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitPrompt(draft);
                  }}
                  className="mx-auto max-w-4xl flex items-end gap-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <label htmlFor="assistant-chat-input" className="sr-only">
                      Digite sua pergunta ou relatório desejado
                    </label>
                    <textarea
                      ref={textareaRef}
                      id="assistant-chat-input"
                      rows={1}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={sending}
                      placeholder="Pergunte sobre contratos, OS, finanças, EPIs ou peça um relatório…"
                      className="block w-full min-h-11 max-h-36 resize-none rounded-2xl border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-slate-800/80 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] disabled:opacity-60"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={sending || draft.trim().length < 2}
                    aria-label="Enviar mensagem para o Assistente IA"
                    className="pill-gradient min-h-11 min-w-11 shrink-0 inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="size-4" aria-hidden="true" />
                    )}
                    <span className="hidden sm:inline">Enviar</span>
                  </button>
                </form>

                <p className="mx-auto max-w-4xl text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
                  <span>Enter envia · Shift+Enter quebra linha · Peça relatórios em Excel ou PDF</span>
                  <span>Uso exclusivo para negócios da empresa {tenantName}</span>
                </p>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Screen-reader live region for copy feedback */}
      <div className="sr-only" aria-live="polite">
        {copiedId ? "Relatório copiado para a área de transferência." : ""}
      </div>

      {/* Mobile History Modal */}
      <Modal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title="Histórico de conversas"
        description={`Conversas salvas em ${tenantName}`}
        size="sm"
      >
        <div className="h-[60dvh] flex flex-col">{renderConversationList()}</div>
      </Modal>

      {/* Delete Conversation Confirm Modal */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Excluir conversa"
        description={
          deleteTarget
            ? `Tem certeza que deseja excluir "${deleteTarget.title}"? Todas as mensagens e relatórios desta conversa serão removidos permanentemente.`
            : ""
        }
        confirmLabel="Excluir conversa"
        tone="danger"
        formAction={async (fd) => {
          const id = deleteTarget?.id;
          await deleteAIConversationAction(fd);
          if (id) {
            setConversations((prev) => prev.filter((c) => c.id !== id));
            if (activeConversationId === id) {
              setActiveConversationId("");
              setMessages([]);
              router.replace("/admin/assistant");
            }
          }
        }}
        hiddenFields={deleteTarget ? { id: deleteTarget.id } : undefined}
      />

      {/* Official Print / PDF Sheet Portal */}
      {printMessage &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="ai-print-portal hidden print:block bg-white text-slate-950 p-2">
            <div className="border-b-2 border-slate-900 pb-4 mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                  Tercerize · Relatório Gerencial
                </p>
                <h1 className="text-xl font-extrabold text-slate-950 mt-1">{tenantName}</h1>
                <p className="text-xs font-mono text-slate-700 mt-0.5">CNPJ: {tenantCnpj}</p>
              </div>
              <div className="text-right text-xs text-slate-700 tabular-nums">
                <p className="font-semibold">Emitido em</p>
                <p>{printMessage.createdAt || nowFormattedBR()}</p>
                <p className="text-[11px] text-slate-500 mt-1">Perfil: {roleName}</p>
              </div>
            </div>

            <MarkdownReport content={printMessage.content} />

            <div className="mt-8 pt-3 border-t border-slate-300 text-[10px] text-slate-500 flex items-center justify-between">
              <span>Documento gerado automaticamente pelo Assistente IA Tercerize</span>
              <span>Dados restritos à empresa {tenantName}</span>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
