import { Calendar, Check, FileText, Plus, Users } from "lucide-react";
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
      title="Colaboradores e escalas"
      subtitle="Equipe técnica, funções, alocação por contrato e turnos operacionais."
      action={
        <a
          href="#novo-colaborador"
          className="inline-flex min-h-11 items-center gap-2 pill-gradient px-6 py-2.5 text-sm"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>Novo colaborador</span>
        </a>
      }
    >
      {/* 4 Pastel Glass KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-blue-100/80 via-blue-50/65 to-white/75 dark:from-blue-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 dark:bg-blue-500/20 text-[#3B68F7] dark:text-blue-300">
            <Users className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Equipe total</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">{employees.length}</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-purple-100/80 via-purple-50/65 to-white/75 dark:from-purple-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300">
            <Check className="size-6 stroke-[2]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Alocados</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">{alocados}</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-emerald-100/80 via-emerald-50/65 to-white/75 dark:from-emerald-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
            <FileText className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Contratos cobertos</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">{contracts.length}</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-sky-100/80 via-sky-50/65 to-white/75 dark:from-sky-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-sky-600/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300">
            <Calendar className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Escalas ativas</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">2</p>
          </div>
        </div>
      </div>

      {/* Main Glass Table Card */}
      <section className="rounded-[28px] glass-surface p-5 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center rounded-full border border-slate-200/80 dark:border-white/10 bg-slate-100/80 dark:bg-slate-800/70 p-1">
            <span className="pill-gradient px-5 py-2 text-sm">Quadro técnico</span>
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {employees.length} colaborador(es)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="rounded-xl bg-slate-100/85 dark:bg-slate-800/75 text-xs font-bold text-slate-700 dark:text-slate-200">
                <th className="rounded-l-xl px-4 py-3.5">Colaborador</th>
                <th className="px-4 py-3.5">Função / cargo</th>
                <th className="px-4 py-3.5">Contrato / posto</th>
                <th className="px-4 py-3.5">Escala / turno</th>
                <th className="rounded-r-xl px-4 py-3.5">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-white/10">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-4 font-bold text-slate-900 dark:text-white">{emp.name}</td>
                  <td className="px-4 py-4 text-slate-700 dark:text-slate-200">{emp.roleTitle}</td>
                  <td className="px-4 py-4 text-slate-700 dark:text-slate-300">
                    {emp.contractCode ? (
                      <>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {emp.contractCode.replace("#", "")}
                        </span>{" "}
                        · {emp.clientName}
                      </>
                    ) : (
                      "Reserva técnica"
                    )}
                  </td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{emp.schedule}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/90 dark:bg-emerald-950/80 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
                      {emp.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="novo-colaborador" className="rounded-[28px] glass-surface p-6 sm:p-7 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Cadastrar colaborador e escala</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Registre o profissional e vincule ao contrato ativo e turno operacional.
          </p>
        </div>

        <form action={createEmployeeAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label htmlFor="emp-name" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Nome do colaborador *
            </label>
            <input
              id="emp-name"
              name="name"
              required
              placeholder="Ex.: Marcos Oliveira…"
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="emp-role" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Função / cargo *
            </label>
            <input
              id="emp-role"
              name="roleTitle"
              required
              placeholder="Ex.: Eletricista de manutenção…"
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="emp-contract" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Contrato vinculado
            </label>
            <select
              id="emp-contract"
              name="contractId"
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <option value="">Reserva técnica</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code.replace("#", "")} · {c.clientName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="emp-schedule" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Turno / escala
            </label>
            <select
              id="emp-schedule"
              name="schedule"
              defaultValue="Comercial 44h (08h às 18h)"
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <option value="Comercial 44h (08h às 18h)">Comercial 44h (08h às 18h)</option>
              <option value="Escala 12x36 Diurno (07h às 19h)">Escala 12x36 Diurno (07h às 19h)</option>
              <option value="Escala 12x36 Noturno (19h às 07h)">Escala 12x36 Noturno (19h às 07h)</option>
              <option value="Plantão 6x1 Operacional">Plantão 6x1 Operacional</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
            <button type="submit" className="min-h-10 pill-gradient py-2.5 px-6 text-xs cursor-pointer">
              Salvar colaborador
            </button>
          </div>
        </form>
      </section>
    </AdminShell>
  );
}
