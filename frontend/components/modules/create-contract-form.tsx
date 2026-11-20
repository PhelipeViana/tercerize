"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, Loader2, Plus, Users } from "lucide-react";
import { createContractStateAction } from "@/app/actions/operations";
import type { ClientRow } from "@/lib/operations/repository";

interface Props {
  tenantName: string;
  clients: ClientRow[];
  initialClientId?: string;
}

export function CreateContractForm({ tenantName, clients, initialClientId }: Props) {
  const [state, action, pending] = useActionState(createContractStateAction, undefined);
  const defaultClientId =
    state?.values?.clientId ||
    (initialClientId && clients.some((c) => c.id === initialClientId) ? initialClientId : clients[0]?.id ?? "");

  const [selectedClientId, setSelectedClientId] = useState(defaultClientId);
  const selectedClient = clients.find((c) => c.id === selectedClientId);

  if (clients.length === 0) {
    return (
      <div className="rounded-[28px] solid-surface p-7 text-center space-y-4">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-blue-500/15 text-[#3B68F7] dark:text-blue-300">
          <Users className="size-6" aria-hidden="true" />
        </div>
        <div className="max-w-md mx-auto space-y-1.5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Cadastre um cliente tomador antes de criar o contrato
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            A empresa ativa <strong>{tenantName}</strong> ainda não possui clientes registrados. Cadastre o cliente para
            vincular o primeiro contrato.
          </p>
        </div>
        <Link
          href="/admin/contracts?tab=clientes#novo-cliente"
          className="inline-flex min-h-11 items-center gap-2 pill-gradient px-6 py-2.5 text-xs sm:text-sm"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>Cadastrar primeiro cliente</span>
        </Link>
      </div>
    );
  }

  return (
    <section className="rounded-[28px] solid-surface p-6 sm:p-8 space-y-6">
      {/* Resumo de contexto antes de salvar */}
      <div className="rounded-2xl border border-blue-200/80 dark:border-blue-500/20 bg-blue-50/60 dark:bg-blue-950/30 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <Building2 className="size-4 text-[#3B68F7] dark:text-blue-400 shrink-0" aria-hidden="true" />
          <span className="text-slate-700 dark:text-slate-200">
            Empresa prestadora ativa: <strong className="text-slate-900 dark:text-white">{tenantName}</strong>
          </span>
        </div>
        {selectedClient && (
          <div className="text-slate-700 dark:text-slate-200">
            Cliente selecionado: <strong>{selectedClient.name}</strong>{" "}
            <span className="font-mono text-slate-500 dark:text-slate-400">({selectedClient.cnpj})</span>
          </div>
        )}
      </div>

      {state?.error && (
        <p
          role="alert"
          className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-300"
        >
          {state.error}
        </p>
      )}

      <form action={action} noValidate className="space-y-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
            <label htmlFor="clientId" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Cliente tomador *
            </label>
            <Link
              href="/admin/contracts?tab=clientes#novo-cliente"
              className="text-xs font-semibold text-[#3B68F7] dark:text-blue-400 hover:underline"
            >
              + Cadastrar outro cliente
            </Link>
          </div>
          <select
            id="clientId"
            name="clientId"
            required
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            {clients.map((cl) => (
              <option key={cl.id} value={cl.id}>
                {cl.name} (CNPJ: {cl.cnpj})
              </option>
            ))}
          </select>
          {state?.fieldError?.field === "clientId" && (
            <p role="alert" className="pl-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {state.fieldError.message}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 space-y-1.5">
            <label htmlFor="object" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              Objeto do contrato *
            </label>
            <input
              id="object"
              name="object"
              required
              defaultValue={state?.values?.object ?? ""}
              aria-invalid={state?.fieldError?.field === "object"}
              placeholder="Ex.: Manutenção preventiva e suporte técnico"
              className={`w-full rounded-full border bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus-visible:ring-2 ${
                state?.fieldError?.field === "object"
                  ? "border-rose-400 focus-visible:ring-rose-500"
                  : "border-slate-200 dark:border-white/15 focus-visible:ring-[#3B68F7]"
              }`}
            />
            {state?.fieldError?.field === "object" && (
              <p role="alert" className="pl-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                {state.fieldError.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between px-1">
              <label htmlFor="durationMonths" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Vigência (meses) *
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Padrão: 12m</span>
            </div>
            <input
              id="durationMonths"
              name="durationMonths"
              type="number"
              min={1}
              max={120}
              defaultValue={state?.values?.durationMonths ?? "12"}
              required
              className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="monthlyValue" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              Valor mensal (R$) *
            </label>
            <input
              id="monthlyValue"
              name="monthlyValue"
              type="text"
              inputMode="decimal"
              defaultValue={state?.values?.monthlyValue ?? ""}
              aria-invalid={state?.fieldError?.field === "monthlyValue"}
              placeholder="Ex.: 18.500,00"
              required
              className={`w-full rounded-full border bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus-visible:ring-2 ${
                state?.fieldError?.field === "monthlyValue"
                  ? "border-rose-400 focus-visible:ring-rose-500"
                  : "border-slate-200 dark:border-white/15 focus-visible:ring-[#3B68F7]"
              }`}
            />
            {state?.fieldError?.field === "monthlyValue" && (
              <p role="alert" className="pl-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                {state.fieldError.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="workstation" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
            Unidade / postos vinculados
          </label>
          <input
            id="workstation"
            name="workstation"
            defaultValue={state?.values?.workstation ?? ""}
            placeholder="Ex.: Matriz Cuiabá · 4 postos"
            className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="scopeNotes" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
            Escopo e condições operacionais
          </label>
          <textarea
            id="scopeNotes"
            name="scopeNotes"
            rows={3}
            defaultValue={state?.values?.scopeNotes ?? ""}
            placeholder="Descreva as entregas previstas, cobertura de postos, SLA de atendimento e observações contratuais…"
            className="w-full rounded-3xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 p-4 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/70 dark:border-white/10 pt-5">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            O contrato será ativado imediatamente em {tenantName}
          </span>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 pill-gradient px-7 py-2.5 text-sm inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            <span>Salvar contrato</span>
          </button>
        </div>
      </form>
    </section>
  );
}
