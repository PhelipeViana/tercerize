"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Eye,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { createServiceOrderStateAction, updateServiceOrderStatusAction } from "@/app/actions/operations";
import { Modal } from "@/components/ui/modal";
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
  const [state, formAction, pending] = useActionState(createServiceOrderStateAction, undefined);
  const [createOpen, setCreateOpen] = useState(false);

  const defaultClient =
    initialClientId && clients.some((c) => c.id === initialClientId)
      ? initialClientId
      : clients[0]?.id ?? "";

  const [selectedClientId, setSelectedClientId] = useState(defaultClient);
  const [selectedContractId, setSelectedContractId] = useState(initialContractId ?? "");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId ?? "");
  const [initialStatus, setInitialStatus] = useState<"Agendada" | "Em Execução">("Agendada");
  const [scheduledFor, setScheduledFor] = useState(getDefaultScheduleDateTime);

  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [techFilter, setTechFilter] = useState<string>("todos");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedOSId, setSelectedOSId] = useState<string | null>(null);

  useEffect(() => {
    if (
      (typeof window !== "undefined" && window.location.hash === "#nova-os") ||
      Boolean(initialClientId || initialContractId || initialEmployeeId)
    ) {
      setCreateOpen(true);
    }
  }, [initialClientId, initialContractId, initialEmployeeId]);

  useEffect(() => {
    if (state?.ok) {
      setCreateOpen(false);
    }
  }, [state]);

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

  return (
    <div className="space-y-5">
      {/* Cabeçalho padronizado */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1 pt-1">
        <div>
          <h1 className="text-2xl sm:text-[32px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight text-balance">
            Ordens de serviço
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Despacho de chamados, agendamento, alocação técnica e progressão operacional em {tenantName}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="min-h-11 inline-flex items-center gap-2 pill-gradient px-6 py-2.5 text-xs sm:text-sm font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>Nova ordem</span>
        </button>
      </div>

      {state?.ok && state.code && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/90 dark:bg-emerald-950/50 p-4 flex items-center gap-2.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white"
        >
          <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
          <span>Ordem de serviço {state.code.replace("#", "")} aberta com sucesso.</span>
        </div>
      )}

      {/* Faixa estruturada de métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-white/10 rounded-[24px] solid-surface overflow-hidden">
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Chamados ativos</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {chamadosAtivos}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Em execução</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-[#3B68F7] dark:text-blue-400 tabular-nums">
            {emExecucao}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Agendadas</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
            {agendadas}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Concluídas</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {concluidas}
          </p>
        </div>
      </div>

      {/* Tabela Full-Width */}
      <section className="rounded-[28px] solid-surface p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Fila de execução</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {chamadosAtivos} chamado(s) ativo(s) · {orders.length} no histórico
            </p>
          </div>

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
                className="w-full min-h-9 rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 pl-9 pr-3.5 py-1.5 text-xs text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              />
            </div>

            <select
              id="os-filter-tech"
              aria-label="Filtrar por técnico"
              value={techFilter}
              onChange={(e) => setTechFilter(e.target.value)}
              className="min-h-9 rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <option value="todos">Técnico: Todos</option>
              <option value="sem-tecnico">Sem técnico</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>

            <select
              id="os-filter-status"
              aria-label="Filtrar por situação"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-h-9 rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <option value="todos">Situação: Todas</option>
              <option value="ativos">Apenas ativos ({chamadosAtivos})</option>
              <option value="Agendada">Agendada ({agendadas})</option>
              <option value="Em Execução">Em Execução ({emExecucao})</option>
              <option value="Concluída">Concluída ({concluidas})</option>
            </select>

            <input
              id="os-filter-date"
              aria-label="Filtrar por data"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="min-h-9 rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-9 inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
                <span>Limpar</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
                <th className="rounded-l-xl px-4 py-3.5">Código</th>
                <th className="px-4 py-3.5">Cliente / contrato</th>
                <th className="px-4 py-3.5">Técnico</th>
                <th className="px-4 py-3.5">Serviço e agendamento</th>
                <th className="px-4 py-3.5">Prioridade</th>
                <th className="px-4 py-3.5">Situação</th>
                <th className="rounded-r-xl px-4 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center space-y-3">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Nenhuma ordem de serviço aberta ainda
                    </p>
                    <button
                      type="button"
                      onClick={() => setCreateOpen(true)}
                      className="min-h-10 inline-flex items-center gap-2 pill-gradient px-5 py-2 text-xs font-bold cursor-pointer"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      <span>Abrir primeira ordem de serviço</span>
                    </button>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center space-y-2.5">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Nenhuma ordem encontrada para este filtro
                    </p>
                    {hasFilters && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 px-4 py-1.5 text-xs font-semibold cursor-pointer"
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
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                          <CalendarClock className="size-3" aria-hidden="true" />
                          Programada: {os.scheduledFor}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${os.priority === "Urgente"
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
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${os.status === "Concluída"
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
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedOSId(os.id)}
                          aria-label={`Ver detalhes da ordem ${os.code}`}
                          className="min-h-9 min-w-9 inline-flex items-center justify-center rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-[#3B68F7] transition-colors cursor-pointer"
                        >
                          <Eye className="size-3.5" aria-hidden="true" />
                        </button>

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
                              className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-800 dark:text-white hover:bg-[#3B68F7] hover:text-white hover:border-[#3B68F7] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
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
                          <span className="text-xs font-medium text-slate-400 px-2">Finalizada</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal: Despachar nova OS */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nova ordem de serviço"
        description={`Vincule cliente, contrato/unidade, técnico alocado e agendamento em ${tenantName}.`}
        size="lg"
      >
        {clients.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/70 dark:bg-amber-950/30 p-5 space-y-3 text-center">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
              Cadastre ao menos um cliente tomador antes de abrir uma ordem de serviço
            </p>
            <Link
              href="/admin/contracts?tab=clientes#novo-cliente"
              className="min-h-10 inline-flex items-center gap-2 pill-gradient px-5 py-2 text-xs font-bold"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Cadastrar cliente agora</span>
            </Link>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            {state?.error && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-300"
              >
                {state.error}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="modal-os-client" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Cliente tomador *
                </label>
                <select
                  id="modal-os-client"
                  name="clientId"
                  required
                  value={selectedClientId}
                  onChange={(e) => {
                    setSelectedClientId(e.target.value);
                    setSelectedContractId("");
                  }}
                  className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                >
                  {clients.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="modal-os-contract" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Contrato / unidade vinculada
                </label>
                <select
                  id="modal-os-contract"
                  name="contractId"
                  value={selectedContractId}
                  onChange={(e) => setSelectedContractId(e.target.value)}
                  className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                >
                  <option value="">Atendimento geral do cliente</option>
                  {clientContracts.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.code.replace("#", "")} · {ct.workstation}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="modal-os-emp" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Técnico alocado
                </label>
                <select
                  id="modal-os-emp"
                  name="employeeId"
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                >
                  <option value="">Designar posteriormente</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.roleTitle})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="modal-os-priority" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Prioridade
                </label>
                <select
                  id="modal-os-priority"
                  name="priority"
                  defaultValue="Normal"
                  className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                >
                  <option value="Normal">Normal</option>
                  <option value="Alta">Alta</option>
                  <option value="Urgente">Urgente</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="modal-os-status" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Situação inicial
                </label>
                <select
                  id="modal-os-status"
                  name="status"
                  value={initialStatus}
                  onChange={(e) => setInitialStatus(e.target.value as "Agendada" | "Em Execução")}
                  className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                >
                  <option value="Agendada">Agendada (com data e hora)</option>
                  <option value="Em Execução">Em Execução imediata</option>
                </select>
              </div>

              {initialStatus === "Agendada" && (
                <div className="space-y-1.5">
                  <label htmlFor="modal-os-sched" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Data e hora programada *
                  </label>
                  <input
                    id="modal-os-sched"
                    name="scheduledFor"
                    type="datetime-local"
                    required
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="modal-os-desc" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Descrição do serviço *
              </label>
              <input
                id="modal-os-desc"
                name="description"
                required
                placeholder="Ex.: Revisão de cabeamento estruturado e switches…"
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="min-h-11 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="min-h-11 inline-flex items-center gap-2 pill-gradient px-6 py-2 text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                <span>Abrir ordem de serviço</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Detalhes e ação rápida da OS */}
      <Modal
        open={Boolean(selectedOS)}
        onClose={() => setSelectedOSId(null)}
        title={selectedOS ? `Ordem ${selectedOS.code.replace("#", "")}` : ""}
        description={selectedOS ? `${selectedOS.clientName} · Prioridade ${selectedOS.priority}` : undefined}
        size="md"
      >
        {selectedOS && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-3.5">
                <span className="text-slate-500 dark:text-slate-400 block">Situação atual</span>
                <strong className="text-slate-900 dark:text-white mt-1 block">{selectedOS.status}</strong>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-3.5">
                <span className="text-slate-500 dark:text-slate-400 block">Técnico alocado</span>
                <strong className="text-slate-900 dark:text-white mt-1 block">
                  {selectedOS.employeeName || "Aguardando designação"}
                </strong>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-3.5">
                <span className="text-slate-500 dark:text-slate-400 block">Contrato / unidade</span>
                <strong className="text-slate-900 dark:text-white mt-1 block">
                  {selectedOS.contractCode
                    ? `${selectedOS.contractCode.replace("#", "")} (${selectedOS.workstation ?? "Principal"})`
                    : "Atendimento geral"}
                </strong>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-3.5">
                <span className="text-slate-500 dark:text-slate-400 block">Agendamento</span>
                <strong className="text-slate-900 dark:text-white mt-1 block tabular-nums">
                  {selectedOS.scheduledFor || selectedOS.createdAt}
                </strong>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
              <p className="font-bold text-slate-900 dark:text-white mb-1">Descrição do serviço</p>
              <p>{selectedOS.description}</p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200/80 dark:border-white/10">
              <button
                type="button"
                onClick={() => setSelectedOSId(null)}
                className="min-h-10 rounded-full border border-slate-300 dark:border-white/15 px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                Fechar
              </button>
              {selectedOS.status !== "Concluída" && (
                <form
                  action={async (fd) => {
                    await updateServiceOrderStatusAction(fd);
                    setSelectedOSId(null);
                  }}
                >
                  <input type="hidden" name="id" value={selectedOS.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={selectedOS.status === "Agendada" ? "Em Execução" : "Concluída"}
                  />
                  <button
                    type="submit"
                    className="min-h-10 inline-flex items-center gap-1.5 pill-gradient px-5 py-2 text-xs font-bold cursor-pointer"
                  >
                    {selectedOS.status === "Agendada" ? (
                      <>
                        <Play className="size-3.5" aria-hidden="true" />
                        <span>Iniciar atendimento</span>
                      </>
                    ) : (
                      <>
                        <Check className="size-3.5" aria-hidden="true" />
                        <span>Concluir ordem</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
