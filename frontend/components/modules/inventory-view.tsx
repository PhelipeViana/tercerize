"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Loader2,
  PackagePlus,
} from "lucide-react";
import {
  createInventoryItemStateAction,
  createInventoryMovementStateAction,
} from "@/app/actions/operations";
import { Modal } from "@/components/ui/modal";
import type {
  EmployeeRow,
  InventoryItemRow,
  InventoryMovementRow,
  ServiceOrderRow,
} from "@/lib/operations/repository";
import { formatCurrencyBRL, formatInteger, formatSKU } from "@/lib/utils/masks";

interface Props {
  tenantName: string;
  items: InventoryItemRow[];
  movements: InventoryMovementRow[];
  employees: EmployeeRow[];
  serviceOrders: ServiceOrderRow[];
}

export function InventoryView({
  tenantName,
  items,
  movements,
  employees,
  serviceOrders,
}: Props) {
  const [movOpen, setMovOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<"todos" | "cautelas">("todos");

  const [movState, movAction, movPending] = useActionState(createInventoryMovementStateAction, undefined);
  const [itemState, itemAction, itemPending] = useActionState(createInventoryItemStateAction, undefined);

  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id ?? "");
  const selectedItem = items.find((i) => i.id === selectedItemId) ?? items[0];

  const allowedOperations = useMemo(() => {
    if (!selectedItem || selectedItem.category === "Material") {
      return [
        { value: "Saída", label: "Saída (aplicação em OS)" },
        { value: "Entrada", label: "Entrada (reposição de estoque)" },
      ];
    }
    return [
      { value: "Cautela", label: "Cautela (empréstimo técnico)" },
      { value: "Devolução", label: "Devolução de cautela" },
      { value: "Entrada", label: "Entrada (aquisição / reposição)" },
      { value: "Saída", label: "Saída (baixa patrimonial)" },
    ];
  }, [selectedItem]);

  const [movementType, setMovementType] = useState<string>(
    selectedItem?.category === "Ferramenta" ? "Cautela" : "Saída",
  );
  const [qtyInput, setQtyInput] = useState<string>("1");
  const [skuInput, setSkuInput] = useState<string>("");
  const [initialQtyInput, setInitialQtyInput] = useState<string>("");
  const [unitValueInput, setUnitValueInput] = useState<string>("");

  useEffect(() => {
    if (movState?.ok) {
      setMovOpen(false);
      setQtyInput("1");
    }
  }, [movState]);

  useEffect(() => {
    if (itemState?.ok) {
      setSkuInput("");
      setInitialQtyInput("");
      setUnitValueInput("");
      setItemOpen(false);
    }
  }, [itemState]);

  const handleItemChange = (newId: string) => {
    setSelectedItemId(newId);
    const found = items.find((i) => i.id === newId);
    if (found) {
      setMovementType(found.category === "Ferramenta" ? "Cautela" : "Saída");
    }
  };

  const parsedQty = Math.max(0, Number(qtyInput || "0"));
  const isOutflow = movementType === "Saída" || movementType === "Cautela";
  const currentBalance = selectedItem?.quantity ?? 0;
  const expectedBalance = isOutflow ? currentBalance - parsedQty : currentBalance + parsedQty;
  const exceedsBalance = isOutflow && parsedQty > currentBalance;

  const totalValorEstoque = items.reduce((acc, i) => acc + i.quantity * i.unitValue, 0);
  const ferramentasCount = items.filter((i) => i.category === "Ferramenta").length;

  const filteredMovements = useMemo(() => {
    if (historyFilter === "cautelas") {
      return movements.filter((m) => m.movementType === "Cautela" || m.movementType === "Devolução");
    }
    return movements;
  }, [movements, historyFilter]);

  return (
    <div className="space-y-5">
      {/* Cabeçalho padronizado */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1 pt-1">
        <div>
          <h1 className="text-2xl sm:text-[32px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight text-balance">
            Almoxarifado e ativos
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Posição de estoque, movimentações auditáveis, vínculo com OS e cautelas técnicas em {tenantName}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={items.length === 0}
            onClick={() => setMovOpen(true)}
            className="min-h-11 inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-800 dark:text-white hover:border-[#3B68F7] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            <ArrowLeftRight className="size-4" aria-hidden="true" />
            <span>Movimentar estoque</span>
          </button>

          <button
            type="button"
            onClick={() => setItemOpen(true)}
            className="min-h-11 inline-flex items-center gap-2 pill-gradient px-5 py-2.5 text-xs sm:text-sm font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            <PackagePlus className="size-4" aria-hidden="true" />
            <span>Novo item</span>
          </button>
        </div>
      </div>

      {movState?.ok && movState.message && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/90 dark:bg-emerald-950/50 p-4 flex items-center gap-2.5 text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-200"
        >
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>{movState.message}</span>
        </div>
      )}

      {itemState?.ok && itemState.sku && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/90 dark:bg-emerald-950/50 p-4 flex items-center gap-2.5 text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-200"
        >
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>Item {itemState.sku} cadastrado no almoxarifado.</span>
        </div>
      )}

      {/* Faixa estruturada de métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-white/10 rounded-[24px] solid-surface overflow-hidden">
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">SKUs cadastrados</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {items.length}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Ferramentas (cautela)</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {ferramentasCount}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Movimentações</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {movements.length}
          </p>
        </div>
        <div className="p-4 sm:p-5 min-w-0">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Valor em estoque</p>
          <p className="mt-1 text-xl sm:text-2xl font-extrabold text-[#3B68F7] dark:text-blue-400 tabular-nums truncate">
            R$ {totalValorEstoque.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Posição atual de estoque */}
      <section className="rounded-[28px] solid-surface p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Posição atual de estoque ({items.length})
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
                <th className="rounded-l-xl px-4 py-3.5">SKU</th>
                <th className="px-4 py-3.5">Descrição</th>
                <th className="px-4 py-3.5">Categoria</th>
                <th className="px-4 py-3.5">Saldo</th>
                <th className="px-4 py-3.5">Valor unitário</th>
                <th className="px-4 py-3.5">Nível</th>
                <th className="rounded-r-xl px-4 py-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center space-y-3">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Nenhum item cadastrado no almoxarifado
                    </p>
                    <button
                      type="button"
                      onClick={() => setItemOpen(true)}
                      className="min-h-10 inline-flex items-center gap-2 pill-gradient px-5 py-2 text-xs font-bold cursor-pointer"
                    >
                      <PackagePlus className="size-3.5" aria-hidden="true" />
                      <span>Cadastrar primeiro item</span>
                    </button>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-4 font-mono font-bold text-slate-900 dark:text-white">{item.sku}</td>
                    <td className="px-4 py-4 font-medium text-slate-800 dark:text-slate-100">{item.description}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{item.category}</td>
                    <td className="px-4 py-4 font-bold text-slate-900 dark:text-white tabular-nums">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-800 dark:text-slate-100 tabular-nums">
                      R$ {item.unitValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${item.level === "Normal"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                          }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${item.level === "Normal" ? "bg-emerald-600" : "bg-amber-600"
                            }`}
                          aria-hidden="true"
                        />
                        {item.level}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          handleItemChange(item.id);
                          setMovOpen(true);
                        }}
                        className="min-h-9 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-white hover:border-[#3B68F7] transition-colors cursor-pointer"
                      >
                        Movimentar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Histórico auditável */}
      <section className="rounded-[28px] solid-surface p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Histórico de movimentações e cautelas ({filteredMovements.length})
          </h2>

          <div className="inline-flex items-center rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setHistoryFilter("todos")}
              className={`min-h-8 rounded-full px-4 py-1 text-xs cursor-pointer ${historyFilter === "todos"
                ? "bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white shadow-2xs"
                : "font-medium text-slate-600 dark:text-slate-300"
                }`}
            >
              Todas ({movements.length})
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilter("cautelas")}
              className={`min-h-8 rounded-full px-4 py-1 text-xs cursor-pointer ${historyFilter === "cautelas"
                ? "bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white shadow-2xs"
                : "font-medium text-slate-600 dark:text-slate-300"
                }`}
            >
              Cautelas e devoluções
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
                <th className="rounded-l-xl px-4 py-3">Data / hora</th>
                <th className="px-4 py-3">SKU / Item</th>
                <th className="px-4 py-3">Operação</th>
                <th className="px-4 py-3">Saldo (antes → alteração → final)</th>
                <th className="px-4 py-3">Responsável / OS</th>
                <th className="rounded-r-xl px-4 py-3">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-500">
                    Nenhuma movimentação registrada.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => {
                  const isOut = m.movementType === "Saída" || m.movementType === "Cautela";
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                      <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {m.createdAt}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{m.itemSku}</span> ·{" "}
                        <span className="text-slate-700 dark:text-slate-300">{m.itemDescription}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${isOut
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                            }`}
                        >
                          {m.movementType}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs tabular-nums">
                        <span className="text-slate-500">{m.previousQuantity}</span>
                        <span className="mx-1.5 text-slate-400">→</span>
                        <span className={isOut ? "font-bold text-rose-600" : "font-bold text-emerald-600"}>
                          {isOut ? `-${m.quantity}` : `+${m.quantity}`}
                        </span>
                        <span className="mx-1.5 text-slate-400">→</span>
                        <strong className="text-slate-900 dark:text-white">
                          {m.newQuantity} {m.unit}
                        </strong>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700 dark:text-slate-300">
                        {m.employeeName || "Almoxarifado"}
                        {m.serviceOrderCode && (
                          <span className="ml-1.5 rounded-full bg-blue-100 dark:bg-blue-950 px-2 py-0.5 text-[11px] font-bold text-[#3B68F7] dark:text-blue-300">
                            {m.serviceOrderCode.replace("#", "")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">{m.notes || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal: Movimentar estoque */}
      <Modal
        open={movOpen}
        onClose={() => setMovOpen(false)}
        title="Movimentar estoque"
        description={`Registre entrada, saída ou cautela técnica com prévia de saldo em ${tenantName}.`}
        size="lg"
      >
        <form action={movAction} noValidate className="space-y-4">
          {movState?.error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/60 p-3.5 flex items-start gap-2.5 text-xs font-semibold text-rose-700 dark:text-rose-200"
            >
              <AlertTriangle className="size-4 shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
              <span>{movState.error}</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="modal-mov-item" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Item *
              </label>
              <select
                id="modal-mov-item"
                name="itemId"
                required
                value={selectedItem?.id ?? ""}
                onChange={(e) => handleItemChange(e.target.value)}
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white"
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sku} · {item.description} [{item.category}] — Saldo: {item.quantity} {item.unit}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="modal-mov-type" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Operação *
              </label>
              <select
                id="modal-mov-type"
                name="movementType"
                value={movementType}
                onChange={(e) => setMovementType(e.target.value)}
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white"
              >
                {allowedOperations.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="modal-mov-qty" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Quantidade *
                </label>
                {selectedItem && (
                  <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                    Disponível: {currentBalance} {selectedItem.unit}
                  </span>
                )}
              </div>
              <input
                id="modal-mov-qty"
                name="quantity"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={qtyInput}
                onChange={(e) => setQtyInput(formatInteger(e.target.value, 6))}
                aria-invalid={exceedsBalance || movState?.field === "quantity"}
                required
                className={`w-full min-h-11 rounded-2xl border bg-white dark:bg-slate-800 px-4 py-2.5 font-mono text-sm text-slate-900 dark:text-white ${exceedsBalance ? "border-rose-400" : "border-slate-300 dark:border-white/15"
                  }`}
              />
              {selectedItem && exceedsBalance && (
                <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  Saldo insuficiente (disponível: {currentBalance} {selectedItem.unit}).
                </p>
              )}
            </div>

            {movementType === "Saída" && (
              <div className="space-y-1.5">
                <label htmlFor="modal-mov-os" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Ordem de serviço vinculada
                </label>
                <select
                  id="modal-mov-os"
                  name="serviceOrderId"
                  className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white"
                >
                  <option value="">Uso operacional geral</option>
                  {serviceOrders.map((os) => (
                    <option key={os.id} value={os.id}>
                      {os.code.replace("#", "")} · {os.clientName} ({os.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="modal-mov-emp" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                {movementType === "Cautela" || movementType === "Devolução"
                  ? "Técnico responsável *"
                  : "Colaborador responsável"}
              </label>
              <select
                id="modal-mov-emp"
                name="employeeId"
                required={movementType === "Cautela" || movementType === "Devolução"}
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white"
              >
                <option value="">
                  {movementType === "Cautela" || movementType === "Devolução"
                    ? "Selecione o técnico…"
                    : "Almoxarifado central"}
                </option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.roleTitle})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="modal-mov-notes" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Observação / justificativa
              </label>
              <input
                id="modal-mov-notes"
                name="notes"
                placeholder="Ex.: Aplicado no atendimento técnico em campo…"
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {selectedItem && (
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-xs text-slate-700 dark:text-slate-200 tabular-nums">
              Prévia do saldo de <strong>{selectedItem.sku}</strong>:{" "}
              <strong>
                {currentBalance} {selectedItem.unit} → {expectedBalance} {selectedItem.unit}
              </strong>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setMovOpen(false)}
              className="min-h-11 rounded-full border border-slate-300 dark:border-white/15 px-5 py-2 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={movPending || exceedsBalance}
              className="min-h-11 inline-flex items-center gap-2 pill-gradient px-6 py-2 text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              {movPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              <span>Confirmar movimentação</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Cadastrar novo item */}
      <Modal
        open={itemOpen}
        onClose={() => setItemOpen(false)}
        title="Cadastrar novo item no almoxarifado"
        description={`Defina SKU, categoria (material ou ferramenta), saldo inicial e valor unitário em ${tenantName}.`}
        size="md"
      >
        <form action={itemAction} className="space-y-4">
          {itemState?.error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700"
            >
              {itemState.error}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="modal-item-sku" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Código SKU *
              </label>
              <input
                id="modal-item-sku"
                name="sku"
                spellCheck={false}
                maxLength={32}
                value={skuInput}
                onChange={(e) => setSkuInput(formatSKU(e.target.value))}
                required
                placeholder="Ex.: CAB-UTP-CAT6…"
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 font-mono text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="modal-item-cat" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Categoria *
              </label>
              <select
                id="modal-item-cat"
                name="category"
                defaultValue="Material"
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white"
              >
                <option value="Material">Material / insumo</option>
                <option value="Ferramenta">Ferramenta (cautela)</option>
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="modal-item-desc" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Descrição do item *
              </label>
              <input
                id="modal-item-desc"
                name="description"
                required
                placeholder="Ex.: Cabo UTP Cat6 (Caixa 305m)…"
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="modal-item-qty" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Saldo inicial *
              </label>
              <input
                id="modal-item-qty"
                name="quantity"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={initialQtyInput}
                onChange={(e) => setInitialQtyInput(formatInteger(e.target.value, 6))}
                placeholder="Ex.: 5…"
                required
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 font-mono text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="modal-item-unit" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Unidade *
              </label>
              <input
                id="modal-item-unit"
                name="unit"
                defaultValue="un."
                required
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="modal-item-val" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Valor unitário (R$) *
              </label>
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 dark:text-slate-400"
                >
                  R$
                </span>
                <input
                  id="modal-item-val"
                  name="unitValue"
                  type="text"
                  inputMode="numeric"
                  spellCheck={false}
                  value={unitValueInput}
                  onChange={(e) => setUnitValueInput(formatCurrencyBRL(e.target.value))}
                  placeholder="0,00…"
                  required
                  className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 pl-10 pr-4 py-2.5 font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setItemOpen(false)}
              className="min-h-11 rounded-full border border-slate-300 dark:border-white/15 px-5 py-2 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={itemPending}
              className="min-h-11 inline-flex items-center gap-2 pill-gradient px-6 py-2 text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              {itemPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              <span>Salvar item</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
