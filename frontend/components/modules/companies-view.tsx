"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Gauge,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { clearAICooldownsAction, reindexTenantKnowledgeAction } from "@/app/actions/ai";
import {
  createCompanyStateAction,
  resendCompanyOwnerLinkAction,
  switchTenantAction,
  toggleTenantActiveAction,
  updateCompanyStateAction,
} from "@/app/actions/auth";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import type { AIObservabilityDashboardData } from "@/lib/ai/repository";
import type { CompanyRow } from "@/lib/operations/repository";
import { formatCNPJ } from "@/lib/utils/cnpj";

interface Props {
  companies: CompanyRow[];
  aiDashboard: AIObservabilityDashboardData;
  initialPartnerFilter?: string;
}

function formatCompactTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M tokens`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k tokens`;
  return `${tokens} tokens`;
}

function AIMonthlyLimitField({
  monthlyLimit,
  onMonthlyLimitChange,
  idPrefix,
}: {
  monthlyLimit: string;
  onMonthlyLimitChange: (v: string) => void;
  idPrefix: string;
}) {
  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={`${idPrefix}-monthly-limit`}
          className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
        >
          Limite mensal de respostas IA (opcional)
        </label>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">0 = sem teto mensal</span>
      </div>
      <input
        id={`${idPrefix}-monthly-limit`}
        name="aiMonthlyMessageLimit"
        type="number"
        inputMode="numeric"
        min={0}
        max={100000}
        value={monthlyLimit}
        onChange={(e) => onMonthlyLimitChange(e.target.value)}
        className="w-full min-h-10 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 px-3.5 py-2 font-mono text-xs text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
      />
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Os modelos de IA (DeepSeek v4.1 Flash + fallbacks Qwen) são roteados automaticamente pela plataforma.
      </p>
    </div>
  );
}

type AccessFilter = "all" | "accessed" | "pending" | "inactive";

function hasClientAccessed(c: CompanyRow): boolean {
  return c.ownerLoginCount > 0 || c.ownerTotpConfigured;
}

function CreateCompanyModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (notice: { text: string; warning?: string }) => void;
}) {
  const [state, createAction, pending] = useActionState(createCompanyStateAction, undefined);
  const [cnpj, setCnpj] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [monthlyLimit, setMonthlyLimit] = useState("0");

  useEffect(() => {
    if (state?.values?.cnpj) {
      setCnpj(state.values.cnpj);
    } else if (state?.ok && state.createdName) {
      setCnpj("");
      setMonthlyLimit("0");
      onCreated({
        text: state.emailSent
          ? `Empresa ${state.createdName} (${state.createdCnpj}) cadastrada e link do Google Authenticator enviado para ${state.ownerEmail}.`
          : `Empresa ${state.createdName} (${state.createdCnpj}) cadastrada.`,
        warning: state.emailWarning || undefined,
      });
      onClose();
    }
  }, [state, onClose, onCreated]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cadastrar nova empresa"
      description="Defina razão social, CNPJ único e os dados do responsável. O link de ativação do Google Authenticator será enviado por e-mail."
      size="md"
    >
      <form action={createAction} noValidate className="space-y-4">
        {state?.message && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300"
          >
            {state.message}
          </p>
        )}

        <div className="space-y-1.5">
          <label htmlFor="modal-comp-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
            Razão social da empresa *
          </label>
          <input
            id="modal-comp-name"
            name="name"
            required
            defaultValue={state?.values?.name ?? ""}
            aria-invalid={state?.fieldError?.field === "name"}
            placeholder="Ex.: Pantanal Facilities & Manutenção Ltda…"
            className={`w-full min-h-11 rounded-2xl border bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 ${
              state?.fieldError?.field === "name"
                ? "border-rose-400 focus-visible:ring-rose-500"
                : "border-slate-300 dark:border-white/15 focus-visible:ring-[#3B68F7]"
            }`}
          />
          {state?.fieldError?.field === "name" && (
            <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {state.fieldError.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="modal-comp-cnpj" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              CNPJ único *
            </label>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">14 dígitos válidos</span>
          </div>
          <input
            id="modal-comp-cnpj"
            name="cnpj"
            inputMode="numeric"
            spellCheck={false}
            maxLength={18}
            required
            value={cnpj}
            onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
            aria-invalid={state?.fieldError?.field === "cnpj"}
            placeholder="00.000.000/0001-00…"
            className={`w-full min-h-11 rounded-2xl border bg-white dark:bg-slate-800 px-4 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 ${
              state?.fieldError?.field === "cnpj"
                ? "border-rose-400 focus-visible:ring-rose-500"
                : "border-slate-300 dark:border-white/15 focus-visible:ring-[#3B68F7]"
            }`}
          />
          {state?.fieldError?.field === "cnpj" && (
            <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {state.fieldError.message}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="modal-comp-owner-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Nome do responsável (Dono) *
            </label>
            <input
              id="modal-comp-owner-name"
              name="ownerName"
              required
              defaultValue={state?.values?.ownerName ?? ""}
              aria-invalid={state?.fieldError?.field === "ownerName"}
              placeholder="Ex.: Rafael Carvalho…"
              className={`w-full min-h-11 rounded-2xl border bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 ${
                state?.fieldError?.field === "ownerName"
                  ? "border-rose-400 focus-visible:ring-rose-500"
                  : "border-slate-300 dark:border-white/15 focus-visible:ring-[#3B68F7]"
              }`}
            />
            {state?.fieldError?.field === "ownerName" && (
              <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {state.fieldError.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="modal-comp-owner-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              E-mail do responsável (Dono) *
            </label>
            <input
              id="modal-comp-owner-email"
              name="ownerEmail"
              type="email"
              spellCheck={false}
              required
              defaultValue={state?.values?.ownerEmail ?? ""}
              aria-invalid={state?.fieldError?.field === "ownerEmail"}
              placeholder="responsavel@empresa.com.br…"
              className={`w-full min-h-11 rounded-2xl border bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 ${
                state?.fieldError?.field === "ownerEmail"
                  ? "border-rose-400 focus-visible:ring-rose-500"
                  : "border-slate-300 dark:border-white/15 focus-visible:ring-[#3B68F7]"
              }`}
            />
            {state?.fieldError?.field === "ownerEmail" && (
              <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {state.fieldError.message}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-800/40 p-3.5 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="modal-comp-or-token" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Token OpenRouter (Assistente IA)
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Opcional · exclusivo desta empresa</span>
            </div>
            <div className="relative">
              <input
                id="modal-comp-or-token"
                name="openrouterToken"
                type={showToken ? "text" : "password"}
                spellCheck={false}
                autoComplete="off"
                placeholder="sk-or-v1-… (deixe em branco para não ativar IA)"
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 pl-4 pr-11 py-2.5 font-mono text-xs text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                aria-label={showToken ? "Ocultar token OpenRouter" : "Mostrar token OpenRouter"}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-h-9 min-w-9 inline-flex items-center justify-center rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                {showToken ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <AIMonthlyLimitField
            monthlyLimit={monthlyLimit}
            onMonthlyLimitChange={setMonthlyLimit}
            idPrefix="create-comp"
          />
        </div>

        <div className="rounded-2xl border border-blue-200/70 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-950/30 p-3.5 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
          <Mail className="size-4 shrink-0 text-[#3B68F7] mt-0.5" aria-hidden="true" />
          <span>
            O mesmo e-mail pode ser dono de várias empresas com CNPJs diferentes. O link do{" "}
            <strong>Google Authenticator</strong> será enviado automaticamente após salvar.
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 inline-flex items-center justify-center gap-2 pill-gradient px-6 py-2 text-xs font-bold cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            <span>Cadastrar empresa e enviar link</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditCompanyModal({
  company,
  onClose,
  onUpdated,
}: {
  company: CompanyRow | null;
  onClose: () => void;
  onUpdated: (notice: { text: string; warning?: string }) => void;
}) {
  const [editState, editAction, editPending] = useActionState(updateCompanyStateAction, undefined);
  const [name, setName] = useState(company?.name ?? "");
  const [cnpj, setCnpj] = useState(company?.cnpj ?? "");
  const [ownerName, setOwnerName] = useState(company?.ownerName ?? "");
  const [ownerEmail, setOwnerEmail] = useState(company?.ownerEmail ?? "");
  const [active, setActive] = useState(company?.active ? "true" : "false");
  const [showToken, setShowToken] = useState(false);
  const [monthlyLimit, setMonthlyLimit] = useState(String(company?.aiMonthlyMessageLimit ?? 0));

  useEffect(() => {
    if (company) {
      setName(company.name);
      setCnpj(company.cnpj);
      setOwnerName(company.ownerName);
      setOwnerEmail(company.ownerEmail);
      setActive(company.active ? "true" : "false");
      setMonthlyLimit(String(company.aiMonthlyMessageLimit ?? 0));
    }
  }, [company]);

  useEffect(() => {
    if (editState?.ok && editState.updatedName) {
      onUpdated({
        text: editState.emailSent
          ? `Empresa ${editState.updatedName} atualizada e link do Google Authenticator enviado ao responsável.`
          : `Informações da empresa ${editState.updatedName} atualizadas com sucesso.`,
        warning: editState.emailWarning || undefined,
      });
      onClose();
    }
  }, [editState, onClose, onUpdated]);

  if (!company) return null;

  return (
    <Modal
      open={Boolean(company)}
      onClose={onClose}
      title="Editar informações da empresa"
      description="Edição exclusiva do Master. O cliente ou dono não pode alterar estes dados cadastrais."
      size="md"
    >
      <form action={editAction} noValidate className="space-y-4">
        <input type="hidden" name="tenantId" value={company.id} />

        {editState?.message && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300"
          >
            {editState.message}
          </p>
        )}

        <div className="space-y-1.5">
          <label htmlFor="edit-modal-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
            Razão social *
          </label>
          <input
            id="edit-modal-name"
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={editState?.fieldError?.field === "name"}
            className={`w-full min-h-11 rounded-2xl border bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 ${
              editState?.fieldError?.field === "name"
                ? "border-rose-400 focus-visible:ring-rose-500"
                : "border-slate-300 dark:border-white/15 focus-visible:ring-[#3B68F7]"
            }`}
          />
          {editState?.fieldError?.field === "name" && (
            <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {editState.fieldError.message}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="edit-modal-cnpj" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              CNPJ *
            </label>
            <input
              id="edit-modal-cnpj"
              name="cnpj"
              inputMode="numeric"
              spellCheck={false}
              maxLength={18}
              required
              value={cnpj}
              onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
              aria-invalid={editState?.fieldError?.field === "cnpj"}
              className={`w-full min-h-11 rounded-2xl border bg-white dark:bg-slate-800 px-4 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 ${
                editState?.fieldError?.field === "cnpj"
                  ? "border-rose-400 focus-visible:ring-rose-500"
                  : "border-slate-300 dark:border-white/15 focus-visible:ring-[#3B68F7]"
              }`}
            />
            {editState?.fieldError?.field === "cnpj" && (
              <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {editState.fieldError.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-modal-status" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Situação da empresa *
            </label>
            <select
              id="edit-modal-status"
              name="active"
              value={active}
              onChange={(e) => setActive(e.target.value)}
              className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <option value="true">Ativa (acesso liberado)</option>
              <option value="false">Desativada (desloga usuários)</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="edit-modal-owner-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Nome do responsável (Dono) *
            </label>
            <input
              id="edit-modal-owner-name"
              name="ownerName"
              required
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              aria-invalid={editState?.fieldError?.field === "ownerName"}
              className={`w-full min-h-11 rounded-2xl border bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 ${
                editState?.fieldError?.field === "ownerName"
                  ? "border-rose-400 focus-visible:ring-rose-500"
                  : "border-slate-300 dark:border-white/15 focus-visible:ring-[#3B68F7]"
              }`}
            />
            {editState?.fieldError?.field === "ownerName" && (
              <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {editState.fieldError.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-modal-owner-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              E-mail do responsável (Dono) *
            </label>
            <input
              id="edit-modal-owner-email"
              name="ownerEmail"
              type="email"
              spellCheck={false}
              required
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              aria-invalid={editState?.fieldError?.field === "ownerEmail"}
              className={`w-full min-h-11 rounded-2xl border bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 ${
                editState?.fieldError?.field === "ownerEmail"
                  ? "border-rose-400 focus-visible:ring-rose-500"
                  : "border-slate-300 dark:border-white/15 focus-visible:ring-[#3B68F7]"
              }`}
            />
            {editState?.fieldError?.field === "ownerEmail" && (
              <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {editState.fieldError.message}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-800/50 p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="edit-modal-or-token" className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-[#3B68F7]" aria-hidden="true" />
              <span>Token OpenRouter (Assistente IA)</span>
            </label>
            <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {company.hasOpenrouterToken ? `Ativo (${company.openrouterTokenHint || "configurado"})` : "Não configurado"}
            </span>
          </div>
          <div className="relative">
            <input
              id="edit-modal-or-token"
              name="openrouterToken"
              type={showToken ? "text" : "password"}
              spellCheck={false}
              autoComplete="off"
              placeholder={
                company.hasOpenrouterToken
                  ? "Digite um novo token para substituir ou deixe em branco para manter…"
                  : "sk-or-v1-… (opcional)"
              }
              className="w-full min-h-10 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 pl-3.5 pr-10 py-2 font-mono text-xs text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              aria-label={showToken ? "Ocultar token OpenRouter" : "Mostrar token OpenRouter"}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-8 min-w-8 inline-flex items-center justify-center rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              {showToken ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
            </button>
          </div>
          {company.aiCreditDepleted && (
            <p className="rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/50 px-3 py-2 text-[11px] font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Créditos OpenRouter esgotados — o Assistente está operando em contingência gratuita até a recarga ou atualização do token.
              </span>
            </p>
          )}
          <AIMonthlyLimitField
            monthlyLimit={monthlyLimit}
            onMonthlyLimitChange={setMonthlyLimit}
            idPrefix="edit-comp"
          />
          {company.hasOpenrouterToken && (
            <label className="inline-flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 cursor-pointer">
              <input
                type="checkbox"
                name="clearOpenrouterToken"
                className="size-4 rounded border-rose-300 text-rose-600 focus-visible:ring-2 focus-visible:ring-rose-500"
              />
              <span>Remover token OpenRouter desta empresa (desativa o Assistente IA)</span>
            </label>
          )}
        </div>

        <label className="flex items-center gap-2.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
          <input
            type="checkbox"
            name="resendLink"
            className="size-4 rounded border-slate-300 text-[#3B68F7] focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          />
          <span>Reenviar link do Google Authenticator para o e-mail do responsável ao salvar</span>
        </label>

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={editPending}
            className="min-h-11 inline-flex items-center justify-center gap-2 pill-gradient px-6 py-2 text-xs font-bold cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            {editPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            <span>Salvar alterações</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CompanyDetailsModal({
  company,
  onClose,
  onEdit,
  onResend,
  resendPending,
}: {
  company: CompanyRow | null;
  onClose: () => void;
  onEdit: (c: CompanyRow) => void;
  onResend: (formData: FormData) => void;
  resendPending: boolean;
}) {
  if (!company) return null;
  const accessed = hasClientAccessed(company);

  return (
    <Modal
      open={Boolean(company)}
      onClose={onClose}
      title={company.name}
      description={`CNPJ ${company.cnpj} · Cadastrada em ${company.createdAt}`}
      size="lg"
    >
      <div className="space-y-5">
        {/* Bloco principal: Auditoria de acesso do cliente */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-800/50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="size-4 text-[#3B68F7]" aria-hidden="true" />
              <span>Histórico e status de acesso do cliente</span>
            </h3>
            {company.ownerBlocked ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 dark:bg-rose-950/80 px-3 py-1 text-xs font-bold text-rose-700 dark:text-rose-300">
                <ShieldAlert className="size-3.5" aria-hidden="true" />
                Responsável bloqueado
              </span>
            ) : accessed ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                Cliente já acessou o sistema
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-950/80 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-200">
                <Clock className="size-3.5" aria-hidden="true" />
                Aguardando primeiro acesso
              </span>
            )}
          </div>

          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900 p-3">
              <dt className="text-slate-500 dark:text-slate-400">Último acesso</dt>
              <dd className="mt-1 font-bold text-slate-900 dark:text-white tabular-nums">
                {company.ownerLastLoginAt ?? "Nunca acessou"}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900 p-3">
              <dt className="text-slate-500 dark:text-slate-400">Total de logins</dt>
              <dd className="mt-1 font-bold text-slate-900 dark:text-white tabular-nums">
                {company.ownerLoginCount} acesso(s)
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900 p-3">
              <dt className="text-slate-500 dark:text-slate-400">Último convite enviado</dt>
              <dd className="mt-1 font-bold text-slate-900 dark:text-white tabular-nums">
                {company.lastInviteSentAt ?? "Não registrado"}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900 p-3">
              <dt className="text-slate-500 dark:text-slate-400">Sessões ativas agora</dt>
              <dd className="mt-1 font-bold text-slate-900 dark:text-white tabular-nums">
                {company.activeSessionsCount} conectada(s)
              </dd>
            </div>
          </dl>
        </div>

        {/* Responsável e dados operacionais */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserCheck className="size-4 text-[#3B68F7]" aria-hidden="true" />
              <span>Responsável (Dono)</span>
            </h3>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{company.ownerName || "Não informado"}</p>
            <p className="font-mono text-xs text-slate-600 dark:text-slate-300">{company.ownerEmail || "—"}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Google Authenticator:{" "}
              <strong className="text-slate-900 dark:text-white">
                {company.ownerTotpConfigured ? "Configurado" : "Pendente de ativação"}
              </strong>
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="size-4 text-[#3B68F7]" aria-hidden="true" />
              <span>Resumo operacional da empresa</span>
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
              <span>
                <strong className="text-slate-900 dark:text-white">{company.membersCount}</strong> usuário(s)
              </span>
              <span>
                <strong className="text-slate-900 dark:text-white">{company.clientsCount}</strong> cliente(s)
              </span>
              <span>
                <strong className="text-slate-900 dark:text-white">{company.contractsCount}</strong> contrato(s)
              </span>
              <span>
                <strong className="text-slate-900 dark:text-white">{company.employeesCount}</strong> colaborador(es)
              </span>
              <span>
                <strong className="text-slate-900 dark:text-white">{company.serviceOrdersCount}</strong> ordem(ns) OS
              </span>
              <span>
                Situação:{" "}
                <strong className={company.active ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                  {company.active ? "Ativa" : "Desativada"}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Ações rápidas dentro do modal */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200/80 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            {company.active && (
              <form action={onResend}>
                <input type="hidden" name="tenantId" value={company.id} />
                <button
                  type="submit"
                  disabled={resendPending}
                  className="min-h-10 inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-white hover:border-[#3B68F7] transition-colors cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                >
                  {resendPending ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="size-3.5" aria-hidden="true" />
                  )}
                  <span>Reenviar link do Authenticator</span>
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(company);
              }}
              className="min-h-10 inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-white hover:border-[#3B68F7] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              <span>Editar informações</span>
            </button>
          </div>

          <form action={switchTenantAction}>
            <input type="hidden" name="tenantId" value={company.id} />
            <button
              type="submit"
              className="min-h-10 inline-flex items-center gap-1.5 pill-gradient px-5 py-2 text-xs font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <span>Abrir visão do cliente</span>
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </Modal>
  );
}

function AIObservabilityModal({
  open,
  onClose,
  aiDashboard,
  onNotice,
}: {
  open: boolean;
  onClose: () => void;
  aiDashboard: AIObservabilityDashboardData;
  onNotice: (notice: { text: string; warning?: string }) => void;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"usage" | "knowledge" | "models">("usage");
  const [reindexingTenantId, setReindexingTenantId] = useState<string | null>(null);
  const [clearingCooldowns, setClearingCooldowns] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleReindex(tenantId: string, tenantName: string) {
    setLocalError(null);
    setReindexingTenantId(tenantId);
    const res = await reindexTenantKnowledgeAction(tenantId);
    setReindexingTenantId(null);
    if (!res.ok) {
      setLocalError(res.error ?? "Erro ao reindexar.");
      return;
    }
    onNotice({ text: `${tenantName}: ${res.message ?? "Reindexação iniciada."}` });
    router.refresh();
  }

  async function handleClearCooldowns() {
    setLocalError(null);
    setClearingCooldowns(true);
    const res = await clearAICooldownsAction();
    setClearingCooldowns(false);
    if (!res.ok) {
      setLocalError(res.error ?? "Erro ao limpar cooldowns.");
      return;
    }
    onNotice({ text: res.message ?? "Cooldowns limpos." });
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Observabilidade e Indexação de IA"
      description="Consumo mensal, saúde do índice híbrido (pgvector + FTS + pg_trgm) e política interna de modelos."
      size="lg"
    >
      <div className="space-y-5">
        <div
          role="tablist"
          aria-label="Seções de observabilidade de IA"
          className="inline-flex flex-wrap items-center gap-1 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 p-1"
        >
          {(
            [
              { key: "usage", label: "Consumo (Mês)" },
              { key: "knowledge", label: "Saúde da Indexação" },
              { key: "models", label: "Modelos Internos" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`min-h-9 rounded-full px-3.5 py-1.5 text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] ${
                activeTab === tab.key
                  ? "bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white shadow-2xs"
                  : "font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {localError && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300"
          >
            {localError}
          </p>
        )}

        {activeTab === "usage" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-b border-slate-200/80 dark:border-white/10">
                    <th className="px-4 py-3 font-bold">Empresa</th>
                    <th className="px-4 py-3 font-bold">Status IA</th>
                    <th className="px-4 py-3 font-bold">Respostas (mês)</th>
                    <th className="px-4 py-3 font-bold">Tokens (mês)</th>
                    <th className="px-4 py-3 font-bold">Latência média</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/10 tabular-nums">
                  {aiDashboard.monthlyUsage.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                        Nenhuma empresa cadastrada para exibir consumo.
                      </td>
                    </tr>
                  ) : (
                    aiDashboard.monthlyUsage.map((row) => (
                      <tr key={row.tenantId}>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900 dark:text-white">{row.tenantName}</p>
                          <p className="font-mono text-[11px] text-slate-500">{row.cnpj}</p>
                        </td>
                        <td className="px-4 py-3 space-y-1">
                          {row.hasToken ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/75 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                              <Sparkles className="size-3" aria-hidden="true" />
                              <span>IA Ativa</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                              Sem token
                            </span>
                          )}
                          {row.creditDepleted && (
                            <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                              Contingência gratuita (sem saldo)
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                          {row.messagesThisMonth}
                          {row.monthlyLimit > 0 ? ` / ${row.monthlyLimit}` : ""}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                          {formatCompactTokens(row.tokensThisMonth)}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                          {row.avgLatencyMs > 0 ? `${(row.avgLatencyMs / 1000).toFixed(1)}s` : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Tokens contabilizados a partir do retorno real da OpenRouter (prompt + resposta) no mês corrente.
            </p>
          </div>
        )}

        {activeTab === "knowledge" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-b border-slate-200/80 dark:border-white/10">
                    <th className="px-4 py-3 font-bold">Empresa</th>
                    <th className="px-4 py-3 font-bold">Chunks / Vetores</th>
                    <th className="px-4 py-3 font-bold">Resumos Mensais</th>
                    <th className="px-4 py-3 font-bold">Fila Outbox</th>
                    <th className="px-4 py-3 font-bold">Última Sync</th>
                    <th className="px-4 py-3 font-bold text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/10 tabular-nums">
                  {aiDashboard.knowledgeHealth.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                        Nenhum dado de indexação disponível.
                      </td>
                    </tr>
                  ) : (
                    aiDashboard.knowledgeHealth.map((row) => (
                      <tr key={row.tenantId}>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                          {row.tenantName}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                          <strong>{row.indexedChunks}</strong> chunks ·{" "}
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                            {row.embeddedChunks} vetores
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                          {row.monthlySummaries}
                        </td>
                        <td className="px-4 py-3">
                          {row.pendingOutbox === 0 && row.deadLetterOutbox === 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="size-3" aria-hidden="true" />
                              Sincronizado
                            </span>
                          ) : (
                            <div className="space-y-0.5">
                              {row.pendingOutbox > 0 && (
                                <p className="text-amber-700 dark:text-amber-300 font-semibold">
                                  {row.pendingOutbox} pendente(s)
                                  {row.oldestPendingMinutes > 0 ? ` (${row.oldestPendingMinutes} min)` : ""}
                                </p>
                              )}
                              {row.deadLetterOutbox > 0 && (
                                <p className="text-rose-700 dark:text-rose-300 font-semibold">
                                  {row.deadLetterOutbox} pausado(s) (FTS ativo)
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {row.lastIndexedAt}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={reindexingTenantId === row.tenantId}
                            onClick={() => void handleReindex(row.tenantId, row.tenantName)}
                            className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-[#3B68F7] hover:text-[#3B68F7] transition-colors cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                          >
                            {reindexingTenantId === row.tenantId ? (
                              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <RefreshCw className="size-3.5" aria-hidden="true" />
                            )}
                            <span>Reindexar</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Database className="size-3.5 text-[#3B68F7]" aria-hidden="true" />
              <span>
                Motor de busca híbrida: SQL Determinístico + FTS Português (GIN) + Trigram (pg_trgm) + Vetorial (
                <code className="font-mono">{aiDashboard.embeddingModel}</code> · {aiDashboard.embeddingDimensions}d).
              </span>
            </p>
          </div>
        )}

        {activeTab === "models" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-200/70 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-950/30 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-200">
                <Cpu className="size-4 shrink-0 text-[#3B68F7] mt-0.5" aria-hidden="true" />
                <span>
                  A seleção de modelos é <strong>controlada internamente em código</strong> para máxima velocidade,
                  consistência e menor custo por resposta.
                </span>
              </div>
              <button
                type="button"
                disabled={clearingCooldowns}
                onClick={() => void handleClearCooldowns()}
                className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-[11px] font-bold text-slate-800 dark:text-white hover:border-[#3B68F7] transition-colors cursor-pointer disabled:opacity-60"
              >
                {clearingCooldowns ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                )}
                <span>Limpar cooldowns Redis</span>
              </button>
            </div>

            <div className="grid gap-3">
              {aiDashboard.profiles.map((prof) => (
                <div
                  key={prof.key}
                  className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{prof.label}</p>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      TTFT {prof.ttftTimeoutSeconds}s · Total {prof.totalTimeoutSeconds}s · {prof.maxTokens} tok
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">{prof.description}</p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {prof.models.map((slug, idx) => (
                      <span
                        key={slug}
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                          idx === 0
                            ? "bg-blue-100 dark:bg-blue-950/80 text-[#3B68F7] dark:text-blue-300"
                            : "bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {idx + 1}. {slug}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {aiDashboard.stats.length > 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-x-auto">
                <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                  Telemetria histórica por modelo
                </div>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/70 dark:border-white/10 text-slate-500">
                      <th className="px-4 py-2">Modelo</th>
                      <th className="px-4 py-2">Perfil</th>
                      <th className="px-4 py-2">Respostas</th>
                      <th className="px-4 py-2">Tokens</th>
                      <th className="px-4 py-2">Latência</th>
                      <th className="px-4 py-2">Fallbacks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-white/10 tabular-nums">
                    {aiDashboard.stats.map((st) => (
                      <tr key={`${st.profileKey}-${st.model}`}>
                        <td className="px-4 py-2 font-mono text-[11px] font-semibold text-slate-900 dark:text-white">
                          {st.model}
                        </td>
                        <td className="px-4 py-2 font-mono text-[11px] text-slate-500">{st.profileKey}</td>
                        <td className="px-4 py-2">{st.calls}</td>
                        <td className="px-4 py-2">{formatCompactTokens(st.totalTokens)}</td>
                        <td className="px-4 py-2">{(st.avgLatencyMs / 1000).toFixed(1)}s</td>
                        <td className="px-4 py-2">{st.totalFallback}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function CompaniesView({ companies, aiDashboard, initialPartnerFilter = "" }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AccessFilter>("all");
  const [partnerFilter, setPartnerFilter] = useState(initialPartnerFilter);
  const [createOpen, setCreateOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyRow | null>(null);
  const [detailsCompany, setDetailsCompany] = useState<CompanyRow | null>(null);
  const [confirmToggleCompany, setConfirmToggleCompany] = useState<CompanyRow | null>(null);
  const [notice, setNotice] = useState<{ text: string; warning?: string } | null>(null);

  const [resendState, resendAction, resendPending] = useActionState(resendCompanyOwnerLinkAction, undefined);

  useEffect(() => {
    if (resendState?.ok && resendState.message) {
      setNotice({ text: resendState.message });
    }
  }, [resendState]);

  const stats = useMemo(() => {
    const total = companies.length;
    const active = companies.filter((c) => c.active).length;
    const accessed = companies.filter((c) => hasClientAccessed(c)).length;
    const pending = companies.filter((c) => !hasClientAccessed(c)).length;
    const online = companies.reduce((sum, c) => sum + c.activeSessionsCount, 0);
    return { total, active, inactive: total - active, accessed, pending, online };
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter((c) => {
      if (partnerFilter && c.parentPartnerTenantId !== partnerFilter) return false;
      if (filter === "accessed" && !hasClientAccessed(c)) return false;
      if (filter === "pending" && hasClientAccessed(c)) return false;
      if (filter === "inactive" && c.active) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.cnpj.toLowerCase().includes(q) ||
        c.ownerName.toLowerCase().includes(q) ||
        c.ownerEmail.toLowerCase().includes(q) ||
        c.parentPartnerName.toLowerCase().includes(q)
      );
    });
  }, [companies, query, filter, partnerFilter]);

  const activePartnerFilterName = useMemo(
    () => companies.find((c) => c.id === partnerFilter)?.name ?? "",
    [companies, partnerFilter],
  );

  return (
    <div className="space-y-5">
      {/* Cabeçalho exclusivo Master */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1 pt-1">
        <div>
          <h1 className="text-2xl sm:text-[32px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight text-balance">
            Gestão de empresas
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 text-pretty">
            Acompanhe quais clientes já acessaram a plataforma, edite dados cadastrais ou entre na visão exata de cada empresa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setModelsOpen(true)}
            className="min-h-11 inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 dark:text-white hover:border-[#3B68F7] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            <Gauge className="size-4 text-[#3B68F7]" aria-hidden="true" />
            <span>Observabilidade de IA</span>
          </button>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="min-h-11 inline-flex items-center gap-2 pill-gradient px-5 py-2.5 text-xs sm:text-sm font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>Nova empresa</span>
          </button>
        </div>
      </div>

      {/* Feedback de ações */}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/90 dark:bg-emerald-950/50 px-4 py-3.5 space-y-1.5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>{notice.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
            >
              Fechar
            </button>
          </div>
          {notice.warning && (
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-1.5 pl-6">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
              {notice.warning}
            </p>
          )}
        </div>
      )}

      {resendState?.error && (
        <p
          role="alert"
          className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-300"
        >
          {resendState.error}
        </p>
      )}

      {/* Faixa estruturada de métricas de adesão e acesso */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-white/10 rounded-[24px] solid-surface overflow-hidden">
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total de empresas</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {stats.total}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {stats.active} ativa(s) · {stats.inactive} desativada(s)
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Clientes que já acessaram</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {stats.accessed}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Authenticator validado e login registrado
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Aguardando 1º acesso</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
            {stats.pending}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Nunca acessaram a plataforma
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Clientes online agora</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-[#3B68F7] dark:text-blue-400 tabular-nums">
            {stats.online}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Sessões ativas nas empresas clientes
          </p>
        </div>
      </div>

      {/* Tabela principal full-width */}
      <section className="rounded-[28px] solid-surface p-5 sm:p-6 space-y-5">
        {partnerFilter && (
          <div className="rounded-2xl border border-blue-200/80 dark:border-blue-500/30 bg-blue-50/70 dark:bg-blue-950/35 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Filtrando carteira do parceiro:{" "}
              <strong className="text-[#3B68F7] dark:text-blue-300">
                {activePartnerFilterName || partnerFilter}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setPartnerFilter("")}
              className="font-bold text-[#3B68F7] dark:text-blue-300 hover:underline cursor-pointer"
            >
              Mostrar todas as empresas
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filtrar empresas por status de acesso"
            className="inline-flex flex-wrap items-center gap-1 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 p-1"
          >
            {(
              [
                { key: "all", label: `Todas (${stats.total})` },
                { key: "accessed", label: `Já acessaram (${stats.accessed})` },
                { key: "pending", label: `Nunca acessaram (${stats.pending})` },
                { key: "inactive", label: `Desativadas (${stats.inactive})` },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={filter === item.key}
                onClick={() => setFilter(item.key)}
                className={`min-h-9 rounded-full px-3.5 py-1.5 text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] ${
                  filter === item.key
                    ? "bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white shadow-2xs"
                    : "font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px] flex-1 sm:flex-initial">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400"
              aria-hidden="true"
            />
            <label htmlFor="companies-filter" className="sr-only">
              Buscar empresa por nome, CNPJ ou responsável
            </label>
            <input
              id="companies-filter"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Empresa, CNPJ ou responsável…"
              className="w-full min-h-10 rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>
        </div>

        {companies.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 dark:border-white/15 bg-slate-50/70 dark:bg-slate-800/40 px-6 py-12 text-center space-y-3.5">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-blue-500/15 text-[#3B68F7] dark:text-blue-300">
              <Building2 className="size-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-bold text-slate-900 dark:text-white">
                Nenhuma empresa cadastrada ainda
              </p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                A base está limpa para iniciar do zero. Cadastre a primeira empresa cliente para enviar o link do
                Google Authenticator ao responsável e acompanhar o primeiro acesso por aqui.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="min-h-11 inline-flex items-center gap-2 pill-gradient px-6 py-2.5 text-xs font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>Cadastrar primeira empresa</span>
            </button>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhuma empresa corresponde ao filtro selecionado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <th className="rounded-l-xl px-4 py-3.5">Empresa</th>
                  <th className="px-4 py-3.5">Responsável (Dono)</th>
                  <th className="px-4 py-3.5">Acesso do cliente</th>
                  <th className="px-4 py-3.5">Situação</th>
                  <th className="rounded-r-xl px-4 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                {filteredCompanies.map((c) => {
                  const accessed = hasClientAccessed(c);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-bold text-slate-900 dark:text-white">{c.name}</p>
                          {c.isPartner && (
                            <span className="rounded-full bg-indigo-100 dark:bg-indigo-950/80 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                              Parceira ({c.partnerPortfolioCount})
                            </span>
                          )}
                          {c.parentPartnerName && (
                            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                              Via: {c.parentPartnerName}
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.cnpj}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                          {c.contractsCount} contrato(s) · {c.employeesCount} colab. · {c.serviceOrdersCount} OS
                        </p>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {c.ownerName || "Não informado"}
                        </p>
                        <p className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {c.ownerEmail || "—"}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                          {c.membersCount} usuário(s) vinculado(s)
                        </p>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {c.ownerBlocked ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/80 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
                                <ShieldAlert className="size-3.5" aria-hidden="true" />
                                Responsável bloqueado
                              </span>
                            ) : accessed ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                                Já acessou
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
                                <Clock className="size-3.5" aria-hidden="true" />
                                Nunca acessou
                              </span>
                            )}

                            {c.activeSessionsCount > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-950/80 px-2 py-0.5 text-[11px] font-bold text-[#3B68F7] dark:text-blue-300">
                                <span className="size-1.5 rounded-full bg-[#3B68F7]" aria-hidden="true" />
                                Online ({c.activeSessionsCount})
                              </span>
                            )}
                          </div>

                          {accessed ? (
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                              {c.ownerLastLoginAt
                                ? `Último acesso: ${c.ownerLastLoginAt} (${c.ownerLoginCount}x)`
                                : "Google Authenticator configurado"}
                            </p>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="tabular-nums">
                                {c.lastInviteSentAt
                                  ? `Convite: ${c.lastInviteSentAt}`
                                  : `Criada em ${c.createdAt}`}
                              </span>
                              {c.active && (
                                <form action={resendAction}>
                                  <input type="hidden" name="tenantId" value={c.id} />
                                  <button
                                    type="submit"
                                    disabled={resendPending}
                                    className="font-bold text-[#3B68F7] dark:text-blue-400 hover:underline cursor-pointer disabled:opacity-50"
                                  >
                                    Reenviar link
                                  </button>
                                </form>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-col items-start gap-1.5">
                          {c.active ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                              <span className="size-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
                              Ativa
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 dark:bg-rose-950/80 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
                              <span className="size-1.5 rounded-full bg-rose-600" aria-hidden="true" />
                              Desativada
                            </span>
                          )}
                          {c.hasOpenrouterToken ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-950/80 px-2.5 py-0.5 text-[11px] font-bold text-[#3B68F7] dark:text-blue-300">
                                <Sparkles className="size-3" aria-hidden="true" />
                                <span>IA Ativa</span>
                              </span>
                              {c.aiCreditDepleted && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/75 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-200">
                                  <AlertTriangle className="size-3" aria-hidden="true" />
                                  Sem saldo (contingência)
                                </span>
                              )}
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                {c.aiMessagesThisMonth} resp. · {formatCompactTokens(c.aiTokensThisMonth)}/mês
                              </p>
                            </div>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              Sem IA
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <form action={switchTenantAction}>
                            <input type="hidden" name="tenantId" value={c.id} />
                            <button
                              type="submit"
                              title="Abrir o sistema exatamente como esta empresa visualiza"
                              className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-blue-200 dark:border-blue-500/30 bg-blue-50/90 dark:bg-blue-950/50 px-3 py-1.5 text-xs font-bold text-[#3B68F7] dark:text-blue-300 hover:bg-[#3B68F7] hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                            >
                              <ExternalLink className="size-3.5" aria-hidden="true" />
                              <span>Ver sistema</span>
                            </button>
                          </form>

                          <button
                            type="button"
                            onClick={() => setDetailsCompany(c)}
                            aria-label={`Ver detalhes e histórico de acesso de ${c.name}`}
                            title="Detalhes e histórico de acesso"
                            className="min-h-9 min-w-9 inline-flex items-center justify-center rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-700 dark:text-slate-200 hover:border-[#3B68F7] hover:text-[#3B68F7] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                          >
                            <Eye className="size-4" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingCompany(c)}
                            aria-label={`Editar informações de ${c.name}`}
                            title="Editar informações da empresa"
                            className="min-h-9 inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-white hover:border-[#3B68F7] hover:text-[#3B68F7] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                            <span>Editar</span>
                          </button>

                          {c.active ? (
                            <button
                              type="button"
                              onClick={() => setConfirmToggleCompany(c)}
                              title="Desativar empresa e desconectar usuários"
                              className="min-h-9 inline-flex items-center gap-1 rounded-full border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                            >
                              <PowerOff className="size-3.5" aria-hidden="true" />
                              <span>Desativar</span>
                            </button>
                          ) : (
                            <form action={toggleTenantActiveAction}>
                              <input type="hidden" name="tenantId" value={c.id} />
                              <button
                                type="submit"
                                title="Ativar acesso desta empresa"
                                className="min-h-9 inline-flex items-center gap-1 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                              >
                                <Power className="size-3.5" aria-hidden="true" />
                                <span>Ativar</span>
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modais inteligentes */}
      <AIObservabilityModal
        open={modelsOpen}
        onClose={() => setModelsOpen(false)}
        aiDashboard={aiDashboard}
        onNotice={setNotice}
      />

      <CreateCompanyModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={setNotice}
      />

      <EditCompanyModal
        company={editingCompany}
        onClose={() => setEditingCompany(null)}
        onUpdated={setNotice}
      />

      <CompanyDetailsModal
        company={detailsCompany}
        onClose={() => setDetailsCompany(null)}
        onEdit={(c) => setEditingCompany(c)}
        onResend={resendAction}
        resendPending={resendPending}
      />

      <ConfirmModal
        open={Boolean(confirmToggleCompany)}
        onClose={() => setConfirmToggleCompany(null)}
        title={`Desativar ${confirmToggleCompany?.name ?? "empresa"}?`}
        description={`Ao desativar esta empresa, o acesso será imediatamente bloqueado e todos os usuários não-Master conectados (${confirmToggleCompany?.activeSessionsCount ?? 0} sessão ativa agora) serão desconectados na hora.`}
        confirmLabel="Desativar empresa"
        tone="danger"
        formAction={toggleTenantActiveAction}
        hiddenFields={confirmToggleCompany ? { tenantId: confirmToggleCompany.id } : undefined}
      />
    </div>
  );
}
