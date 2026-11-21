"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Eye,
  Loader2,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { createClientStateAction } from "@/app/actions/operations";
import { Modal } from "@/components/ui/modal";
import type { ClientRow, ContractRow } from "@/lib/operations/repository";
import { formatCNPJ, formatPhoneBR } from "@/lib/utils/masks";

interface Props {
  tenantName: string;
  contracts: ContractRow[];
  clients: ClientRow[];
  initialTab?: "contratos" | "clientes";
  welcome?: boolean;
  createdContractId?: string;
  createdCode?: string;
}

export function ContractsView({
  tenantName,
  contracts,
  clients,
  initialTab = "contratos",
  welcome = false,
  createdContractId,
  createdCode,
}: Props) {
  const [tab, setTab] = useState<"contratos" | "clientes">(initialTab);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [selectedContract, setSelectedContract] = useState<ContractRow | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [cnpjInput, setCnpjInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");

  const [clientState, clientAction, clientPending] = useActionState(createClientStateAction, undefined);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#novo-cliente") {
      setTab("clientes");
      setNewClientOpen(true);
    }
  }, []);

  useEffect(() => {
    if (clientState?.values?.cnpj !== undefined) {
      setCnpjInput(clientState.values.cnpj);
    }
    if (clientState?.values?.phone !== undefined) {
      setPhoneInput(clientState.values.phone);
    }
    if (clientState?.ok) {
      setCnpjInput("");
      setPhoneInput("");
      setNewClientOpen(false);
    }
  }, [clientState]);

  const activeContractsCount = contracts.filter((c) => c.status === "Ativo").length;
  const totalMonthlyRevenue = contracts.reduce((acc, c) => acc + c.monthlyValue, 0);

  const hasContractFilters = query.trim() !== "" || statusFilter !== "todos";
  const hasClientFilters = query.trim() !== "";

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("todos");
  };

  const filteredContracts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contracts.filter((c) => {
      if (statusFilter !== "todos" && c.status.toLowerCase() !== statusFilter) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.clientName.toLowerCase().includes(q) ||
        c.object.toLowerCase().includes(q) ||
        c.workstation.toLowerCase().includes(q)
      );
    });
  }, [contracts, query, statusFilter]);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (cl) =>
        cl.name.toLowerCase().includes(q) ||
        cl.cnpj.toLowerCase().includes(q) ||
        cl.phone.toLowerCase().includes(q) ||
        cl.email.toLowerCase().includes(q) ||
        cl.contact.toLowerCase().includes(q),
    );
  }, [clients, query]);

  return (
    <div className="space-y-5">
      {/* Cabeçalho padronizado com ação principal clara */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1 pt-1">
        <div>
          <h1 className="text-2xl sm:text-[32px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight text-balance">
            Clientes e contratos
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Cadastre clientes tomadores, gerencie contratos ativos, postos de trabalho e vigências em {tenantName}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setNewClientOpen(true)}
            className={`min-h-11 inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] ${
              tab === "clientes"
                ? "pill-gradient"
                : "rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 text-slate-800 dark:text-white hover:border-[#3B68F7]"
            }`}
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>Novo cliente</span>
          </button>

          <Link
            href="/admin/contracts/create"
            className={`min-h-11 inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] ${
              tab === "contratos"
                ? "pill-gradient"
                : "rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 text-slate-800 dark:text-white hover:border-[#3B68F7]"
            }`}
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>Novo contrato</span>
          </Link>
        </div>
      </div>

      {/* Banners guiados de próxima ação */}
      {welcome && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/90 dark:bg-emerald-950/50 p-4 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Empresa {tenantName} pronta para operação
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Cadastre o primeiro cliente tomador para liberar contratos, alocação de equipe e ordens de serviço.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNewClientOpen(true)}
            className="min-h-10 inline-flex items-center gap-2 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold px-5 py-2 text-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span>Cadastrar primeiro cliente</span>
          </button>
        </div>
      )}

      {clientState?.ok && clientState.clientId && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-blue-200 dark:border-blue-700/60 bg-blue-50/95 dark:bg-blue-950/60 p-4 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-[#3B68F7] dark:text-blue-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Cliente {clientState.clientName} ({clientState.clientCnpj}) cadastrado
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Próximo passo: crie o contrato já vinculado a este cliente.
              </p>
            </div>
          </div>
          <Link
            href={`/admin/contracts/create?clientId=${encodeURIComponent(clientState.clientId)}`}
            className="min-h-10 inline-flex items-center gap-2 pill-gradient px-5 py-2 text-xs font-bold"
          >
            <span>Criar contrato para este cliente</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}

      {createdContractId && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-blue-200 dark:border-blue-700/60 bg-blue-50/95 dark:bg-blue-950/60 p-4 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-[#3B68F7] dark:text-blue-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Contrato {(createdCode ?? "").replace("#", "")} salvo com sucesso
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Próximo passo recomendado: alocar um colaborador e definir a escala para este contrato.
              </p>
            </div>
          </div>
          <Link
            href={`/admin/employees?contractId=${encodeURIComponent(createdContractId)}#novo-colaborador`}
            className="min-h-10 inline-flex items-center gap-2 pill-gradient px-5 py-2 text-xs font-bold"
          >
            <span>Alocar colaborador</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* Faixa estruturada de métricas (padrão unificado da plataforma) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-white/10 rounded-[24px] solid-surface overflow-hidden">
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Contratos totais</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {contracts.length}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Contratos ativos</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {activeContractsCount}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Clientes tomadores</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {clients.length}
          </p>
        </div>
        <div className="p-4 sm:p-5 min-w-0">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Receita mensal contratada</p>
          <p className="mt-1 text-xl sm:text-2xl font-extrabold text-[#3B68F7] dark:text-blue-400 tabular-nums truncate">
            R$ {totalMonthlyRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Superfície Principal Full-Width */}
      <section className="rounded-[28px] solid-surface p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div
            role="tablist"
            aria-label="Visualização de contratos e clientes"
            className="inline-flex items-center rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "contratos"}
              onClick={() => setTab("contratos")}
              className={`min-h-9 rounded-full px-5 py-1.5 text-xs sm:text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] ${
                tab === "contratos"
                  ? "bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white shadow-2xs"
                  : "font-medium text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
              }`}
            >
              Contratos ({contracts.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "clientes"}
              onClick={() => setTab("clientes")}
              className={`min-h-9 rounded-full px-5 py-1.5 text-xs sm:text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] ${
                tab === "clientes"
                  ? "bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white shadow-2xs"
                  : "font-medium text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
              }`}
            >
              Clientes ({clients.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 flex-1 sm:flex-initial justify-end">
            <div className="relative min-w-[220px] sm:w-68">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400"
                aria-hidden="true"
              />
              <label htmlFor="contracts-search" className="sr-only">
                {tab === "contratos" ? "Buscar por cliente ou código" : "Buscar por razão social ou CNPJ"}
              </label>
              <input
                id="contracts-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  tab === "contratos" ? "Buscar por cliente ou código…" : "Buscar por razão social ou CNPJ…"
                }
                className="w-full min-h-10 rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              />
            </div>

            {tab === "contratos" && (
              <div className="relative">
                <label htmlFor="contracts-status" className="sr-only">
                  Filtrar por situação
                </label>
                <select
                  id="contracts-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none min-h-10 rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 pl-4 pr-9 py-2 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] cursor-pointer"
                >
                  <option value="todos">Situação: Todas</option>
                  <option value="ativo">Ativo</option>
                  <option value="suspenso">Suspenso</option>
                  <option value="encerrado">Encerrado</option>
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-500"
                  aria-hidden="true"
                />
              </div>
            )}
          </div>
        </div>

        {tab === "contratos" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <th className="rounded-l-xl px-4 py-3.5">Código</th>
                  <th className="px-4 py-3.5">Cliente</th>
                  <th className="px-4 py-3.5">Objeto e unidade</th>
                  <th className="px-4 py-3.5">Vigência</th>
                  <th className="px-4 py-3.5">Valor mensal</th>
                  <th className="px-4 py-3.5">Situação</th>
                  <th className="rounded-r-xl px-4 py-3.5 text-right">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                {contracts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="mx-auto max-w-md space-y-3">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          Nenhum contrato cadastrado ainda
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {clients.length === 0
                            ? `Comece cadastrando o primeiro cliente tomador em ${tenantName}.`
                            : `Você já tem ${clients.length} cliente(s) cadastrado(s). Crie o primeiro contrato agora.`}
                        </p>
                        <div className="pt-1">
                          {clients.length === 0 ? (
                            <button
                              type="button"
                              onClick={() => setNewClientOpen(true)}
                              className="min-h-10 inline-flex items-center gap-2 pill-gradient px-5 py-2 text-xs font-bold cursor-pointer"
                            >
                              <Plus className="size-3.5" aria-hidden="true" />
                              <span>Cadastrar primeiro cliente</span>
                            </button>
                          ) : (
                            <Link
                              href="/admin/contracts/create"
                              className="min-h-10 inline-flex items-center gap-2 pill-gradient px-5 py-2 text-xs font-bold"
                            >
                              <Plus className="size-3.5" aria-hidden="true" />
                              <span>Criar primeiro contrato</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : filteredContracts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center space-y-3">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        Nenhum contrato encontrado para este filtro
                      </p>
                      {hasContractFilters && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-800 dark:text-white cursor-pointer"
                        >
                          <RotateCcw className="size-3.5" aria-hidden="true" />
                          <span>Limpar filtros</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredContracts.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4 font-bold tabular-nums">
                        <button
                          type="button"
                          onClick={() => setSelectedContract(c)}
                          className="text-[#3B68F7] dark:text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] rounded cursor-pointer"
                        >
                          {c.code.replace("#", "")}
                        </button>
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-900 dark:text-slate-100">{c.clientName}</td>
                      <td className="px-4 py-4">
                        <span className="block font-medium text-slate-800 dark:text-slate-200">{c.object}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {c.workstation.replace("•", "·")}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-700 dark:text-slate-200 tabular-nums">
                        {c.durationMonths} meses
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        R$ {c.monthlyValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedContract(c)}
                          className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-white hover:border-[#3B68F7] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                        >
                          <Eye className="size-3.5" aria-hidden="true" />
                          <span>Detalhes</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <th className="rounded-l-xl px-4 py-3.5">Cliente tomador</th>
                  <th className="px-4 py-3.5">CNPJ</th>
                  <th className="px-4 py-3.5">Telefone</th>
                  <th className="px-4 py-3.5">E-mail</th>
                  <th className="rounded-r-xl px-4 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center space-y-3">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        Nenhum cliente cadastrado em {tenantName}
                      </p>
                      <button
                        type="button"
                        onClick={() => setNewClientOpen(true)}
                        className="min-h-10 inline-flex items-center gap-2 pill-gradient px-5 py-2 text-xs font-bold cursor-pointer"
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                        <span>Cadastrar primeiro cliente</span>
                      </button>
                    </td>
                  </tr>
                ) : filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center space-y-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">Nenhum cliente encontrado</p>
                      {hasClientFilters && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-white cursor-pointer"
                        >
                          <RotateCcw className="size-3.5" aria-hidden="true" />
                          <span>Limpar filtros</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((cl) => (
                    <tr key={cl.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4 font-bold text-slate-900 dark:text-white">{cl.name}</td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-600 dark:text-slate-300">{cl.cnpj}</td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-700 dark:text-slate-200 tabular-nums">
                        {cl.phone || "—"}
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                        {cl.email || cl.contact || "—"}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedClient(cl)}
                            className="min-h-9 inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#3B68F7] transition-colors cursor-pointer"
                          >
                            <Eye className="size-3.5" aria-hidden="true" />
                            <span>Ver</span>
                          </button>
                          <Link
                            href={`/admin/contracts/create?clientId=${encodeURIComponent(cl.id)}`}
                            className="min-h-9 inline-flex items-center gap-1 rounded-full border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-950/50 px-3.5 py-1.5 text-xs font-bold text-[#3B68F7] dark:text-blue-300 hover:bg-[#3B68F7] hover:text-white transition-colors"
                          >
                            <Plus className="size-3.5" aria-hidden="true" />
                            <span>Criar contrato</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal: Cadastrar novo cliente tomador */}
      <Modal
        open={newClientOpen}
        onClose={() => setNewClientOpen(false)}
        title="Novo cliente tomador"
        description={`Cadastre a empresa cliente contratante dentro de ${tenantName}.`}
        size="md"
      >
        <form action={clientAction} noValidate className="space-y-4">
          {clientState?.error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300"
            >
              {clientState.error}
            </p>
          )}

          <div className="space-y-1.5">
            <label htmlFor="modal-client-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Razão social *
            </label>
            <input
              id="modal-client-name"
              name="name"
              required
              defaultValue={clientState?.values?.name ?? ""}
              aria-invalid={clientState?.fieldError?.field === "name"}
              placeholder="Ex.: Grupo Horizonte Ltda…"
              className={`w-full min-h-11 rounded-2xl border bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 ${
                clientState?.fieldError?.field === "name"
                  ? "border-rose-400 focus-visible:ring-rose-500"
                  : "border-slate-300 dark:border-white/15 focus-visible:ring-[#3B68F7]"
              }`}
            />
            {clientState?.fieldError?.field === "name" && (
              <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {clientState.fieldError.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="modal-client-cnpj" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                CNPJ *
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">14 dígitos válidos</span>
            </div>
            <input
              id="modal-client-cnpj"
              name="cnpj"
              inputMode="numeric"
              spellCheck={false}
              maxLength={18}
              required
              value={cnpjInput}
              onChange={(e) => setCnpjInput(formatCNPJ(e.target.value))}
              aria-invalid={clientState?.fieldError?.field === "cnpj"}
              placeholder="00.000.000/0001-00…"
              className={`w-full min-h-11 rounded-2xl border bg-white dark:bg-slate-800 px-4 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 ${
                clientState?.fieldError?.field === "cnpj"
                  ? "border-rose-400 focus-visible:ring-rose-500"
                  : "border-slate-300 dark:border-white/15 focus-visible:ring-[#3B68F7]"
              }`}
            />
            {clientState?.fieldError?.field === "cnpj" && (
              <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {clientState.fieldError.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="modal-client-phone" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Telefone de contato *
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Fixo ou celular</span>
              </div>
              <input
                id="modal-client-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={15}
                required
                value={phoneInput}
                onChange={(e) => setPhoneInput(formatPhoneBR(e.target.value))}
                aria-invalid={clientState?.fieldError?.field === "phone"}
                placeholder="(65) 99999-0000…"
                className={`w-full min-h-11 rounded-2xl border bg-white dark:bg-slate-800 px-4 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 ${
                  clientState?.fieldError?.field === "phone"
                    ? "border-rose-400 focus-visible:ring-rose-500"
                    : "border-slate-300 dark:border-white/15 focus-visible:ring-[#3B68F7]"
                }`}
              />
              {clientState?.fieldError?.field === "phone" && (
                <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {clientState.fieldError.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="modal-client-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                E-mail de contato *
              </label>
              <input
                id="modal-client-email"
                name="email"
                type="email"
                autoComplete="email"
                spellCheck={false}
                required
                defaultValue={clientState?.values?.email ?? ""}
                aria-invalid={clientState?.fieldError?.field === "email"}
                placeholder="contato@cliente.com.br…"
                className={`w-full min-h-11 rounded-2xl border bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 ${
                  clientState?.fieldError?.field === "email"
                    ? "border-rose-400 focus-visible:ring-rose-500"
                    : "border-slate-300 dark:border-white/15 focus-visible:ring-[#3B68F7]"
                }`}
              />
              {clientState?.fieldError?.field === "email" && (
                <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {clientState.fieldError.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setNewClientOpen(false)}
              className="min-h-11 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={clientPending}
              className="min-h-11 inline-flex items-center gap-2 pill-gradient px-6 py-2 text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              {clientPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Building2 className="size-4" aria-hidden="true" />
              )}
              <span>Salvar cliente</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Detalhes do contrato */}
      <Modal
        open={Boolean(selectedContract)}
        onClose={() => setSelectedContract(null)}
        title={selectedContract ? `Contrato ${selectedContract.code.replace("#", "")}` : ""}
        description={
          selectedContract
            ? `${selectedContract.clientName} · CNPJ ${selectedContract.clientCnpj}`
            : undefined
        }
        size="lg"
      >
        {selectedContract && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-3.5">
                <span className="text-slate-500 dark:text-slate-400 block">Unidade / postos</span>
                <strong className="text-slate-900 dark:text-white mt-1 block">{selectedContract.workstation}</strong>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-3.5">
                <span className="text-slate-500 dark:text-slate-400 block">Vigência contratual</span>
                <strong className="text-slate-900 dark:text-white mt-1 block tabular-nums">
                  {selectedContract.durationMonths} meses ({selectedContract.status})
                </strong>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-3.5">
                <span className="text-slate-500 dark:text-slate-400 block">Valor mensal</span>
                <strong className="text-[#3B68F7] dark:text-blue-400 mt-1 block tabular-nums">
                  R$ {selectedContract.monthlyValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
              <p className="font-bold text-slate-900 dark:text-white mb-1">Objeto e escopo</p>
              <p>{selectedContract.scopeNotes || selectedContract.object}</p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-200/80 dark:border-white/10">
              <Link
                href={`/admin/employees?contractId=${encodeURIComponent(selectedContract.id)}#novo-colaborador`}
                className="min-h-10 inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-white hover:border-[#3B68F7]"
              >
                <span>Alocar colaborador</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
              <Link
                href={`/admin/service-orders?clientId=${encodeURIComponent(selectedContract.clientId)}&contractId=${encodeURIComponent(selectedContract.id)}#nova-os`}
                className="min-h-10 inline-flex items-center gap-1.5 pill-gradient px-5 py-2 text-xs font-bold"
              >
                <span>Abrir ordem de serviço</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Detalhes do cliente */}
      <Modal
        open={Boolean(selectedClient)}
        onClose={() => setSelectedClient(null)}
        title={selectedClient?.name ?? ""}
        description={selectedClient ? `CNPJ ${selectedClient.cnpj}` : undefined}
        size="sm"
      >
        {selectedClient && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-3.5 space-y-1">
                <p className="text-slate-500 dark:text-slate-400">Telefone de contato</p>
                <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                  {selectedClient.phone || "Não informado"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-3.5 space-y-1 min-w-0">
                <p className="text-slate-500 dark:text-slate-400">E-mail de contato</p>
                <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {selectedClient.email || selectedClient.contact || "Não informado"}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedClient(null)}
                className="min-h-10 rounded-full border border-slate-300 dark:border-white/15 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Fechar
              </button>
              <Link
                href={`/admin/contracts/create?clientId=${encodeURIComponent(selectedClient.id)}`}
                className="min-h-10 inline-flex items-center gap-1.5 pill-gradient px-5 py-2 text-xs font-bold"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                <span>Criar contrato</span>
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
