"use client";

import { useActionState, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowLeftRight,
  Building2,
  Check,
  CheckCircle2,
  Coins,
  Loader2,
  PackagePlus,
} from "lucide-react";
import {
  createInventoryItemStateAction,
  createInventoryMovementStateAction,
} from "@/app/actions/operations";
import type {
  EmployeeRow,
  InventoryItemRow,
  InventoryMovementRow,
  ServiceOrderRow,
} from "@/lib/operations/repository";

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
  const [activePanel, setActivePanel] = useState<"movimentar" | "novo-item">("movimentar");
  const [historyFilter, setHistoryFilter] = useState<"todos" | "cautelas">("todos");

  const [movState, movAction, movPending] = useActionState(createInventoryMovementStateAction, undefined);
  const [itemState, itemAction, itemPending] = useActionState(createInventoryItemStateAction, undefined);

  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id ?? "");
  const selectedItem = items.find((i) => i.id === selectedItemId) ?? items[0];

  const allowedOperations = useMemo(() => {
    if (!selectedItem) {
      return [
        { value: "Saída", label: "Saída (aplicação em OS)" },
        { value: "Entrada", label: "Entrada (reposição de estoque)" },
      ];
    }
    if (selectedItem.category === "Material") {
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
      {/* Cabeçalho com Ações Distintas posicionadas junto ao título */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1 pt-1">
        <div>
          <h1 className="text-2xl sm:text-[34px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
            Almoxarifado e ativos
          </h1>
          <p className="mt-1 text-xs sm:text-[15px] font-normal text-slate-600 dark:text-slate-400">
            Controle de saldo, operações por categoria, seletor de OS e cautelas em {tenantName}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setActivePanel("movimentar");
              document.getElementById("painel-operacao")?.scrollIntoView({ behavior: "smooth" });
            }}
            className={`inline-flex min-h-11 items-center gap-2 px-5 py-2.5 text-xs sm:text-sm cursor-pointer transition-colors ${
              activePanel === "movimentar"
                ? "pill-gradient"
                : "rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 font-semibold text-slate-800 dark:text-white"
            }`}
          >
            <ArrowLeftRight className="size-4" aria-hidden="true" />
            <span>Movimentar estoque</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActivePanel("novo-item");
              document.getElementById("painel-operacao")?.scrollIntoView({ behavior: "smooth" });
            }}
            className={`inline-flex min-h-11 items-center gap-2 px-5 py-2.5 text-xs sm:text-sm cursor-pointer transition-colors ${
              activePanel === "novo-item"
                ? "pill-gradient"
                : "rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 font-semibold text-slate-800 dark:text-white"
            }`}
          >
            <PackagePlus className="size-4" aria-hidden="true" />
            <span>Novo item</span>
          </button>
        </div>
      </div>

      {/* 4 Pastel Glass KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-blue-100/80 via-blue-50/65 to-white/85 dark:from-blue-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 dark:bg-blue-500/20 text-[#3B68F7] dark:text-blue-300">
            <Archive className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">SKUs ativos</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">{items.length}</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-purple-100/80 via-purple-50/65 to-white/85 dark:from-purple-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300">
            <Check className="size-6 stroke-[2]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Ferramentas</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {ferramentasCount}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-emerald-100/80 via-emerald-50/65 to-white/85 dark:from-emerald-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
            <ArrowLeftRight className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Movimentações</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {movements.length}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-sky-100/80 via-sky-50/65 to-white/85 dark:from-sky-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
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

      {/* Posição atual de estoque */}
      <section className="rounded-[28px] solid-surface p-5 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Posição atual de estoque ({items.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="rounded-xl bg-slate-100 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
                <th className="rounded-l-xl px-4 py-3.5">SKU</th>
                <th className="px-4 py-3.5">Descrição do item</th>
                <th className="px-4 py-3.5">Categoria</th>
                <th className="px-4 py-3.5">Saldo disponível</th>
                <th className="px-4 py-3.5">Valor unitário</th>
                <th className="px-4 py-3.5">Nível</th>
                <th className="rounded-r-xl px-4 py-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-xs text-slate-500">
                    Nenhum item cadastrado no almoxarifado de <strong>{tenantName}</strong>. Clique em &ldquo;Novo
                    item&rdquo; para iniciar o estoque.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-4 font-bold text-slate-900 dark:text-white">{item.sku}</td>
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
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                          item.level === "Normal"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
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
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          handleItemChange(item.id);
                          setActivePanel("movimentar");
                          document.getElementById("painel-operacao")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-1 text-xs font-semibold text-slate-800 dark:text-white hover:border-[#3B68F7] cursor-pointer"
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

      {/* Painel separado: Movimentar estoque OU Cadastrar novo item */}
      <section id="painel-operacao" className="rounded-[28px] solid-surface p-6 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 dark:border-white/10 pb-4">
          <div
            role="tablist"
            aria-label="Selecionar formulário de almoxarifado"
            className="inline-flex items-center rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activePanel === "movimentar"}
              onClick={() => setActivePanel("movimentar")}
              className={`rounded-full px-5 py-2 text-xs sm:text-sm transition-colors cursor-pointer ${
                activePanel === "movimentar"
                  ? "bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white shadow-xs"
                  : "font-medium text-slate-600 dark:text-slate-300 hover:text-slate-950"
              }`}
            >
              Movimentar estoque
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activePanel === "novo-item"}
              onClick={() => setActivePanel("novo-item")}
              className={`rounded-full px-5 py-2 text-xs sm:text-sm transition-colors cursor-pointer ${
                activePanel === "novo-item"
                  ? "bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white shadow-xs"
                  : "font-medium text-slate-600 dark:text-slate-300 hover:text-slate-950"
              }`}
            >
              Novo item
            </button>
          </div>

          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Building2 className="size-3.5 text-[#3B68F7]" aria-hidden="true" />
            Empresa ativa: <strong className="text-slate-900 dark:text-white">{tenantName}</strong>
          </span>
        </div>

        {activePanel === "movimentar" ? (
          <form action={movAction} noValidate className="space-y-4">
            {movState?.ok && movState.message && (
              <div
                role="status"
                className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/90 dark:bg-emerald-950/50 p-3.5 flex items-center gap-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-200"
              >
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>{movState.message}</span>
              </div>
            )}

            {movState?.error && (
              <div
                role="alert"
                className="rounded-2xl border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/60 p-3.5 flex items-start gap-2.5 text-xs font-semibold text-rose-700 dark:text-rose-200"
              >
                <AlertTriangle className="size-4 shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
                <span>{movState.error}</span>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="mov-item" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Item selecionado *
                </label>
                <select
                  id="mov-item"
                  name="itemId"
                  required
                  value={selectedItem?.id ?? ""}
                  onChange={(e) => handleItemChange(e.target.value)}
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                >
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} · {item.description} [{item.category}] — Saldo: {item.quantity} {item.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="mov-type" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Operação permitida para {selectedItem?.category ?? "item"} *
                </label>
                <select
                  id="mov-type"
                  name="movementType"
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value)}
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                >
                  {allowedOperations.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex items-baseline justify-between px-1">
                  <label htmlFor="mov-qty" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Quantidade *
                  </label>
                  {selectedItem && (
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Saldo disponível: {currentBalance} {selectedItem.unit}
                    </span>
                  )}
                </div>
                <input
                  id="mov-qty"
                  name="quantity"
                  type="number"
                  min={1}
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                  aria-invalid={exceedsBalance || movState?.field === "quantity"}
                  required
                  className={`w-full rounded-full border bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 ${
                    exceedsBalance || movState?.field === "quantity"
                      ? "border-rose-400 focus-visible:ring-rose-500"
                      : "border-slate-200 dark:border-white/15 focus-visible:ring-[#3B68F7]"
                  }`}
                />
                {selectedItem && exceedsBalance && (
                  <p role="alert" className="pl-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    Saldo insuficiente: solicitado {parsedQty} {selectedItem.unit}, disponível {currentBalance}{" "}
                    {selectedItem.unit}. Corrija a quantidade para prosseguir.
                  </p>
                )}
              </div>

              {movementType === "Saída" && (
                <div className="space-y-1">
                  <label htmlFor="mov-os" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Ordem de serviço vinculada
                  </label>
                  <select
                    id="mov-os"
                    name="serviceOrderId"
                    className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
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

              <div className="space-y-1">
                <label htmlFor="mov-emp" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {movementType === "Cautela" || movementType === "Devolução"
                    ? "Técnico responsável pela cautela *"
                    : "Técnico / colaborador responsável"}
                </label>
                <select
                  id="mov-emp"
                  name="employeeId"
                  required={movementType === "Cautela" || movementType === "Devolução"}
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                >
                  <option value="">
                    {movementType === "Cautela" || movementType === "Devolução"
                      ? "Selecione o técnico responsável…"
                      : "Almoxarifado central"}
                  </option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.roleTitle})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="mov-notes" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Observação / justificativa
                </label>
                <input
                  id="mov-notes"
                  name="notes"
                  placeholder="Ex.: Aplicado no atendimento técnico em campo"
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>
            </div>

            {/* Resumo pré-confirmação repetindo nome da empresa, item e mudança esperada */}
            {selectedItem && (
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="text-slate-700 dark:text-slate-200">
                  <strong>Confirmação para {tenantName}:</strong> {movementType} de{" "}
                  <strong>
                    {parsedQty} {selectedItem.unit}
                  </strong>{" "}
                  do item <strong>{selectedItem.sku}</strong> ({selectedItem.description}).{" "}
                  <span className={exceedsBalance ? "text-rose-600 font-bold" : "font-bold"}>
                    Mudança esperada no saldo: {currentBalance} {selectedItem.unit} → {expectedBalance}{" "}
                    {selectedItem.unit}
                  </span>
                  .
                </div>

                <button
                  type="submit"
                  disabled={movPending}
                  className="min-h-10 rounded-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-bold py-2.5 px-6 text-xs inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                >
                  {movPending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                  <span>Confirmar movimentação em {tenantName}</span>
                </button>
              </div>
            )}
          </form>
        ) : (
          <form action={itemAction} className="space-y-4">
            {itemState?.ok && (
              <div
                role="status"
                className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/90 dark:bg-emerald-950/50 p-3.5 flex items-center gap-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-200"
              >
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>Item {itemState.sku} cadastrado com sucesso no almoxarifado de {tenantName}!</span>
              </div>
            )}

            {itemState?.error && (
              <p
                role="alert"
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700"
              >
                {itemState.error}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="item-sku" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Código SKU *
                </label>
                <input
                  id="item-sku"
                  name="sku"
                  required
                  placeholder="Ex.: CAB-UTP-CAT6"
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="item-cat" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Categoria *
                </label>
                <select
                  id="item-cat"
                  name="category"
                  defaultValue="Material"
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                >
                  <option value="Material">Material / insumo de consumo</option>
                  <option value="Ferramenta">Ferramenta (sujeita a cautela)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="item-desc" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Descrição do item *
                </label>
                <input
                  id="item-desc"
                  name="description"
                  required
                  placeholder="Ex.: Cabo UTP Cat6 (Caixa 305m)"
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="item-qty" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Saldo inicial *
                </label>
                <input
                  id="item-qty"
                  name="quantity"
                  type="number"
                  min={0}
                  placeholder="Ex.: 5"
                  required
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="item-unit" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Unidade (padrão: un.) *
                </label>
                <input
                  id="item-unit"
                  name="unit"
                  defaultValue="un."
                  required
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="item-val" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Valor unitário (R$) *
                </label>
                <input
                  id="item-val"
                  name="unitValue"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex.: 120,00"
                  required
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={itemPending}
                className="min-h-10 rounded-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-bold py-2.5 px-6 text-xs inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              >
                {itemPending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                <span>Salvar item em {tenantName}</span>
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Histórico auditável com Saldo anterior -> Alteração -> Saldo final */}
      <section className="rounded-[28px] solid-surface p-5 sm:p-7 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Histórico de movimentações e cautelas ({filteredMovements.length})
          </h2>

          <div className="inline-flex items-center rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setHistoryFilter("todos")}
              className={`rounded-full px-4 py-1 text-xs cursor-pointer ${
                historyFilter === "todos"
                  ? "bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white shadow-xs"
                  : "font-medium text-slate-600 dark:text-slate-300"
              }`}
            >
              Todas ({movements.length})
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilter("cautelas")}
              className={`rounded-full px-4 py-1 text-xs cursor-pointer ${
                historyFilter === "cautelas"
                  ? "bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white shadow-xs"
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
              <tr className="rounded-xl bg-slate-100 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
                <th className="rounded-l-xl px-4 py-3">Data / hora</th>
                <th className="px-4 py-3">SKU / Item</th>
                <th className="px-4 py-3">Operação</th>
                <th className="px-4 py-3">Saldo anterior → Alteração → Final</th>
                <th className="px-4 py-3">Responsável / OS</th>
                <th className="rounded-r-xl px-4 py-3">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-500">
                    Nenhuma movimentação registrada para este filtro.
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
                        <span className="font-bold text-slate-900 dark:text-white">{m.itemSku}</span> ·{" "}
                        <span className="text-slate-700 dark:text-slate-300">{m.itemDescription}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isOut
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                          }`}
                        >
                          {m.movementType}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs tabular-nums">
                        <span className="text-slate-500">{m.previousQuantity}</span>
                        <span className="mx-1.5 font-bold text-slate-400">→</span>
                        <span className={isOut ? "font-bold text-rose-600" : "font-bold text-emerald-600"}>
                          {isOut ? `-${m.quantity}` : `+${m.quantity}`}
                        </span>
                        <span className="mx-1.5 font-bold text-slate-400">→</span>
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
    </div>
  );
}
