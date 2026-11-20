import { Check, Plus, Shield, Users } from "lucide-react";
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
      title="Controle de EPIs"
      subtitle="Registro de entrega de equipamentos de proteção, validade de CA e termos assinados."
      action={
        <a
          href="#novo-epi"
          className="inline-flex min-h-11 items-center gap-2 pill-gradient px-6 py-2.5 text-sm"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>Registrar entrega</span>
        </a>
      }
    >
      {/* Pastel Glass KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-blue-100/80 via-blue-50/65 to-white/75 dark:from-blue-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 dark:bg-blue-500/20 text-[#3B68F7] dark:text-blue-300">
            <Shield className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Entregas de EPI</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">{deliveries.length}</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-purple-100/80 via-purple-50/65 to-white/75 dark:from-purple-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300">
            <Check className="size-6 stroke-[2]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Termos assinados</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">{deliveries.length}</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-emerald-100/80 via-emerald-50/65 to-white/75 dark:from-emerald-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
            <Users className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Colaboradores ativos</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">{employees.length}</p>
          </div>
        </div>
      </div>

      {/* Main Glass Table Card */}
      <section className="rounded-[28px] glass-surface p-5 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center rounded-full border border-slate-200/80 dark:border-white/10 bg-slate-100/80 dark:bg-slate-800/70 p-1">
            <span className="pill-gradient px-5 py-2 text-sm">Termos e entregas</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="rounded-xl bg-slate-100/85 dark:bg-slate-800/75 text-xs font-bold text-slate-700 dark:text-slate-200">
                <th className="rounded-l-xl px-4 py-3.5">Colaborador</th>
                <th className="px-4 py-3.5">Equipamento (EPI)</th>
                <th className="px-4 py-3.5">Certificado (CA)</th>
                <th className="px-4 py-3.5">Entrega</th>
                <th className="px-4 py-3.5">Validade</th>
                <th className="rounded-r-xl px-4 py-3.5">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-white/10">
              {deliveries.map((d) => (
                <tr key={d.id} className="hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-4">
                    <span className="block font-bold text-slate-900 dark:text-white">{d.employeeName}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{d.employeeRole}</span>
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-800 dark:text-slate-200">{d.epiName}</td>
                  <td className="px-4 py-4 font-bold text-slate-900 dark:text-white">{d.caNumber}</td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300 tabular-nums">{d.deliveredAt}</td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300 tabular-nums">{d.expiresAt}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/90 dark:bg-emerald-950/80 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
                      Termo assinado
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="novo-epi" className="rounded-[28px] glass-surface p-6 sm:p-7 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Registrar entrega de EPI</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Vincule o equipamento ao colaborador com número do CA e data de validade.
          </p>
        </div>

        <form action={createEPIAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label htmlFor="epi-emp" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Colaborador *
            </label>
            <select
              id="epi-emp"
              name="employeeId"
              required
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.roleTitle})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="epi-name" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Descrição do EPI *
            </label>
            <input
              id="epi-name"
              name="epiName"
              required
              placeholder="Ex.: Botina de segurança composite…"
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="epi-ca" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Número do CA *
            </label>
            <input
              id="epi-ca"
              name="caNumber"
              required
              placeholder="Ex.: CA-42110…"
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="epi-exp" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Data de validade *
            </label>
            <input
              id="epi-exp"
              name="expiresAt"
              type="date"
              defaultValue="2027-11-19"
              required
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
            <button type="submit" className="min-h-10 pill-gradient py-2.5 px-6 text-xs cursor-pointer">
              Registrar entrega
            </button>
          </div>
        </form>
      </section>
    </AdminShell>
  );
}
