"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Coins,
  Loader2,
  Plus,
  RotateCcw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  createFinancialEntryStateAction,
  reconcileFinancialEntryAction,
} from "@/app/actions/operations";
import type { ContractRow, FinancialEntryRow } from "@/lib/operations/repository";

interface Props {
  tenantName: string;
  entries: FinancialEntryRow[];
  contracts: ContractRow[];
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FinanceView({ tenantName, entries, contracts }: Props) {
  const descInputRef = useRef<HTMLInputElement>(null);
  const [state, createAction, pending] = useActionState(createFinancialEntryStateAction, undefined);

  // Competências disponíveis nos lançamentos (ex.: "11/2026")
  const competences = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.competence) set.add(e.competence);
    });
    return Array.from(set).sort();
  }, [entries]);

  const [periodFilter, setPeriodFilter] = useState<string>("todos");
  const [typeFilter, setTypeFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [dueDate, setDueDate] = useState(getTodayIso);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (periodFilter !== "todos" && e.competence !== periodFilter) return false;
      if (typeFilter !== "todos" && e.entryType !== typeFilter) return false;
      if (statusFilter !== "todos" && e.reconciliationStatus !== statusFilter) return false;
      return true;
    });
  }, [entries, periodFilter, typeFilter, statusFilter]);

  const periodLabel = periodFilter === "todos" ? "Acumulado geral" : `Competência ${periodFilter}`;

  const totalReceitas = filteredEntries
    .filter((e) => e.entryType === "Receita")
    .reduce((acc, cur) => acc + cur.amount, 0);
  const receitasConciliadas = filteredEntries
    .filter((e) => e.entryType === "Receita" && e.reconciliationStatus === "Conciliado")
    .reduce((acc, cur) => acc + cur.amount, 0);

  const totalDespesas = filteredEntries
    .filter((e) => e.entryType === "Despesa")
    .reduce((acc, cur) => acc + cur.amount, 0);
  const saldo = totalReceitas - totalDespesas;
  const conciliados = filteredEntries.filter((e) => e.reconciliationStatus === "Conciliado").length;
  const pendentes = filteredEntries.filter((e) => e.reconciliationStatus === "Pendente").length;

  const hasFilters = periodFilter !== "todos" || typeFilter !== "todos" || statusFilter !== "todos";

  return (
    <div className="space-y-5">
      {/* Barra de contexto de período e ação principal */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl solid-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
            <Calendar className="size-4 text-[#3B68F7] dark:text-blue-400" aria-hidden="true" />
            Período dos totais: <strong className="text-slate-900 dark:text-white">{periodLabel}</strong>
          </span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500 dark:text-slate-400">
            Os totais de Receitas, Despesas e Saldo somam lançamentos conciliados ({conciliados}) e pendentes (
            {pendentes}).
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            descInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(() => descInputRef.current?.focus(), 60);
          }}
          className="inline-flex min-h-10 items-center gap-2 pill-gradient px-5 py-2 text-xs sm:text-sm cursor-pointer"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>Novo lançamento</span>
        </button>
      </div>

      {state?.ok && (
        <div
          role="status"
          className="rounded-3xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/90 dark:bg-emerald-950/50 p-4 flex items-center gap-2.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white"
        >
          <CheckCircle2 className="size-5 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>Lançamento financeiro salvo com sucesso na empresa {tenantName}!</span>
        </div>
      )}

      {/* 4 Pastel Glass KPI Cards com indicação de período e pendências */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-emerald-100/80 via-emerald-50/65 to-white/85 dark:from-emerald-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
            <TrendingUp className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Receitas ({periodLabel})
            </p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5 truncate">
              R$ {totalReceitas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Conciliado: R$ {receitasConciliadas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-purple-100/80 via-purple-50/65 to-white/85 dark:from-purple-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300">
            <TrendingDown className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Despesas ({periodLabel})
            </p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5 truncate">
              R$ {totalDespesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Inclui previstas e conciliadas</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-blue-100/80 via-blue-50/65 to-white/85 dark:from-blue-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 dark:bg-blue-500/20 text-[#3B68F7] dark:text-blue-300">
            <Coins className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Saldo operacional</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5 truncate">
              R$ {saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{pendentes} pendente(s) no período</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-sky-100/80 via-sky-50/65 to-white/85 dark:from-sky-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-sky-600/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300">
            <BarChart3 className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Conciliados</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">{conciliados}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">de {filteredEntries.length} lançamento(s)</p>
          </div>
        </div>
      </div>

      {/* Main Solid Table Card */}
      <section className="rounded-[28px] solid-surface p-5 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-1.5 text-xs font-bold">
            Fluxo de caixa ({filteredEntries.length})
          </span>

          {/* Filtros de competência, tipo e situação de conciliação */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div>
              <label htmlFor="fin-filter-period" className="sr-only">
                Filtrar por competência
              </label>
              <select
                id="fin-filter-period"
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                className="rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200"
              >
                <option value="todos">Período: Todos</option>
                {competences.map((comp) => (
                  <option key={comp} value={comp}>
                    Competência {comp}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="fin-filter-type" className="sr-only">
                Filtrar por tipo
              </label>
              <select
                id="fin-filter-type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200"
              >
                <option value="todos">Tipo: Todos</option>
                <option value="Receita">Receita</option>
                <option value="Despesa">Despesa</option>
              </select>
            </div>

            <div>
              <label htmlFor="fin-filter-status" className="sr-only">
                Filtrar por conciliação
              </label>
              <select
                id="fin-filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200"
              >
                <option value="todos">Conciliação: Todas</option>
                <option value="Conciliado">Conciliado</option>
                <option value="Pendente">Pendente</option>
              </select>
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setPeriodFilter("todos");
                  setTypeFilter("todos");
                  setStatusFilter("todos");
                }}
                className="inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
                <span>Limpar</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="rounded-xl bg-slate-100 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
                <th className="rounded-l-xl px-4 py-3.5">Tipo</th>
                <th className="px-4 py-3.5">Contrato</th>
                <th className="px-4 py-3.5">Descrição</th>
                <th className="px-4 py-3.5">Vencimento</th>
                <th className="px-4 py-3.5">Valor</th>
                <th className="px-4 py-3.5">Situação e histórico</th>
                <th className="rounded-r-xl px-4 py-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-xs text-slate-500">
                    Nenhum lançamento encontrado para os filtros aplicados em <strong>{tenantName}</strong>.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                          entry.entryType === "Receita"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300"
                        }`}
                      >
                        {entry.entryType}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-bold text-slate-900 dark:text-white">
                      {entry.contractCode ? entry.contractCode.replace("#", "") : "Geral"}
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-800 dark:text-slate-100">{entry.description}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300 tabular-nums">{entry.dueDate}</td>
                    <td className="px-4 py-4 font-bold text-slate-900 dark:text-white tabular-nums">
                      R$ {entry.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                          entry.reconciliationStatus === "Conciliado"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            entry.reconciliationStatus === "Conciliado" ? "bg-emerald-600" : "bg-amber-600"
                          }`}
                          aria-hidden="true"
                        />
                        {entry.reconciliationStatus}
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-0.5 tabular-nums">
                        Atualizado: {entry.updatedAt}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <form action={reconcileFinancialEntryAction} className="inline-flex">
                        <input type="hidden" name="id" value={entry.id} />
                        <button
                          type="submit"
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-800 dark:text-white hover:bg-[#3B68F7] hover:text-white hover:border-[#3B68F7] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                        >
                          <Check className="size-3" aria-hidden="true" />
                          <span>{entry.reconciliationStatus === "Conciliado" ? "Reabrir" : "Conciliar"}</span>
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Novo lançamento com campo Valor iniciando em branco e suporte a padrão brasileiro */}
      <section id="novo-lancamento" className="rounded-[28px] solid-surface p-6 sm:p-7 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Novo lançamento financeiro</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Registre faturamentos de contrato (receitas) ou despesas operacionais.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Building2 className="size-3.5 text-[#3B68F7]" aria-hidden="true" />
            Empresa ativa: <strong className="text-slate-900 dark:text-white">{tenantName}</strong>
          </span>
        </div>

        {state?.error && (
          <p
            role="alert"
            className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-300"
          >
            {state.error}
          </p>
        )}

        <form action={createAction} noValidate className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label htmlFor="fin-type" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              Tipo *
            </label>
            <select
              id="fin-type"
              name="entryType"
              defaultValue={state?.values?.entryType ?? "Receita"}
              className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <option value="Receita">Receita</option>
              <option value="Despesa">Despesa</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="fin-contract" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              Contrato vinculado
            </label>
            <select
              id="fin-contract"
              name="contractId"
              defaultValue={state?.values?.contractId ?? ""}
              className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <option value="">Operacional geral</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code.replace("#", "")} · {c.clientName}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 space-y-1">
            <label htmlFor="fin-desc" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              Descrição *
            </label>
            <input
              ref={descInputRef}
              id="fin-desc"
              name="description"
              required
              defaultValue={state?.values?.description ?? ""}
              placeholder="Ex.: Medição mensal de serviços terceirizados"
              className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="fin-amount" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              Valor (R$) *
            </label>
            <input
              id="fin-amount"
              name="amount"
              type="text"
              inputMode="decimal"
              defaultValue={state?.values?.amount ?? ""}
              placeholder="Ex.: 1.500,00 ou 150,50"
              aria-invalid={state?.field === "amount"}
              required
              className={`w-full rounded-full border bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 ${
                state?.field === "amount"
                  ? "border-rose-400 focus-visible:ring-rose-500"
                  : "border-slate-200 dark:border-white/15 focus-visible:ring-[#3B68F7]"
              }`}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="fin-due" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              Vencimento *
            </label>
            <input
              id="fin-due"
              name="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="fin-status" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              Situação inicial
            </label>
            <select
              id="fin-status"
              name="status"
              defaultValue="Pendente"
              className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <option value="Pendente">Pendente</option>
              <option value="Conciliado">Conciliado</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3 flex items-end justify-end">
            <button
              type="submit"
              disabled={pending}
              className="min-h-10 pill-gradient py-2.5 px-6 text-xs inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
              <span>Salvar lançamento em {tenantName}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
