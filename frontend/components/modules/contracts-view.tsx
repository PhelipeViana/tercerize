"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Coins,
  FileText,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Users,
  X,
} from "lucide-react";
import { createClientStateAction } from "@/app/actions/operations";
import type { ClientRow, ContractRow } from "@/lib/operations/repository";
import { formatCNPJ } from "@/lib/utils/cnpj";

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
  const [cnpjInput, setCnpjInput] = useState("");

  const clientNameInputRef = useRef<HTMLInputElement>(null);
  const [clientState, clientAction, clientPending] = useActionState(createClientStateAction, undefined);

  useEffect(() => {
    if (clientState?.values?.cnpj) {
      setCnpjInput(clientState.values.cnpj);
    } else if (clientState?.ok) {
      setCnpjInput("");
    }
  }, [clientState]);

  const focusNewClientForm = () => {
    setTab("clientes");
    setTimeout(() => {
      clientNameInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      clientNameInputRef.current?.focus();
    }, 60);
  };

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
        cl.contact.toLowerCase().includes(q),
    );
  }, [clients, query]);

  return (
    <div className="space-y-5">
      {/* Cabeçalho com Ação Principal única posicionada junto ao título e dinâmica conforme a aba ativa */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1 pt-1">
        <div>
          <h1 className="text-2xl sm:text-[34px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
            Clientes e contratos
          </h1>
          <p className="mt-1 text-xs sm:text-[15px] font-normal text-slate-600 dark:text-slate-400">
            Gerencie clientes tomadores, contratos ativos, postos de trabalho e vigências em {tenantName}.
          </p>
        </div>

        {tab === "contratos" ? (
          <Link
            href="/admin/contracts/create"
            className="inline-flex min-h-11 items-center gap-2 pill-gradient px-6 py-2.5 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>Novo contrato</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={focusNewClientForm}
            className="inline-flex min-h-11 items-center gap-2 pill-gradient px-6 py-2.5 text-xs sm:text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>Novo cliente</span>
          </button>
        )}
      </div>

      {/* Banner pós-cadastro público (Passo 1 -> Passo 2) */}
      {welcome && (
        <div
          role="status"
          className="rounded-3xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/90 dark:bg-emerald-950/50 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Empresa {tenantName} ativada com sucesso!
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Passo 1 concluído. Cadastre abaixo o primeiro cliente tomador para liberar a criação do contrato.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={focusNewClientForm}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold px-5 py-2 text-xs cursor-pointer"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span>Cadastrar primeiro cliente</span>
          </button>
        </div>
      )}

      {/* Banner pós-salvamento de cliente (Passo 2 -> Passo 3) */}
      {clientState?.ok && clientState.clientId && (
        <div
          role="status"
          className="rounded-3xl border border-blue-200 dark:border-blue-700/60 bg-blue-50/95 dark:bg-blue-950/60 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-[#3B68F7] dark:text-blue-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Cliente {clientState.clientName} ({clientState.clientCnpj}) cadastrado em {tenantName}!
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Siga para o próximo passo com este cliente já vinculado ao contrato.
              </p>
            </div>
          </div>
          <Link
            href={`/admin/contracts/create?clientId=${encodeURIComponent(clientState.clientId)}`}
            className="inline-flex min-h-10 items-center gap-2 pill-gradient px-5 py-2 text-xs"
          >
            <span>Criar contrato para este cliente</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* Banner pós-salvamento de contrato (Passo 3 -> Passo 4) */}
      {createdContractId && (
        <div
          role="status"
          className="rounded-3xl border border-blue-200 dark:border-blue-700/60 bg-blue-50/95 dark:bg-blue-950/60 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-[#3B68F7] dark:text-blue-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Contrato {(createdCode ?? "").replace("#", "")} salvo na empresa {tenantName}!
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Próximo passo recomendado: alocar um colaborador e definir a escala para este contrato.
              </p>
            </div>
          </div>
          <Link
            href={`/admin/employees?contractId=${encodeURIComponent(createdContractId)}#novo-colaborador`}
            className="inline-flex min-h-10 items-center gap-2 pill-gradient px-5 py-2 text-xs"
          >
            <span>Alocar colaborador</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* 4 Pastel Glass KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-blue-100/80 via-blue-50/65 to-white/85 dark:from-blue-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 dark:bg-blue-500/20 text-[#3B68F7] dark:text-blue-300">
            <FileText className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Contratos</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {contracts.length}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-purple-100/80 via-purple-50/65 to-white/85 dark:from-purple-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300">
            <Check className="size-6 stroke-[2]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Contratos ativos</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {activeContractsCount}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-emerald-100/80 via-emerald-50/65 to-white/85 dark:from-emerald-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
            <Users className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Clientes</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {clients.length}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-sky-100/80 via-sky-50/65 to-white/85 dark:from-sky-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-sky-600/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300">
            <Coins className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Receita mensal</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5 truncate">
              R$ {totalMonthlyRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Main Solid Container for High-Contrast Reading */}
      <section className="rounded-[28px] solid-surface p-5 sm:p-7 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Segmented Pill Tabs (neutras para reservar o azul para a ação principal) */}
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
              className={`rounded-full px-5 py-2 text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] ${
                tab === "contratos"
                  ? "bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white shadow-xs"
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
              className={`rounded-full px-5 py-2 text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] ${
                tab === "clientes"
                  ? "bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white shadow-xs"
                  : "font-medium text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
              }`}
            >
              Clientes ({clients.length})
            </button>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-wrap items-center gap-3 flex-1 sm:flex-initial justify-end">
            <div className="relative min-w-[240px] sm:w-72">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400"
                aria-hidden="true"
              />
              <label htmlFor="contracts-search" className="sr-only">
                {tab === "contratos"
                  ? "Buscar por cliente ou código"
                  : "Buscar por razão social ou CNPJ"}
              </label>
              <input
                id="contracts-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  tab === "contratos"
                    ? "Buscar por cliente ou código…"
                    : "Buscar por razão social ou CNPJ…"
                }
                className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-slate-50/90 dark:bg-slate-800 pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
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
                  className="appearance-none rounded-full border border-slate-200 dark:border-white/15 bg-slate-50/90 dark:bg-slate-800 pl-4 pr-9 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] cursor-pointer"
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

        {/* Detalhe interativo do contrato ou cliente clicado */}
        {selectedContract && (
          <div
            role="region"
            aria-label={`Detalhes do contrato ${selectedContract.code}`}
            className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-950/30 p-5 space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-base font-extrabold text-slate-900 dark:text-white">
                    Contrato {selectedContract.code.replace("#", "")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-3 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <span className="size-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
                    {selectedContract.status}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                  Cliente tomador: <strong>{selectedContract.clientName}</strong> · CNPJ: {selectedContract.clientCnpj}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedContract(null)}
                aria-label="Fechar detalhes do contrato"
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-slate-200/80 dark:border-white/10">
                <span className="text-slate-500 dark:text-slate-400 block">Unidade / postos</span>
                <strong className="text-slate-900 dark:text-white mt-0.5 block">
                  {selectedContract.workstation}
                </strong>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-slate-200/80 dark:border-white/10">
                <span className="text-slate-500 dark:text-slate-400 block">Vigência contratual</span>
                <strong className="text-slate-900 dark:text-white mt-0.5 block">
                  {selectedContract.durationMonths} meses
                </strong>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-slate-200/80 dark:border-white/10">
                <span className="text-slate-500 dark:text-slate-400 block">Valor mensal</span>
                <strong className="text-slate-900 dark:text-white mt-0.5 block">
                  R$ {selectedContract.monthlyValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200/80 dark:border-white/10">
              <strong>Escopo e condições:</strong> {selectedContract.scopeNotes || selectedContract.object}
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Link
                href={`/admin/employees?contractId=${encodeURIComponent(selectedContract.id)}#novo-colaborador`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-800 dark:text-white hover:border-[#3B68F7]"
              >
                <span>Alocar colaborador neste contrato</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
              <Link
                href={`/admin/service-orders?clientId=${encodeURIComponent(selectedContract.clientId)}&contractId=${encodeURIComponent(selectedContract.id)}#nova-os`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-800 dark:text-white hover:border-[#3B68F7]"
              >
                <span>Abrir ordem de serviço</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}

        {selectedClient && (
          <div
            role="region"
            aria-label={`Detalhes do cliente ${selectedClient.name}`}
            className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-950/30 p-5 flex flex-wrap items-center justify-between gap-4"
          >
            <div>
              <p className="text-base font-extrabold text-slate-900 dark:text-white">{selectedClient.name}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                CNPJ: <span className="font-mono">{selectedClient.cnpj}</span> · Contato:{" "}
                {selectedClient.contact || "Não informado"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/admin/contracts/create?clientId=${encodeURIComponent(selectedClient.id)}`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold px-4 py-1.5 text-xs"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                <span>Criar contrato para este cliente</span>
              </Link>
              <button
                type="button"
                onClick={() => setSelectedClient(null)}
                aria-label="Fechar detalhes do cliente"
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {tab === "contratos" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="rounded-xl bg-slate-100 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <th className="rounded-l-xl px-4 py-3.5">Código</th>
                  <th className="px-4 py-3.5">Cliente</th>
                  <th className="px-4 py-3.5">Objeto</th>
                  <th className="px-4 py-3.5">Unidade / postos</th>
                  <th className="px-4 py-3.5">Vigência</th>
                  <th className="px-4 py-3.5">Valor mensal</th>
                  <th className="rounded-r-xl px-4 py-3.5">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                {contracts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="mx-auto max-w-md space-y-3">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          Nenhum contrato cadastrado
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {clients.length === 0
                            ? `A empresa ${tenantName} ainda não possui clientes nem contratos. Cadastre primeiro o cliente tomador.`
                            : `Você já possui cliente(s) cadastrado(s) em ${tenantName}. Crie agora o primeiro contrato.`}
                        </p>
                        <div className="pt-1">
                          {clients.length === 0 ? (
                            <button
                              type="button"
                              onClick={focusNewClientForm}
                              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold px-5 py-2 text-xs cursor-pointer"
                            >
                              <Plus className="size-3.5" aria-hidden="true" />
                              <span>Cadastrar primeiro cliente</span>
                            </button>
                          ) : (
                            <Link
                              href="/admin/contracts/create"
                              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold px-5 py-2 text-xs"
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
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="mx-auto max-w-md space-y-3">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          Nenhum contrato encontrado
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Não encontramos contratos correspondentes à busca ou ao filtro de situação selecionado.
                        </p>
                        {hasContractFilters && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={clearFilters}
                              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-white hover:border-[#3B68F7] cursor-pointer"
                            >
                              <RotateCcw className="size-3.5" aria-hidden="true" />
                              <span>Limpar filtros</span>
                            </button>
                          </div>
                        )}
                      </div>
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
                      <td className="px-4 py-4 font-medium">
                        <button
                          type="button"
                          onClick={() => setSelectedContract(c)}
                          className="text-left text-slate-900 dark:text-slate-100 hover:text-[#3B68F7] dark:hover:text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] rounded cursor-pointer"
                        >
                          {c.clientName}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-slate-700 dark:text-slate-300">{c.object}</td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                        {c.workstation.replace("•", "·")}
                      </td>
                      <td className="px-4 py-4 text-slate-700 dark:text-slate-200 tabular-nums">
                        {c.durationMonths} meses
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-800 dark:text-slate-100 tabular-nums">
                        R$ {c.monthlyValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="rounded-xl bg-slate-100 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
                    <th className="rounded-l-xl px-4 py-3.5">Cliente tomador</th>
                    <th className="px-4 py-3.5">CNPJ</th>
                    <th className="px-4 py-3.5">Contato</th>
                    <th className="rounded-r-xl px-4 py-3.5 text-right">Próximo passo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                  {clients.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center space-y-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          Nenhum cliente cadastrado
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Utilize o formulário ao lado para cadastrar o primeiro cliente tomador da empresa{" "}
                          <strong>{tenantName}</strong>.
                        </p>
                      </td>
                    </tr>
                  ) : filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center space-y-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          Nenhum cliente encontrado
                        </p>
                        {hasClientFilters && (
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-white cursor-pointer"
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
                        <td className="px-4 py-4 font-bold">
                          <button
                            type="button"
                            onClick={() => setSelectedClient(cl)}
                            className="text-left text-slate-900 dark:text-white hover:text-[#3B68F7] dark:hover:text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] rounded cursor-pointer"
                          >
                            {cl.name}
                          </button>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs text-slate-600 dark:text-slate-300">{cl.cnpj}</td>
                        <td className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400">
                          {cl.contact || "—"}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Link
                            href={`/admin/contracts/create?clientId=${encodeURIComponent(cl.id)}`}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-800 dark:text-white hover:border-[#3B68F7]"
                          >
                            <Plus className="size-3" aria-hidden="true" />
                            <span>Criar contrato</span>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <form
              id="novo-cliente"
              action={clientAction}
              noValidate
              className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-800/50 p-5 space-y-3.5 h-fit"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Novo cliente tomador</h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <Building2 className="size-3 text-[#3B68F7]" aria-hidden="true" />
                  {tenantName}
                </span>
              </div>

              {clientState?.error && (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300"
                >
                  {clientState.error}
                </p>
              )}

              <div className="space-y-1">
                <label htmlFor="client-name" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Razão social *
                </label>
                <input
                  ref={clientNameInputRef}
                  id="client-name"
                  name="name"
                  required
                  defaultValue={clientState?.values?.name ?? ""}
                  aria-invalid={clientState?.fieldError?.field === "name"}
                  placeholder="Ex.: Grupo Horizonte Ltda"
                  className={`w-full rounded-full border bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 ${
                    clientState?.fieldError?.field === "name"
                      ? "border-rose-400 focus-visible:ring-rose-500"
                      : "border-slate-200 dark:border-white/15 focus-visible:ring-[#3B68F7]"
                  }`}
                />
                {clientState?.fieldError?.field === "name" && (
                  <p role="alert" className="pl-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {clientState.fieldError.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-baseline justify-between px-1">
                  <label htmlFor="client-cnpj" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    CNPJ *
                  </label>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">14 dígitos válidos</span>
                </div>
                <input
                  id="client-cnpj"
                  name="cnpj"
                  inputMode="numeric"
                  required
                  value={cnpjInput}
                  onChange={(e) => setCnpjInput(formatCNPJ(e.target.value))}
                  aria-invalid={clientState?.fieldError?.field === "cnpj"}
                  placeholder="00.000.000/0001-00"
                  className={`w-full rounded-full border bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 ${
                    clientState?.fieldError?.field === "cnpj"
                      ? "border-rose-400 focus-visible:ring-rose-500"
                      : "border-slate-200 dark:border-white/15 focus-visible:ring-[#3B68F7]"
                  }`}
                />
                {clientState?.fieldError?.field === "cnpj" && (
                  <p role="alert" className="pl-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {clientState.fieldError.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="client-contact" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Contato principal
                </label>
                <input
                  id="client-contact"
                  name="contact"
                  defaultValue={clientState?.values?.contact ?? ""}
                  placeholder="(65) 3322-0000 · gestao@cliente.com.br"
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>

              <button
                type="submit"
                disabled={clientPending}
                className="w-full min-h-10 rounded-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-bold py-2.5 px-5 text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              >
                {clientPending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-3.5" aria-hidden="true" />
                )}
                <span>Salvar cliente em {tenantName}</span>
              </button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
