"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Handshake,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Save,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { switchTenantAction } from "@/app/actions/auth";
import {
  partnerCreateCompanyStateAction,
  partnerResendCompanyOwnerLinkAction,
  partnerToggleCompanyActiveAction,
  partnerUpdateCompanyStateAction,
} from "@/app/actions/partners";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import type { CompanyRow } from "@/lib/operations/repository";
import { formatCNPJ } from "@/lib/utils/cnpj";

interface Props {
  partnerTenantName: string;
  partnerMaxCompanies: number;
  partnerFeatures: Record<string, boolean>;
  companies: CompanyRow[];
}

type AccessFilter = "all" | "accessed" | "pending" | "inactive";

function hasClientAccessed(c: CompanyRow): boolean {
  return c.ownerLoginCount > 0 || c.ownerTotpConfigured;
}

function PartnerCreateModal({
  open,
  canSetToken,
  onClose,
  onCreated,
}: {
  open: boolean;
  canSetToken: boolean;
  onClose: () => void;
  onCreated: (notice: { text: string; warning?: string }) => void;
}) {
  const [state, createAction, pending] = useActionState(partnerCreateCompanyStateAction, undefined);
  const [cnpj, setCnpj] = useState("");
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (state?.values?.cnpj) {
      setCnpj(state.values.cnpj);
    } else if (state?.ok && state.createdName) {
      setCnpj("");
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
      title="Cadastrar nova empresa cliente"
      description="A empresa ficará vinculada exclusivamente à sua carteira Parceira e receberá o link do Google Authenticator por e-mail."
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
          <label htmlFor="pc-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
            Razão social da empresa *
          </label>
          <input
            id="pc-name"
            name="name"
            required
            defaultValue={state?.values?.name ?? ""}
            placeholder="Ex.: Pantanal Facilities Ltda…"
            className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          />
          {state?.fieldError?.field === "name" && (
            <p role="alert" className="text-xs font-semibold text-rose-600">{state.fieldError.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="pc-cnpj" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
            CNPJ único *
          </label>
          <input
            id="pc-cnpj"
            name="cnpj"
            inputMode="numeric"
            maxLength={18}
            required
            value={cnpj}
            onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
            placeholder="00.000.000/0001-00"
            className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          />
          {state?.fieldError?.field === "cnpj" && (
            <p role="alert" className="text-xs font-semibold text-rose-600">{state.fieldError.message}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="pc-owner-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Nome do responsável (Dono) *
            </label>
            <input
              id="pc-owner-name"
              name="ownerName"
              required
              defaultValue={state?.values?.ownerName ?? ""}
              placeholder="Ex.: Rafael Carvalho…"
              className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
            {state?.fieldError?.field === "ownerName" && (
              <p role="alert" className="text-xs font-semibold text-rose-600">{state.fieldError.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="pc-owner-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              E-mail do responsável (Dono) *
            </label>
            <input
              id="pc-owner-email"
              name="ownerEmail"
              type="email"
              spellCheck={false}
              required
              defaultValue={state?.values?.ownerEmail ?? ""}
              placeholder="responsavel@empresa.com.br"
              className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
            {state?.fieldError?.field === "ownerEmail" && (
              <p role="alert" className="text-xs font-semibold text-rose-600">{state.fieldError.message}</p>
            )}
          </div>
        </div>

        {canSetToken && (
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-800/40 p-3.5 space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="pc-or-token" className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-[#3B68F7]" aria-hidden="true" />
                <span>Token OpenRouter (Assistente IA)</span>
              </label>
              <span className="text-[11px] text-slate-500">Opcional · exclusivo desta empresa</span>
            </div>
            <div className="relative">
              <input
                id="pc-or-token"
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
                aria-label={showToken ? "Ocultar token" : "Mostrar token"}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-h-9 min-w-9 inline-flex items-center justify-center rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                {showToken ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
              </button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-blue-200/70 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-950/30 p-3 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
          <Mail className="size-4 shrink-0 text-[#3B68F7] mt-0.5" aria-hidden="true" />
          <span>O link do Google Authenticator será enviado automaticamente para o e-mail informado.</span>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-full border border-slate-300 dark:border-white/15 px-5 py-2 text-xs font-semibold cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 inline-flex items-center gap-2 pill-gradient px-6 py-2 text-xs font-bold cursor-pointer disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            <span>Cadastrar e enviar link</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PartnerEditModal({
  company,
  canToggle,
  canSetToken,
  onClose,
  onUpdated,
}: {
  company: CompanyRow | null;
  canToggle: boolean;
  canSetToken: boolean;
  onClose: () => void;
  onUpdated: (notice: { text: string; warning?: string }) => void;
}) {
  const [editState, editAction, pending] = useActionState(partnerUpdateCompanyStateAction, undefined);
  const [name, setName] = useState(company?.name ?? "");
  const [cnpj, setCnpj] = useState(company?.cnpj ?? "");
  const [ownerName, setOwnerName] = useState(company?.ownerName ?? "");
  const [ownerEmail, setOwnerEmail] = useState(company?.ownerEmail ?? "");
  const [active, setActive] = useState(company?.active ? "true" : "false");
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (company) {
      setName(company.name);
      setCnpj(company.cnpj);
      setOwnerName(company.ownerName);
      setOwnerEmail(company.ownerEmail);
      setActive(company.active ? "true" : "false");
    }
  }, [company]);

  useEffect(() => {
    if (editState?.ok && editState.updatedName) {
      onUpdated({
        text: editState.emailSent
          ? `Empresa ${editState.updatedName} atualizada e link enviado ao responsável.`
          : `Empresa ${editState.updatedName} atualizada com sucesso.`,
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
      title="Editar empresa da carteira"
      description="Altere dados cadastrais, responsável ou token OpenRouter desta empresa."
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
          <label htmlFor="pe-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
            Razão social *
          </label>
          <input
            id="pe-name"
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="pe-cnpj" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              CNPJ *
            </label>
            <input
              id="pe-cnpj"
              name="cnpj"
              inputMode="numeric"
              maxLength={18}
              required
              value={cnpj}
              onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
              className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 font-mono text-sm text-slate-900 dark:text-white"
            />
          </div>

          {canToggle && (
            <div className="space-y-1.5">
              <label htmlFor="pe-active" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Situação
              </label>
              <select
                id="pe-active"
                name="active"
                value={active}
                onChange={(e) => setActive(e.target.value)}
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-900 dark:text-white"
              >
                <option value="true">Ativa</option>
                <option value="false">Desativada</option>
              </select>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="pe-owner-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Nome do responsável *
            </label>
            <input
              id="pe-owner-name"
              name="ownerName"
              required
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="pe-owner-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              E-mail do responsável *
            </label>
            <input
              id="pe-owner-email"
              name="ownerEmail"
              type="email"
              spellCheck={false}
              required
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {canSetToken && (
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-800/40 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="pe-token" className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-[#3B68F7]" aria-hidden="true" />
                <span>Token OpenRouter (Assistente IA)</span>
              </label>
              <span className="font-mono text-[11px] text-slate-500">
                {company.hasOpenrouterToken ? `Ativo (${company.openrouterTokenHint || "configurado"})` : "Não configurado"}
              </span>
            </div>
            <div className="relative">
              <input
                id="pe-token"
                name="openrouterToken"
                type={showToken ? "text" : "password"}
                spellCheck={false}
                autoComplete="off"
                placeholder={company.hasOpenrouterToken ? "Novo token para substituir ou deixe em branco…" : "sk-or-v1-… (opcional)"}
                className="w-full min-h-10 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 pl-3.5 pr-10 py-2 font-mono text-xs text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                aria-label={showToken ? "Ocultar token" : "Mostrar token"}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-8 min-w-8 inline-flex items-center justify-center rounded-full text-slate-500 cursor-pointer"
              >
                {showToken ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
              </button>
            </div>
            {company.hasOpenrouterToken && (
              <label className="inline-flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 cursor-pointer">
                <input type="checkbox" name="clearOpenrouterToken" className="size-4 rounded border-rose-300 text-rose-600" />
                <span>Remover token OpenRouter desta empresa</span>
              </label>
            )}
          </div>
        )}

        <label className="flex items-center gap-2.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
          <input type="checkbox" name="resendLink" className="size-4 rounded border-slate-300 text-[#3B68F7]" />
          <span>Reenviar link do Google Authenticator ao responsável ao salvar</span>
        </label>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-full border border-slate-300 dark:border-white/15 px-5 py-2 text-xs font-semibold cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 inline-flex items-center gap-2 pill-gradient px-6 py-2 text-xs font-bold cursor-pointer disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            <span>Salvar alterações</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function PartnerCompaniesView({
  partnerTenantName,
  partnerMaxCompanies,
  partnerFeatures,
  companies,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AccessFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyRow | null>(null);
  const [detailsCompany, setDetailsCompany] = useState<CompanyRow | null>(null);
  const [confirmToggleCompany, setConfirmToggleCompany] = useState<CompanyRow | null>(null);
  const [notice, setNotice] = useState<{ text: string; warning?: string } | null>(null);

  const [resendState, resendAction, resendPending] = useActionState(partnerResendCompanyOwnerLinkAction, undefined);

  useEffect(() => {
    if (resendState?.ok && resendState.message) {
      setNotice({ text: resendState.message });
    }
  }, [resendState]);

  const canCreate = Boolean(partnerFeatures["companies:create"]);
  const canEdit = Boolean(partnerFeatures["companies:edit"]);
  const canToggle = Boolean(partnerFeatures["companies:toggle_active"]);
  const canImpersonate = Boolean(partnerFeatures["companies:impersonate"]);
  const canSetToken = Boolean(partnerFeatures["companies:ai_token"]);
  const quotaReached = partnerMaxCompanies > 0 && companies.length >= partnerMaxCompanies;

  const stats = useMemo(() => {
    const total = companies.length;
    const active = companies.filter((c) => c.active).length;
    const accessed = companies.filter((c) => hasClientAccessed(c)).length;
    const pending = companies.filter((c) => !hasClientAccessed(c)).length;
    const online = companies.reduce((sum, c) => sum + c.activeSessionsCount, 0);
    return { total, active, inactive: total - active, accessed, pending, online };
  }, [companies]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter((c) => {
      if (filter === "accessed" && !hasClientAccessed(c)) return false;
      if (filter === "pending" && hasClientAccessed(c)) return false;
      if (filter === "inactive" && c.active) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.cnpj.toLowerCase().includes(q) ||
        c.ownerName.toLowerCase().includes(q) ||
        c.ownerEmail.toLowerCase().includes(q)
      );
    });
  }, [companies, query, filter]);

  return (
    <div className="space-y-5">
      {/* Cabeçalho dedicado do ambiente Parceiros */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1 pt-1">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-950/80 px-2.5 py-0.5 text-[11px] font-bold text-[#3B68F7] dark:text-blue-300">
              <Handshake className="size-3.5" aria-hidden="true" />
              Ambiente Parceiros
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
              {partnerMaxCompanies > 0
                ? `Cota: ${companies.length} de ${partnerMaxCompanies} empresas`
                : `${companies.length} empresa(s) na carteira`}
            </span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-[32px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight text-balance">
            Empresas da carteira · {partnerTenantName}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 text-pretty">
            Cadastre e gerencie exclusivamente as empresas clientes vinculadas à sua conta Parceira.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            disabled={quotaReached}
            onClick={() => setCreateOpen(true)}
            title={quotaReached ? "Limite de empresas da sua cota atingido" : "Cadastrar nova empresa cliente"}
            className="min-h-11 inline-flex items-center gap-2 pill-gradient px-5 py-2.5 text-xs sm:text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>{quotaReached ? "Cota atingida" : "Nova empresa"}</span>
          </button>
        )}
      </div>

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
        <p role="alert" className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
          {resendState.error}
        </p>
      )}

      {/* Faixa KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-white/10 rounded-[24px] solid-surface overflow-hidden">
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Empresas na carteira</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {stats.total}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {stats.active} ativa(s) · {stats.inactive} desativada(s)
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Já acessaram</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {stats.accessed}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Authenticator validado</p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Aguardando 1º acesso</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
            {stats.pending}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Nunca acessaram</p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Clientes online</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-[#3B68F7] dark:text-blue-400 tabular-nums">
            {stats.online}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Sessões ativas na carteira</p>
        </div>
      </div>

      {/* Tabela */}
      <section className="rounded-[28px] solid-surface p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filtrar empresas da carteira"
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
                className={`min-h-9 rounded-full px-3.5 py-1.5 text-xs transition-colors cursor-pointer ${
                  filter === item.key
                    ? "bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white shadow-2xs"
                    : "font-medium text-slate-600 dark:text-slate-300"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px] flex-1 sm:flex-initial">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" aria-hidden="true" />
            <label htmlFor="partner-comp-search" className="sr-only">
              Buscar empresa na carteira
            </label>
            <input
              id="partner-comp-search"
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
                Nenhuma empresa cadastrada na sua carteira ainda
              </p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                Cadastre sua primeira empresa cliente para enviar o link do Google Authenticator ao responsável e
                acompanhar o acesso por aqui.
              </p>
            </div>
            {canCreate && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="min-h-11 inline-flex items-center gap-2 pill-gradient px-6 py-2.5 text-xs font-bold cursor-pointer"
              >
                <Plus className="size-4" aria-hidden="true" />
                <span>Cadastrar primeira empresa</span>
              </button>
            )}
          </div>
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
                {filtered.map((c) => {
                  const accessed = hasClientAccessed(c);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4 align-top">
                        <p className="font-bold text-slate-900 dark:text-white">{c.name}</p>
                        <p className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.cnpj}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                          {c.contractsCount} contrato(s) · {c.employeesCount} colab. · {c.serviceOrdersCount} OS
                        </p>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-slate-900 dark:text-white">{c.ownerName || "—"}</p>
                        <p className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.ownerEmail || "—"}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                          {c.membersCount} usuário(s)
                        </p>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {c.ownerBlocked ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/80 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
                                <ShieldAlert className="size-3.5" aria-hidden="true" />
                                Bloqueado
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
                          </div>
                          {!accessed && c.active && (
                            <form action={resendAction}>
                              <input type="hidden" name="tenantId" value={c.id} />
                              <button
                                type="submit"
                                disabled={resendPending}
                                className="text-[11px] font-bold text-[#3B68F7] dark:text-blue-400 hover:underline cursor-pointer"
                              >
                                Reenviar link
                              </button>
                            </form>
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
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-950/80 px-2.5 py-0.5 text-[11px] font-bold text-[#3B68F7] dark:text-blue-300">
                              <Sparkles className="size-3" aria-hidden="true" />
                              IA ativa
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                              Sem IA
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          {canImpersonate && (
                            <form action={switchTenantAction}>
                              <input type="hidden" name="tenantId" value={c.id} />
                              <button
                                type="submit"
                                className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-blue-200 dark:border-blue-500/30 bg-blue-50/90 dark:bg-blue-950/50 px-3 py-1.5 text-xs font-bold text-[#3B68F7] dark:text-blue-300 hover:bg-[#3B68F7] hover:text-white transition-colors cursor-pointer"
                              >
                                <ExternalLink className="size-3.5" aria-hidden="true" />
                                <span>Ver sistema</span>
                              </button>
                            </form>
                          )}

                          <button
                            type="button"
                            onClick={() => setDetailsCompany(c)}
                            aria-label={`Ver detalhes de ${c.name}`}
                            className="min-h-9 min-w-9 inline-flex items-center justify-center rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-700 dark:text-slate-200 hover:border-[#3B68F7] cursor-pointer"
                          >
                            <Eye className="size-4" aria-hidden="true" />
                          </button>

                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => setEditingCompany(c)}
                              className="min-h-9 inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-white hover:border-[#3B68F7] cursor-pointer"
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                              <span>Editar</span>
                            </button>
                          )}

                          {canToggle &&
                            (c.active ? (
                              <button
                                type="button"
                                onClick={() => setConfirmToggleCompany(c)}
                                className="min-h-9 inline-flex items-center gap-1 rounded-full border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 cursor-pointer"
                              >
                                <PowerOff className="size-3.5" aria-hidden="true" />
                                <span>Desativar</span>
                              </button>
                            ) : (
                              <form action={partnerToggleCompanyActiveAction}>
                                <input type="hidden" name="tenantId" value={c.id} />
                                <button
                                  type="submit"
                                  className="min-h-9 inline-flex items-center gap-1 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer"
                                >
                                  <Power className="size-3.5" aria-hidden="true" />
                                  <span>Ativar</span>
                                </button>
                              </form>
                            ))}
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

      <PartnerCreateModal
        open={createOpen}
        canSetToken={canSetToken}
        onClose={() => setCreateOpen(false)}
        onCreated={setNotice}
      />

      <PartnerEditModal
        company={editingCompany}
        canToggle={canToggle}
        canSetToken={canSetToken}
        onClose={() => setEditingCompany(null)}
        onUpdated={setNotice}
      />

      {/* Modal de detalhes */}
      <Modal
        open={Boolean(detailsCompany)}
        onClose={() => setDetailsCompany(null)}
        title={detailsCompany?.name ?? ""}
        description={detailsCompany ? `CNPJ ${detailsCompany.cnpj} · Cadastrada em ${detailsCompany.createdAt}` : ""}
        size="md"
      >
        {detailsCompany && (
          <div className="space-y-4 text-xs">
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-800/50 p-4 space-y-2">
              <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Activity className="size-4 text-[#3B68F7]" aria-hidden="true" />
                Auditoria de acesso
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Último acesso: <strong>{detailsCompany.ownerLastLoginAt ?? "Nunca acessou"}</strong> ({detailsCompany.ownerLoginCount}x)
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Sessões ativas agora: <strong>{detailsCompany.activeSessionsCount}</strong>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-3.5 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <UserCheck className="size-3.5 text-[#3B68F7]" aria-hidden="true" />
                  Responsável
                </p>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{detailsCompany.ownerName}</p>
                <p className="font-mono text-[11px] text-slate-500">{detailsCompany.ownerEmail}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-3.5 space-y-1 tabular-nums">
                <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Users className="size-3.5 text-[#3B68F7]" aria-hidden="true" />
                  Operação
                </p>
                <p>{detailsCompany.clientsCount} cliente(s) · {detailsCompany.contractsCount} contrato(s)</p>
                <p>{detailsCompany.employeesCount} colaborador(es) · {detailsCompany.serviceOrdersCount} OS</p>
              </div>
            </div>
            {detailsCompany.active && (
              <div className="flex justify-end pt-2">
                <form action={resendAction}>
                  <input type="hidden" name="tenantId" value={detailsCompany.id} />
                  <button
                    type="submit"
                    disabled={resendPending}
                    className="min-h-10 inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 px-4 py-2 text-xs font-semibold cursor-pointer"
                  >
                    <Send className="size-3.5" aria-hidden="true" />
                    <span>Reenviar link do Authenticator</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={Boolean(confirmToggleCompany)}
        onClose={() => setConfirmToggleCompany(null)}
        title={`Desativar ${confirmToggleCompany?.name ?? "empresa"}?`}
        description="O acesso dos usuários desta empresa será bloqueado imediatamente até que ela seja reativada."
        confirmLabel="Desativar empresa"
        tone="danger"
        formAction={partnerToggleCompanyActiveAction}
        hiddenFields={confirmToggleCompany ? { tenantId: confirmToggleCompany.id } : undefined}
      />
    </div>
  );
}
