"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  FileCheck2,
  Loader2,
  Plus,
  RotateCcw,
  Shield,
  X,
} from "lucide-react";
import { createEPIStateAction, signEPIAction } from "@/app/actions/operations";
import type { EmployeeRow, EPIDeliveryRow } from "@/lib/operations/repository";

interface Props {
  tenantName: string;
  deliveries: EPIDeliveryRow[];
  employees: EmployeeRow[];
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function getOneYearFromNowIso(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export function EPIsView({ tenantName, deliveries, employees }: Props) {
  const firstInputRef = useRef<HTMLSelectElement>(null);
  const [state, createAction, pending] = useActionState(createEPIStateAction, undefined);

  const [filterMode, setFilterMode] = useState<"todos" | "pendentes" | "assinados" | "vencimento">("todos");
  const [signMode, setSignMode] = useState<"pending" | "signed">("pending");
  const [deliveredAt, setDeliveredAt] = useState(getTodayIso);
  const [expiresAt, setExpiresAt] = useState(getOneYearFromNowIso);

  // Evidência ou coleta de assinatura selecionada
  const [selectedDelivery, setSelectedDelivery] = useState<EPIDeliveryRow | null>(null);
  const [signResponsible, setSignResponsible] = useState("");
  const [signProtocol, setSignProtocol] = useState("");

  // QA-02: Contadores reais separados por estado de assinatura e validade
  const signedCount = deliveries.filter((d) => d.receiptSigned).length;
  const pendingCount = deliveries.filter((d) => !d.receiptSigned).length;
  const expiringCount = deliveries.filter((d) => d.daysUntilExpiry <= 30).length;

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      if (filterMode === "pendentes") return !d.receiptSigned;
      if (filterMode === "assinados") return d.receiptSigned;
      if (filterMode === "vencimento") return d.daysUntilExpiry <= 30;
      return true;
    });
  }, [deliveries, filterMode]);

  const openSignOrInspect = (d: EPIDeliveryRow) => {
    setSelectedDelivery(d);
    setSignResponsible(d.signedBy || d.employeeName);
    setSignProtocol(d.evidenceCode || `TRM-${d.caNumber.replace(/\D/g, "") || "2026"}`);
  };

  return (
    <div className="space-y-5">
      {state?.ok && (
        <div
          role="status"
          className="rounded-3xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/90 dark:bg-emerald-950/50 p-4 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm"
        >
          <div className="flex items-center gap-2.5 font-bold text-slate-900 dark:text-white">
            <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            <span>
              Entrega de EPI ({state.epiName}) registrada em {tenantName} com status:{" "}
              {state.receiptSigned ? "Termo assinado com comprovante" : "Pendente de assinatura"}.
            </span>
          </div>
        </div>
      )}

      {/* 4 Pastel Glass KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-blue-100/80 via-blue-50/65 to-white/85 dark:from-blue-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 dark:bg-blue-500/20 text-[#3B68F7] dark:text-blue-300">
            <Shield className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Entregas de EPI</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {deliveries.length}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-emerald-100/80 via-emerald-50/65 to-white/85 dark:from-emerald-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
            <Check className="size-6 stroke-[2]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Termos assinados</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {signedCount}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-amber-100/80 via-amber-50/65 to-white/85 dark:from-amber-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
            <Clock className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Assinaturas pendentes</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {pendingCount}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-purple-100/80 via-purple-50/65 to-white/85 dark:from-purple-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(31,38,135,0.05)] flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300">
            <AlertTriangle className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">CA vencido / &lt; 30d</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {expiringCount}
            </p>
          </div>
        </div>
      </div>

      {/* Main Solid Table Card */}
      <section className="rounded-[28px] solid-surface p-5 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Filtros de conformidade e assinatura */}
          <div
            role="tablist"
            aria-label="Filtro de entregas de EPI"
            className="inline-flex flex-wrap items-center rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 p-1 gap-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === "todos"}
              onClick={() => setFilterMode("todos")}
              className={`rounded-full px-4 py-1.5 text-xs transition-colors cursor-pointer ${
                filterMode === "todos"
                  ? "pill-gradient"
                  : "font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950"
              }`}
            >
              Todas ({deliveries.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === "pendentes"}
              onClick={() => setFilterMode("pendentes")}
              className={`rounded-full px-4 py-1.5 text-xs transition-colors cursor-pointer ${
                filterMode === "pendentes"
                  ? "pill-gradient"
                  : "font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950"
              }`}
            >
              Assinatura pendente ({pendingCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === "assinados"}
              onClick={() => setFilterMode("assinados")}
              className={`rounded-full px-4 py-1.5 text-xs transition-colors cursor-pointer ${
                filterMode === "assinados"
                  ? "pill-gradient"
                  : "font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950"
              }`}
            >
              Termo assinado ({signedCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === "vencimento"}
              onClick={() => setFilterMode("vencimento")}
              className={`rounded-full px-4 py-1.5 text-xs transition-colors cursor-pointer ${
                filterMode === "vencimento"
                  ? "pill-gradient"
                  : "font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950"
              }`}
            >
              Vencimento CA ({expiringCount})
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              firstInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              setTimeout(() => firstInputRef.current?.focus(), 60);
            }}
            className="inline-flex min-h-10 items-center gap-2 pill-gradient px-5 py-2 text-xs sm:text-sm cursor-pointer"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>Registrar entrega</span>
          </button>
        </div>

        {/* Painel de Evidência ou Coleta de Assinatura (QA-02) */}
        {selectedDelivery && (
          <div
            role="region"
            aria-label={`Comprovante e assinatura de EPI de ${selectedDelivery.employeeName}`}
            className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-950/30 p-5 space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <FileCheck2 className="size-5 text-[#3B68F7] dark:text-blue-400" aria-hidden="true" />
                  <span className="text-base font-extrabold text-slate-900 dark:text-white">
                    {selectedDelivery.receiptSigned
                      ? "Evidência de Termo de EPI Assinado"
                      : "Registrar Assinatura e Comprovante de Entrega"}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Colaborador: <strong>{selectedDelivery.employeeName}</strong> ({selectedDelivery.employeeRole}) · EPI:{" "}
                  <strong>{selectedDelivery.epiName}</strong> · CA: <strong>{selectedDelivery.caNumber}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDelivery(null)}
                aria-label="Fechar painel de comprovante"
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            {selectedDelivery.receiptSigned ? (
              <div className="grid gap-3 sm:grid-cols-3 text-xs">
                <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-slate-200/80 dark:border-white/10">
                  <span className="text-slate-500 dark:text-slate-400 block">Assinado / confirmado por</span>
                  <strong className="text-slate-900 dark:text-white mt-0.5 block">
                    {selectedDelivery.signedBy || selectedDelivery.employeeName}
                  </strong>
                </div>
                <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-slate-200/80 dark:border-white/10">
                  <span className="text-slate-500 dark:text-slate-400 block">Data e hora da assinatura</span>
                  <strong className="text-slate-900 dark:text-white mt-0.5 block">
                    {selectedDelivery.signedAt || selectedDelivery.deliveredAt}
                  </strong>
                </div>
                <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-slate-200/80 dark:border-white/10">
                  <span className="text-slate-500 dark:text-slate-400 block">Protocolo / comprovante</span>
                  <strong className="font-mono text-emerald-700 dark:text-emerald-300 mt-0.5 block">
                    {selectedDelivery.evidenceCode || "TRM-VERIFICADO"}
                  </strong>
                </div>
              </div>
            ) : (
              <form
                action={async (fd) => {
                  await signEPIAction(fd);
                  setSelectedDelivery(null);
                }}
                className="grid gap-3 sm:grid-cols-3 items-end bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-white/10"
              >
                <input type="hidden" name="id" value={selectedDelivery.id} />
                <div className="space-y-1">
                  <label htmlFor="sign-by" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Responsável pela assinatura *
                  </label>
                  <input
                    id="sign-by"
                    name="signedBy"
                    required
                    value={signResponsible}
                    onChange={(e) => setSignResponsible(e.target.value)}
                    placeholder="Nome do colaborador ou supervisor"
                    className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="sign-code" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Protocolo / nº da ficha ou anexo *
                  </label>
                  <input
                    id="sign-code"
                    name="evidenceCode"
                    required
                    value={signProtocol}
                    onChange={(e) => setSignProtocol(e.target.value)}
                    placeholder="Ex.: TRM-2026-001"
                    className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-mono font-medium text-slate-900 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="min-h-9 pill-gradient px-4 py-2 text-xs cursor-pointer"
                >
                  Confirmar termo assinado
                </button>
              </form>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="rounded-xl bg-slate-100 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
                <th className="rounded-l-xl px-4 py-3.5">Colaborador</th>
                <th className="px-4 py-3.5">Equipamento (EPI)</th>
                <th className="px-4 py-3.5">Certificado (CA)</th>
                <th className="px-4 py-3.5">Entrega</th>
                <th className="px-4 py-3.5">Validade do CA</th>
                <th className="px-4 py-3.5">Situação do termo</th>
                <th className="rounded-r-xl px-4 py-3.5 text-right">Evidência / ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                    Nenhuma entrega de EPI registrada na empresa <strong>{tenantName}</strong>.
                  </td>
                </tr>
              ) : filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center space-y-2.5">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Nenhum registro de EPI encontrado para este filtro
                    </p>
                    <button
                      type="button"
                      onClick={() => setFilterMode("todos")}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-white cursor-pointer"
                    >
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                      <span>Mostrar todas as entregas</span>
                    </button>
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((d) => {
                  const expired = d.daysUntilExpiry < 0;
                  const expiringSoon = d.daysUntilExpiry >= 0 && d.daysUntilExpiry <= 30;
                  return (
                    <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4">
                        <span className="block font-bold text-slate-900 dark:text-white">{d.employeeName}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{d.employeeRole}</span>
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-800 dark:text-slate-200">{d.epiName}</td>
                      <td className="px-4 py-4 font-bold text-slate-900 dark:text-white">{d.caNumber}</td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300 tabular-nums">{d.deliveredAt}</td>
                      <td className="px-4 py-4 tabular-nums">
                        <span className="block text-slate-700 dark:text-slate-200">{d.expiresAt}</span>
                        {expired ? (
                          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">CA vencido</span>
                        ) : expiringSoon ? (
                          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                            Vence em {d.daysUntilExpiry}d
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        {d.receiptSigned ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
                            Termo assinado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-950/80 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
                            <span className="size-1.5 rounded-full bg-amber-600 dark:bg-amber-400" aria-hidden="true" />
                            Assinatura pendente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {d.receiptSigned ? (
                          <button
                            type="button"
                            onClick={() => openSignOrInspect(d)}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#3B68F7] cursor-pointer"
                          >
                            <FileCheck2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                            <span>Ver evidência</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openSignOrInspect(d)}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 px-3.5 py-1 text-xs font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-100 cursor-pointer"
                          >
                            <Check className="size-3.5" aria-hidden="true" />
                            <span>Registrar assinatura</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Formulário com separação explícita entre entrega, validade do CA e assinatura */}
      <section id="novo-epi" className="rounded-[28px] solid-surface p-6 sm:p-7 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Registrar entrega de EPI</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Informe a data da entrega, validade do CA e se o termo ficará pendente de assinatura ou já possui comprovante.
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

        <form action={createAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor="epi-emp" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              Colaborador *
            </label>
            <select
              ref={firstInputRef}
              id="epi-emp"
              name="employeeId"
              required
              className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.roleTitle})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="epi-name" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              Descrição do equipamento (EPI) *
            </label>
            <input
              id="epi-name"
              name="epiName"
              required
              placeholder="Ex.: Botina de segurança composite"
              className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="epi-ca" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              Número do CA *
            </label>
            <input
              id="epi-ca"
              name="caNumber"
              required
              placeholder="Ex.: CA-42110"
              className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="epi-delivered" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              Data real da entrega *
            </label>
            <input
              id="epi-delivered"
              name="deliveredAt"
              type="date"
              value={deliveredAt}
              onChange={(e) => setDeliveredAt(e.target.value)}
              required
              className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="epi-exp" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              Validade do CA *
            </label>
            <input
              id="epi-exp"
              name="expiresAt"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              required
              className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="epi-sign-mode" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              Estado do termo de recebimento *
            </label>
            <select
              id="epi-sign-mode"
              name="signMode"
              value={signMode}
              onChange={(e) => setSignMode(e.target.value as "pending" | "signed")}
              className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <option value="pending">Pendente de assinatura (coletar depois)</option>
              <option value="signed">Termo assinado no ato (registrar comprovante)</option>
            </select>
          </div>

          {signMode === "signed" && (
            <>
              <div className="space-y-1">
                <label htmlFor="epi-signed-by" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Responsável pela assinatura *
                </label>
                <input
                  id="epi-signed-by"
                  name="signedBy"
                  required
                  placeholder="Nome de quem assinou a ficha"
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="epi-evidence" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Código / protocolo do comprovante *
                </label>
                <input
                  id="epi-evidence"
                  name="evidenceCode"
                  required
                  placeholder="Ex.: TRM-2026-045"
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-mono font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>
            </>
          )}

          <div className="sm:col-span-2 lg:col-span-3 flex justify-end pt-1">
            <button
              type="submit"
              disabled={pending}
              className="min-h-10 pill-gradient py-2.5 px-6 text-xs inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
              <span>Salvar entrega de EPI</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
