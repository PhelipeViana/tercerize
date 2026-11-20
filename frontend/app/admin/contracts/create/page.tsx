import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { createContractAction } from "@/app/actions/operations";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireSession } from "@/lib/auth/dal";
import { listClients, listCompanies } from "@/lib/operations/repository";

export default async function CreateContractPage() {
  const session = await requireSession();
  const [companies, clients] = await Promise.all([
    listCompanies(),
    listClients(session.tenant.id),
  ]);

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="contracts"
      title="Novo contrato"
      subtitle="Seleção relacional de cliente tomador, vigência, postos e escopo técnico."
      action={
        <Link
          href="/admin/contracts"
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200/90 dark:border-white/15 bg-white/85 dark:bg-slate-800/80 px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          <span>Voltar para contratos</span>
        </Link>
      }
    >
      <section className="rounded-[28px] glass-surface p-6 sm:p-8">
        <form action={createContractAction} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="clientId" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Cliente tomador (seleção obrigatória) *
            </label>
            <select
              id="clientId"
              name="clientId"
              required
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              {clients.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name} (CNPJ: {cl.cnpj})
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="object" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Objeto do contrato *
              </label>
              <input
                id="object"
                name="object"
                required
                placeholder="Ex.: Manutenção preventiva e suporte técnico…"
                className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="durationMonths" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Vigência (meses) *
              </label>
              <input
                id="durationMonths"
                name="durationMonths"
                type="number"
                min={1}
                max={120}
                defaultValue={12}
                required
                className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="monthlyValue" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Valor mensal (R$) *
              </label>
              <input
                id="monthlyValue"
                name="monthlyValue"
                type="number"
                step="0.01"
                min={0}
                defaultValue="18500.00"
                required
                className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="workstation" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Unidade / postos vinculados
            </label>
            <input
              id="workstation"
              name="workstation"
              defaultValue="Cuiabá · 4 postos"
              className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="scopeNotes" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Escopo e condições do contrato *
            </label>
            <textarea
              id="scopeNotes"
              name="scopeNotes"
              rows={3}
              required
              defaultValue="Prestação de serviços contínuos de suporte técnico, manutenção preventiva e alocação de equipe especializada."
              className="w-full rounded-3xl border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 p-4 text-sm font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/60 dark:border-white/10 pt-5">
            <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              Campos validados automaticamente pelo sistema
            </span>
            <button
              type="submit"
              className="min-h-11 pill-gradient px-7 py-2.5 text-sm cursor-pointer"
            >
              Salvar contrato
            </button>
          </div>
        </form>
      </section>
    </AdminShell>
  );
}
