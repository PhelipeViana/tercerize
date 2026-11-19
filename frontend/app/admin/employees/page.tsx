import { CheckCircle2, Clock, UserPlus, Users } from "lucide-react";
import { createEmployeeAction } from "@/app/actions/operations";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireSession } from "@/lib/auth/dal";
import { listCompanies, listContracts, listEmployees } from "@/lib/operations/repository";

export default async function EmployeesPage() {
  const session = await requireSession();
  const [companies, employees, contracts] = await Promise.all([
    listCompanies(),
    listEmployees(session.tenant.id),
    listContracts(session.tenant.id),
  ]);

  const alocados = employees.filter((e) => e.status === "Alocado").length;

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="employees"
      breadcrumb="Colaboradores e Escalas"
      routeLabel="/admin/employees"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-blue-100 italic">
            Gestão de Colaboradores e Escalas Operacionais
          </h1>
          <p className="text-xs font-bold text-gray-500 dark:text-blue-400/70 mt-0.5">
            Visibilidade imediata da ocupação, funções técnicas, turnos e cobertura de postos por contrato.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700/50 p-5 flex items-center border-b-4 border-b-blue-500">
          <div className="p-3.5 rounded-xl bg-blue-100/70 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 mr-4">
            <Users className="size-7" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest mb-0.5">
              Total Equipe
            </p>
            <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{employees.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700/50 p-5 flex items-center border-b-4 border-b-emerald-500">
          <div className="p-3.5 rounded-xl bg-emerald-100/70 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 mr-4">
            <CheckCircle2 className="size-7" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest mb-0.5">
              Alocados em Posto
            </p>
            <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{alocados}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700/50 p-5 flex items-center border-b-4 border-b-indigo-500">
          <div className="p-3.5 rounded-xl bg-indigo-100/70 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 mr-4">
            <Clock className="size-7" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest mb-0.5">
              Contratos Cobertos
            </p>
            <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{contracts.length}</p>
          </div>
        </div>
      </div>

      <section className="bg-white dark:bg-slate-800 overflow-hidden shadow-2xl rounded-2xl border border-gray-100 dark:border-slate-700/50">
        <div className="border-b border-gray-100 dark:border-slate-700 px-6 py-4 bg-gray-50/40 dark:bg-slate-900/40">
          <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
            Quadro de Colaboradores e Escalas
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-700">
            <thead className="bg-gray-50/80 dark:bg-slate-900/60">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Colaborador
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Função / Cargo
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Contrato / Posto Alocado
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Escala / Turno
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Situação
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-50 dark:divide-slate-700/50">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-900/15 transition-colors">
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/80 text-xs font-black text-blue-700 dark:text-blue-300">
                        {emp.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-sm font-black text-gray-900 dark:text-blue-50">{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs font-bold text-gray-700 dark:text-slate-200">{emp.roleTitle}</td>
                  <td className="px-5 py-4 text-xs">
                    {emp.contractCode ? (
                      <>
                        <span className="font-mono font-black text-blue-600 dark:text-blue-400">{emp.contractCode}</span>{" "}
                        <span className="font-bold text-gray-600 dark:text-slate-300">— {emp.clientName}</span>
                      </>
                    ) : (
                      <span className="font-bold text-gray-400">Reserva Técnica</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs font-bold text-gray-700 dark:text-slate-300">{emp.schedule}</td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="inline-flex rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 px-3 py-1 text-xs font-black">
                      {emp.status}
                    </span>
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
            <UserPlus className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
              Cadastrar Colaborador e Alocar em Escala
            </h2>
            <p className="text-xs font-bold text-gray-500 dark:text-slate-400">
              Registre o profissional técnico e vincule ao contrato ativo e turno de trabalho.
            </p>
          </div>
        </div>

        <form action={createEmployeeAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              htmlFor="emp-name"
              className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
            >
              Nome do Colaborador *
            </label>
            <input
              id="emp-name"
              name="name"
              required
              placeholder="Ex.: Marcos Oliveira…"
              className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="emp-role"
              className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
            >
              Função / Cargo *
            </label>
            <input
              id="emp-role"
              name="roleTitle"
              required
              placeholder="Ex.: Eletricista de Manutenção…"
              className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="emp-contract"
              className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
            >
              Contrato Vinculado
            </label>
            <select
              id="emp-contract"
              name="contractId"
              className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="">Reserva Técnica</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.clientName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="emp-schedule"
              className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
            >
              Turno / Escala Operacional
            </label>
            <select
              id="emp-schedule"
              name="schedule"
              defaultValue="Comercial 44h (08h às 18h)"
              className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="Comercial 44h (08h às 18h)">Comercial 44h (08h às 18h)</option>
              <option value="Escala 12x36 Diurno (07h às 19h)">Escala 12x36 Diurno (07h às 19h)</option>
              <option value="Escala 12x36 Noturno (19h às 07h)">Escala 12x36 Noturno (19h às 07h)</option>
              <option value="Plantão 6x1 Operacional">Plantão 6x1 Operacional</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg shadow-blue-500/25 text-xs uppercase tracking-widest transition-colors cursor-pointer"
            >
              Salvar Colaborador
            </button>
          </div>
        </form>
      </section>
    </AdminShell>
  );
}
