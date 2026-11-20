"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Search,
  Wrench,
  X,
} from "lucide-react";
import { createServiceOrderStateAction, updateServiceOrderStatusAction } from "@/app/actions/operations";
import type {
  ClientRow,
  ContractRow,
  EmployeeRow,
  ServiceOrderRow,
} from "@/lib/operations/repository";

interface Props {
  tenantName: string;
  orders: ServiceOrderRow[];
  clients: ClientRow[];
  contracts: ContractRow[];
  employees: EmployeeRow[];
  initialClientId?: string;
  initialContractId?: string;
  initialEmployeeId?: string;
}

function getDefaultScheduleDateTime(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T09:00`;
}

function isoDateToBR(isoDate: string): string {
  if (!isoDate || !isoDate.includes("-")) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export function ServiceOrdersView({
  tenantName,
  orders,
  clients,
  contracts,
  employees,
  initialClientId,
  initialContractId,
  initialEmployeeId,
}: Props) {
  const firstInputRef = useRef<HTMLSelectElement>(null);
  const [state, formAction, pending] = useActionState(createServiceOrderStateAction, undefined);

  const defaultClient =
    initialClientId && clients.some((c) => c.id === initialClientId)
      ? initialClientId
      : clients[0]?.id ?? "";

  const [selectedClientId, setSelectedClientId] = useState(defaultClient);
  const [selectedContractId, setSelectedContractId] = useState(initialContractId ?? "");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId ?? "");
  const [initialStatus, setInitialStatus] = useState<"Agendada" | "Em Execução">("Agendada");
  const [scheduledFor, setScheduledFor] = useState(getDefaultScheduleDateTime);

  // Filters: Técnico, Situação, Data e Busca
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [techFilter, setTechFilter] = useState<string>("todos");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedOSId, setSelectedOSId] = useState<string | null>(null);

  const selectedOS = useMemo(
    () => orders.find((o) => o.id === selectedOSId) ?? null,
    [orders, selectedOSId],
  );

  const emExecucao = orders.filter((o) => o.status === "Em Execução").length;
  const agendadas = orders.filter((o) => o.status === "Agendada").length;
  const concluidas = orders.filter((o) => o.status === "Concluída").length;
  const chamadosAtivos = emExecucao + agendadas;

  const clientContracts = useMemo(
    () => contracts.filter((c) => c.clientId === selectedClientId),
    [contracts, selectedClientId],
  );

  const hasFilters =
    statusFilter !== "todos" ||
    techFilter !== "todos" ||
    dateFilter !== "" ||
    searchQuery.trim() !== "";

  const clearFilters = () => {
    setStatusFilter("todos");
    setTechFilter("todos");
    setDateFilter("");
    setSearchQuery("");
  };

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const brDate = isoDateToBR(dateFilter);
    return orders.filter((o) => {
      if (statusFilter === "ativos" && o.status === "Concluída") return false;
      if (statusFilter !== "todos" && statusFilter !== "ativos" && o.status !== statusFilter) return false;
      if (techFilter !== "todos" && (o.employeeId ?? "sem-tecnico") !== techFilter) return false;
      if (brDate) {
        const matchesCreated = (o.createdAt ?? "").includes(brDate);
        const matchesScheduled = (o.scheduledFor ?? "").includes(brDate);
        if (!matchesCreated && !matchesScheduled) return false;
      }
      if (!q) return true;
      return (
        o.code.toLowerCase().includes(q) ||
        o.clientName.toLowerCase().includes(q) ||
        (o.employeeName ?? "").toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q)
      );
    });
  }, [orders, statusFilter, techFilter, dateFilter, searchQuery]);

  const focusNewOrderForm = () => {
    firstInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => firstInputRef.current?.focus(), 80);
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho com Ação Principal única junto ao título */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1 pt-1">
        <div>
          <h1 className="text-2xl sm:text-[34px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
            Ordens de serviço
          </h1>
          <p className="mt-1 text-xs sm:text-[15px] font-normal text-slate-600 dark:text-slate-400">
            Despacho de chamados, agendamento com data e hora, alocação técnica e progressão em {tenantName}.
          </p>
        </div>

        <button
          type="button"
          onClick={focusNewOrderForm}
          className="inline-flex min-h-11 items-center gap-2 pill-gradient px-6 py-2.5 text-xs sm:text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>Nova ordem</span>
        </button>
      </div>

      {state?.ok && state.code && (
        <div
          role="status"
          className="rounded-3xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/90 dark:bg-emerald-950/50 p-4 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
            <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            <span>
              Ordem de serviço {state.code.replace("#", "")} aberta com sucesso em {tenantName}! Acompanhe a situação e
              a próxima ação na tabela ou no detalhe.
            </span>
          </div>
        </div>
      )}

      {/* 4 Pastel Glass KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-blue-100/80 via-blue-50/65 to-white/85 dark:from-blue-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 dark:bg-blue-500/20 text-[#3B68F7] dark:text-blue-300">
            <ClipboardList className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Chamados ativos</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {chamadosAtivos}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-purple-100/80 via-purple-50/65 to-white/85 dark:from-purple-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300">
            <Wrench className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Em execução</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {emExecucao}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-emerald-100/80 via-emerald-50/65 to-white/85 dark:from-emerald-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
            <Check className="size-6 stroke-[2]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Concluídas</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {concluidas}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-sky-100/80 via-sky-50/65 to-white/85 dark:from-sky-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-sky-600/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300">
            <Clock className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Agendadas</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {agendadas}
            </p>
          </div>
        </div>
      </div>

      {/* Main Solid Table Section */}
      <section className="rounded-[28px] solid-surface p-5 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Fila de execução</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <strong>{chamadosAtivos}</strong> chamado(s) ativo(s) · {orders.length} no histórico total
            </p>
          </div>

          {/* Filtros por técnico, situação, data e busca */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px]">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400"
                aria-hidden="true"
              />
              <label htmlFor="os-search" className="sr-only">
                Buscar por código, cliente ou descrição
              </label>
              <input
                id="os-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Código ou cliente…"
                className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 pl-9 pr-3.5 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              />
            </div>

            <div>
              <label htmlFor="os-filter-tech" className="sr-only">
                Filtrar por técnico
              </label>
              <select
                id="os-filter-tech"
                value={techFilter}
                onChange={(e) => setTechFilter(e.target.value)}
                className="rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              >
                <option value="todos">Técnico: Todos</option>
                <option value="sem-tecnico">Sem técnico designado</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="os-filter-status" className="sr-only">
                Filtrar por situação
              </label>
              <select
                id="os-filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              >
                <option value="todos">Situação: Todas</option>
                <option value="ativos">Apenas ativos ({chamadosAtivos})</option>
                <option value="Agendada">Agendada ({agendadas})</option>
                <option value="Em Execução">Em Execução ({emExecucao})</option>
                <option value="Concluída">Concluída ({concluidas})</option>
              </select>
            </div>

            <div>
              <label htmlFor="os-filter-date" className="sr-only">
                Filtrar por data
              </label>
              <input
                id="os-filter-date"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                title="Filtrar ordens por data de abertura ou agendamento"
                className="rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              />
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
                <span>Limpar filtros</span>
              </button>
            )}
          </div>
        </div>

        {/* Painel de detalhe da OS selecionada com Situação e Próxima Ação */}
        {selectedOS && (
          <div
            role="region"
            aria-label={`Detalhes da ordem ${selectedOS.code}`}
            className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-950/30 p-4 flex flex-wrap items-center justify-between gap-4 text-xs"
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {selectedOS.code.replace("#", "")} · {selectedOS.clientName}
                </span>
                <span className="rounded-full bg-white dark:bg-slate-800 px-2.5 py-0.5 font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10">
                  Situação: {selectedOS.status}
                </span>
                <span className="rounded-full bg-white dark:bg-slate-800 px-2.5 py-0.5 font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10">
                  Prioridade: {selectedOS.priority}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                <strong>Serviço:</strong> {selectedOS.description} ·{" "}
                <strong>Contrato/Unidade:</strong>{" "}
                {selectedOS.contractCode
                  ? `${selectedOS.contractCode.replace("#", "")} (${selectedOS.workstation ?? "Unidade principal"})`
                  : "Atendimento geral"}{" "}
                · <strong>Técnico:</strong> {selectedOS.employeeName || "Aguardando designação"}
                {selectedOS.scheduledFor ? ` · Programada: ${selectedOS.scheduledFor}` : ""}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {selectedOS.status !== "Concluída" && (
                <form action={updateServiceOrderStatusAction} className="inline-flex">
                  <input type="hidden" name="id" value={selectedOS.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={selectedOS.status === "Agendada" ? "Em Execução" : "Concluída"}
                  />
                  <button
                    type="submit"
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-1.5 text-xs font-bold cursor-pointer"
                  >
                    {selectedOS.status === "Agendada" ? (
                      <>
                        <Play className="size-3" aria-hidden="true" />
                        <span>Próxima ação: Iniciar</span>
                      </>
                    ) : (
                      <>
                        <Check className="size-3" aria-hidden="true" />
                        <span>Próxima ação: Concluir</span>
                      </>
                    )}
                  </button>
                </form>
              )}
              <button
                type="button"
                onClick={() => setSelectedOSId(null)}
                aria-label="Fechar detalhes da OS"
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="rounded-xl bg-slate-100 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
                <th className="rounded-l-xl px-4 py-3.5">Código</th>
                <th className="px-4 py-3.5">Cliente / contrato</th>
                <th className="px-4 py-3.5">Técnico alocado</th>
                <th className="px-4 py-3.5">Descrição e agendamento</th>
                <th className="px-4 py-3.5">Prioridade</th>
                <th className="px-4 py-3.5">Situação</th>
                <th className="rounded-r-xl px-4 py-3.5 text-right">Próxima ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center space-y-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Nenhuma ordem de serviço cadastrada em {tenantName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Utilize o formulário abaixo para despachar a primeira ordem de serviço desta empresa.
                    </p>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center space-y-2.5">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Nenhuma ordem de serviço encontrada
                    </p>
                    {hasFilters && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-800 dark:text-white cursor-pointer"
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                        <span>Limpar filtros</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((os) => (
                  <tr key={os.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-4 font-bold tabular-nums">
                      <button
                        type="button"
                        onClick={() => setSelectedOSId(os.id)}
                        className="text-[#3B68F7] dark:text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] rounded cursor-pointer"
                      >
                        {os.code.replace("#", "")}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <span className="block font-bold text-slate-900 dark:text-slate-100">{os.clientName}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {os.contractCode
                          ? `${os.contractCode.replace("#", "")} · ${os.workstation ?? "Unidade principal"}`
                          : "Chamado operacional"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-700 dark:text-slate-200">
                      {os.employeeName || "Aguardando designação"}
                    </td>
                    <td className="px-4 py-4">
                      <span className="block text-slate-800 dark:text-slate-200">{os.description}</span>
                      {os.scheduledFor && (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          <CalendarClock className="size-3" aria-hidden="true" />
                          Programada: {os.scheduledFor}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${os.priority === "Urgente"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300"
                          : os.priority === "Alta"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300"
                          }`}
                      >
                        {os.priority}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${os.status === "Concluída"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                          : os.status === "Em Execução"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                          }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${os.status === "Concluída"
                            ? "bg-emerald-600"
                            : os.status === "Em Execução"
                              ? "bg-blue-600"
                              : "bg-amber-600"
                            }`}
                          aria-hidden="true"
                        />
                        {os.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {os.status !== "Concluída" ? (
                        <form action={updateServiceOrderStatusAction} className="inline-flex">
                          <input type="hidden" name="id" value={os.id} />
                          <input
                            type="hidden"
                            name="status"
                            value={os.status === "Agendada" ? "Em Execução" : "Concluída"}
                          />
                          <button
                            type="submit"
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-800 dark:text-white hover:bg-[#3B68F7] hover:text-white hover:border-[#3B68F7] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                          >
                            {os.status === "Agendada" ? (
                              <>
                                <Play className="size-3" aria-hidden="true" />
                                <span>Iniciar</span>
                              </>
                            ) : (
                              <>
                                <Check className="size-3" aria-hidden="true" />
                                <span>Concluir</span>
                              </>
                            )}
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs font-medium text-slate-400">Finalizada</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Form Card: Nova Ordem de Serviço */}
      <section id="nova-os" className="rounded-[28px] solid-surface p-6 sm:p-7 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Despachar nova ordem de serviço</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Vincule o cliente tomador, contrato/unidade, técnico alocado e data/hora quando agendada.
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

        {clients.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/70 dark:bg-amber-950/30 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-medium text-amber-900 dark:text-amber-200">
              Cadastre ao menos um cliente tomador na empresa {tenantName} antes de abrir uma ordem de serviço.
            </span>
            <Link
              href="/admin/contracts?tab=clientes#novo-cliente"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold px-4 py-1.5 text-xs"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Cadastrar cliente</span>
            </Link>
          </div>
        ) : (
          <form action={formAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="os-client" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                Cliente tomador *
              </label>
              <select
                ref={firstInputRef}
                id="os-client"
                name="clientId"
                required
                value={selectedClientId}
                onChange={(e) => {
                  setSelectedClientId(e.target.value);
                  setSelectedContractId("");
                }}
                className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              >
                {clients.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {cl.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="os-contract" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                Contrato / unidade vinculada
              </label>
              <select
                id="os-contract"
                name="contractId"
                value={selectedContractId}
                onChange={(e) => setSelectedContractId(e.target.value)}
                className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              >
                <option value="">Atendimento geral do cliente</option>
                {clientContracts.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.code.replace("#", "")} · {ct.workstation}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="os-employee" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                Técnico alocado
              </label>
              <select
                id="os-employee"
                name="employeeId"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              >
                <option value="">Designar posteriormente</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.roleTitle})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="os-priority" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                Prioridade
              </label>
              <select
                id="os-priority"
                name="priority"
                defaultValue="Normal"
                className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              >
                <option value="Normal">Normal</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="os-status" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                Situação inicial
              </label>
              <select
                id="os-status"
                name="status"
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value as "Agendada" | "Em Execução")}
                className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              >
                <option value="Agendada">Agendada (com data e hora)</option>
                <option value="Em Execução">Em Execução imediata</option>
              </select>
            </div>

            {initialStatus === "Agendada" && (
              <div className="space-y-1">
                <label htmlFor="os-scheduled" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Data e hora programada *
                </label>
                <input
                  id="os-scheduled"
                  name="scheduledFor"
                  type="datetime-local"
                  required
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>
            )}

            <div className="sm:col-span-2 space-y-1">
              <label htmlFor="os-desc" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                Descrição do serviço *
              </label>
              <input
                id="os-desc"
                name="description"
                required
                placeholder="Ex.: Revisão de cabeamento estruturado e switches"
                className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={pending}
                className="w-full min-h-10 rounded-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-bold py-2.5 px-5 text-xs inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              >
                {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                <span>Abrir ordem em {tenantName}</span>
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
