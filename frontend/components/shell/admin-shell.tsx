"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  BarChart3,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  HelpCircle,
  Layers,
  LogOut,
  Menu,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { logout, switchTenantAction } from "@/app/actions/auth";
import { Logo } from "@/components/brand/logo";
import { OnboardingBanner } from "@/components/shell/onboarding-banner";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Modal } from "@/components/ui/modal";
import type { SessionContext } from "@/lib/auth/repository";
import type { CompanyRow } from "@/lib/operations/repository";
import { cn } from "@/lib/utils";

export type ModuleKey =
  | "contracts"
  | "service-orders"
  | "employees"
  | "epis"
  | "inventory-items"
  | "finance"
  | "permissions"
  | "assistant"
  | "companies";

interface NavItem {
  key: ModuleKey;
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  accessManageOnly?: boolean;
  masterOnly?: boolean;
}

const CLIENT_NAV_ITEMS: NavItem[] = [
  { key: "contracts", label: "Clientes e contratos", href: "/admin/contracts", icon: Users, permission: "contracts:view" },
  { key: "service-orders", label: "Ordens de serviço", href: "/admin/service-orders", icon: ClipboardList, permission: "service_orders:view" },
  { key: "employees", label: "Colaboradores e escalas", href: "/admin/employees", icon: Calendar, permission: "employees:view" },
  { key: "epis", label: "Controle de EPIs", href: "/admin/epis", icon: Shield, permission: "epis:view" },
  { key: "inventory-items", label: "Almoxarifado e ativos", href: "/admin/inventory-items", icon: Archive, permission: "inventory:view" },
  { key: "finance", label: "Gestão financeira", href: "/admin/finance", icon: BarChart3, permission: "finance:view" },
  { key: "assistant", label: "Assistente IA", href: "/admin/assistant", icon: Sparkles, permission: "ai_chat:use" },
  { key: "permissions", label: "Roles e permissões", href: "/admin/permissions", icon: ShieldCheck, accessManageOnly: true },
];

const MASTER_NAV_ITEMS: NavItem[] = [
  { key: "companies", label: "Gestão de empresas", href: "/admin/companies", icon: Layers, masterOnly: true },
];

interface AdminShellProps {
  session: SessionContext;
  companies: CompanyRow[];
  current: ModuleKey;
  title: string;
  subtitle: string;
  action?: ReactNode;
  hideHeader?: boolean;
  children: ReactNode;
}

export function AdminShell({
  session,
  companies,
  current,
  title,
  subtitle,
  action,
  hideHeader = false,
  children,
}: AdminShellProps) {
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [companyQuery, setCompanyQuery] = useState("");
  const [switchedNotice, setSwitchedNotice] = useState<string | null>(null);

  const isMaster = session.user.isMaster;
  const hasActiveTenant = Boolean(session.tenant.id);
  const isMasterGlobalMode = isMaster && !hasActiveTenant;
  const canManageAccess = isMaster || session.role.key === "owner" || Boolean(session.role.permissions["access:manage"]);

  // Separação estrita:
  // - No contexto MASTER (sem empresa selecionada): exibe SOMENTE opções exclusivas do Master.
  // - Quando seleciona uma empresa cliente: exibe EXATAMENTE o menu que o cliente vê (sem opções do Master).
  const visibleItems = isMasterGlobalMode
    ? MASTER_NAV_ITEMS
    : CLIENT_NAV_ITEMS.filter((item) => {
        if (item.key === "assistant" && !session.tenant.hasOpenrouterToken && !isMaster && session.role.key !== "owner") {
          return false;
        }
        if (item.accessManageOnly) return canManageAccess;
        if (item.permission) {
          return isMaster || session.role.key === "owner" || Boolean(session.role.permissions[item.permission]);
        }
        return true;
      });

  const activeCompany = hasActiveTenant ? companies.find((c) => c.id === session.tenant.id) : undefined;
  const showContextDropdown = isMaster || companies.length > 1;

  useEffect(() => {
    try {
      const storageKey = "tercerize_active_context_id";
      const nextKey = isMasterGlobalMode ? "MASTER" : session.tenant.id;
      const prev = window.sessionStorage.getItem(storageKey);
      if (prev && prev !== nextKey) {
        if (isMasterGlobalMode) {
          setSwitchedNotice("Painel Global MASTER");
        } else {
          setSwitchedNotice(`${session.tenant.name} (${session.tenant.cnpj})`);
        }
      }
      window.sessionStorage.setItem(storageKey, nextKey);
    } catch {
      // ignore storage errors
    }
  }, [isMasterGlobalMode, session.tenant.id, session.tenant.name, session.tenant.cnpj]);

  const filteredCompanies = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.cnpj.toLowerCase().includes(q) ||
        c.ownerName.toLowerCase().includes(q) ||
        c.ownerEmail.toLowerCase().includes(q),
    );
  }, [companies, companyQuery]);

  return (
    <div className="admin-shell-root flex h-dvh overflow-hidden p-2.5 sm:p-5 gap-4 sm:gap-5">
      {open && (
        <button
          type="button"
          aria-label="Fechar menu lateral"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Floating Glass Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-3 left-3 z-40 flex w-64 shrink-0 flex-col rounded-[28px] glass-surface px-4 py-6 transition-transform motion-reduce:transition-none md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-[110%]",
        )}
      >
        <div className="flex items-center justify-between px-3 pb-6">
          <Logo />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="md:hidden min-h-10 min-w-10 flex items-center justify-center rounded-full p-2 text-slate-500 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Menu principal" className="flex-1 overflow-y-auto space-y-1.5 px-1">
          <ul className="space-y-1.5">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = current === item.key;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex w-full min-h-11 items-center gap-3.5 px-4 py-3 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]",
                      isActive
                        ? "rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold shadow-xs"
                        : "rounded-2xl font-medium text-slate-700 dark:text-slate-300 hover:bg-white/75 dark:hover:bg-white/5 hover:text-slate-950 dark:hover:text-white",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-[19px] shrink-0 stroke-[1.8]",
                        isActive
                          ? "text-white dark:text-slate-900"
                          : "text-slate-700 dark:text-slate-300",
                      )}
                      aria-hidden="true"
                    />
                    <span className="leading-snug">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom User Profile Pill */}
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 px-3 py-2.5">
          <div
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-900 dark:bg-blue-600 text-white font-bold text-sm shadow-xs"
          >
            {session.user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
              {session.user.name}
            </p>
            <p className="truncate text-[11px] font-semibold text-[#3B68F7] dark:text-blue-400">
              {isMasterGlobalMode ? "Master Global" : isMaster ? "Master (visão cliente)" : session.role.name}
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title="Sair da plataforma"
              aria-label="Sair da plataforma"
              className="min-h-10 min-w-10 flex items-center justify-center rounded-xl p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col gap-4 sm:gap-5 overflow-hidden">
        {/* Top Floating Glass Bar */}
        <header className="relative z-20 flex shrink-0 items-center justify-between gap-2 rounded-2xl glass-surface px-3.5 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
              className="md:hidden min-h-11 min-w-11 flex items-center justify-center rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <Menu className="size-4.5" aria-hidden="true" />
            </button>

            {isMasterGlobalMode ? (
              <div className="hidden lg:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <ShieldCheck className="size-4 text-[#3B68F7] dark:text-blue-400" aria-hidden="true" />
                <span>
                  Ambiente exclusivo <strong className="text-slate-900 dark:text-white">MASTER</strong>
                </span>
              </div>
            ) : isMaster ? (
              <div className="hidden sm:flex items-center gap-2.5 min-w-0">
                <form action={switchTenantAction}>
                  <input type="hidden" name="tenantId" value="MASTER" />
                  <button
                    type="submit"
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-blue-200 dark:border-blue-500/30 bg-blue-50/90 dark:bg-blue-950/50 px-3 py-1 text-xs font-bold text-[#3B68F7] dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/80 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                  >
                    <ArrowLeft className="size-3.5" aria-hidden="true" />
                    <span>Voltar para MASTER</span>
                  </button>
                </form>
                <span className="hidden lg:inline text-xs text-slate-600 dark:text-slate-300 truncate">
                  Visualizando exatamente como a empresa vê
                </span>
              </div>
            ) : (
              <div className="hidden lg:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <Building2 className="size-3.5 text-[#3B68F7] dark:text-blue-400" aria-hidden="true" />
                <span>
                  Função nesta empresa:{" "}
                  <strong className="text-slate-900 dark:text-white">{session.role.name}</strong>
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 ml-auto">
            <span className="hidden sm:inline text-xs font-semibold text-slate-600 dark:text-slate-300">
              {isMaster ? "Contexto:" : "Empresa ativa:"}
            </span>

            {showContextDropdown ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  aria-expanded={pickerOpen}
                  aria-haspopup="listbox"
                  aria-label={
                    isMasterGlobalMode
                      ? "Contexto atual: MASTER. Clique para escolher uma empresa cliente"
                      : `Empresa ativa: ${session.tenant.name}. Clique para alternar`
                  }
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-300/90 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white shadow-2xs hover:border-[#3B68F7] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] cursor-pointer"
                >
                  {isMasterGlobalMode ? (
                    <>
                      <ShieldCheck className="size-3.5 text-[#3B68F7] shrink-0" aria-hidden="true" />
                      <span>MASTER</span>
                    </>
                  ) : (
                    <>
                      <span
                        className={cn(
                          "size-2 rounded-full shrink-0",
                          session.tenant.active ? "bg-emerald-500" : "bg-rose-500",
                        )}
                        aria-hidden="true"
                      />
                      <span className="max-w-[140px] sm:max-w-[230px] truncate">{session.tenant.name}</span>
                    </>
                  )}
                  <ChevronDown className="size-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                </button>

                {pickerOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Fechar seletor de contexto"
                      onClick={() => setPickerOpen(false)}
                      className="fixed inset-0 z-30 cursor-default"
                    />
                    <div className="absolute right-0 mt-2 z-40 w-80 sm:w-96 rounded-2xl solid-surface p-3 shadow-xl space-y-2.5">
                      {isMaster && (
                        <div className="space-y-1.5 pb-2 border-b border-slate-200/80 dark:border-white/10">
                          <p className="px-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            Administração Global
                          </p>
                          <form
                            action={switchTenantAction}
                            onSubmit={() => setPickerOpen(false)}
                          >
                            <input type="hidden" name="tenantId" value="MASTER" />
                            <button
                              type="submit"
                              className={cn(
                                "w-full min-h-11 text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]",
                                isMasterGlobalMode
                                  ? "bg-blue-50/90 dark:bg-blue-950/60 font-bold text-[#3B68F7] dark:text-blue-300"
                                  : "hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200",
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <ShieldCheck className="size-4 shrink-0 text-[#3B68F7] dark:text-blue-400" aria-hidden="true" />
                                <div className="min-w-0">
                                  <p className="font-bold truncate">MASTER</p>
                                  <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400 truncate">
                                    Somente gestão de empresas e acessos
                                  </p>
                                </div>
                              </div>
                              {isMasterGlobalMode && <Check className="size-4 shrink-0" aria-hidden="true" />}
                            </button>
                          </form>
                        </div>
                      )}

                      <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {isMaster
                            ? `Empresas clientes (${companies.length})`
                            : `Suas empresas (${companies.length})`}
                        </span>
                      </div>

                      {companies.length > 0 && (
                        <div className="relative">
                          <Search
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400"
                            aria-hidden="true"
                          />
                          <label htmlFor="tenant-search-input" className="sr-only">
                            Buscar empresa por razão social, CNPJ ou responsável
                          </label>
                          <input
                            id="tenant-search-input"
                            type="search"
                            value={companyQuery}
                            onChange={(e) => setCompanyQuery(e.target.value)}
                            placeholder="Filtrar por empresa ou CNPJ…"
                            className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800/80 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                          />
                        </div>
                      )}

                      <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
                        {companies.length === 0 ? (
                          <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                            Nenhuma empresa cliente cadastrada ainda.
                          </p>
                        ) : filteredCompanies.length === 0 ? (
                          <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                            Nenhuma empresa encontrada.
                          </p>
                        ) : (
                          filteredCompanies.map((c) => {
                            const active = !isMasterGlobalMode && c.id === session.tenant.id;
                            const accessed = c.ownerLoginCount > 0 || c.ownerTotpConfigured;
                            return (
                              <form
                                key={c.id}
                                action={switchTenantAction}
                                onSubmit={() => setPickerOpen(false)}
                              >
                                <input type="hidden" name="tenantId" value={c.id} />
                                <button
                                  type="submit"
                                  className={cn(
                                    "w-full min-h-11 text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]",
                                    active
                                      ? "bg-blue-50/90 dark:bg-blue-950/50 font-bold text-[#3B68F7] dark:text-blue-300"
                                      : "hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200",
                                  )}
                                >
                                  <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={cn(
                                          "size-1.5 rounded-full shrink-0",
                                          c.active ? "bg-emerald-500" : "bg-rose-500",
                                        )}
                                        aria-hidden="true"
                                      />
                                      <p className="truncate font-semibold">{c.name}</p>
                                    </div>
                                    <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400 truncate">
                                      <span className="font-mono">{c.cnpj}</span>
                                      {isMaster
                                        ? accessed
                                          ? " · Já acessou"
                                          : " · Nunca acessou"
                                        : ` · ${c.userRoleName}`}
                                    </p>
                                  </div>
                                  {active && <Check className="size-4 shrink-0" aria-hidden="true" />}
                                </button>
                              </form>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-300/90 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white shadow-2xs">
                <span className="size-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
                <span className="max-w-[150px] sm:max-w-[240px] truncate">{session.tenant.name}</span>
              </span>
            )}

            <span className="h-5 w-px bg-slate-200 dark:bg-white/10" aria-hidden="true" />
            {!isMasterGlobalMode && (
              <OnboardingBanner activeCompany={activeCompany} tenantName={session.tenant.name} />
            )}
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              aria-label="Abrir guia rápido de usabilidade"
              title="Guia rápido de uso"
              className="min-h-10 inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#3B68F7] hover:text-[#3B68F7] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <HelpCircle className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Guia</span>
            </button>
            <ThemeToggle />
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto pr-1 space-y-5">
          {switchedNotice && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/95 dark:bg-emerald-950/60 px-4 py-3 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 font-semibold text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                <span>
                  Contexto alterado para <strong>{switchedNotice}</strong>.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSwitchedNotice(null)}
                aria-label="Fechar aviso de troca de contexto"
                className="min-h-8 min-w-8 flex items-center justify-center rounded-full text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200/50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          {!hideHeader && (
            <div className="flex flex-wrap items-center justify-between gap-4 px-1 pt-1">
              <div>
                <h1 className="text-2xl sm:text-[34px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight text-balance">
                  {title}
                </h1>
                <p className="mt-1 text-xs sm:text-[15px] font-normal text-slate-600 dark:text-slate-400 text-pretty">
                  {subtitle}
                </p>
              </div>
              {action}
            </div>
          )}

          {children}
        </main>
      </div>

      {/* Modal de Guia Rápido de Usabilidade (contextual: MASTER vs Empresa Cliente) */}
      <Modal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title={isMasterGlobalMode ? "Guia rápido do ambiente MASTER" : `Guia rápido · ${session.tenant.name}`}
        description={
          isMasterGlobalMode
            ? "Entenda como gerir empresas clientes, acompanhar acessos e alternar para a visão de cada empresa."
            : "Roteiro objetivo para operar todos os módulos da empresa na ordem recomendada."
        }
        size="lg"
      >
        {isMasterGlobalMode ? (
          <div className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
            <ol className="space-y-3">
              <li className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 p-4">
                <p className="font-bold text-slate-900 dark:text-white">1. Cadastrar nova empresa cliente</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Clique em <strong>Nova empresa</strong>, informe Razão social, CNPJ único, Nome e E-mail do
                  responsável (Dono). O sistema dispara automaticamente o link do <strong>Google Authenticator</strong>{" "}
                  para o e-mail informado.
                </p>
              </li>
              <li className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 p-4">
                <p className="font-bold text-slate-900 dark:text-white">2. Acompanhar se o cliente já acessou</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Na coluna <strong>Acesso do cliente</strong>, veja imediatamente quem está como{" "}
                  <strong>Já acessou</strong> (com data/hora, total de logins e indicador Online) ou{" "}
                  <strong>Nunca acessou</strong> (com ação rápida para <strong>Reenviar link</strong>).
                </p>
              </li>
              <li className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 p-4">
                <p className="font-bold text-slate-900 dark:text-white">3. Editar, ativar ou desativar</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Somente o <strong>MASTER</strong> pode editar os dados cadastrais da empresa. Ao{" "}
                  <strong>Desativar</strong>, todos os usuários não-Master conectados àquela empresa são desconectados
                  imediatamente.
                </p>
              </li>
              <li className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 p-4">
                <p className="font-bold text-slate-900 dark:text-white">4. Ver exatamente como o cliente vê</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Clique em <strong>Ver sistema</strong> (ou escolha a empresa no seletor do topo). O menu mudará para
                  a visão exata da empresa; use o botão <strong>Voltar para MASTER</strong> no topo quando quiser
                  retornar.
                </p>
              </li>
            </ol>
          </div>
        ) : (
          <div className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
            <ol className="space-y-2.5">
              <li className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 p-3.5">
                <p className="font-bold text-slate-900 dark:text-white">1. Clientes e contratos</p>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  Cadastre primeiro o cliente tomador pelo botão <strong>Novo cliente</strong> e depois crie o contrato
                  com objeto, postos e valor mensal.
                </p>
              </li>
              <li className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 p-3.5">
                <p className="font-bold text-slate-900 dark:text-white">2. Colaboradores e escalas</p>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  Aloque a equipe nos contratos. Clique no nome de qualquer colaborador para ver o histórico de OS,
                  EPIs e trocar a escala com detecção automática de conflito.
                </p>
              </li>
              <li className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 p-3.5">
                <p className="font-bold text-slate-900 dark:text-white">3. Ordens de serviço, EPIs, Almoxarifado e Financeiro</p>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  Em todos os módulos, o botão principal no topo abre uma janela modal limpa para cadastro, mantendo a
                  tabela em tela cheia.
                </p>
              </li>
              <li className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 p-3.5">
                <p className="font-bold text-slate-900 dark:text-white">4. Assistente IA & Relatórios</p>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  Tire dúvidas operacionais e gere relatórios exportáveis (PDF, copiar ou Markdown) usando apenas os
                  dados dos módulos liberados para a sua função nesta empresa.
                </p>
              </li>
              <li className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 p-3.5">
                <p className="font-bold text-slate-900 dark:text-white">5. Roles e subpermissões (exclusivo Dono / Master)</p>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  Convide outros e-mails com função única nesta empresa e decida quais funções podem usar o Assistente
                  IA. Ao bloquear um usuário, ele é desconectado imediatamente.
                </p>
              </li>
            </ol>
          </div>
        )}
      </Modal>
    </div>
  );
}
