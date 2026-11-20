"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  Plus,
  Search,
  UserCheck,
} from "lucide-react";
import { createCompanyStateAction, switchTenantAction } from "@/app/actions/auth";
import type { CompanyRow } from "@/lib/operations/repository";
import { formatCNPJ } from "@/lib/utils/cnpj";

interface Props {
  activeTenantId: string;
  activeTenantName: string;
  companies: CompanyRow[];
}

export function CompaniesView({
  activeTenantId,
  activeTenantName,
  companies,
}: Props) {
  const [state, createAction, pending] = useActionState(createCompanyStateAction, undefined);
  const [cnpj, setCnpj] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (state?.values?.cnpj) {
      setCnpj(state.values.cnpj);
    } else if (state?.ok) {
      setCnpj("");
    }
  }, [state]);

  const filteredCompanies = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.cnpj.toLowerCase().includes(q) ||
        c.ownerName.toLowerCase().includes(q) ||
        c.ownerEmail.toLowerCase().includes(q),
    );
  }, [companies, query]);

  return (
    <div className="space-y-5">
      {/* Confirmação visual ao criar empresa e enviar link para o e-mail do responsável */}
      {state?.ok && state.createdName && (
        <div
          role="status"
          className="rounded-3xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/90 dark:bg-emerald-950/50 p-4 sm:p-5 space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Empresa {state.createdName} ({state.createdCnpj}) criada e ativada!
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Responsável (Dono): <strong>{state.ownerName}</strong> ({state.ownerEmail}).{" "}
                  {state.emailSent && "Link do Google Authenticator enviado automaticamente por e-mail!"}
                </p>
              </div>
            </div>
            <Link
              href="/admin/permissions"
              className="inline-flex min-h-10 items-center gap-2 pill-gradient px-5 py-2 text-xs"
            >
              <span>Gerenciar roles e subpermissões</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          {state.emailWarning && (
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              {state.emailWarning}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <section className="rounded-[28px] solid-surface p-5 sm:p-7 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Empresas cadastradas ({companies.length})
            </h2>

            <div className="relative min-w-[230px]">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400"
                aria-hidden="true"
              />
              <label htmlFor="companies-filter" className="sr-only">
                Buscar empresa por nome, CNPJ ou responsável
              </label>
              <input
                id="companies-filter"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Empresa, CNPJ ou responsável…"
                className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 pl-9 pr-3.5 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-200/70 dark:divide-white/10">
            {filteredCompanies.map((c) => {
              const isCurrent = c.id === activeTenantId;
              return (
                <div key={c.id} className="py-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{c.name}</p>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-3 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          <span className="size-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
                          Ativa na sessão
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-xs text-slate-500 dark:text-slate-400">CNPJ: {c.cnpj}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-1.5">
                      <UserCheck className="size-3.5 text-[#3B68F7]" aria-hidden="true" />
                      <span>
                        Dono / Responsável: <strong>{c.ownerName || "Não informado"}</strong> (
                        <span className="font-mono">{c.ownerEmail || "—"}</span>)
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>
                        <strong>{c.clientsCount}</strong> cliente(s)
                      </span>
                      <span>
                        <strong>{c.contractsCount}</strong> contrato(s)
                      </span>
                      <span>
                        <strong>{c.employeesCount}</strong> colaborador(es)
                      </span>
                      <span>
                        <strong>{c.serviceOrdersCount}</strong> OS
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isCurrent && (
                      <form action={switchTenantAction}>
                        <input type="hidden" name="tenantId" value={c.id} />
                        <button
                          type="submit"
                          className="min-h-9 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 hover:bg-[#3B68F7] hover:text-white hover:border-[#3B68F7] px-4 py-1.5 text-xs font-bold text-slate-800 dark:text-white transition-colors cursor-pointer"
                        >
                          Ativar empresa
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[28px] solid-surface p-6 space-y-4 h-fit">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-[#3B68F7] dark:text-blue-300">
              <Building2 className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Nova empresa prestadora</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Exige CNPJ único, nome e e-mail do responsável. O link do autenticador é enviado por e-mail.
              </p>
            </div>
          </div>

          {state?.message && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300"
            >
              {state.message}
            </p>
          )}

          <form action={createAction} noValidate className="space-y-3.5">
            <div className="space-y-1">
              <label htmlFor="comp-name" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                Razão social da empresa *
              </label>
              <input
                id="comp-name"
                name="name"
                required
                defaultValue={state?.values?.name ?? ""}
                aria-invalid={state?.fieldError?.field === "name"}
                placeholder="Ex.: Pantanal Facilities & Manutenção Ltda"
                className={`w-full rounded-full border bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 ${
                  state?.fieldError?.field === "name"
                    ? "border-rose-400 focus-visible:ring-rose-500"
                    : "border-slate-200 dark:border-white/15 focus-visible:ring-[#3B68F7]"
                }`}
              />
              {state?.fieldError?.field === "name" && (
                <p role="alert" className="pl-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {state.fieldError.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline justify-between px-1">
                <label htmlFor="comp-cnpj" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  CNPJ único *
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">14 dígitos válidos</span>
              </div>
              <input
                id="comp-cnpj"
                name="cnpj"
                inputMode="numeric"
                required
                value={cnpj}
                onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                aria-invalid={state?.fieldError?.field === "cnpj"}
                placeholder="00.000.000/0001-00"
                className={`w-full rounded-full border bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 ${
                  state?.fieldError?.field === "cnpj"
                    ? "border-rose-400 focus-visible:ring-rose-500"
                    : "border-slate-200 dark:border-white/15 focus-visible:ring-[#3B68F7]"
                }`}
              />
              {state?.fieldError?.field === "cnpj" && (
                <p role="alert" className="pl-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {state.fieldError.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="comp-owner-name" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                Nome do responsável (Dono) *
              </label>
              <input
                id="comp-owner-name"
                name="ownerName"
                required
                defaultValue={state?.values?.ownerName ?? ""}
                aria-invalid={state?.fieldError?.field === "ownerName"}
                placeholder="Ex.: Rafael Carvalho"
                className={`w-full rounded-full border bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 ${
                  state?.fieldError?.field === "ownerName"
                    ? "border-rose-400 focus-visible:ring-rose-500"
                    : "border-slate-200 dark:border-white/15 focus-visible:ring-[#3B68F7]"
                }`}
              />
              {state?.fieldError?.field === "ownerName" && (
                <p role="alert" className="pl-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {state.fieldError.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline justify-between px-1">
                <label htmlFor="comp-owner-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  E-mail do responsável (Dono) *
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Pode gerir múltiplos CNPJs</span>
              </div>
              <input
                id="comp-owner-email"
                name="ownerEmail"
                type="email"
                required
                defaultValue={state?.values?.ownerEmail ?? ""}
                aria-invalid={state?.fieldError?.field === "ownerEmail"}
                placeholder="responsavel@empresa.com.br"
                className={`w-full rounded-full border bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 ${
                  state?.fieldError?.field === "ownerEmail"
                    ? "border-rose-400 focus-visible:ring-rose-500"
                    : "border-slate-200 dark:border-white/15 focus-visible:ring-[#3B68F7]"
                }`}
              />
              {state?.fieldError?.field === "ownerEmail" && (
                <p role="alert" className="pl-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {state.fieldError.message}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-blue-200/70 dark:border-blue-500/20 bg-blue-50/60 dark:bg-blue-950/30 p-3 text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2">
              <Mail className="size-4 shrink-0 text-[#3B68F7] mt-0.5" aria-hidden="true" />
              <span>
                Ao salvar, um e-mail com o <strong>link do Google Authenticator</strong> será enviado automaticamente
                para o responsável cadastrado.
              </span>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full min-h-11 pill-gradient py-2.5 px-5 text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              <span>Cadastrar empresa e enviar link</span>
            </button>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
              Contexto atual: <strong>{activeTenantName}</strong>
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}
