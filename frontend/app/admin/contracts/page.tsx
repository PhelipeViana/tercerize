import Link from "next/link";
import { Building, CheckCircle2, DollarSign, FilePlus2, FileSignature, Plus, Users } from "lucide-react";
import { createClientAction } from "@/app/actions/operations";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireSession } from "@/lib/auth/dal";
import { listClients, listCompanies, listContracts } from "@/lib/operations/repository";

export default async function ContractsPage() {
  const session = await requireSession();
  const [companies, contracts, clients] = await Promise.all([
    listCompanies(),
    listContracts(session.tenant.id),
    listClients(session.tenant.id),
  ]);

  const totalReceitaMensal = contracts.reduce((acc, c) => acc + c.monthlyValue, 0);
  const ativosCount = contracts.filter((c) => c.status === "Ativo").length;

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="contracts"
      breadcrumb="Clientes e Contratos"
      routeLabel="/admin/contracts"
    >
      {/* Header Principal Estilo PortoCercado / Filament */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-blue-100 italic">
            Gestão de Clientes e Contratos Ativos
          </h1>
          <p className="text-xs font-bold text-gray-500 dark:text-blue-400/70 mt-0.5">
            Controle de tomadores de serviço, vigência contratual, escopo técnico e postos vinculados.
          </p>
        </div>
        <Link
          href="/admin/contracts/create"
          className="bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 px-6 rounded-xl shadow-lg shadow-blue-500/25 transition-colors flex items-center gap-2 text-xs uppercase tracking-wider"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>+ Novo Contrato</span>
        </Link>
      </div>

      {/* Cards de Métricas Estilo PortoCercado / Filament */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700/50 p-5 flex items-center border-b-4 border-b-blue-500">
          <div className="p-3.5 rounded-xl bg-blue-100/70 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 mr-4">
            <FileSignature className="size-7" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest mb-0.5">
              Total Contratos
            </p>
            <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{contracts.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700/50 p-5 flex items-center border-b-4 border-b-emerald-500">
          <div className="p-3.5 rounded-xl bg-emerald-100/70 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 mr-4">
            <CheckCircle2 className="size-7" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest mb-0.5">
              Contratos Ativos
            </p>
            <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{ativosCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700/50 p-5 flex items-center border-b-4 border-b-indigo-500">
          <div className="p-3.5 rounded-xl bg-indigo-100/70 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 mr-4">
            <Users className="size-7" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest mb-0.5">
              Clientes Tomadores
            </p>
            <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{clients.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700/50 p-5 flex items-center border-b-4 border-b-amber-500">
          <div className="p-3.5 rounded-xl bg-amber-100/70 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 mr-4">
            <DollarSign className="size-7" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest mb-0.5">
              Receita Mensal
            </p>
            <p className="text-xl font-black text-gray-900 dark:text-white tabular-nums">
              R$ {totalReceitaMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Tabela Principal Filament — Tela 1 do Briefing Executivo */}
      <section className="bg-white dark:bg-slate-800 overflow-hidden shadow-2xl rounded-2xl border border-gray-100 dark:border-slate-700/50">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-700 px-6 py-4 bg-gray-50/40 dark:bg-slate-900/40">
          <div>
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
              Contratos Cadastrados <span className="text-blue-600 dark:text-blue-400">(Visão Geral)</span>
            </h2>
          </div>
          <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
            {contracts.length} registro(s) na empresa ativa
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-700">
            <thead className="bg-gray-50/80 dark:bg-slate-900/60">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Cód.
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Cliente Tomador
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Objeto do Contrato
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Posto Alocado
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Vigência
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Valor Mensal
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Situação
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-50 dark:divide-slate-700/50">
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm font-bold text-gray-500 dark:text-slate-400">
                    Nenhum contrato cadastrado para esta empresa. Clique em &ldquo;+ Novo Contrato&rdquo; para iniciar.
                  </td>
                </tr>
              ) : (
                contracts.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-blue-50/40 dark:hover:bg-blue-900/15 transition-colors"
                  >
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="inline-flex rounded-lg bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/60 px-2.5 py-1 font-mono text-xs font-black text-blue-700 dark:text-blue-300 tabular-nums">
                        {c.code}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm font-black text-gray-900 dark:text-blue-50">{c.clientName}</div>
                      <div className="font-mono text-xs font-bold text-gray-500 dark:text-blue-400/70">
                        CNPJ: {c.clientCnpj}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm font-bold text-gray-800 dark:text-white">{c.object}</div>
                      {c.scopeNotes && (
                        <div className="text-xs font-medium text-gray-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                          {c.scopeNotes}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs font-bold text-gray-600 dark:text-slate-300">
                      {c.workstation}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-xs font-black text-gray-800 dark:text-blue-100 tabular-nums">
                      {c.durationMonths} meses
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                      R$ {c.monthlyValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
                        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Seção Inferior: Clientes Tomadores + Cadastro Rápido */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700/50 space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-700 pb-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
              <Building className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                Base de Clientes Tomadores ({clients.length})
              </h2>
              <p className="text-xs font-bold text-gray-500 dark:text-slate-400">
                Empresas contratantes habilitadas para abertura de Contratos e OS.
              </p>
            </div>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-slate-700/60 rounded-xl border border-gray-100 dark:border-slate-700/60 bg-gray-50/50 dark:bg-slate-900/40">
            {clients.map((cl) => (
              <div key={cl.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-900 dark:text-blue-50">{cl.name}</p>
                  <p className="text-xs font-bold text-gray-500 dark:text-slate-400">
                    {cl.contact || "Sem contato adicional"}
                  </p>
                </div>
                <span className="rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-2.5 py-1 font-mono text-xs font-black text-blue-600 dark:text-blue-400">
                  {cl.cnpj}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700/50 space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-700 pb-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400">
              <FilePlus2 className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                Novo Cliente Tomador
              </h2>
              <p className="text-xs font-bold text-gray-500 dark:text-slate-400">
                Cadastre um novo contratante na carteira da empresa.
              </p>
            </div>
          </div>

          <form action={createClientAction} className="space-y-4">
            <div>
              <label
                htmlFor="client-name"
                className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
              >
                Razão Social / Nome do Cliente *
              </label>
              <input
                id="client-name"
                name="name"
                required
                placeholder="Ex.: Indústria Alimentos Cuiabá Ltda…"
                className="w-full px-4 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="client-cnpj"
                className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
              >
                CNPJ *
              </label>
              <input
                id="client-cnpj"
                name="cnpj"
                required
                placeholder="00.000.000/0001-00…"
                className="w-full px-4 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="client-contact"
                className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
              >
                Contato / Gestor do Contrato
              </label>
              <input
                id="client-contact"
                name="contact"
                placeholder="(65) 3322-0000 • contratos@cliente.com.br…"
                className="w-full px-4 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="w-full min-h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-5 rounded-xl shadow-lg shadow-emerald-500/20 text-xs uppercase tracking-widest transition-colors cursor-pointer"
            >
              Salvar Cliente Tomador
            </button>
          </form>
        </section>
      </div>
    </AdminShell>
  );
}
