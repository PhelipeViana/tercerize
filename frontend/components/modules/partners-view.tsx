"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Handshake,
  Layers,
  Loader2,
  Mail,
  Plus,
  Save,
  Search,
  Settings2,
  ShieldOff,
  Sparkles,
  UserPlus,
} from "lucide-react";
import {
  createPartnerCompanyStateAction,
  promoteOrUpdatePartnerStateAction,
  revokePartnerAction,
} from "@/app/actions/partners";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import type { CompanyRow } from "@/lib/operations/repository";
import { formatCNPJ } from "@/lib/utils/cnpj";

interface Props {
  companies: CompanyRow[];
}

interface PartnerFeatureDef {
  key: string;
  label: string;
  hint: string;
  defaultOn: boolean;
  futureTag?: boolean;
}

const PARTNER_FEATURE_DEFS: PartnerFeatureDef[] = [
  {
    key: "companies:create",
    label: "Cadastrar empresas",
    hint: "Permite cadastrar novas empresas clientes na própria carteira (respeitando a cota).",
    defaultOn: true,
  },
  {
    key: "companies:edit",
    label: "Editar empresas da carteira",
    hint: "Permite editar razão social, CNPJ e responsável apenas das empresas que cadastrou.",
    defaultOn: true,
  },
  {
    key: "companies:toggle_active",
    label: "Ativar / Desativar empresas",
    hint: "Permite suspender ou reativar empresas da própria carteira.",
    defaultOn: true,
  },
  {
    key: "companies:impersonate",
    label: "Abrir Ver sistema",
    hint: "Permite entrar na visão cliente das empresas da própria carteira.",
    defaultOn: true,
  },
  {
    key: "companies:ai_token",
    label: "Configurar Token OpenRouter",
    hint: "Permite informar ou atualizar o token de IA (plano Free por padrão).",
    defaultOn: true,
  },
  {
    key: "companies:ai_paid_plans",
    label: "Liberar planos pagos de IA",
    hint: "Permite ao parceiro escolher Padrão/Premium (além do Free) para seus clientes.",
    defaultOn: false,
    futureTag: true,
  },
  {
    key: "analytics:portfolio",
    label: "Relatórios da carteira",
    hint: "Reservado para futuros painéis consolidados de consumo e operação da carteira.",
    defaultOn: false,
    futureTag: true,
  },
];

function PartnerFeaturesChecklist({
  initialFeatures,
}: {
  initialFeatures?: Record<string, boolean>;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
          Recursos liberados no ambiente Parceiros
        </span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          Expansível pelo Admin Master
        </span>
      </div>
      <div className="divide-y divide-slate-200/70 dark:divide-white/10 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-800/40">
        {PARTNER_FEATURE_DEFS.map((feat) => {
          const checked =
            initialFeatures && Object.prototype.hasOwnProperty.call(initialFeatures, feat.key)
              ? Boolean(initialFeatures[feat.key])
              : feat.defaultOn;
          return (
            <label
              key={feat.key}
              className="flex items-start gap-3 px-3.5 py-2.5 text-xs cursor-pointer hover:bg-white/60 dark:hover:bg-white/5 transition-colors"
            >
              <input
                type="checkbox"
                name={`feat_${feat.key}`}
                defaultChecked={checked}
                className="mt-0.5 size-4 rounded border-slate-300 text-[#3B68F7] focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                  <span>{feat.label}</span>
                  {feat.futureTag && (
                    <span className="rounded-full bg-violet-100 dark:bg-violet-950/70 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                      Avançado
                    </span>
                  )}
                </span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {feat.hint}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function CreatePartnerModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (notice: { text: string; warning?: string }) => void;
}) {
  const [state, action, pending] = useActionState(createPartnerCompanyStateAction, undefined);
  const [cnpj, setCnpj] = useState("");
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (state?.values?.cnpj) {
      setCnpj(state.values.cnpj);
    } else if (state?.ok && state.createdName) {
      setCnpj("");
      onCreated({
        text: state.emailSent
          ? `Empresa parceira ${state.createdName} (${state.createdCnpj}) cadastrada e link do Authenticator enviado para ${state.ownerEmail}.`
          : `Empresa parceira ${state.createdName} (${state.createdCnpj}) cadastrada.`,
        warning: state.emailWarning || undefined,
      });
      onClose();
    }
  }, [state, onClose, onCreated]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cadastrar nova empresa parceira"
      description="Cria uma nova empresa já promovida ao ambiente Parceiros, com recursos controlados exclusivamente pelo Admin Master."
      size="lg"
    >
      <form action={action} noValidate className="space-y-4">
        {state?.message && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300"
          >
            {state.message}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="np-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Razão social da parceira *
            </label>
            <input
              id="np-name"
              name="name"
              required
              defaultValue={state?.values?.name ?? ""}
              placeholder="Ex.: Grupo Alpha Serviços Ltda…"
              className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
            {state?.fieldError?.field === "name" && (
              <p role="alert" className="text-xs font-semibold text-rose-600">{state.fieldError.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="np-cnpj" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              CNPJ único *
            </label>
            <input
              id="np-cnpj"
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

          <div className="space-y-1.5">
            <label htmlFor="np-owner-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Nome do dono parceiro *
            </label>
            <input
              id="np-owner-name"
              name="ownerName"
              required
              defaultValue={state?.values?.ownerName ?? ""}
              placeholder="Ex.: Carlos Henrique…"
              className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
            {state?.fieldError?.field === "ownerName" && (
              <p role="alert" className="text-xs font-semibold text-rose-600">{state.fieldError.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="np-owner-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              E-mail do dono parceiro *
            </label>
            <input
              id="np-owner-email"
              name="ownerEmail"
              type="email"
              spellCheck={false}
              required
              defaultValue={state?.values?.ownerEmail ?? ""}
              placeholder="parceiro@empresa.com.br"
              className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
            {state?.fieldError?.field === "ownerEmail" && (
              <p role="alert" className="text-xs font-semibold text-rose-600">{state.fieldError.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="np-quota" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Cota máxima de empresas
              </label>
              <span className="text-[11px] text-slate-500">0 = ilimitado</span>
            </div>
            <input
              id="np-quota"
              name="partnerMaxCompanies"
              type="number"
              min={0}
              max={10000}
              defaultValue={0}
              className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="np-token" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Token OpenRouter (opcional)
            </label>
            <div className="relative">
              <input
                id="np-token"
                name="openrouterToken"
                type={showToken ? "text" : "password"}
                spellCheck={false}
                autoComplete="off"
                placeholder="sk-or-v1-…"
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 pl-4 pr-11 py-2.5 font-mono text-xs text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
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
        </div>

        <div className="space-y-1.5">
          <label htmlFor="np-notes" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
            Observações comerciais internas (visível apenas ao Master)
          </label>
          <input
            id="np-notes"
            name="partnerNotes"
            placeholder="Ex.: Parceiro regional Centro-Oeste · contrato revenda…"
            className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          />
        </div>

        <PartnerFeaturesChecklist />

        <div className="rounded-2xl border border-blue-200/70 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-950/30 p-3 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
          <Mail className="size-4 shrink-0 text-[#3B68F7] mt-0.5" aria-hidden="true" />
          <span>
            O dono parceiro receberá o link do Google Authenticator por e-mail e verá o ambiente dedicado{" "}
            <strong>Parceiros</strong> no seletor do topo — sem acesso ao ambiente MASTER.
          </span>
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
            <span>Cadastrar parceiro</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PromoteOrEditPartnerModal({
  open,
  mode,
  targetCompany,
  eligibleCompanies,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "promote" | "update";
  targetCompany: CompanyRow | null;
  eligibleCompanies: CompanyRow[];
  onClose: () => void;
  onSaved: (notice: { text: string }) => void;
}) {
  const [state, action, pending] = useActionState(promoteOrUpdatePartnerStateAction, undefined);

  useEffect(() => {
    if (state?.ok && state.message) {
      onSaved({ text: state.message });
      onClose();
    }
  }, [state, onClose, onSaved]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        mode === "update"
          ? `Recursos de Parceiro · ${targetCompany?.name ?? ""}`
          : "Promover empresa existente para Parceira"
      }
      description={
        mode === "update"
          ? "Ligue ou desligue recursos liberados no ambiente Parceiros e ajuste a cota máxima de empresas."
          : "Selecione uma empresa ativa cadastrada diretamente pelo Master para liberar o ambiente Parceiros ao Dono."
      }
      size="lg"
    >
      <form
        key={`${mode}-${targetCompany?.id ?? "pick"}`}
        action={action}
        className="space-y-4"
      >
        <input type="hidden" name="mode" value={mode} />
        {mode === "update" && targetCompany && (
          <input type="hidden" name="tenantId" value={targetCompany.id} />
        )}

        {state?.error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300"
          >
            {state.error}
          </p>
        )}

        {mode === "promote" && (
          <div className="space-y-1.5">
            <label htmlFor="prom-tenant" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Empresa elegível *
            </label>
            {eligibleCompanies.length === 0 ? (
              <p className="rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 p-3.5 text-xs text-amber-800 dark:text-amber-200">
                Todas as empresas diretas ativas já estão promovidas como Parceiras. Use{" "}
                <strong>Novo parceiro</strong> para cadastrar uma nova.
              </p>
            ) : (
              <select
                id="prom-tenant"
                name="tenantId"
                required
                defaultValue={eligibleCompanies[0]?.id ?? ""}
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              >
                {eligibleCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.cnpj}) — Dono: {c.ownerName}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="prom-quota" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Cota máxima de empresas
              </label>
              <span className="text-[11px] text-slate-500">0 = ilimitado</span>
            </div>
            <input
              id="prom-quota"
              name="partnerMaxCompanies"
              type="number"
              min={0}
              max={10000}
              defaultValue={targetCompany?.partnerMaxCompanies ?? 0}
              className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="prom-notes" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Observações internas
            </label>
            <input
              id="prom-notes"
              name="partnerNotes"
              defaultValue={targetCompany?.partnerNotes ?? ""}
              placeholder="Ex.: Parceiro autorizado…"
              className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>
        </div>

        <PartnerFeaturesChecklist initialFeatures={targetCompany?.partnerFeatures} />

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
            disabled={pending || (mode === "promote" && eligibleCompanies.length === 0)}
            className="min-h-11 inline-flex items-center gap-2 pill-gradient px-6 py-2 text-xs font-bold cursor-pointer disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            <span>{mode === "update" ? "Salvar recursos" : "Promover para Parceira"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function PartnersView({ companies }: Props) {
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<CompanyRow | null>(null);
  const [revokingPartner, setRevokingPartner] = useState<CompanyRow | null>(null);
  const [notice, setNotice] = useState<{ text: string; warning?: string } | null>(null);

  const partners = useMemo(() => companies.filter((c) => c.isPartner), [companies]);
  const eligibleCompanies = useMemo(
    () => companies.filter((c) => !c.isPartner && c.active && !c.parentPartnerTenantId),
    [companies],
  );

  const stats = useMemo(() => {
    const totalPartners = partners.length;
    const activePartners = partners.filter((p) => p.active).length;
    const portfolioCompanies = companies.filter((c) => Boolean(c.parentPartnerTenantId)).length;
    const accessed = partners.filter((p) => p.ownerLoginCount > 0 || p.ownerTotpConfigured).length;
    const online = companies
      .filter((c) => c.isPartner || Boolean(c.parentPartnerTenantId))
      .reduce((sum, c) => sum + c.activeSessionsCount, 0);
    return { totalPartners, activePartners, portfolioCompanies, accessed, online };
  }, [companies, partners]);

  const filteredPartners = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.cnpj.toLowerCase().includes(q) ||
        p.ownerName.toLowerCase().includes(q) ||
        p.ownerEmail.toLowerCase().includes(q) ||
        p.partnerNotes.toLowerCase().includes(q),
    );
  }, [partners, query]);

  return (
    <div className="space-y-5">
      {/* Cabeçalho exclusivo Admin Master */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1 pt-1">
        <div>
          <h1 className="text-2xl sm:text-[32px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight text-balance">
            Empresas Donos Parceiras
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 text-pretty">
            Aba exclusiva do Admin Master. Promova empresas ao ambiente dedicado <strong>Parceiros</strong> e libere
            recursos gradualmente sem expor o painel MASTER.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setPromoteOpen(true)}
            className="min-h-11 inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 dark:text-white hover:border-[#3B68F7] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            <UserPlus className="size-4 text-[#3B68F7]" aria-hidden="true" />
            <span>Promover empresa</span>
          </button>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="min-h-11 inline-flex items-center gap-2 pill-gradient px-5 py-2.5 text-xs sm:text-sm font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>Novo parceiro</span>
          </button>
        </div>
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

      {/* Faixa KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-white/10 rounded-[24px] solid-surface overflow-hidden">
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Empresas parceiras</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {stats.totalPartners}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {stats.activePartners} ativa(s) no nível Parceiros
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Empresas na rede parceira</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-[#3B68F7] dark:text-blue-400 tabular-nums">
            {stats.portfolioCompanies}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Cadastradas por Donos Parceiros
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Parceiros com acesso ativo</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {stats.accessed}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Google Authenticator validado
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sessões online na rede</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {stats.online}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Parceiros e clientes conectados agora
          </p>
        </div>
      </div>

      {/* Tabela principal */}
      <section className="rounded-[28px] solid-surface p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <Handshake className="size-4 text-[#3B68F7]" aria-hidden="true" />
            <span>Parceiros habilitados ({partners.length})</span>
          </p>

          <div className="relative min-w-[240px] flex-1 sm:flex-initial">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400"
              aria-hidden="true"
            />
            <label htmlFor="partners-filter" className="sr-only">
              Buscar empresa parceira
            </label>
            <input
              id="partners-filter"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Empresa, CNPJ, dono ou observação…"
              className="w-full min-h-10 rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>
        </div>

        {partners.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 dark:border-white/15 bg-slate-50/70 dark:bg-slate-800/40 px-6 py-12 text-center space-y-3.5">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-blue-500/15 text-[#3B68F7] dark:text-blue-300">
              <Handshake className="size-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-bold text-slate-900 dark:text-white">
                Nenhuma empresa promovida ao nível Parceiros ainda
              </p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-lg mx-auto">
                Promova uma empresa existente (como <strong>D C Tecnologia</strong>) ou cadastre um novo parceiro para
                liberar o ambiente dedicado <strong>Parceiros</strong>.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              {eligibleCompanies.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPromoteOpen(true)}
                  className="min-h-11 inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-5 py-2.5 text-xs font-bold text-slate-800 dark:text-white hover:border-[#3B68F7] cursor-pointer"
                >
                  <UserPlus className="size-4 text-[#3B68F7]" aria-hidden="true" />
                  <span>Promover empresa existente</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="min-h-11 inline-flex items-center gap-2 pill-gradient px-6 py-2.5 text-xs font-bold cursor-pointer"
              >
                <Plus className="size-4" aria-hidden="true" />
                <span>Cadastrar novo parceiro</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <th className="rounded-l-xl px-4 py-3.5">Empresa Parceira</th>
                  <th className="px-4 py-3.5">Dono Parceiro</th>
                  <th className="px-4 py-3.5">Carteira</th>
                  <th className="px-4 py-3.5">Recursos liberados</th>
                  <th className="rounded-r-xl px-4 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                {filteredPartners.map((p) => {
                  const accessed = p.ownerLoginCount > 0 || p.ownerTotpConfigured;
                  const enabledFeatures = PARTNER_FEATURE_DEFS.filter((f) => Boolean(p.partnerFeatures[f.key]));
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 dark:text-white">{p.name}</p>
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-950/80 px-2 py-0.5 text-[10px] font-bold text-[#3B68F7] dark:text-blue-300">
                            <Handshake className="size-2.5" aria-hidden="true" />
                            Parceiro
                          </span>
                        </div>
                        <p className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.cnpj}</p>
                        {p.partnerNotes && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">{p.partnerNotes}</p>
                        )}
                      </td>

                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-slate-900 dark:text-white">{p.ownerName}</p>
                        <p className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.ownerEmail}</p>
                        <div className="mt-1">
                          {accessed ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/75 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="size-3" aria-hidden="true" />
                              Já acessou
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/75 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                              <Clock className="size-3" aria-hidden="true" />
                              Nunca acessou
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top tabular-nums">
                        <p className="font-bold text-slate-900 dark:text-white">
                          {p.partnerPortfolioCount} empresa(s)
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Cota: {p.partnerMaxCompanies > 0 ? `máx. ${p.partnerMaxCompanies}` : "Ilimitada"}
                        </p>
                        <Link
                          href={`/admin/companies?partner=${encodeURIComponent(p.id)}`}
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#3B68F7] dark:text-blue-400 hover:underline"
                        >
                          <Layers className="size-3" aria-hidden="true" />
                          <span>Ver carteira</span>
                          <ArrowUpRight className="size-3" aria-hidden="true" />
                        </Link>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {enabledFeatures.length === 0 ? (
                            <span className="text-[11px] text-slate-400">Nenhum recurso ativo</span>
                          ) : (
                            enabledFeatures.map((f) => (
                              <span
                                key={f.key}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-200"
                              >
                                {f.key === "companies:ai_token" && <Sparkles className="size-2.5 text-[#3B68F7]" aria-hidden="true" />}
                                {f.label}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingPartner(p)}
                            className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-white hover:border-[#3B68F7] hover:text-[#3B68F7] transition-colors cursor-pointer"
                          >
                            <Settings2 className="size-3.5" aria-hidden="true" />
                            <span>Recursos</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setRevokingPartner(p)}
                            className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors cursor-pointer"
                          >
                            <ShieldOff className="size-3.5" aria-hidden="true" />
                            <span>Remover promoção</span>
                          </button>
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

      <CreatePartnerModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={setNotice}
      />

      <PromoteOrEditPartnerModal
        open={promoteOpen}
        mode="promote"
        targetCompany={null}
        eligibleCompanies={eligibleCompanies}
        onClose={() => setPromoteOpen(false)}
        onSaved={setNotice}
      />

      <PromoteOrEditPartnerModal
        open={Boolean(editingPartner)}
        mode="update"
        targetCompany={editingPartner}
        eligibleCompanies={eligibleCompanies}
        onClose={() => setEditingPartner(null)}
        onSaved={setNotice}
      />

      <ConfirmModal
        open={Boolean(revokingPartner)}
        onClose={() => setRevokingPartner(null)}
        title={`Remover promoção de ${revokingPartner?.name ?? "parceiro"}?`}
        description="O dono perderá imediatamente o acesso ao ambiente Parceiros e não poderá cadastrar ou gerenciar novas empresas. As empresas clientes já criadas por ele continuarão ativas sob governança do Admin Master."
        confirmLabel="Remover promoção"
        tone="danger"
        formAction={revokePartnerAction}
        hiddenFields={revokingPartner ? { tenantId: revokingPartner.id } : undefined}
      />
    </div>
  );
}
