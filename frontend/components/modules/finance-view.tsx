"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Check,
  CheckCircle2,
  Loader2,
  Plus,
  RotateCcw,
} from "lucide-react";
import {
  createFinancialEntryStateAction,
  reconcileFinancialEntryAction,
} from "@/app/actions/operations";
import { Modal } from "@/components/ui/modal";
import type { ContractRow, FinancialEntryRow } from "@/lib/operations/repository";
import { formatCurrencyBRL } from "@/lib/utils/masks";

interface Props {
  tenantName: string;
  entries: FinancialEntryRow[];
  contracts: ContractRow[];
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FinanceView({ tenantName, entries, contracts }: Props) {
  const [state, createAction, pending] = useActionState(createFinancialEntryStateAction, undefined);
  const [createOpen, setCreateOpen] = useState(false);

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
  const [formType, setFormType] = useState<"Receita" | "Despesa">("Receita");
  const [formContractId, setFormContractId] = useState<string>("");
  const [amountInput, setAmountInput] = useState<string>("");

  useEffect(() => {
    if (state?.values?.amount !== undefined) {
      setAmountInput(state.values.amount);
    }
    if (state?.ok) {
      setAmountInput("");
      setCreateOpen(false);
    }
  }, [state]);

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
      {/* Cabeçalho padronizado */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1 pt-1">
        <div>
          <h1 className="text-2xl sm:text-[32px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight text-balance">
            Gestão financeira
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Receitas de contratos, despesas operacionais, visão por competência e conciliação em {tenantName}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="min-h-11 inline-flex items-center gap-2 pill-gradient px-6 py-2.5 text-xs sm:text-sm font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>Novo lançamento</span>
        </button>
      </div>

      {/* Barra explícita de período */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl solid-surface px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="size-4 text-[#3B68F7] dark:text-blue-400 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            Período nos totais: <strong className="text-slate-900 dark:text-white">{periodLabel}</strong>
          </span>
          <span className="text-slate-500 dark:text-slate-400 tabular-nums">
            ({conciliados} conciliado(s) e {pendentes} pendente(s))
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="top-period-select" className="font-semibold text-slate-600 dark:text-slate-300">
            Competência:
          </label>
          <select
            id="top-period-select"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="min-h-9 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-1 text-xs font-bold text-slate-900 dark:text-white"
          >
            <option value="todos">Todos os períodos</option>
            {competences.map((comp) => (
              <option key={comp} value={comp}>
                {comp}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state?.ok && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/90 dark:bg-emerald-950/50 p-4 flex items-center gap-2.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white"
        >
          <CheckCircle2 className="size-5 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>Lançamento financeiro salvo com sucesso.</span>
        </div>
      )}

      {/* Faixa estruturada de métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-white/10 rounded-[24px] solid-surface overflow-hidden">
        <div className="p-4 sm:p-5 min-w-0">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Receitas</p>
          <p className="mt-1 text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
            R$ {totalReceitas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
            Conciliado: R$ {receitasConciliadas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-4 sm:p-5 min-w-0">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Despesas</p>
          <p className="mt-1 text-xl sm:text-2xl font-extrabold text-rose-600 dark:text-rose-400 tabular-nums truncate">
            R$ {totalDespesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Inclui pendentes e conciliadas</p>
        </div>
        <div className="p-4 sm:p-5 min-w-0">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Saldo líquido</p>
          <p className="mt-1 text-xl sm:text-2xl font-extrabold text-[#3B68F7] dark:text-blue-400 tabular-nums truncate">
            R$ {saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {pendentes} pendente(s) no período
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Conciliados</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {conciliados}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            de {filteredEntries.length} lançamento(s)
          </p>
        </div>
      </div>

      {/* Tabela Full-Width */}
      <section className="rounded-[28px] solid-surface p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Fluxo de caixa ({filteredEntries.length})
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filtrar por tipo"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="min-h-9 rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              <option value="todos">Tipo: Todos</option>
              <option value="Receita">Receita</option>
              <option value="Despesa">Despesa</option>
            </select>

            <select
              aria-label="Filtrar por conciliação"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-h-9 rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              <option value="todos">Conciliação: Todas</option>
              <option value="Conciliado">Conciliado</option>
              <option value="Pendente">Pendente</option>
            </select>

            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setPeriodFilter("todos");
                  setTypeFilter("todos");
                  setStatusFilter("todos");
                }}
                className="min-h-9 inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
                <span>Limpar</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
                <th className="rounded-l-xl px-4 py-3.5">Tipo</th>
                <th className="px-4 py-3.5">Contrato</th>
                <th className="px-4 py-3.5">Descrição</th>
                <th className="px-4 py-3.5">Vencimento</th>
                <th className="px-4 py-3.5">Valor</th>
                <th className="px-4 py-3.5">Situação</th>
                <th className="rounded-r-xl px-4 py-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center space-y-3">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Nenhum lançamento encontrado em {tenantName}
                    </p>
                    <button
                      type="button"
                      onClick={() => setCreateOpen(true)}
                      className="min-h-10 inline-flex items-center gap-2 pill-gradient px-5 py-2 text-xs font-bold cursor-pointer"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      <span>Novo lançamento</span>
                    </button>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${entry.entryType === "Receita"
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
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${entry.reconciliationStatus === "Conciliado"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                          }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${entry.reconciliationStatus === "Conciliado" ? "bg-emerald-600" : "bg-amber-600"
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
                          className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-800 dark:text-white hover:bg-[#3B68F7] hover:text-white hover:border-[#3B68F7] transition-colors cursor-pointer"
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

      {/* Modal: Novo lançamento financeiro */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Novo lançamento financeiro"
        description={`Registre uma receita ou despesa em ${tenantName}. O valor inicia em branco para evitar erros.`}
        size="md"
      >
        <form action={createAction} noValidate className="space-y-4">
          {state?.error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300"
            >
              {state.error}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="modal-fin-type" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Tipo *
              </label>
              <select
                id="modal-fin-type"
                name="entryType"
                value={formType}
                onChange={(e) => setFormType(e.target.value as "Receita" | "Despesa")}
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white"
              >
                <option value="Receita">Receita</option>
                <option value="Despesa">Despesa</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="modal-fin-contract" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Contrato vinculado
              </label>
              <select
                id="modal-fin-contract"
                name="contractId"
                value={formContractId}
                onChange={(e) => setFormContractId(e.target.value)}
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white"
              >
                <option value="">Operacional geral</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code.replace("#", "")} · {c.clientName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="modal-fin-desc" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Descrição *
              </label>
              <input
                id="modal-fin-desc"
                name="description"
                required
                defaultValue={state?.values?.description ?? ""}
                placeholder="Ex.: Medição mensal de serviços terceirizados…"
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="modal-fin-amount" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Valor (R$) *
              </label>
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 dark:text-slate-400"
                >
                  R$
                </span>
                <input
                  id="modal-fin-amount"
                  name="amount"
                  type="text"
                  inputMode="numeric"
                  spellCheck={false}
                  value={amountInput}
                  onChange={(e) => setAmountInput(formatCurrencyBRL(e.target.value))}
                  placeholder="0,00…"
                  aria-invalid={state?.field === "amount"}
                  required
                  className={`w-full min-h-11 rounded-2xl border bg-white dark:bg-slate-800 pl-10 pr-4 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 ${state?.field === "amount"
                    ? "border-rose-400 focus-visible:ring-rose-500"
                    : "border-slate-300 dark:border-white/15 focus-visible:ring-[#3B68F7]"
                    }`}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="modal-fin-due" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Vencimento *
              </label>
              <input
                id="modal-fin-due"
                name="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="modal-fin-status" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Situação inicial
              </label>
              <select
                id="modal-fin-status"
                name="status"
                defaultValue="Pendente"
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white"
              >
                <option value="Pendente">Pendente</option>
                <option value="Conciliado">Conciliado</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="min-h-11 rounded-full border border-slate-300 dark:border-white/15 px-5 py-2 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 inline-flex items-center gap-2 pill-gradient px-6 py-2 text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              <span>Salvar lançamento</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
