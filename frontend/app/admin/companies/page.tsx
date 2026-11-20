import { redirect } from "next/navigation";
import { Building2, Check, Layers, Plus } from "lucide-react";
import { createCompanyAction, switchTenantAction } from "@/app/actions/auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireSession } from "@/lib/auth/dal";
import { listCompanies } from "@/lib/operations/repository";

export default async function CompaniesPage() {
  const session = await requireSession();
  if (session.user.role !== "developer") {
    redirect("/admin/contracts");
  }
  const companies = await listCompanies();

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="companies"
      title="Multi-Empresas"
      subtitle="Governança de empresas prestadoras cadastradas e troca de contexto operacional em tempo real."
    >
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-[28px] glass-surface p-5 sm:p-7 space-y-5">
          <div className="inline-flex items-center rounded-full border border-slate-200/80 dark:border-white/10 bg-slate-100/80 dark:bg-slate-800/70 p-1">
            <span className="pill-gradient px-5 py-2 text-sm">
              Empresas cadastradas ({companies.length})
            </span>
          </div>

          <div className="divide-y divide-slate-200/60 dark:divide-white/10">
            {companies.map((c) => {
              const isCurrent = c.id === session.tenant.id;
              return (
                <div key={c.id} className="py-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2.5">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{c.name}</p>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/90 dark:bg-emerald-950/80 px-3 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          <span className="size-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
                          Ativa na sessão
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-xs text-slate-500 dark:text-slate-400">CNPJ: {c.cnpj}</p>
                    <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                      <span>
                        <strong>{c.contractsCount}</strong> contratos
                      </span>
                      <span>
                        <strong>{c.employeesCount}</strong> colaboradores
                      </span>
                      <span>
                        <strong>{c.serviceOrdersCount}</strong> ordens de serviço
                      </span>
                    </div>
                  </div>

                  {!isCurrent && (
                    <form action={switchTenantAction}>
                      <input type="hidden" name="tenantId" value={c.id} />
                      <button
                        type="submit"
                        className="min-h-9 pill-gradient px-4 py-1.5 text-xs cursor-pointer"
                      >
                        Ativar empresa
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[28px] glass-surface p-6 space-y-4 h-fit">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-[#3B68F7] dark:text-blue-300">
              <Building2 className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Nova empresa prestadora</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cria um ambiente isolado multi-tenant.
              </p>
            </div>
          </div>

          <form action={createCompanyAction} className="space-y-3.5">
            <div className="space-y-1">
              <label htmlFor="comp-name" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Razão social da empresa *
              </label>
              <input
                id="comp-name"
                name="name"
                required
                placeholder="Ex.: Pantanal Facilities & Manutenção Ltda…"
                className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="comp-cnpj" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                CNPJ *
              </label>
              <input
                id="comp-cnpj"
                name="cnpj"
                required
                placeholder="00.000.000/0001-00…"
                className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              />
            </div>
            <button
              type="submit"
              className="w-full min-h-10 pill-gradient py-2.5 px-5 text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>Criar empresa e ativar</span>
            </button>
          </form>
        </section>
      </div>
    </AdminShell>
  );
}
