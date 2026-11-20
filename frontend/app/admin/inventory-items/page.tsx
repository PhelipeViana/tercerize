import { Archive, ArrowLeftRight, Check, Coins, Plus } from "lucide-react";
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

  const totalValorEstoque = items.reduce((acc, i) => acc + i.quantity * i.unitValue, 0);
  const ferramentasCount = items.filter((i) => i.category === "Ferramenta").length;

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="inventory-items"
      title="Almoxarifado e ativos"
      subtitle="Controle de saldo de materiais, histórico de movimentações e cautela de ferramentas."
      action={
        <a
          href="#movimentacao"
          className="inline-flex min-h-11 items-center gap-2 pill-gradient px-6 py-2.5 text-sm"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>Registrar movimentação</span>
        </a>
      }
    >
      {/* 4 Pastel Glass KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-blue-100/80 via-blue-50/65 to-white/75 dark:from-blue-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 dark:bg-blue-500/20 text-[#3B68F7] dark:text-blue-300">
            <Archive className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">SKUs ativos</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">{items.length}</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-purple-100/80 via-purple-50/65 to-white/75 dark:from-purple-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300">
            <Check className="size-6 stroke-[2]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Ferramentas</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">{ferramentasCount}</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-emerald-100/80 via-emerald-50/65 to-white/75 dark:from-emerald-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
            <ArrowLeftRight className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Movimentações</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">{movements.length}</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-sky-100/80 via-sky-50/65 to-white/75 dark:from-sky-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-sky-600/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300">
            <Coins className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Valor em estoque</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5 truncate">
              R$ {totalValorEstoque.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Main Glass Table Card */}
      <section className="rounded-[28px] glass-surface p-5 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center rounded-full border border-slate-200/80 dark:border-white/10 bg-slate-100/80 dark:bg-slate-800/70 p-1">
            <span className="pill-gradient px-5 py-2 text-sm">Posição atual de estoque</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="rounded-xl bg-slate-100/85 dark:bg-slate-800/75 text-xs font-bold text-slate-700 dark:text-slate-200">
                <th className="rounded-l-xl px-4 py-3.5">SKU</th>
                <th className="px-4 py-3.5">Descrição do item</th>
                <th className="px-4 py-3.5">Categoria</th>
                <th className="px-4 py-3.5">Qtd. em estoque</th>
                <th className="px-4 py-3.5">Valor unitário</th>
                <th className="rounded-r-xl px-4 py-3.5">Nível</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-white/10">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-4 font-bold text-slate-900 dark:text-white">{item.sku}</td>
                  <td className="px-4 py-4 font-medium text-slate-800 dark:text-slate-100">{item.description}</td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{item.category}</td>
                  <td className="px-4 py-4 font-medium text-slate-800 dark:text-slate-100 tabular-nums">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-800 dark:text-slate-100 tabular-nums">
                    R$ {item.unitValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                        item.level === "Normal"
                          ? "bg-emerald-100/90 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                          : "bg-amber-100/90 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          item.level === "Normal" ? "bg-emerald-600" : "bg-amber-600"
                        }`}
                        aria-hidden="true"
                      />
                      {item.level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div id="movimentacao" className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[28px] glass-surface p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Registrar movimentação ou cautela</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Entradas, saídas em OS e empréstimo (cautela) de ferramentas para técnicos.
            </p>
          </div>

          <form action={createInventoryMovementAction} className="space-y-3.5">
            <div className="space-y-1">
              <label htmlFor="mov-item" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Item / ferramenta *
              </label>
              <select
                id="mov-item"
                name="itemId"
                required
                className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sku} · {item.description} ({item.quantity} {item.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="mov-type" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Operação *
                </label>
                <select
                  id="mov-type"
                  name="movementType"
                  defaultValue="Cautela"
                  className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                >
                  <option value="Cautela">Cautela (empréstimo técnico)</option>
                  <option value="Devolução">Devolução de cautela</option>
                  <option value="Saída">Saída (aplicação em OS)</option>
                  <option value="Entrada">Entrada (reposição)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="mov-qty" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Quantidade *
                </label>
                <input
                  id="mov-qty"
                  name="quantity"
                  type="number"
                  min={1}
                  defaultValue={1}
                  required
                  className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="mov-emp" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Técnico / colaborador responsável
              </label>
              <select
                id="mov-emp"
                name="employeeId"
                className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              >
                <option value="">Almoxarifado central</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.roleTitle})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="mov-notes" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Observação
              </label>
              <input
                id="mov-notes"
                name="notes"
                placeholder="Ex.: Cautela para atendimento na OS-104…"
                className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              />
            </div>

            <button type="submit" className="w-full min-h-10 pill-gradient py-2.5 px-5 text-xs cursor-pointer">
              Confirmar movimentação
            </button>
          </form>
        </section>

        <section className="rounded-[28px] glass-surface p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Cadastrar novo item ou ferramenta</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Inclua novos insumos ou ferramentas patrimoniais no almoxarifado.
            </p>
          </div>

          <form action={createInventoryItemAction} className="space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="item-sku" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Código SKU *
                </label>
                <input
                  id="item-sku"
                  name="sku"
                  required
                  placeholder="Ex.: CAB-UTP-CAT6…"
                  className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="item-cat" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Categoria *
                </label>
                <select
                  id="item-cat"
                  name="category"
                  defaultValue="Material"
                  className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                >
                  <option value="Material">Material / insumo</option>
                  <option value="Ferramenta">Ferramenta (cautela)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="item-desc" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Descrição do item *
              </label>
              <input
                id="item-desc"
                name="description"
                required
                placeholder="Ex.: Cabo UTP Cat6 (Caixa 305m)…"
                className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="item-qty" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Saldo inicial
                </label>
                <input
                  id="item-qty"
                  name="quantity"
                  type="number"
                  min={0}
                  defaultValue={5}
                  required
                  className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="item-unit" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Unidade
                </label>
                <input
                  id="item-unit"
                  name="unit"
                  defaultValue="un."
                  required
                  className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="item-val" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Valor unit. (R$)
                </label>
                <input
                  id="item-val"
                  name="unitValue"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue="120.00"
                  required
                  className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>
            </div>

            <button type="submit" className="w-full min-h-10 pill-gradient py-2.5 px-5 text-xs cursor-pointer">
              Salvar item no estoque
            </button>
          </form>
        </section>
      </div>
    </AdminShell>
  );
}
