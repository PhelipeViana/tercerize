import { BarChart3, Check, Coins, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { createFinancialEntryAction, reconcileFinancialEntryAction } from "@/app/actions/operations";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireSession } from "@/lib/auth/dal";
import { listCompanies, listContracts, listFinancialEntries } from "@/lib/operations/repository";

export default async function FinancePage() {
  const session = await requireSession();
  const [companies, entries, contracts] = await Promise.all([
    listCompanies(),
    listFinancialEntries(session.tenant.id),
    listContracts(session.tenant.id),
  ]);

  const totalReceitas = entries
    .filter((e) => e.entryType === "Receita")
    .reduce((acc, cur) => acc + cur.amount, 0);
  const totalDespesas = entries
    .filter((e) => e.entryType === "Despesa")
    .reduce((acc, cur) => acc + cur.amount, 0);
  const saldo = totalReceitas - totalDespesas;
  const conciliados = entries.filter((e) => e.reconciliationStatus === "Conciliado").length;

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="finance"
      title="Gestão financeira"
      subtitle="Receitas vinculadas aos contratos, despesas operacionais e conciliação de lançamentos."
      action={
        <a
          href="#novo-lancamento"
          className="inline-flex min-h-11 items-center gap-2 pill-gradient px-6 py-2.5 text-sm"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>Novo lançamento</span>
        </a>
      }
    >
      {/* 4 Pastel Glass KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-emerald-100/80 via-emerald-50/65 to-white/75 dark:from-emerald-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
            <TrendingUp className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Receitas</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5 truncate">
              R$ {totalReceitas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-purple-100/80 via-purple-50/65 to-white/75 dark:from-purple-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300">
            <TrendingDown className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Despesas</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5 truncate">
              R$ {totalDespesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-blue-100/80 via-blue-50/65 to-white/75 dark:from-blue-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 dark:bg-blue-500/20 text-[#3B68F7] dark:text-blue-300">
            <Coins className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Saldo operacional</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5 truncate">
              R$ {saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-sky-100/80 via-sky-50/65 to-white/75 dark:from-sky-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-sky-600/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300">
            <BarChart3 className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Conciliados</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">{conciliados}</p>
          </div>
        </div>
      </div>

      {/* Main Glass Table Card */}
      <section className="rounded-[28px] glass-surface p-5 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center rounded-full border border-slate-200/80 dark:border-white/10 bg-slate-100/80 dark:bg-slate-800/70 p-1">
            <span className="pill-gradient px-5 py-2 text-sm">Fluxo de caixa</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="rounded-xl bg-slate-100/85 dark:bg-slate-800/75 text-xs font-bold text-slate-700 dark:text-slate-200">
                <th className="rounded-l-xl px-4 py-3.5">Tipo</th>
                <th className="px-4 py-3.5">Contrato</th>
                <th className="px-4 py-3.5">Descrição</th>
                <th className="px-4 py-3.5">Vencimento</th>
                <th className="px-4 py-3.5">Valor</th>
                <th className="px-4 py-3.5">Situação</th>
                <th className="rounded-r-xl px-4 py-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-white/10">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                        entry.entryType === "Receita"
                          ? "bg-emerald-100/90 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                          : "bg-rose-100/90 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300"
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
                          ? "bg-emerald-100/90 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                          : "bg-amber-100/90 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
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
                  </td>
                  <td className="px-4 py-4 text-right">
                    <form action={reconcileFinancialEntryAction} className="inline-flex">
                      <input type="hidden" name="id" value={entry.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-white hover:bg-[#3B68F7] hover:text-white transition-colors cursor-pointer"
                      >
                        <Check className="size-3" aria-hidden="true" />
                        <span>{entry.reconciliationStatus === "Conciliado" ? "Reabrir" : "Conciliar"}</span>
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="novo-lancamento" className="rounded-[28px] glass-surface p-6 sm:p-7 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Novo lançamento financeiro</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Registre faturamentos de contrato (receitas) ou despesas operacionais.
          </p>
        </div>

        <form action={createFinancialEntryAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label htmlFor="fin-type" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Tipo *
            </label>
            <select
              id="fin-type"
              name="entryType"
              defaultValue="Receita"
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <option value="Receita">Receita</option>
              <option value="Despesa">Despesa</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="fin-contract" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Contrato vinculado
            </label>
            <select
              id="fin-contract"
              name="contractId"
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
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
            <label htmlFor="fin-desc" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Descrição *
            </label>
            <input
              id="fin-desc"
              name="description"
              required
              placeholder="Ex.: Medição mensal de serviços terceirizados…"
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="fin-amount" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Valor (R$) *
            </label>
            <input
              id="fin-amount"
              name="amount"
              type="number"
              step="0.01"
              min={0.01}
              defaultValue="1500.00"
              required
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="fin-due" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Vencimento *
            </label>
            <input
              id="fin-due"
              name="dueDate"
              type="date"
              defaultValue="2026-11-30"
              required
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="fin-status" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Situação
            </label>
            <select
              id="fin-status"
              name="status"
              defaultValue="Pendente"
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <option value="Pendente">Pendente</option>
              <option value="Conciliado">Conciliado</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3 flex items-end justify-end">
            <button type="submit" className="min-h-10 pill-gradient py-2.5 px-6 text-xs cursor-pointer">
              Salvar lançamento
            </button>
          </div>
        </form>
      </section>
    </AdminShell>
  );
}
