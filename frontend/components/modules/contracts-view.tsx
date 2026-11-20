"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Coins, FileText, Plus, Search, Users } from "lucide-react";
import { createClientAction } from "@/app/actions/operations";
import type { ClientRow, ContractRow } from "@/lib/operations/repository";

interface Props {
  contracts: ContractRow[];
  clients: ClientRow[];
}

export function ContractsView({ contracts, clients }: Props) {
  const [tab, setTab] = useState<"contratos" | "clientes">("contratos");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  const activeContractsCount = contracts.filter((c) => c.status === "Ativo").length;
  const totalMonthlyRevenue = contracts.reduce((acc, c) => acc + c.monthlyValue, 0);

  const filteredContracts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contracts.filter((c) => {
      if (statusFilter !== "todos" && c.status.toLowerCase() !== statusFilter) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.clientName.toLowerCase().includes(q) ||
        c.object.toLowerCase().includes(q) ||
        c.workstation.toLowerCase().includes(q)
      );
    });
  }, [contracts, query, statusFilter]);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (cl) =>
        cl.name.toLowerCase().includes(q) ||
        cl.cnpj.toLowerCase().includes(q) ||
        cl.contact.toLowerCase().includes(q),
    );
  }, [clients, query]);

  return (
    <div className="space-y-6">
      {/* 4 Pastel Glass KPI Cards — Exact Reference Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Contratos (Sky Blue) */}
        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-blue-100/80 via-blue-50/65 to-white/75 dark:from-blue-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 dark:bg-blue-500/20 text-[#3B68F7] dark:text-blue-300">
            <FileText className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Contratos</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {contracts.length}
            </p>
          </div>
        </div>

        {/* Card 2: Contratos ativos (Lavender Purple) */}
        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-purple-100/80 via-purple-50/65 to-white/75 dark:from-purple-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300">
            <Check className="size-6 stroke-[2]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Contratos ativos</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {activeContractsCount}
            </p>
          </div>
        </div>

        {/* Card 3: Clientes (Mint Emerald) */}
        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-emerald-100/80 via-emerald-50/65 to-white/75 dark:from-emerald-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
            <Users className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Clientes</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {clients.length}
            </p>
          </div>
        </div>

        {/* Card 4: Receita mensal (Cyan Blue) */}
        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-sky-100/80 via-sky-50/65 to-white/75 dark:from-sky-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-sky-600/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300">
            <Coins className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Receita mensal</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5 truncate">
              R$ {totalMonthlyRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Main Glass Container with Segmented Pill Tabs + Pill Search + Table */}
      <section className="rounded-[28px] glass-surface p-5 sm:p-7 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Segmented Pill Tabs */}
          <div
            role="tablist"
            aria-label="Visualização de contratos e clientes"
            className="inline-flex items-center rounded-full border border-slate-200/80 dark:border-white/10 bg-slate-100/80 dark:bg-slate-800/70 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "contratos"}
              onClick={() => setTab("contratos")}
              className={`rounded-full px-5 py-2 text-sm transition-colors cursor-pointer ${
                tab === "contratos"
                  ? "pill-gradient"
                  : "font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
              }`}
            >
              Contratos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "clientes"}
              onClick={() => setTab("clientes")}
              className={`rounded-full px-5 py-2 text-sm transition-colors cursor-pointer ${
                tab === "clientes"
                  ? "pill-gradient"
                  : "font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
              }`}
            >
              Clientes
            </button>
          </div>

          {/* Search & Status Pill Filters */}
          <div className="flex flex-wrap items-center gap-3 flex-1 sm:flex-initial justify-end">
            <div className="relative min-w-[230px] sm:w-72">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400"
                aria-hidden="true"
              />
              <label htmlFor="contracts-search" className="sr-only">
                Buscar por cliente ou código
              </label>
              <input
                id="contracts-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por cliente ou código…"
                className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 pl-10 pr-4 py-2 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              />
            </div>

            {tab === "contratos" && (
              <div className="relative">
                <label htmlFor="contracts-status" className="sr-only">
                  Filtrar por situação
                </label>
                <select
                  id="contracts-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 pl-4 pr-9 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] cursor-pointer"
                >
                  <option value="todos">Situação</option>
                  <option value="ativo">Ativo</option>
                  <option value="suspenso">Suspenso</option>
                  <option value="encerrado">Encerrado</option>
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-500"
                  aria-hidden="true"
                />
              </div>
            )}
          </div>
        </div>

        {tab === "contratos" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="rounded-xl bg-slate-100/85 dark:bg-slate-800/75 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <th className="rounded-l-xl px-4 py-3.5">Código</th>
                  <th className="px-4 py-3.5">Cliente</th>
                  <th className="px-4 py-3.5">Objeto</th>
                  <th className="px-4 py-3.5">Unidade / postos</th>
                  <th className="px-4 py-3.5">Vigência</th>
                  <th className="px-4 py-3.5">Valor mensal</th>
                  <th className="rounded-r-xl px-4 py-3.5">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-white/10">
                {filteredContracts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                      Nenhum contrato encontrado para o filtro selecionado.
                    </td>
                  </tr>
                ) : (
                  filteredContracts.map((c) => (
                    <tr key={c.id} className="hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4 font-bold text-slate-900 dark:text-white tabular-nums">
                        {c.code.replace("#", "")}
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-800 dark:text-slate-100">
                        {c.clientName}
                      </td>
                      <td className="px-4 py-4 text-slate-700 dark:text-slate-300">{c.object}</td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                        {c.workstation.replace("•", "·")}
                      </td>
                      <td className="px-4 py-4 text-slate-700 dark:text-slate-200 tabular-nums">
                        {c.durationMonths} meses
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-800 dark:text-slate-100 tabular-nums">
                        R$ {c.monthlyValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/90 dark:bg-emerald-950/80 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="rounded-xl bg-slate-100/85 dark:bg-slate-800/75 text-xs font-bold text-slate-700 dark:text-slate-200">
                    <th className="rounded-l-xl px-4 py-3.5">Cliente tomador</th>
                    <th className="px-4 py-3.5">CNPJ</th>
                    <th className="rounded-r-xl px-4 py-3.5">Contato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/10">
                  {filteredClients.map((cl) => (
                    <tr key={cl.id} className="hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4 font-bold text-slate-900 dark:text-white">{cl.name}</td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-600 dark:text-slate-300">{cl.cnpj}</td>
                      <td className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400">
                        {cl.contact || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form
              action={createClientAction}
              className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-slate-800/50 p-5 space-y-3.5"
            >
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Novo cliente tomador</h3>
              <div className="space-y-1">
                <label htmlFor="client-name" className="block pl-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Razão social *
                </label>
                <input
                  id="client-name"
                  name="name"
                  required
                  placeholder="Ex.: Grupo Horizonte Ltda…"
                  className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="client-cnpj" className="block pl-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  CNPJ *
                </label>
                <input
                  id="client-cnpj"
                  name="cnpj"
                  required
                  placeholder="00.000.000/0001-00…"
                  className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="client-contact" className="block pl-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Contato principal
                </label>
                <input
                  id="client-contact"
                  name="contact"
                  placeholder="(65) 3322-0000 · gestao@cliente.com.br…"
                  className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>
              <button
                type="submit"
                className="w-full min-h-10 pill-gradient py-2.5 px-5 text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                <span>Cadastrar cliente</span>
              </button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
