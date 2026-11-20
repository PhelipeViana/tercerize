"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Archive,
  BarChart3,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Layers,
  LogOut,
  Menu,
  Search,
  Shield,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { logout, switchTenantAction } from "@/app/actions/auth";
import { Logo } from "@/components/brand/logo";
import { OnboardingBanner } from "@/components/shell/onboarding-banner";
import { ThemeToggle } from "@/components/shell/theme-toggle";
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
  | "companies";

interface NavItem {
  key: ModuleKey;
  label: string;
  href: string;
  icon: LucideIcon;
  devOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { key: "contracts", label: "Clientes e contratos", href: "/admin/contracts", icon: Users },
  { key: "service-orders", label: "Ordens de serviço", href: "/admin/service-orders", icon: ClipboardList },
  { key: "employees", label: "Colaboradores e escalas", href: "/admin/employees", icon: Calendar },
  { key: "epis", label: "Controle de EPIs", href: "/admin/epis", icon: Shield },
  { key: "inventory-items", label: "Almoxarifado e ativos", href: "/admin/inventory-items", icon: Archive },
  { key: "finance", label: "Gestão financeira", href: "/admin/finance", icon: BarChart3 },
  { key: "companies", label: "Multi-Empresas", href: "/admin/companies", icon: Layers, devOnly: true },
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
  const [companyQuery, setCompanyQuery] = useState("");
  const [switchedCompanyNotice, setSwitchedCompanyNotice] = useState<string | null>(null);

  const isDev = session.user.role === "developer";
  const visibleItems = NAV_ITEMS.filter((item) => !item.devOnly || isDev);
  const activeCompany = companies.find((c) => c.id === session.tenant.id);

  // Confirma visualmente a troca de empresa com o nome e CNPJ da empresa ativa
  useEffect(() => {
    try {
      const storageKey = "tercerize_active_tenant_id";
      const prev = window.sessionStorage.getItem(storageKey);
      if (prev && prev !== session.tenant.id) {
        setSwitchedCompanyNotice(`${session.tenant.name} (CNPJ: ${session.tenant.cnpj})`);
      }
      window.sessionStorage.setItem(storageKey, session.tenant.id);
    } catch {
      // ignore storage errors
    }
  }, [session.tenant.id, session.tenant.name, session.tenant.cnpj]);

  const filteredCompanies = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) => c.name.toLowerCase().includes(q) || c.cnpj.toLowerCase().includes(q),
    );
  }, [companies, companyQuery]);

  return (
    <div className="flex h-dvh overflow-hidden p-2.5 sm:p-5 gap-4 sm:gap-5">
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
          "fixed inset-y-3 left-3 z-40 flex w-64 shrink-0 flex-col rounded-[28px] glass-surface px-4 py-6 transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-[110%]",
        )}
      >
        <div className="flex items-center justify-between px-3 pb-6">
          <Logo />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="md:hidden rounded-full p-2 text-slate-500 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800"
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
                      "flex w-full items-center gap-3.5 px-4 py-3 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]",
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
              {session.user.name.replace(" (Desenvolvedor)", "")}
            </p>
            <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {isDev ? "Desenvolvedor" : "Gestor administrador"}
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title="Sair da plataforma"
              aria-label="Sair da plataforma"
              className="min-h-9 min-w-9 flex items-center justify-center rounded-xl p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col gap-4 sm:gap-5 overflow-hidden">
        {/* Top Floating Glass Bar with Persistent Active Company Context */}
        <header className="relative z-20 flex shrink-0 items-center justify-between gap-2 rounded-2xl glass-surface px-3.5 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
              className="md:hidden min-h-10 min-w-10 flex items-center justify-center rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <Menu className="size-4.5" aria-hidden="true" />
            </button>

            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <Building2 className="size-3.5 text-[#3B68F7] dark:text-blue-400" aria-hidden="true" />
              <span>Contexto isolado por empresa</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 ml-auto">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Empresa ativa:
            </span>

            {isDev && companies.length > 1 ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  aria-expanded={pickerOpen}
                  aria-haspopup="listbox"
                  aria-label={`Empresa ativa: ${session.tenant.name}. Clique para trocar de empresa`}
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-300/90 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white shadow-2xs hover:border-[#3B68F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] cursor-pointer"
                >
                  <span className="size-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
                  <span className="max-w-[145px] sm:max-w-[240px] truncate">{session.tenant.name}</span>
                  <ChevronDown className="size-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                </button>

                {pickerOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Fechar seletor de empresas"
                      onClick={() => setPickerOpen(false)}
                      className="fixed inset-0 z-30 cursor-default"
                    />
                    <div className="absolute right-0 mt-2 z-40 w-80 rounded-2xl solid-surface p-3 shadow-xl space-y-2.5">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Alternar empresa ativa ({companies.length})
                        </span>
                        <Link
                          href="/admin/companies"
                          onClick={() => setPickerOpen(false)}
                          className="text-[11px] font-semibold text-[#3B68F7] dark:text-blue-400 hover:underline"
                        >
                          Gerenciar todas
                        </Link>
                      </div>

                      <div className="relative">
                        <Search
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400"
                          aria-hidden="true"
                        />
                        <label htmlFor="tenant-search-input" className="sr-only">
                          Buscar empresa por razão social ou CNPJ
                        </label>
                        <input
                          id="tenant-search-input"
                          type="search"
                          value={companyQuery}
                          onChange={(e) => setCompanyQuery(e.target.value)}
                          placeholder="Filtrar por nome ou CNPJ…"
                          className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800/80 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                        />
                      </div>

                      <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
                        {filteredCompanies.length === 0 ? (
                          <p className="py-4 text-center text-xs text-slate-500">
                            Nenhuma empresa encontrada.
                          </p>
                        ) : (
                          filteredCompanies.map((c) => {
                            const active = c.id === session.tenant.id;
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
                                    "w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer",
                                    active
                                      ? "bg-blue-50/90 dark:bg-blue-950/50 font-bold text-[#3B68F7] dark:text-blue-300"
                                      : "hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200",
                                  )}
                                >
                                  <div className="min-w-0">
                                    <p className="truncate">{c.name}</p>
                                    <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                      CNPJ: {c.cnpj} · {c.contractsCount} contrato(s)
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
              <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-300/90 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white shadow-2xs">
                <span className="size-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
                <span className="max-w-[150px] sm:max-w-[240px] truncate">{session.tenant.name}</span>
              </span>
            )}

            <span className="h-5 w-px bg-slate-200 dark:bg-white/10" aria-hidden="true" />
            <ThemeToggle />
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto pr-1 space-y-5">
          {/* Confirmação visual ao alternar de empresa */}
          {switchedCompanyNotice && (
            <div
              role="status"
              className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/95 dark:bg-emerald-950/60 px-4 py-3 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 font-semibold text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                <span>
                  Empresa ativa alterada para <strong>{switchedCompanyNotice}</strong>. Todos os cadastros e listas
                  abaixo pertencem a este contexto.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSwitchedCompanyNotice(null)}
                aria-label="Fechar aviso de troca de empresa"
                className="rounded-full p-1 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200/50 cursor-pointer"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Page Title & Pill Action Row */}
          {!hideHeader && (
            <div className="flex flex-wrap items-center justify-between gap-4 px-1 pt-1">
              <div>
                <h1 className="text-2xl sm:text-[34px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                  {title}
                </h1>
                <p className="mt-1 text-xs sm:text-[15px] font-normal text-slate-600 dark:text-slate-400">
                  {subtitle}
                </p>
              </div>
              {action}
            </div>
          )}

          {/* Trilha guiada da primeira operação quando a empresa ativa está em implantação */}
          <OnboardingBanner activeCompany={activeCompany} tenantName={session.tenant.name} />

          {children}
        </main>
      </div>
    </div>
  );
}
