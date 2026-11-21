"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  History,
  Loader2,
  Plus,
} from "lucide-react";
import { createEmployeeStateAction, updateEmployeeScheduleAction } from "@/app/actions/operations";
import { Modal } from "@/components/ui/modal";
import type {
  ContractRow,
  EmployeeRow,
  EPIDeliveryRow,
  InventoryMovementRow,
  ServiceOrderRow,
} from "@/lib/operations/repository";

interface Props {
  tenantName: string;
  employees: EmployeeRow[];
  contracts: ContractRow[];
  serviceOrders: ServiceOrderRow[];
  epiDeliveries: EPIDeliveryRow[];
  inventoryMovements: InventoryMovementRow[];
  initialContractId?: string;
}

const SCHEDULES = [
  "Comercial 44h (08h às 18h)",
  "Escala 12x36 Diurno (07h às 19h)",
  "Escala 12x36 Noturno (19h às 07h)",
  "Plantão 6x1 Operacional",
];

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function EmployeesView({
  tenantName,
  employees,
  contracts,
  serviceOrders,
  epiDeliveries,
  inventoryMovements,
  initialContractId,
}: Props) {
  const [state, createAction, pending] = useActionState(createEmployeeStateAction, undefined);
  const [createOpen, setCreateOpen] = useState(false);

  const defaultContractId =
    initialContractId && contracts.some((c) => c.id === initialContractId)
      ? initialContractId
      : contracts[0]?.id ?? "";

  const [formContractId, setFormContractId] = useState(defaultContractId);
  const [formSchedule, setFormSchedule] = useState(SCHEDULES[0]);
  const [viewMode, setViewMode] = useState<"quadro" | "cobertura">("quadro");

  const [selectedEmp, setSelectedEmp] = useState<EmployeeRow | null>(null);
  const [detailContractId, setDetailContractId] = useState<string>("");
  const [detailSchedule, setDetailSchedule] = useState<string>(SCHEDULES[0]);
  const [detailStatus, setDetailStatus] = useState<string>("Alocado");
  const [effectiveDate, setEffectiveDate] = useState<string>(getTodayIso);

  useEffect(() => {
    if (
      (typeof window !== "undefined" && window.location.hash === "#novo-colaborador") ||
      Boolean(initialContractId)
    ) {
      setCreateOpen(true);
    }
  }, [initialContractId]);

  useEffect(() => {
    if (state?.ok) {
      setCreateOpen(false);
    }
  }, [state]);

  const openEmployeeDetail = (emp: EmployeeRow) => {
    setSelectedEmp(emp);
    setDetailContractId(emp.contractId ?? "");
    setDetailSchedule(emp.schedule);
    setDetailStatus(emp.status);
    setEffectiveDate(getTodayIso());
  };

  const alocados = employees.filter((e) => e.status === "Alocado").length;
  const activeSchedulesCount = useMemo(
    () => new Set(employees.filter((e) => e.status === "Alocado").map((e) => e.schedule)).size,
    [employees],
  );

  const empOrders = useMemo(
    () => (selectedEmp ? serviceOrders.filter((o) => o.employeeId === selectedEmp.id) : []),
    [serviceOrders, selectedEmp],
  );
  const empEpis = useMemo(
    () => (selectedEmp ? epiDeliveries.filter((d) => d.employeeId === selectedEmp.id) : []),
    [epiDeliveries, selectedEmp],
  );
  const empMovements = useMemo(
    () =>
      selectedEmp
        ? inventoryMovements.filter(
          (m) => m.employeeName && m.employeeName.toLowerCase() === selectedEmp.name.toLowerCase(),
        )
        : [],
    [inventoryMovements, selectedEmp],
  );

  const newFormConflict = useMemo(() => {
    if (!formContractId) return null;
    return employees.find(
      (e) =>
        e.contractId === formContractId &&
        e.schedule === formSchedule &&
        e.status === "Alocado",
    );
  }, [employees, formContractId, formSchedule]);

  const detailConflict = useMemo(() => {
    if (!selectedEmp || !detailContractId) return null;
    return employees.find(
      (e) =>
        e.id !== selectedEmp.id &&
        e.contractId === detailContractId &&
        e.schedule === detailSchedule &&
        e.status === "Alocado",
    );
  }, [employees, selectedEmp, detailContractId, detailSchedule]);

  return (
    <div className="space-y-5">
      {/* Cabeçalho padronizado */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1 pt-1">
        <div>
          <h1 className="text-2xl sm:text-[32px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight text-balance">
            Colaboradores e escalas
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Equipe técnica, cobertura por posto, histórico individual e validação de conflito de turno em {tenantName}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="min-h-11 inline-flex items-center gap-2 pill-gradient px-6 py-2.5 text-xs sm:text-sm font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>Novo colaborador</span>
        </button>
      </div>

      {state?.ok && state.employeeId && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-blue-200 dark:border-blue-700/60 bg-blue-50/95 dark:bg-blue-950/60 p-4 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-[#3B68F7] dark:text-blue-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Colaborador {state.employeeName} alocado com sucesso
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Próximo passo: abrir uma ordem de serviço com este técnico já selecionado.
              </p>
            </div>
          </div>
          <Link
            href={`/admin/service-orders?clientId=${encodeURIComponent(state.clientId ?? "")}&contractId=${encodeURIComponent(state.contractId ?? "")}&employeeId=${encodeURIComponent(state.employeeId)}#nova-os`}
            className="min-h-10 inline-flex items-center gap-2 pill-gradient px-5 py-2 text-xs font-bold"
          >
            <span>Abrir ordem de serviço</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* Faixa estruturada de métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-white/10 rounded-[24px] solid-surface overflow-hidden">
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Equipe total</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {employees.length}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Alocados</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {alocados}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Contratos ativos</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {contracts.length}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Escalas em operação</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-[#3B68F7] dark:text-blue-400 tabular-nums">
            {activeSchedulesCount}
          </p>
        </div>
      </div>

      {/* Superfície principal Full-Width */}
      <section className="rounded-[28px] solid-surface p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Modo de visualização de colaboradores e escalas"
            className="inline-flex items-center rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "quadro"}
              onClick={() => setViewMode("quadro")}
              className={`min-h-9 rounded-full px-5 py-1.5 text-xs sm:text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] ${viewMode === "quadro"
                ? "bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white shadow-2xs"
                : "font-medium text-slate-600 dark:text-slate-300"
                }`}
            >
              Quadro técnico ({employees.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "cobertura"}
              onClick={() => setViewMode("cobertura")}
              className={`min-h-9 rounded-full px-5 py-1.5 text-xs sm:text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] ${viewMode === "cobertura"
                ? "bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white shadow-2xs"
                : "font-medium text-slate-600 dark:text-slate-300"
                }`}
            >
              Cobertura por posto
            </button>
          </div>
        </div>

        {viewMode === "quadro" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <th className="rounded-l-xl px-4 py-3.5">Colaborador</th>
                  <th className="px-4 py-3.5">Função / cargo</th>
                  <th className="px-4 py-3.5">Contrato / posto</th>
                  <th className="px-4 py-3.5">Escala / turno</th>
                  <th className="px-4 py-3.5">Situação</th>
                  <th className="rounded-r-xl px-4 py-3.5 text-right">Escala e histórico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center space-y-3">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        Nenhum colaborador cadastrado em {tenantName}
                      </p>
                      <button
                        type="button"
                        onClick={() => setCreateOpen(true)}
                        className="min-h-10 inline-flex items-center gap-2 pill-gradient px-5 py-2 text-xs font-bold cursor-pointer"
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                        <span>Cadastrar primeiro colaborador</span>
                      </button>
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4 font-bold">
                        <button
                          type="button"
                          onClick={() => openEmployeeDetail(emp)}
                          className="text-left text-[#3B68F7] dark:text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] rounded cursor-pointer"
                        >
                          {emp.name}
                        </button>
                      </td>
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
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEmployeeDetail(emp)}
                          className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-white hover:border-[#3B68F7] transition-colors cursor-pointer"
                        >
                          <Eye className="size-3.5" aria-hidden="true" />
                          <span>Detalhes e escala</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {contracts.length === 0 ? (
              <p className="text-xs text-slate-500 col-span-2 py-8 text-center">
                Nenhum contrato ativo para exibir cobertura por posto.
              </p>
            ) : (
              contracts.map((c) => {
                const allocated = employees.filter((e) => e.contractId === c.id);
                return (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-800/50 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {c.code.replace("#", "")} · {c.clientName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{c.workstation}</p>
                      </div>
                      <span className="rounded-full bg-blue-100 dark:bg-blue-950/80 px-3 py-1 text-xs font-bold text-[#3B68F7] dark:text-blue-300 tabular-nums">
                        {allocated.length} alocado(s)
                      </span>
                    </div>
                    {allocated.length === 0 ? (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Sem cobertura técnica alocada neste contrato.
                      </p>
                    ) : (
                      <ul className="space-y-1.5 text-xs">
                        {allocated.map((emp) => (
                          <li
                            key={emp.id}
                            className="flex items-center justify-between rounded-xl bg-white dark:bg-slate-900 px-3 py-2 border border-slate-200/70 dark:border-white/10"
                          >
                            <button
                              type="button"
                              onClick={() => openEmployeeDetail(emp)}
                              className="font-bold text-[#3B68F7] dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              {emp.name}
                            </button>
                            <span className="text-slate-600 dark:text-slate-300">{emp.schedule}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* Modal: Cadastrar colaborador */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Novo colaborador e escala"
        description={`Cadastre o profissional e vincule ao contrato e turno em ${tenantName}.`}
        size="md"
      >
        <form action={createAction} className="space-y-4">
          {state?.error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300"
            >
              {state.error}
            </p>
          )}

          {newFormConflict && (
            <div
              role="status"
              className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 p-3.5 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200"
            >
              <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" aria-hidden="true" />
              <span>
                <strong>Sobreposição detectada:</strong> {newFormConflict.name} já cobre o turno{" "}
                <strong>{formSchedule}</strong> neste contrato.
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="modal-emp-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Nome do colaborador *
            </label>
            <input
              id="modal-emp-name"
              name="name"
              required
              placeholder="Ex.: Marcos Oliveira…"
              className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="modal-emp-role" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Função / cargo *
            </label>
            <input
              id="modal-emp-role"
              name="roleTitle"
              required
              placeholder="Ex.: Eletricista de manutenção…"
              className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="modal-emp-contract" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Contrato vinculado
              </label>
              <select
                id="modal-emp-contract"
                name="contractId"
                value={formContractId}
                onChange={(e) => setFormContractId(e.target.value)}
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              >
                <option value="">Reserva técnica</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code.replace("#", "")} · {c.clientName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="modal-emp-schedule" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Turno / escala
              </label>
              <select
                id="modal-emp-schedule"
                name="schedule"
                value={formSchedule}
                onChange={(e) => setFormSchedule(e.target.value)}
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              >
                {SCHEDULES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="min-h-11 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-5 py-2 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 inline-flex items-center gap-2 pill-gradient px-6 py-2 text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              <span>Salvar colaborador</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Detalhe, histórico e troca de escala do colaborador */}
      <Modal
        open={Boolean(selectedEmp)}
        onClose={() => setSelectedEmp(null)}
        title={selectedEmp?.name ?? ""}
        description={selectedEmp ? `${selectedEmp.roleTitle} · ${selectedEmp.status}` : undefined}
        size="xl"
      >
        {selectedEmp && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                  <span className="inline-flex items-center gap-1.5">
                    <History className="size-3.5 text-[#3B68F7]" aria-hidden="true" />
                    Ordens de serviço
                  </span>
                  <span className="tabular-nums">{empOrders.length}</span>
                </div>
                {empOrders.length === 0 ? (
                  <p className="text-slate-500">Nenhuma OS atribuída.</p>
                ) : (
                  <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                    {empOrders.slice(0, 3).map((o) => (
                      <li key={o.id} className="truncate">
                        <strong>{o.code.replace("#", "")}</strong> · {o.status}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                  <span>EPIs entregues</span>
                  <span className="tabular-nums">{empEpis.length}</span>
                </div>
                {empEpis.length === 0 ? (
                  <p className="text-slate-500">Sem entregas registradas.</p>
                ) : (
                  <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                    {empEpis.slice(0, 3).map((d) => (
                      <li key={d.id} className="truncate">
                        <strong>{d.caNumber}</strong> · {d.epiName}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                  <span>Cautelas / estoque</span>
                  <span className="tabular-nums">{empMovements.length}</span>
                </div>
                {empMovements.length === 0 ? (
                  <p className="text-slate-500">Sem movimentações.</p>
                ) : (
                  <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                    {empMovements.slice(0, 3).map((m) => (
                      <li key={m.id} className="truncate">
                        <strong>{m.movementType}</strong> · {m.itemSku}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {detailConflict && (
              <div
                role="alert"
                className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 p-3.5 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200"
              >
                <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" aria-hidden="true" />
                <span>
                  <strong>Conflito de escala:</strong> {detailConflict.name} já ocupa o turno{" "}
                  <strong>{detailSchedule}</strong> neste contrato.
                </span>
              </div>
            )}

            <form
              action={async (fd) => {
                await updateEmployeeScheduleAction(fd);
                setSelectedEmp(null);
              }}
              className="space-y-4 rounded-2xl border border-slate-200 dark:border-white/10 p-4"
            >
              <input type="hidden" name="id" value={selectedEmp.id} />
              <p className="text-xs font-bold text-slate-900 dark:text-white">Alterar alocação ou escala</p>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="detail-contract" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Posto / contrato vinculado
                  </label>
                  <select
                    id="detail-contract"
                    name="contractId"
                    value={detailContractId}
                    onChange={(e) => setDetailContractId(e.target.value)}
                    className="w-full min-h-10 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs text-slate-900 dark:text-white"
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
                  <label htmlFor="detail-schedule" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Novo turno / escala
                  </label>
                  <select
                    id="detail-schedule"
                    name="schedule"
                    value={detailSchedule}
                    onChange={(e) => setDetailSchedule(e.target.value)}
                    className="w-full min-h-10 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs text-slate-900 dark:text-white"
                  >
                    {SCHEDULES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="detail-date" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Início da vigência
                  </label>
                  <input
                    id="detail-date"
                    name="effectiveDate"
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full min-h-10 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="detail-status" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Situação operacional
                  </label>
                  <select
                    id="detail-status"
                    name="status"
                    value={detailStatus}
                    onChange={(e) => setDetailStatus(e.target.value)}
                    className="w-full min-h-10 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="Alocado">Alocado</option>
                    <option value="Disponível">Disponível</option>
                    <option value="Afastado">Afastado</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedEmp(null)}
                  className="min-h-10 rounded-full border border-slate-300 dark:border-white/15 px-4 py-2 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-10 pill-gradient px-5 py-2 text-xs font-bold cursor-pointer"
                >
                  Confirmar troca de escala
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
