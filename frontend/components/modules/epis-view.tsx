"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  FileCheck2,
  Loader2,
  Plus,
  RotateCcw,
} from "lucide-react";
import { createEPIStateAction, signEPIAction } from "@/app/actions/operations";
import { Modal } from "@/components/ui/modal";
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
  const [state, createAction, pending] = useActionState(createEPIStateAction, undefined);
  const [createOpen, setCreateOpen] = useState(false);

  const [filterMode, setFilterMode] = useState<"todos" | "pendentes" | "assinados" | "vencimento">("todos");
  const [signMode, setSignMode] = useState<"pending" | "signed">("pending");
  const [deliveredAt, setDeliveredAt] = useState(getTodayIso);
  const [expiresAt, setExpiresAt] = useState(getOneYearFromNowIso);

  const [selectedDelivery, setSelectedDelivery] = useState<EPIDeliveryRow | null>(null);
  const [signResponsible, setSignResponsible] = useState("");
  const [signProtocol, setSignProtocol] = useState("");

  useEffect(() => {
    if (state?.ok) {
      setCreateOpen(false);
    }
  }, [state]);

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
      {/* Cabeçalho padronizado */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1 pt-1">
        <div>
          <h1 className="text-2xl sm:text-[32px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight text-balance">
            Controle de EPIs
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Entregas de equipamentos de proteção, validade do CA e comprovantes de assinatura em {tenantName}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="min-h-11 inline-flex items-center gap-2 pill-gradient px-6 py-2.5 text-xs sm:text-sm font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>Registrar entrega</span>
        </button>
      </div>

      {state?.ok && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/90 dark:bg-emerald-950/50 p-4 flex items-center gap-2.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white"
        >
          <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
          <span>
            Entrega de {state.epiName} registrada ({state.receiptSigned ? "Termo assinado" : "Assinatura pendente"}).
          </span>
        </div>
      )}

      {/* Faixa estruturada de métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-white/10 rounded-[24px] solid-surface overflow-hidden">
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Entregas de EPI</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {deliveries.length}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Termos assinados</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {signedCount}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Assinaturas pendentes</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
            {pendingCount}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">CA vencido / &lt; 30d</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
            {expiringCount}
          </p>
        </div>
      </div>

      {/* Tabela Full-Width */}
      <section className="rounded-[28px] solid-surface p-5 sm:p-6 space-y-5">
        <div
          role="tablist"
          aria-label="Filtro de entregas de EPI"
          className="inline-flex flex-wrap items-center rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 p-1 gap-1"
        >
          {(
            [
              { key: "todos", label: `Todas (${deliveries.length})` },
              { key: "pendentes", label: `Pendentes (${pendingCount})` },
              { key: "assinados", label: `Assinados (${signedCount})` },
              { key: "vencimento", label: `Vencimentos CA (${expiringCount})` },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={filterMode === item.key}
              onClick={() => setFilterMode(item.key)}
              className={`min-h-9 rounded-full px-4 py-1.5 text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] ${
                filterMode === item.key
                  ? "bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white shadow-2xs"
                  : "font-medium text-slate-600 dark:text-slate-300"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
                <th className="rounded-l-xl px-4 py-3.5">Colaborador</th>
                <th className="px-4 py-3.5">Equipamento (EPI)</th>
                <th className="px-4 py-3.5">CA</th>
                <th className="px-4 py-3.5">Entrega</th>
                <th className="px-4 py-3.5">Validade do CA</th>
                <th className="px-4 py-3.5">Situação do termo</th>
                <th className="rounded-r-xl px-4 py-3.5 text-right">Evidência / ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center space-y-3">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Nenhuma entrega de EPI registrada ainda
                    </p>
                    <button
                      type="button"
                      onClick={() => setCreateOpen(true)}
                      className="min-h-10 inline-flex items-center gap-2 pill-gradient px-5 py-2 text-xs font-bold cursor-pointer"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      <span>Registrar primeira entrega</span>
                    </button>
                  </td>
                </tr>
              ) : filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center space-y-2.5">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Nenhum registro encontrado para este filtro
                    </p>
                    <button
                      type="button"
                      onClick={() => setFilterMode("todos")}
                      className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 px-3.5 py-1.5 text-xs font-semibold cursor-pointer"
                    >
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                      <span>Limpar filtros</span>
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
                      <td className="px-4 py-4 font-mono font-bold text-slate-900 dark:text-white">{d.caNumber}</td>
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
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            <span className="size-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
                            Termo assinado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                            <span className="size-1.5 rounded-full bg-amber-600" aria-hidden="true" />
                            Assinatura pendente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {d.receiptSigned ? (
                          <button
                            type="button"
                            onClick={() => openSignOrInspect(d)}
                            className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#3B68F7] transition-colors cursor-pointer"
                          >
                            <FileCheck2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                            <span>Ver evidência</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openSignOrInspect(d)}
                            className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 px-3.5 py-1.5 text-xs font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
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

      {/* Modal: Registrar entrega de EPI */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Registrar entrega de EPI"
        description={`Informe colaborador, equipamento, CA e situação do termo em ${tenantName}.`}
        size="lg"
      >
        {employees.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/70 dark:bg-amber-950/30 p-5 space-y-3 text-center">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
              Cadastre ao menos um colaborador antes de registrar a entrega de EPI
            </p>
            <Link
              href="/admin/employees#novo-colaborador"
              className="min-h-10 inline-flex items-center gap-2 pill-gradient px-5 py-2 text-xs font-bold"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Cadastrar colaborador agora</span>
            </Link>
          </div>
        ) : (
          <form action={createAction} className="space-y-4">
            {state?.error && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300"
              >
                {state.error}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="modal-epi-emp" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Colaborador *
                </label>
                <select
                  id="modal-epi-emp"
                  name="employeeId"
                  required
                  className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.roleTitle})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="modal-epi-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Descrição do EPI *
                </label>
                <input
                  id="modal-epi-name"
                  name="epiName"
                  required
                  placeholder="Ex.: Botina de segurança composite…"
                  className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="modal-epi-ca" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Número do CA *
                </label>
                <input
                  id="modal-epi-ca"
                  name="caNumber"
                  spellCheck={false}
                  required
                  placeholder="Ex.: CA-42110…"
                  className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="modal-epi-del" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Data real da entrega *
                </label>
                <input
                  id="modal-epi-del"
                  name="deliveredAt"
                  type="date"
                  value={deliveredAt}
                  onChange={(e) => setDeliveredAt(e.target.value)}
                  required
                  className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="modal-epi-exp" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Validade do CA *
                </label>
                <input
                  id="modal-epi-exp"
                  name="expiresAt"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  required
                  className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="modal-epi-sign-mode" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Estado do termo de recebimento *
                </label>
                <select
                  id="modal-epi-sign-mode"
                  name="signMode"
                  value={signMode}
                  onChange={(e) => setSignMode(e.target.value as "pending" | "signed")}
                  className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                >
                  <option value="pending">Pendente de assinatura (coletar depois)</option>
                  <option value="signed">Termo assinado no ato (registrar comprovante)</option>
                </select>
              </div>

              {signMode === "signed" && (
                <>
                  <div className="space-y-1.5">
                    <label htmlFor="modal-epi-signed-by" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Responsável pela assinatura *
                    </label>
                    <input
                      id="modal-epi-signed-by"
                      name="signedBy"
                      required
                      placeholder="Nome de quem assinou…"
                      className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="modal-epi-evidence" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Protocolo / código do comprovante *
                    </label>
                    <input
                      id="modal-epi-evidence"
                      name="evidenceCode"
                      spellCheck={false}
                      required
                      placeholder="Ex.: TRM-2026-045…"
                      className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 font-mono text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="min-h-11 rounded-full border border-slate-300 dark:border-white/15 px-5 py-2 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="min-h-11 inline-flex items-center gap-2 pill-gradient px-6 py-2 text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                <span>Salvar entrega</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Evidência de assinatura ou Coleta de assinatura */}
      <Modal
        open={Boolean(selectedDelivery)}
        onClose={() => setSelectedDelivery(null)}
        title={
          selectedDelivery?.receiptSigned
            ? "Comprovante de termo assinado"
            : "Registrar assinatura do termo de EPI"
        }
        description={
          selectedDelivery
            ? `${selectedDelivery.employeeName} · ${selectedDelivery.epiName} (${selectedDelivery.caNumber})`
            : undefined
        }
        size="md"
      >
        {selectedDelivery &&
          (selectedDelivery.receiptSigned ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3 text-xs">
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-3.5">
                  <span className="text-slate-500 block">Assinado por</span>
                  <strong className="text-slate-900 dark:text-white mt-1 block">
                    {selectedDelivery.signedBy || selectedDelivery.employeeName}
                  </strong>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-3.5">
                  <span className="text-slate-500 block">Data e hora</span>
                  <strong className="text-slate-900 dark:text-white mt-1 block tabular-nums">
                    {selectedDelivery.signedAt || selectedDelivery.deliveredAt}
                  </strong>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-3.5">
                  <span className="text-slate-500 block">Protocolo</span>
                  <strong className="font-mono text-emerald-700 dark:text-emerald-300 mt-1 block">
                    {selectedDelivery.evidenceCode || "TRM-VERIFICADO"}
                  </strong>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedDelivery(null)}
                  className="min-h-10 rounded-full border border-slate-300 dark:border-white/15 px-5 py-2 text-xs font-semibold cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          ) : (
            <form
              action={async (fd) => {
                await signEPIAction(fd);
                setSelectedDelivery(null);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="id" value={selectedDelivery.id} />

              <div className="space-y-1.5">
                <label htmlFor="sign-by" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Responsável pela assinatura *
                </label>
                <input
                  id="sign-by"
                  name="signedBy"
                  required
                  value={signResponsible}
                  onChange={(e) => setSignResponsible(e.target.value)}
                  className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="sign-code" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Protocolo / nº da ficha ou anexo *
                </label>
                <input
                  id="sign-code"
                  name="evidenceCode"
                  spellCheck={false}
                  required
                  value={signProtocol}
                  onChange={(e) => setSignProtocol(e.target.value)}
                  className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDelivery(null)}
                  className="min-h-11 rounded-full border border-slate-300 dark:border-white/15 px-5 py-2 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-11 pill-gradient px-6 py-2 text-xs font-bold cursor-pointer"
                >
                  Confirmar termo assinado
                </button>
              </div>
            </form>
          ))}
      </Modal>
    </div>
  );
}
