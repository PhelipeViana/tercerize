import { ArrowLeftRight, PackagePlus, Plus } from "lucide-react";
import { createInventoryItemAction, createInventoryMovementAction } from "@/app/actions/operations";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireSession } from "@/lib/auth/dal";
import {
  listCompanies,
  listEmployees,
  listInventoryItems,
  listInventoryMovements,
} from "@/lib/operations/repository";

export default async function InventoryItemsPage() {
  const session = await requireSession();
  const [companies, items, movements, employees] = await Promise.all([
    listCompanies(),
    listInventoryItems(session.tenant.id),
    listInventoryMovements(session.tenant.id),
    listEmployees(session.tenant.id),
  ]);

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="inventory-items"
      breadcrumb="Inventário e Ativos"
      routeLabel="/admin/inventory-items"
    >
      {/* Header Principal Estilo PortoCercado / Filament */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-blue-100 italic">
            Controle de Inventário, Materiais e Cautela de Ferramentas
          </h1>
          <p className="text-xs font-bold text-gray-500 dark:text-blue-400/70 mt-0.5">
            Rastreamento exato de insumos aplicados nas ordens de serviço e devolução de ferramentas emprestadas.
          </p>
        </div>
        <a
          href="#form-movimentacao"
          className="bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 px-6 rounded-xl shadow-lg shadow-blue-500/25 transition-colors flex items-center gap-2 text-xs uppercase tracking-wider"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>+ Registrar Movimentação</span>
        </a>
      </div>

      {/* Tabela Principal Filament — Tela 3 do Briefing Executivo */}
      <section className="bg-white dark:bg-slate-800 overflow-hidden shadow-2xl rounded-2xl border border-gray-100 dark:border-slate-700/50">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-700 px-6 py-4 bg-gray-50/40 dark:bg-slate-900/40">
          <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
            Posição Atual de Estoque
          </h2>
          <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
            {items.length} item(ns) no almoxarifado
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-700">
            <thead className="bg-gray-50/80 dark:bg-slate-900/60">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  SKU
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Descrição do Item
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Categoria
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Qtd. em Estoque
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Valor Unitário
                </th>
                <th className="px-5 py-4 text-left text-xs font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Nível
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-50 dark:divide-slate-700/50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-900/15 transition-colors">
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="inline-flex rounded-lg bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/60 px-2.5 py-1 font-mono text-xs font-black text-blue-700 dark:text-blue-300">
                      {item.sku}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm font-black text-gray-900 dark:text-blue-50">
                    {item.description}
                  </td>
                  <td className="px-5 py-4 text-xs font-bold text-gray-500 dark:text-slate-300">
                    {item.category}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-xs font-black text-gray-900 dark:text-white tabular-nums">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm font-black text-gray-900 dark:text-blue-100 tabular-nums">
                    R$ {item.unitValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${item.level === "Normal"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                        }`}
                    >
                      {item.level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div id="form-movimentacao" className="grid gap-6 lg:grid-cols-2">
        {/* Registrar Movimentação ou Cautela */}
        <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700/50 space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-700 pb-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
              <ArrowLeftRight className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                Registrar Movimentação / Cautela
              </h2>
              <p className="text-xs font-bold text-gray-500 dark:text-slate-400">
                Entradas, baixas de insumos e cautela de ferramentas para técnicos.
              </p>
            </div>
          </div>

          <form action={createInventoryMovementAction} className="space-y-3.5">
            <div>
              <label
                htmlFor="mov-item"
                className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
              >
                Item / Ferramenta *
              </label>
              <select
                id="mov-item"
                name="itemId"
                required
                className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sku} — {item.description} (Saldo: {item.quantity} {item.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="mov-type"
                  className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
                >
                  Operação *
                </label>
                <select
                  id="mov-type"
                  name="movementType"
                  defaultValue="Cautela"
                  className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="Cautela">Cautela (Empréstimo Técnico)</option>
                  <option value="Devolução">Devolução de Cautela</option>
                  <option value="Saída">Saída (Aplicação em OS)</option>
                  <option value="Entrada">Entrada (Reposição)</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="mov-qty"
                  className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
                >
                  Quantidade *
                </label>
                <input
                  id="mov-qty"
                  name="quantity"
                  type="number"
                  min={1}
                  defaultValue={1}
                  required
                  className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-black text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="mov-emp"
                className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
              >
                Técnico / Colaborador Responsável
              </label>
              <select
                id="mov-emp"
                name="employeeId"
                className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <option value="">Almoxarifado Central</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.roleTitle})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="mov-notes"
                className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
              >
                Observação / OS Vinculada
              </label>
              <input
                id="mov-notes"
                name="notes"
                placeholder="Ex.: Cautela de ferramenta para OS #OS-104…"
                className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-11 bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 px-5 rounded-xl shadow-lg shadow-blue-500/20 text-xs uppercase tracking-widest transition-colors cursor-pointer"
            >
              Confirmar Movimentação
            </button>
          </form>
        </section>

        {/* Novo Item ou Ferramenta */}
        <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700/50 space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-700 pb-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400">
              <PackagePlus className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                Cadastrar Novo Item ou Ferramenta
              </h2>
              <p className="text-xs font-bold text-gray-500 dark:text-slate-400">
                Inclua novos materiais ou ferramentas patrimoniais no estoque.
              </p>
            </div>
          </div>

          <form action={createInventoryItemAction} className="space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="item-sku"
                  className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
                >
                  Código SKU *
                </label>
                <input
                  id="item-sku"
                  name="sku"
                  required
                  placeholder="Ex.: CAB-UTP-CAT6…"
                  className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="item-cat"
                  className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
                >
                  Categoria *
                </label>
                <select
                  id="item-cat"
                  name="category"
                  defaultValue="Material"
                  className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="Material">Material / Insumo</option>
                  <option value="Ferramenta">Ferramenta (Cautela)</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="item-desc"
                className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
              >
                Descrição do Item *
              </label>
              <input
                id="item-desc"
                name="description"
                required
                placeholder="Ex.: Cabo UTP Cat6 (Caixa 305m)…"
                className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="item-qty"
                  className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
                >
                  Qtd. Inicial
                </label>
                <input
                  id="item-qty"
                  name="quantity"
                  type="number"
                  min={0}
                  defaultValue={5}
                  required
                  className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-black text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="item-unit"
                  className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
                >
                  Unidade
                </label>
                <input
                  id="item-unit"
                  name="unit"
                  defaultValue="un."
                  required
                  className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="item-val"
                  className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-1.5 uppercase tracking-wider"
                >
                  Valor Unit. (R$)
                </label>
                <input
                  id="item-val"
                  name="unitValue"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue="120.00"
                  required
                  className="w-full px-3.5 py-2.5 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-900 text-xs font-black text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-5 rounded-xl shadow-lg shadow-emerald-500/20 text-xs uppercase tracking-widest transition-colors cursor-pointer"
            >
              Salvar Item no Almoxarifado
            </button>
          </form>
        </section>
      </div>

      {/* Histórico de Movimentações e Cautelas */}
      <section className="bg-white dark:bg-slate-800 overflow-hidden shadow-2xl rounded-2xl border border-gray-100 dark:border-slate-700/50">
        <div className="border-b border-gray-100 dark:border-slate-700 px-6 py-4 bg-gray-50/40 dark:bg-slate-900/40">
          <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
            Histórico Recente de Entradas, Saídas e Cautelas
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-700 text-xs">
            <thead className="bg-gray-50/80 dark:bg-slate-900/60">
              <tr>
                <th className="px-5 py-3 text-left font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Data/Hora
                </th>
                <th className="px-5 py-3 text-left font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Operação
                </th>
                <th className="px-5 py-3 text-left font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Item (SKU)
                </th>
                <th className="px-5 py-3 text-left font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Qtd.
                </th>
                <th className="px-5 py-3 text-left font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Técnico / Responsável
                </th>
                <th className="px-5 py-3 text-left font-black text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                  Observação
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-900/15 transition-colors">
                  <td className="px-5 py-3 font-mono font-bold text-gray-500 dark:text-slate-400 tabular-nums">
                    {m.createdAt}
                  </td>
                  <td className="px-5 py-3 font-black text-blue-600 dark:text-blue-400">{m.movementType}</td>
                  <td className="px-5 py-3 font-bold text-gray-900 dark:text-white">
                    <span className="font-mono text-blue-600 dark:text-blue-300">{m.itemSku}</span> — {m.itemDescription}
                  </td>
                  <td className="px-5 py-3 font-black text-gray-900 dark:text-white tabular-nums">
                    {m.quantity} {m.unit}
                  </td>
                  <td className="px-5 py-3 font-bold text-gray-700 dark:text-slate-200">
                    {m.employeeName || "Almoxarifado"}
                  </td>
                  <td className="px-5 py-3 text-gray-500 dark:text-slate-400">{m.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
