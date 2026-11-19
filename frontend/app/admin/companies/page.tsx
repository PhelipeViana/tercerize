import { redirect } from "next/navigation";
import { Building2, CheckCircle2, Plus, ShieldCheck } from "lucide-react";
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
      breadcrumb="Multi-Empresas (Nível Desenvolvedor)"
      routeLabel="/admin/companies"
    >
      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 border-b-4 border-b-blue-600 p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/25">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
              Supervisão Multi-Tenant
            </p>
            <h1 className="text-xl font-black text-gray-900 dark:text-white italic">
              Painel Desenvolvedor — Governança Multi-Empresas
            </h1>
            <p className="text-xs font-bold text-gray-500 dark:text-blue-300/80 mt-0.5">
              Autenticado como <strong>{session.user.email}</strong>. Provisione novas empresas prestadoras e alterne o contexto operacional ativo em tempo real.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 shadow-2xl overflow-hidden">
          <div className="border-b border-gray-100 dark:border-slate-700 px-6 py-4 bg-gray-50/40 dark:bg-slate-900/40">
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
              Empresas Cadastradas na Plataforma ({companies.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-slate-700/60">
            {companies.map((c) => {
              const isCurrent = c.id === session.tenant.id;
              return (
                <div
                  key={c.id}
                  className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <p className="text-sm font-black text-gray-900 dark:text-white">{c.name}</p>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 px-2.5 py-0.5 text-[11px] font-black">
                          <CheckCircle2 className="size-3.5" aria-hidden="true" />
                          Ativa na Sessão
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      CNPJ: {c.cnpj}
                    </p>
                    <div className="flex flex-wrap gap-4 text-xs font-bold text-gray-500 dark:text-slate-400 tabular-nums">
                      <span>
                        <strong className="text-gray-900 dark:text-white">{c.contractsCount}</strong> contratos
                      </span>
                      <span>
                        <strong className="text-gray-900 dark:text-white">{c.employeesCount}</strong> colaboradores
                      </span>
                      <span>
                        <strong className="text-gray-900 dark:text-white">{c.serviceOrdersCount}</strong> ordens de serviço
                      </span>
                    </div>
                  </div>

                  {!isCurrent && (
                    <form action={switchTenantAction}>
                      <input type="hidden" name="tenantId" value={c.id} />
                      <button
                        type="submit"
                        className="rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/20 transition-colors cursor-pointer"
                      >
                        Assumir Contexto
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-6 shadow-xl space-y-4 h-fit">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-700 pb-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
              <Building2 className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                Provisionar Nova Empresa
              </h2>
              <p className="text-xs font-bold text-gray-500 dark:text-slate-400">
                Cria um ambiente isolado para uma nova empresa terceirizadora.
              </p>
            </div>
          </div>

          <form action={createCompanyAction} className="space-y-4">
            <div>
              <label
                htmlFor="comp-name"
                className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
              >
                Razão Social da Empresa *
              </label>
              <input
                id="comp-name"
                name="name"
                required
                placeholder="Ex.: Pantanal Facilities & Manutenção Ltda…"
                className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="comp-cnpj"
                className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
              >
                CNPJ *
              </label>
              <input
                id="comp-cnpj"
                name="cnpj"
                required
                placeholder="00.000.000/0001-00…"
                className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="w-full min-h-11 bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 px-5 rounded-xl shadow-lg shadow-blue-500/20 text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>Criar Empresa e Ativar</span>
            </button>
          </form>
        </section>
      </div>
    </AdminShell>
  );
}
