"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Archive,
  BarChart3,
  Calendar,
  ChevronDown,
  ClipboardList,
  Layers,
  LogOut,
  Menu,
  Shield,
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
  children: ReactNode;
}

export function AdminShell({
  session,
  companies,
  current,
  title,
  subtitle,
  action,
  children,
}: AdminShellProps) {
  const [open, setOpen] = useState(false);
  const isDev = session.user.role === "developer";
  const visibleItems = NAV_ITEMS.filter((item) => !item.devOnly || isDev);

  return (
    <div className="flex h-dvh overflow-hidden p-3 sm:p-5 gap-5">
      {open && (
        <button
          type="button"
          aria-label="Fechar menu lateral"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Floating Glass Sidebar — Exact Reference Design */}
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
            className="md:hidden rounded-full p-1.5 text-slate-500 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800"
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
                        ? "pill-gradient"
                        : "rounded-2xl font-medium text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5 hover:text-slate-950 dark:hover:text-white",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-[19px] shrink-0 stroke-[1.8]",
                        isActive ? "text-white" : "text-slate-700 dark:text-slate-300",
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
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/55 dark:bg-slate-800/50 border border-white/70 dark:border-white/5 px-3 py-2.5">
          <div
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3B68F7] to-[#5346E8] text-white font-bold text-sm shadow-xs"
          >
            {session.user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
              {session.user.name.replace(" (Desenvolvedor)", "")}
            </p>
            <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {isDev ? "Desenvolvedor" : "Administrador"}
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title="Sair da plataforma"
              aria-label="Sair da plataforma"
              className="rounded-xl p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 transition-colors cursor-pointer"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-hidden">
        {/* Top Floating Glass Bar — Exact Reference Design */}
        <header className="flex shrink-0 items-center justify-between gap-3 rounded-2xl glass-surface px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
              className="md:hidden rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-200"
            >
              <Menu className="size-4.5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">
              Empresa ativa
            </span>

            {isDev && companies.length > 1 ? (
              <form action={switchTenantAction} className="inline-flex items-center">
                <label htmlFor="top-tenant-select" className="sr-only">
                  Selecionar empresa ativa
                </label>
                <div className="relative flex items-center">
                  <select
                    id="top-tenant-select"
                    name="tenantId"
                    defaultValue={session.tenant.id}
                    onChange={(e) => e.currentTarget.form?.requestSubmit()}
                    className="appearance-none rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 pl-4 pr-9 py-1.5 text-xs font-semibold text-slate-800 dark:text-white shadow-2xs outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] cursor-pointer"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 size-3.5 text-slate-500"
                    aria-hidden="true"
                  />
                </div>
              </form>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 px-4 py-1.5 text-xs font-semibold text-slate-800 dark:text-white shadow-2xs">
                {session.tenant.name}
              </span>
            )}

            <span className="h-5 w-px bg-slate-200 dark:bg-white/10" aria-hidden="true" />
            <ThemeToggle />
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto pr-1 space-y-6">
          {/* Page Title & Pill Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-1 pt-1">
            <div>
              <h1 className="text-3xl sm:text-[36px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                {title}
              </h1>
              <p className="mt-1 text-sm sm:text-[15px] font-normal text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            </div>
            {action}
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
