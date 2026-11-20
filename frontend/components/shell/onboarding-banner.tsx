"use client";

import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Circle } from "lucide-react";
import type { CompanyRow } from "@/lib/operations/repository";

interface Props {
  activeCompany: CompanyRow | undefined;
  tenantName: string;
}

export function OnboardingBanner({ activeCompany, tenantName }: Props) {
  if (!activeCompany) return null;

  const hasClient = activeCompany.clientsCount > 0;
  const hasContract = activeCompany.contractsCount > 0;
  const hasEmployee = activeCompany.employeesCount > 0;
  const hasOS = activeCompany.serviceOrdersCount > 0;

  // Quando todos os 4 primeiros passos da cadeia já estão completos, não precisa exibir a trilha de implantação
  if (hasClient && hasContract && hasEmployee && hasOS) {
    return null;
  }

  let nextLabel = "Cadastrar primeiro cliente";
  let nextHref = "/admin/contracts?tab=clientes#novo-cliente";
  let nextHint = "Comece registrando o cliente tomador para liberar o vínculo de contratos.";

  if (hasClient && !hasContract) {
    nextLabel = "Criar primeiro contrato";
    nextHref = "/admin/contracts/create";
    nextHint = "Cliente cadastrado! Agora defina o objeto, vigência e valor mensal do contrato.";
  } else if (hasClient && hasContract && !hasEmployee) {
    nextLabel = "Alocar colaborador";
    nextHref = "/admin/employees#novo-colaborador";
    nextHint = "Contrato ativo! Aloque o primeiro técnico ou colaborador e defina sua escala.";
  } else if (hasClient && hasContract && hasEmployee && !hasOS) {
    nextLabel = "Abrir primeira ordem de serviço";
    nextHref = "/admin/service-orders#nova-os";
    nextHint = "Equipe alocada! Despache a primeira ordem de serviço para iniciar a operação.";
  }

  const steps = [
    { key: "company", label: "1. Empresa ativa", done: true, href: "/admin/companies" },
    { key: "client", label: "2. Cliente tomador", done: hasClient, href: "/admin/contracts?tab=clientes#novo-cliente" },
    { key: "contract", label: "3. Contrato", done: hasContract, href: "/admin/contracts/create" },
    { key: "employee", label: "4. Colaborador", done: hasEmployee, href: "/admin/employees#novo-colaborador" },
    { key: "os", label: "5. Primeira OS", done: hasOS, href: "/admin/service-orders#nova-os" },
  ];

  return (
    <section
      aria-label="Roteiro para primeira operação"
      className="rounded-3xl border border-blue-200/90 dark:border-blue-500/25 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-[#3B68F7] dark:text-blue-300">
            <Building2 className="size-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#3B68F7] dark:text-blue-400">
                Primeira operação · {tenantName}
              </span>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                Contexto ativo
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 mt-0.5">
              {nextHint}
            </p>
          </div>
        </div>

        <Link
          href={nextHref}
          className="inline-flex min-h-10 items-center gap-2 pill-gradient px-5 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
        >
          <span>{nextLabel}</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      <ol className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
        {steps.map((step) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors ${
                step.done
                  ? "border-emerald-200/90 dark:border-emerald-800/50 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
                  : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-blue-300"
              }`}
            >
              {step.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              ) : (
                <Circle className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
              )}
              <span className="truncate">{step.label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
