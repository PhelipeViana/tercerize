import { CheckCircle2, ClipboardCheck, Clock, Play, Plus, Wrench } from "lucide-react";
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
      breadcrumb="Ordens de Serviço"
      routeLabel="/admin/service-orders"
    >
      {/* Header Principal Estilo PortoCercado / Filament */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-blue-100 italic">
            Abertura e Acompanhamento de Ordens de Serviço
          </h1>
          <p className="text-xs font-bold text-gray-500 dark:text-blue-400/70 mt-0.5">
            Despacho rápido de chamados vinculando cliente, técnico designado e prioridade de atendimento.
          </p>
        </div>
        <a
          href="#form-nova-os"
          className="bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 px-6 rounded-xl shadow-lg shadow-blue-500/25 transition-colors flex items-center gap-2 text-xs uppercase tracking-wider"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>+ Nova Ordem de Serviço</span>
        </a>
      </div>

      {/* Cards KPI de Ordens de Serviço */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700/50 p-5 flex items-center border-b-4 border-b-blue-500">
          <div className="p-3.5 rounded-xl bg-blue-100/70 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 mr-4">
            <Wrench className="size-7" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest mb-0.5">
              Em Execução
            </p>
            <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{emExecucao}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700/50 p-5 flex items-center border-b-4 border-b-amber-500">
          <div className="p-3.5 rounded-xl bg-amber-100/70 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 mr-4">
            <Clock className="size-7" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest mb-0.5">
              Agendadas
            </p>
            <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{agendadas}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700/50 p-5 flex items-center border-b-4 border-b-emerald-500">
          <div className="p-3.5 rounded-xl bg-emerald-100/70 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 mr-4">
            <CheckCircle2 className="size-7" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest mb-0.5">
              Concluídas
            </p>
            <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{concluidas}</p>
          </div>
        </div>
      </div>

      {/* Tabela Principal Filament — Tela 2 do Briefing Executivo */}
      <section className="bg-white dark:bg-slate-800 overflow-hidden shadow-2xl rounded-2xl border border-gray-100 dark:border-slate-700/50">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-700 px-6 py-4 bg-gray-50/40 dark:bg-slate-900/40">
          <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
            Fila de Execução Operacional
          </h2>
          <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
            {orders.length} chamado(s) listado(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-700">
            <thead className="bg-gray-50/80 dark:bg-slate-900/60">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  OS
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Cliente / Unidade
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Técnico Alocado
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Descrição do Serviço
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Prioridade
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Status
                </th>
                <th className="px-5 py-4 text-right text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-50 dark:divide-slate-700/50">
              {orders.map((os) => (
                <tr key={os.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-900/15 transition-colors">
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="inline-flex rounded-lg bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/60 px-2.5 py-1 font-mono text-xs font-black text-blue-700 dark:text-blue-300 tabular-nums">
                      {os.code}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm font-black text-gray-900 dark:text-blue-50">
                    {os.clientName}
                  </td>
                  <td className="px-5 py-4 text-xs font-bold text-gray-700 dark:text-slate-200">
                    {os.employeeName || "Aguardando designação"}
                  </td>
                  <td className="px-5 py-4 text-xs font-medium text-gray-700 dark:text-slate-300">
                    {os.description}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-black uppercase ${os.priority === "Urgente"
                        ? "bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300"
                        : os.priority === "Alta"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300"
                        }`}
                    >
                      {os.priority}
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${os.status === "Concluída"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                        : os.status === "Em Execução"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                        }`}
                    >
                      {os.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-right">
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
                          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white shadow-sm transition-colors cursor-pointer"
                        >
                          {os.status === "Agendada" ? (
                            <>
                              <Play className="size-3" aria-hidden="true" />
                              <span>Iniciar</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="size-3" aria-hidden="true" />
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

      {/* Card de Abertura de Nova Ordem de Serviço */}
      <section
        id="form-nova-os"
        className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700/50 space-y-5"
      >
        <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-700 pb-3">
          <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
            <ClipboardCheck className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
              Despachar Nova Ordem de Serviço (OS)
            </h2>
            <p className="text-xs font-bold text-gray-500 dark:text-slate-400">
              Vincule o cliente tomador, o técnico responsável e a descrição técnica do chamado.
            </p>
          </div>
        </div>

        <form action={createServiceOrderAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              htmlFor="os-client"
              className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
            >
              Cliente / Unidade *
            </label>
            <select
              id="os-client"
              name="clientId"
              required
              className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {clients.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="os-employee"
              className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
            >
              Técnico Alocado
            </label>
            <select
              id="os-employee"
              name="employeeId"
              className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="">Designar posteriormente</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.roleTitle})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="os-priority"
              className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
            >
              Prioridade
            </label>
            <select
              id="os-priority"
              name="priority"
              defaultValue="Normal"
              className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="Normal">Normal</option>
              <option value="Alta">Alta</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="os-status"
              className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
            >
              Status Inicial
            </label>
            <select
              id="os-status"
              name="status"
              defaultValue="Agendada"
              className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="Agendada">Agendada</option>
              <option value="Em Execução">Em Execução</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label
              htmlFor="os-desc"
              className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
            >
              Descrição do Serviço *
            </label>
            <input
              id="os-desc"
              name="description"
              required
              placeholder="Ex.: Revisão de cabeamento estruturado e switches…"
              className="w-full px-4 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full min-h-11 bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 px-5 rounded-xl shadow-lg shadow-blue-500/25 text-xs uppercase tracking-widest transition-colors cursor-pointer"
            >
              Abrir OS
            </button>
          </div>
        </form>
      </section>
    </AdminShell>
  );
}
