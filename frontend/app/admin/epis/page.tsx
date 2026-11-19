import { CheckCircle2, HardHat } from "lucide-react";
import { createEPIAction } from "@/app/actions/operations";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireSession } from "@/lib/auth/dal";
import { listCompanies, listEmployees, listEPIDeliveries } from "@/lib/operations/repository";

export default async function EPIsPage() {
  const session = await requireSession();
  const [companies, deliveries, employees] = await Promise.all([
    listCompanies(),
    listEPIDeliveries(session.tenant.id),
    listEmployees(session.tenant.id),
  ]);

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="epis"
      breadcrumb="Controle de EPIs"
      routeLabel="/admin/epis"
    >
      <div>
        <h1 className="text-2xl font-black text-gray-800 dark:text-blue-100 italic">
          Controle de Entrega de EPIs e Termos de Recebimento
        </h1>
        <p className="text-xs font-bold text-gray-500 dark:text-blue-400/70 mt-0.5">
          Conformidade trabalhista, rastreamento de Certificado de Aprovação (CA), validade e termos assinados.
        </p>
      </div>

      <section className="bg-white dark:bg-slate-800 overflow-hidden shadow-2xl rounded-2xl border border-gray-100 dark:border-slate-700/50">
        <div className="border-b border-gray-100 dark:border-slate-700 px-6 py-4 bg-gray-50/40 dark:bg-slate-900/40">
          <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
            Histórico de Entregas de EPIs por Colaborador ({deliveries.length})
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
                  Equipamento (EPI)
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Certificado (CA)
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Entrega
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Validade
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Termo
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-50 dark:divide-slate-700/50">
              {deliveries.map((d) => (
                <tr key={d.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-900/15 transition-colors">
                  <td className="px-5 py-4">
                    <div className="text-sm font-black text-gray-900 dark:text-blue-50">{d.employeeName}</div>
                    <div className="text-xs font-bold text-gray-500 dark:text-blue-400/70">{d.employeeRole}</div>
                  </td>
                  <td className="px-5 py-4 text-sm font-bold text-gray-800 dark:text-white">{d.epiName}</td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="inline-flex rounded-lg bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/60 px-2.5 py-1 font-mono text-xs font-black text-blue-700 dark:text-blue-300">
                      {d.caNumber}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs font-bold text-gray-700 dark:text-slate-300 tabular-nums">
                    {d.deliveredAt}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs font-bold text-gray-700 dark:text-slate-300 tabular-nums">
                    {d.expiresAt}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 px-3 py-1 text-xs font-black">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      <span>Termo Assinado</span>
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
            <HardHat className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
              Registrar Nova Entrega de EPI
            </h2>
            <p className="text-xs font-bold text-gray-500 dark:text-slate-400">
              Vincule o equipamento ao colaborador com número do CA e data de validade.
            </p>
          </div>
        </div>

        <form action={createEPIAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              htmlFor="epi-emp"
              className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
            >
              Colaborador *
            </label>
            <select
              id="epi-emp"
              name="employeeId"
              required
              className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.roleTitle})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="epi-name"
              className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
            >
              Descrição do EPI *
            </label>
            <input
              id="epi-name"
              name="epiName"
              required
              placeholder="Ex.: Botina de Segurança Composite…"
              className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="epi-ca"
              className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
            >
              Número do CA *
            </label>
            <input
              id="epi-ca"
              name="caNumber"
              required
              placeholder="Ex.: CA-42110…"
              className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="epi-exp"
              className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
            >
              Data de Validade *
            </label>
            <input
              id="epi-exp"
              name="expiresAt"
              type="date"
              defaultValue="2027-11-19"
              required
              className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg shadow-blue-500/25 text-xs uppercase tracking-widest transition-colors cursor-pointer"
            >
              Registrar Entrega e Termo
            </button>
          </div>
        </form>
      </section>
    </AdminShell>
  );
}
