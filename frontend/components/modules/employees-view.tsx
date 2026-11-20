"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  Users,
  X,
} from "lucide-react";
import { createEmployeeStateAction, updateEmployeeScheduleAction } from "@/app/actions/operations";
import type { ContractRow, EmployeeRow } from "@/lib/operations/repository";

interface Props {
  tenantName: string;
  employees: EmployeeRow[];
  contracts: ContractRow[];
  initialContractId?: string;
}

const SCHEDULES = [
  "Comercial 44h (08h às 18h)",
  "Escala 12x36 Diurno (07h às 19h)",
  "Escala 12x36 Noturno (19h às 07h)",
  "Plantão 6x1 Operacional",
];

export function EmployeesView({
  tenantName,
  employees,
  contracts,
  initialContractId,
}: Props) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [state, createAction, pending] = useActionState(createEmployeeStateAction, undefined);

  const defaultContractId =
    initialContractId && contracts.some((c) => c.id === initialContractId)
      ? initialContractId
      : contracts[0]?.id ?? "";

  const [formContractId, setFormContractId] = useState(defaultContractId);
  const [formSchedule, setFormSchedule] = useState(SCHEDULES[0]);
  const [viewMode, setViewMode] = useState<"quadro" | "cobertura">("quadro");

  // Colaborador selecionado para inspeção de detalhe e troca de turno/alocação
  const [selectedEmp, setSelectedEmp] = useState<EmployeeRow | null>(null);
  const [detailContractId, setDetailContractId] = useState<string>("");
  const [detailSchedule, setDetailSchedule] = useState<string>(SCHEDULES[0]);
  const [detailStatus, setDetailStatus] = useState<string>("Alocado");

  const openEmployeeDetail = (emp: EmployeeRow) => {
    setSelectedEmp(emp);
    setDetailContractId(emp.contractId ?? "");
    setDetailSchedule(emp.schedule);
    setDetailStatus(emp.status);
  };

  const alocados = employees.filter((e) => e.status === "Alocado").length;
  const activeSchedulesCount = useMemo(
    () => new Set(employees.filter((e) => e.status === "Alocado").map((e) => e.schedule)).size,
    [employees],
  );

  // Detecção de conflito de escala no formulário de novo colaborador
  const newFormConflict = useMemo(() => {
    if (!formContractId) return null;
    return employees.find(
      (e) =>
        e.contractId === formContractId &&
        e.schedule === formSchedule &&
        e.status === "Alocado",
    );
  }, [employees, formContractId, formSchedule]);

  // Detecção de conflito de escala na troca de turno do colaborador selecionado
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
      {/* Banner pós-salvamento de alocação (Passo 4 -> Passo 5) */}
      {state?.ok && state.employeeId && (
        <div
          role="status"
          className="rounded-3xl border border-blue-200 dark:border-blue-700/60 bg-blue-50/95 dark:bg-blue-950/60 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-[#3B68F7] dark:text-blue-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Colaborador {state.employeeName} alocado com sucesso em {tenantName}!
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Conclua a primeira operação abrindo uma ordem de serviço com este técnico já selecionado.
              </p>
            </div>
          </div>
          <Link
            href={`/admin/service-orders?clientId=${encodeURIComponent(state.clientId ?? "")}&contractId=${encodeURIComponent(state.contractId ?? "")}&employeeId=${encodeURIComponent(state.employeeId)}#nova-os`}
            className="inline-flex min-h-10 items-center gap-2 pill-gradient px-5 py-2 text-xs"
          >
            <span>Abrir primeira ordem</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* 4 Pastel Glass KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-blue-100/80 via-blue-50/65 to-white/85 dark:from-blue-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 dark:bg-blue-500/20 text-[#3B68F7] dark:text-blue-300">
            <Users className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Equipe total</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {employees.length}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-purple-100/80 via-purple-50/65 to-white/85 dark:from-purple-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300">
            <Check className="size-6 stroke-[2]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Alocados</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">{alocados}</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-emerald-100/80 via-emerald-50/65 to-white/85 dark:from-emerald-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
            <FileText className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Contratos ativos</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {contracts.length}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-sky-100/80 via-sky-50/65 to-white/85 dark:from-sky-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-sky-600/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300">
            <Calendar className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Escalas em operação</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {activeSchedulesCount}
            </p>
          </div>
        </div>
      </div>

      {/* Main Solid Table Card */}
      <section className="rounded-[28px] solid-surface p-5 sm:p-7 space-y-5">
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
              className={`rounded-full px-5 py-2 text-xs sm:text-sm transition-colors cursor-pointer ${
                viewMode === "quadro"
                  ? "pill-gradient"
                  : "font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950"
              }`}
            >
              Quadro técnico ({employees.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "cobertura"}
              onClick={() => setViewMode("cobertura")}
              className={`rounded-full px-5 py-2 text-xs sm:text-sm transition-colors cursor-pointer ${
                viewMode === "cobertura"
                  ? "pill-gradient"
                  : "font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950"
              }`}
            >
              Cobertura semanal por posto
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              nameInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              setTimeout(() => nameInputRef.current?.focus(), 60);
            }}
            className="inline-flex min-h-10 items-center gap-2 pill-gradient px-5 py-2 text-xs sm:text-sm cursor-pointer"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>Novo colaborador</span>
          </button>
        </div>

        {/* Detalhe do colaborador clicado + Troca de escala com verificação de conflito */}
        {selectedEmp && (
          <div
            role="region"
            aria-label={`Detalhes e escala de ${selectedEmp.name}`}
            className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-950/30 p-5 space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-base font-extrabold text-slate-900 dark:text-white">
                    {selectedEmp.name}
                  </span>
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-3 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    {selectedEmp.status}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Função: <strong>{selectedEmp.roleTitle}</strong> · Posto atual:{" "}
                  <strong>
                    {selectedEmp.contractCode
                      ? `${selectedEmp.contractCode.replace("#", "")} (${selectedEmp.clientName} · ${selectedEmp.workstation ?? "Unidade principal"})`
                      : "Reserva técnica"}
                  </strong>{" "}
                  · Turno atual: <strong>{selectedEmp.schedule}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmp(null)}
                aria-label="Fechar detalhes do colaborador"
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            {detailConflict && (
              <div
                role="alert"
                className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 p-3.5 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200"
              >
                <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-bold">Conflito de escala identificado no período selecionado</p>
                  <p className="mt-0.5">
                    O colaborador <strong>{detailConflict.name}</strong> ({detailConflict.roleTitle}) já está alocado
                    neste mesmo contrato e turno (<strong>{detailSchedule}</strong>). Revise antes de confirmar a
                    sobreposição de posto.
                  </p>
                </div>
              </div>
            )}

            <form
              action={async (fd) => {
                await updateEmployeeScheduleAction(fd);
                setSelectedEmp(null);
              }}
              className="grid gap-3 sm:grid-cols-4 items-end bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-white/10"
            >
              <input type="hidden" name="id" value={selectedEmp.id} />
              <div className="space-y-1">
                <label htmlFor="detail-contract" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Posto / contrato vinculado
                </label>
                <select
                  id="detail-contract"
                  name="contractId"
                  value={detailContractId}
                  onChange={(e) => setDetailContractId(e.target.value)}
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-white"
                >
                  <option value="">Reserva técnica (sem posto fixo)</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code.replace("#", "")} · {c.clientName} ({c.workstation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="detail-schedule" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Novo turno / escala
                </label>
                <select
                  id="detail-schedule"
                  name="schedule"
                  value={detailSchedule}
                  onChange={(e) => setDetailSchedule(e.target.value)}
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-white"
                >
                  {SCHEDULES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="detail-status" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Situação operacional
                </label>
                <select
                  id="detail-status"
                  name="status"
                  value={detailStatus}
                  onChange={(e) => setDetailStatus(e.target.value)}
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-white"
                >
                  <option value="Alocado">Alocado</option>
                  <option value="Disponível">Disponível</option>
                  <option value="Afastado">Afastado</option>
                </select>
              </div>

              <button
                type="submit"
                className="min-h-9 pill-gradient px-4 py-2 text-xs cursor-pointer"
              >
                Confirmar alteração de escala
              </button>
            </form>
          </div>
        )}

        {viewMode === "quadro" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="rounded-xl bg-slate-100 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <th className="rounded-l-xl px-4 py-3.5">Colaborador</th>
                  <th className="px-4 py-3.5">Função / cargo</th>
                  <th className="px-4 py-3.5">Contrato / posto</th>
                  <th className="px-4 py-3.5">Escala / turno</th>
                  <th className="px-4 py-3.5">Situação</th>
                  <th className="rounded-r-xl px-4 py-3.5 text-right">Detalhe / escala</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                      Nenhum colaborador cadastrado em <strong>{tenantName}</strong>. Utilize o formulário abaixo para
                      alocar o primeiro profissional.
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
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEmployeeDetail(emp)}
                          className="rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-1 text-xs font-semibold text-slate-800 dark:text-white hover:border-[#3B68F7] cursor-pointer"
                        >
                          Trocar turno / ver posto
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
              <p className="text-xs text-slate-500 col-span-2 py-6 text-center">
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
                      <span className="rounded-full bg-blue-100 dark:bg-blue-950/80 px-3 py-1 text-xs font-bold text-[#3B68F7] dark:text-blue-300">
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
                            <span className="font-bold text-slate-900 dark:text-white">{emp.name}</span>
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

      <section id="novo-colaborador" className="rounded-[28px] solid-surface p-6 sm:p-7 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Cadastrar colaborador e escala</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Registre o profissional e vincule ao contrato ativo e turno operacional.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Building2 className="size-3.5 text-[#3B68F7]" aria-hidden="true" />
            Empresa ativa: <strong className="text-slate-900 dark:text-white">{tenantName}</strong>
          </span>
        </div>

        {state?.error && (
          <p
            role="alert"
            className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-300"
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
            <div>
              <p className="font-bold">Aviso de sobreposição de turno no mesmo contrato</p>
              <p className="mt-0.5">
                O colaborador <strong>{newFormConflict.name}</strong> já cobre o turno{" "}
                <strong>{formSchedule}</strong> neste contrato. Se desejar cobertura complementar, prossiga com o
                salvamento ou escolha outro turno.
              </p>
            </div>
          </div>
        )}

        <form action={createAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label htmlFor="emp-name" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              Nome do colaborador *
            </label>
            <input
              ref={nameInputRef}
              id="emp-name"
              name="name"
              required
              placeholder="Ex.: Marcos Oliveira"
              className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="emp-role" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              Função / cargo *
            </label>
            <input
              id="emp-role"
              name="roleTitle"
              required
              placeholder="Ex.: Eletricista de manutenção"
              className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="emp-contract" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              Contrato vinculado
            </label>
            <select
              id="emp-contract"
              name="contractId"
              value={formContractId}
              onChange={(e) => setFormContractId(e.target.value)}
              className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
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
            <label htmlFor="emp-schedule" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              Turno / escala
            </label>
            <select
              id="emp-schedule"
              name="schedule"
              value={formSchedule}
              onChange={(e) => setFormSchedule(e.target.value)}
              className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              {SCHEDULES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="min-h-10 pill-gradient py-2.5 px-6 text-xs inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
              <span>Salvar colaborador</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
