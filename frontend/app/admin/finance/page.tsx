import { CheckCircle2, Landmark, PlusCircle, TrendingDown, TrendingUp } from "lucide-react";
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

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="finance"
      breadcrumb="Gestão Financeira"
      routeLabel="/admin/finance"
    >
      <div>
        <h1 className="text-2xl font-black text-gray-800 dark:text-blue-100 italic">
          Gestão Financeira e Conciliação por Contrato
        </h1>
        <p className="text-xs font-bold text-gray-500 dark:text-blue-400/70 mt-0.5">
          Controle de receitas vinculadas aos contratos, despesas operacionais e fluxo de caixa.
        </p>
      </div>

      {/* Cards de Resumo Financeiro (Estilo PortoCercado) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl p-5 border border-emerald-200 dark:border-emerald-800/60 shadow-lg border-b-4 border-b-emerald-500 flex items-center justify-between">
          <div>
            <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
              Receitas Contratuais
            </span>
            <p className="text-2xl font-black text-emerald-900 dark:text-emerald-100 mt-1 tabular-nums">
              R$ {totalReceitas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 rounded-xl">
            <TrendingUp className="size-7" aria-hidden="true" />
          </div>
        </div>

        <div className="bg-red-50/70 dark:bg-red-950/30 rounded-2xl p-5 border border-red-200 dark:border-red-800/60 shadow-lg border-b-4 border-b-red-500 flex items-center justify-between">
          <div>
            <span className="text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-widest">
              Despesas Operacionais
            </span>
            <p className="text-2xl font-black text-red-900 dark:text-red-100 mt-1 tabular-nums">
              R$ {totalDespesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 rounded-xl">
            <TrendingDown className="size-7" aria-hidden="true" />
          </div>
        </div>

        <div className="bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl p-5 border border-blue-200 dark:border-blue-800/60 shadow-lg border-b-4 border-b-blue-500 flex items-center justify-between">
          <div>
            <span className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">
              Saldo Operacional
            </span>
            <p className="text-2xl font-black text-blue-900 dark:text-blue-100 mt-1 tabular-nums">
              R$ {saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-xl">
            <Landmark className="size-7" aria-hidden="true" />
          </div>
        </div>
      </div>

      <section className="bg-white dark:bg-slate-800 overflow-hidden shadow-2xl rounded-2xl border border-gray-100 dark:border-slate-700/50">
        <div className="border-b border-gray-100 dark:border-slate-700 px-6 py-4 bg-gray-50/40 dark:bg-slate-900/40">
          <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
            Fluxo de Caixa e Conciliação de Lançamentos ({entries.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-700">
            <thead className="bg-gray-50/80 dark:bg-slate-900/60">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Tipo
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Contrato
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Descrição
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Vencimento
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Valor
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Conciliação
                </th>
                <th className="px-5 py-4 text-right text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-50 dark:divide-slate-700/50">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-900/15 transition-colors">
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-black ${
                        entry.entryType === "Receita"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"
                          : "bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300"
                      }`}
                    >
                      {entry.entryType}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs font-black text-blue-600 dark:text-blue-400">
                    {entry.contractCode || "Geral"}
                  </td>
                  <td className="px-5 py-4 text-sm font-bold text-gray-900 dark:text-white">{entry.description}</td>
                  <td className="px-5 py-4 font-mono text-xs font-bold text-gray-600 dark:text-slate-300 tabular-nums">
                    {entry.dueDate}
                  </td>
                  <td className="px-5 py-4 font-black text-sm text-gray-900 dark:text-blue-50 tabular-nums">
                    R$ {entry.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
                        entry.reconciliationStatus === "Conciliado"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                      }`}
                    >
                      {entry.reconciliationStatus === "Conciliado" && (
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      )}
                      <span>{entry.reconciliationStatus}</span>
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-right">
                    <form action={reconcileFinancialEntryAction} className="inline-flex">
                      <input type="hidden" name="id" value={entry.id} />
                      <button
                        type="submit"
                        className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-gray-700 dark:text-blue-200 transition-colors cursor-pointer"
                      >
                        {entry.reconciliationStatus === "Conciliado" ? "Reabrir" : "Conciliar"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700/50 space-y-5">
        <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-700 pb-3">
          <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
            <PlusCircle className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
              Novo Lançamento Financeiro
            </h2>
            <p className="text-xs font-bold text-gray-500 dark:text-slate-400">
              Registre faturamentos de contrato (receitas) ou custos operacionais (despesas).
            </p>
          </div>
        </div>

        <form action={createFinancialEntryAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label
              htmlFor="fin-type"
              className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
            >
              Tipo *
            </label>
            <select
              id="fin-type"
              name="entryType"
              defaultValue="Receita"
              className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="Receita">Receita</option>
              <option value="Despesa">Despesa</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="fin-contract"
              className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
            >
              Contrato Vinculado
            </label>
            <select
              id="fin-contract"
              name="contractId"
              className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="">Operacional Geral</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.clientName}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="fin-desc"
              className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
            >
              Descrição *
            </label>
            <input
              id="fin-desc"
              name="description"
              required
              placeholder="Ex.: Medição Mensal de Serviços Terceirizados…"
              className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="fin-amount"
              className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
            >
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
              className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-black text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="fin-due"
              className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
            >
              Vencimento *
            </label>
            <input
              id="fin-due"
              name="dueDate"
              type="date"
              defaultValue="2026-11-30"
              required
              className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="fin-status"
              className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
            >
              Conciliação
            </label>
            <select
              id="fin-status"
              name="status"
              defaultValue="Pendente"
              className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="Pendente">Pendente</option>
              <option value="Conciliado">Conciliado</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3 flex items-end justify-end">
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg shadow-blue-500/25 text-xs uppercase tracking-widest transition-colors cursor-pointer"
            >
              Registrar Lançamento
            </button>
          </div>
        </form>
      </section>
    </AdminShell>
  );
}
