import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileSignature } from "lucide-react";
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
      breadcrumb="Contratos › Criar"
      routeLabel="/admin/contracts/create"
    >
      {/* Tela 4 do Briefing Executivo — Formulário Inteligente de Cadastro (Novo Contrato) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-blue-100 italic">
            Formulário Inteligente — Novo Contrato
          </h1>
          <p className="text-xs font-bold text-gray-500 dark:text-blue-400/70 mt-0.5">
            Validação automática e seleção relacional da base de clientes tomadores cadastrados.
          </p>
        </div>
        <Link
          href="/admin/contracts"
          className="px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-blue-200 border border-gray-200 dark:border-slate-700 text-xs font-black rounded-xl transition-colors uppercase tracking-wider flex items-center gap-2 shadow-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>Voltar para Contratos</span>
        </Link>
      </div>

      <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700/50 overflow-hidden border-b-4 border-b-blue-600">
        <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-700 px-6 py-4 bg-blue-50/50 dark:bg-slate-900/60">
          <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <FileSignature className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
              Painel Administrativo › Contratos › Criar
            </h2>
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
              Preencha os parâmetros contratuais e de alocação operacional
            </p>
          </div>
        </div>

        <form action={createContractAction} className="p-6 sm:p-8 space-y-6">
          <div className="rounded-2xl border-2 border-blue-100 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-900/60 p-5">
            <label
              htmlFor="clientId"
              className="block text-xs font-black text-blue-700 dark:text-blue-300 mb-2 uppercase tracking-widest"
            >
              Cliente Tomador (Seleção Obrigatória) *
            </label>
            <select
              id="clientId"
              name="clientId"
              required
              className="w-full px-4 py-3 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm font-black text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {clients.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name} (CNPJ: {cl.cnpj})
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="object"
                className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-2 uppercase tracking-wider"
              >
                Objeto do Contrato *
              </label>
              <input
                id="object"
                name="object"
                required
                placeholder="Ex.: Manutenção Preventiva e Suporte Técnico…"
                className="w-full px-4 py-3 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="durationMonths"
                className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-2 uppercase tracking-wider"
              >
                Vigência (Meses) *
              </label>
              <input
                id="durationMonths"
                name="durationMonths"
                type="number"
                min={1}
                max={120}
                defaultValue={12}
                required
                className="w-full px-4 py-3 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-sm font-black text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="monthlyValue"
                className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-2 uppercase tracking-wider"
              >
                Valor Mensal (R$) *
              </label>
              <input
                id="monthlyValue"
                name="monthlyValue"
                type="number"
                step="0.01"
                min={0}
                defaultValue="18500.00"
                required
                className="w-full px-4 py-3 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-sm font-black text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="workstation"
              className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-2 uppercase tracking-wider"
            >
              Posto de Trabalho / Unidade Vinculada
            </label>
            <input
              id="workstation"
              name="workstation"
              defaultValue="Unidade Operacional Principal • 4 Postos"
              className="w-full px-4 py-3 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          <div className="rounded-2xl border-2 border-blue-100 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-900/60 p-5">
            <label
              htmlFor="scopeNotes"
              className="block text-xs font-black text-blue-700 dark:text-blue-300 mb-2 uppercase tracking-widest"
            >
              Escopo e Condições do Contrato *
            </label>
            <textarea
              id="scopeNotes"
              name="scopeNotes"
              rows={3}
              required
              defaultValue="Prestação de serviços contínuos de suporte técnico, manutenção preventiva e alocação de equipe especializada."
              className="w-full px-4 py-3 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 dark:border-slate-700 pt-5">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-blue-300/80">
              <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />
              Campos validados automaticamente pelo sistema
            </span>
            <button
              type="submit"
              className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg shadow-blue-500/30 uppercase tracking-widest text-xs transition-colors cursor-pointer"
            >
              Salvar Contrato
            </button>
          </div>
        </form>
      </section>
    </AdminShell>
  );
}
