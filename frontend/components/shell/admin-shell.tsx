"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Building2,
  ClipboardCheck,
  FileSignature,
  HardHat,
  Landmark,
  LogOut,
  Menu,
  PackageCheck,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { logout, switchTenantAction } from "@/app/actions/auth";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import type { SessionContext } from "@/lib/auth/repository";
import type { CompanyRow } from "@/lib/operations/repository";
import { cn } from "@/lib/utils";

export type ModuleKey =
  | "contracts"
  | "service-orders"
  | "inventory-items"
  | "employees"
  | "epis"
  | "finance"
  | "companies";

interface NavItem {
  key: ModuleKey;
  label: string;
  group: string;
  href: string;
  icon: LucideIcon;
  devOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { key: "contracts", label: "Clientes e Contratos", group: "Operação & Contratos", href: "/admin/contracts", icon: FileSignature },
  { key: "service-orders", label: "Ordens de Serviço (OS)", group: "Operação & Contratos", href: "/admin/service-orders", icon: ClipboardCheck },
  { key: "employees", label: "Colaboradores e Escalas", group: "Equipe & Segurança", href: "/admin/employees", icon: Users },
  { key: "epis", label: "Controle de EPIs", group: "Equipe & Segurança", href: "/admin/epis", icon: HardHat },
  { key: "inventory-items", label: "Almoxarifado e Ativos", group: "Estoque & Financeiro", href: "/admin/inventory-items", icon: PackageCheck },
  { key: "finance", label: "Gestão Financeira", group: "Estoque & Financeiro", href: "/admin/finance", icon: Landmark },
  { key: "companies", label: "Multi-Empresas (Dev)", group: "Governança", href: "/admin/companies", icon: Building2, devOnly: true },
];

interface AdminShellProps {
  session: SessionContext;
  companies: CompanyRow[];
  current: ModuleKey;
  breadcrumb: string;
  routeLabel: string;
  headerAction?: ReactNode;
  children: ReactNode;
}

export function AdminShell({
  session,
  companies,
  current,
  breadcrumb,
  routeLabel,
  headerAction,
  children,
}: AdminShellProps) {
  const [open, setOpen] = useState(false);
  const isDev = session.user.role === "developer";
  const visibleItems = NAV_ITEMS.filter((item) => !item.devOnly || isDev);
  const groups = Array.from(new Set(visibleItems.map((i) => i.group)));

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50 dark:bg-slate-950">
      {open && (
        <button
          type="button"
          aria-label="Fechar menu lateral"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Filament-inspired Sidebar (PortoCercado Visual Style) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl md:shadow-none transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-100 dark:border-slate-800 px-5">
          <Logo />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="md:hidden rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Multi-Empresa Active Card */}
        <div className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/50 p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
              Empresa Ativa
            </span>
            {isDev && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-blue-100 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800/60 px-2 py-0.5 text-[10px] font-black text-blue-700 dark:text-blue-300">
                <ShieldCheck className="size-3" aria-hidden="true" />
                DEV MULTI-TENANT
              </span>
            )}
          </div>

          {isDev && companies.length > 1 ? (
            <form action={switchTenantAction} className="space-y-2">
              <label htmlFor="sidebar-tenant-select" className="sr-only">
                Selecionar empresa ativa
              </label>
              <div className="flex gap-1.5">
                <select
                  id="sidebar-tenant-select"
                  name="tenantId"
                  defaultValue={session.tenant.id}
                  className="min-w-0 flex-1 rounded-xl border-2 border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-black text-gray-800 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/20 transition-colors cursor-pointer"
                >
                  Trocar
                </button>
              </div>
              <p className="truncate font-mono text-[11px] font-bold text-gray-500 dark:text-blue-300/70">
                CNPJ: {session.tenant.cnpj}
              </p>
            </form>
          ) : (
            <div>
              <p className="truncate text-xs font-black text-gray-900 dark:text-white">{session.tenant.name}</p>
              <p className="truncate font-mono text-[11px] font-bold text-gray-500 dark:text-blue-300/70">
                CNPJ: {session.tenant.cnpj}
              </p>
            </div>
          )}
        </div>

        {/* Grouped Navigation Links */}
        <nav aria-label="Menu Principal" className="flex-1 overflow-y-auto px-3.5 py-4 space-y-5">
          {groups.map((group) => (
            <div key={group} className="space-y-1.5">
              <p className="px-3 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-slate-500">
                {group}
              </p>
              <ul className="space-y-1">
                {visibleItems
                  .filter((item) => item.group === group)
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = current === item.key;
                    return (
                      <li key={item.key}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                            isActive
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                              : "text-gray-600 dark:text-slate-300 hover:bg-blue-50/70 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-300",
                          )}
                        >
                          <Icon
                            className={cn("size-4 shrink-0", isActive ? "text-white" : "text-blue-600 dark:text-blue-400")}
                            aria-hidden="true"
                          />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User Footer Card */}
        <div className="flex items-center gap-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/80 px-4 py-3.5">
          <div
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-black text-sm shadow-md shadow-blue-500/20"
          >
            {session.user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black text-gray-900 dark:text-white">{session.user.name}</p>
            <p className="truncate text-[11px] font-bold text-blue-600 dark:text-blue-400">
              {isDev ? "Nível Desenvolvedor" : "Administrador"}
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title="Sair da plataforma"
              aria-label="Sair da plataforma"
              className="rounded-xl p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/50 dark:hover:text-red-400 transition-colors cursor-pointer"
            >
              <LogOut className="size-4.5" aria-hidden="true" />
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sticky Topbar (PortoCercado Navigation Style) */}
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
              className="md:hidden rounded-xl border border-gray-200 dark:border-slate-700 p-2 text-gray-700 dark:text-slate-200"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-slate-500 hidden sm:inline">
                  Painel Administrativo ›
                </span>
                <span className="truncate text-sm font-black text-gray-900 dark:text-blue-100">
                  {breadcrumb}
                </span>
              </div>
              <p className="truncate text-[11px] font-bold text-gray-500 dark:text-blue-400/70">
                Operando em: <strong className="text-gray-800 dark:text-white">{session.tenant.name}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden lg:inline-flex items-center rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/80 dark:bg-blue-950/50 px-3 py-1.5 font-mono text-xs font-black text-blue-700 dark:text-blue-300">
              {routeLabel}
            </span>
            {headerAction}
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
