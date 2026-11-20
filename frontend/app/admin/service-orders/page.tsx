import { Check, ClipboardList, Clock, Play, Plus, Wrench } from "lucide-react";
import { createServiceOrderAction, updateServiceOrderStatusAction } from "@/app/actions/operations";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireSession } from "@/lib/auth/dal";
import { listClients, listCompanies, listEmployees, listServiceOrders } from "@/lib/operations/repository";

export default async function ServiceOrdersPage() {
  const session = await requireSession();
  const [companies, orders, clients, employees] = await Promise.all([
    listCompanies(),
    listServiceOrders(session.tenant.id),
    listClients(session.tenant.id),
    listEmployees(session.tenant.id),
  ]);

  const emExecucao = orders.filter((o) => o.status === "Em Execução").length;
  const agendadas = orders.filter((o) => o.status === "Agendada").length;
  const concluidas = orders.filter((o) => o.status === "Concluída").length;

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="service-orders"
      title="Ordens de serviço"
      subtitle="Despacho rápido de chamados, alocação técnica e acompanhamento em tempo real."
      action={
        <a
          href="#nova-os"
          className="inline-flex min-h-11 items-center gap-2 pill-gradient px-6 py-2.5 text-sm"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>Nova ordem</span>
        </a>
      }
    >
      {/* 4 Pastel Glass KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-blue-100/80 via-blue-50/65 to-white/75 dark:from-blue-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 dark:bg-blue-500/20 text-[#3B68F7] dark:text-blue-300">
            <ClipboardList className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Total de OS</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">{orders.length}</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-purple-100/80 via-purple-50/65 to-white/75 dark:from-purple-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300">
            <Wrench className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Em execução</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">{emExecucao}</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-emerald-100/80 via-emerald-50/65 to-white/75 dark:from-emerald-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
            <Check className="size-6 stroke-[2]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Concluídas</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">{concluidas}</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-sky-100/80 via-sky-50/65 to-white/75 dark:from-sky-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-sky-600/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300">
            <Clock className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Agendadas</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">{agendadas}</p>
          </div>
        </div>
      </div>

      {/* Main Glass Table Card */}
      <section className="rounded-[28px] glass-surface p-5 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center rounded-full border border-slate-200/80 dark:border-white/10 bg-slate-100/80 dark:bg-slate-800/70 p-1">
            <span className="pill-gradient px-5 py-2 text-sm">Fila de execução</span>
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {orders.length} chamado(s) ativo(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="rounded-xl bg-slate-100/85 dark:bg-slate-800/75 text-xs font-bold text-slate-700 dark:text-slate-200">
                <th className="rounded-l-xl px-4 py-3.5">Código</th>
                <th className="px-4 py-3.5">Cliente / unidade</th>
                <th className="px-4 py-3.5">Técnico alocado</th>
                <th className="px-4 py-3.5">Descrição do serviço</th>
                <th className="px-4 py-3.5">Prioridade</th>
                <th className="px-4 py-3.5">Situação</th>
                <th className="rounded-r-xl px-4 py-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-white/10">
              {orders.map((os) => (
                <tr key={os.id} className="hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-4 font-bold text-slate-900 dark:text-white tabular-nums">
                    {os.code.replace("#", "")}
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-800 dark:text-slate-100">{os.clientName}</td>
                  <td className="px-4 py-4 text-slate-700 dark:text-slate-200">
                    {os.employeeName || "Aguardando designação"}
                  </td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{os.description}</td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                        os.priority === "Urgente"
                          ? "bg-rose-100/90 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300"
                          : os.priority === "Alta"
                            ? "bg-amber-100/90 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                            : "bg-blue-100/90 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300"
                      }`}
                    >
                      {os.priority}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                        os.status === "Concluída"
                          ? "bg-emerald-100/90 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                          : os.status === "Em Execução"
                            ? "bg-blue-100/90 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300"
                            : "bg-amber-100/90 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          os.status === "Concluída"
                            ? "bg-emerald-600"
                            : os.status === "Em Execução"
                              ? "bg-blue-600"
                              : "bg-amber-600"
                        }`}
                        aria-hidden="true"
                      />
                      {os.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    {os.status !== "Concluída" && (
                      <form action={updateServiceOrderStatusAction} className="inline-flex">
                        <input type="hidden" name="id" value={os.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={os.status === "Agendada" ? "Em Execução" : "Concluída"}
                        />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-white hover:bg-[#3B68F7] hover:text-white transition-colors cursor-pointer"
                        >
                          {os.status === "Agendada" ? (
                            <>
                              <Play className="size-3" aria-hidden="true" />
                              <span>Iniciar</span>
                            </>
                          ) : (
                            <>
                              <Check className="size-3" aria-hidden="true" />
                              <span>Concluir</span>
                            </>
                          )}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Form Card: Nova Ordem de Serviço */}
      <section id="nova-os" className="rounded-[28px] glass-surface p-6 sm:p-7 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Despachar nova ordem de serviço</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Vincule o cliente tomador, o técnico alocado e a descrição do atendimento.
          </p>
        </div>

        <form action={createServiceOrderAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label htmlFor="os-client" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Cliente / unidade *
            </label>
            <select
              id="os-client"
              name="clientId"
              required
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              {clients.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="os-employee" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Técnico alocado
            </label>
            <select
              id="os-employee"
              name="employeeId"
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <option value="">Designar posteriormente</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.roleTitle})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="os-priority" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Prioridade
            </label>
            <select
              id="os-priority"
              name="priority"
              defaultValue="Normal"
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <option value="Normal">Normal</option>
              <option value="Alta">Alta</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="os-status" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Situação inicial
            </label>
            <select
              id="os-status"
              name="status"
              defaultValue="Agendada"
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <option value="Agendada">Agendada</option>
              <option value="Em Execução">Em Execução</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3 space-y-1">
            <label htmlFor="os-desc" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Descrição do serviço *
            </label>
            <input
              id="os-desc"
              name="description"
              required
              placeholder="Ex.: Revisão de cabeamento estruturado e switches…"
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="flex items-end">
            <button type="submit" className="w-full min-h-10 pill-gradient py-2.5 px-5 text-xs cursor-pointer">
              Abrir ordem de serviço
            </button>
          </div>
        </form>
      </section>
    </AdminShell>
  );
}
