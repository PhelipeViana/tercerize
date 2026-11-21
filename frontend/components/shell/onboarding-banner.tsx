"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, ListChecks } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import type { CompanyRow } from "@/lib/operations/repository";

interface Props {
  activeCompany: CompanyRow | undefined;
  tenantName: string;
}

export function OnboardingBanner({ activeCompany, tenantName }: Props) {
  const [open, setOpen] = useState(false);

  if (!activeCompany) return null;

  const hasClient = activeCompany.clientsCount > 0;
  const hasContract = activeCompany.contractsCount > 0;
  const hasEmployee = activeCompany.employeesCount > 0;
  const hasOS = activeCompany.serviceOrdersCount > 0;

  // Quando todos os passos estiverem completos, oculta completamente o botão discreto
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
    { key: "company", label: "1. Empresa ativa", done: true, href: "/admin/contracts" },
    { key: "client", label: "2. Cliente tomador", done: hasClient, href: "/admin/contracts?tab=clientes#novo-cliente" },
    { key: "contract", label: "3. Primeiro contrato", done: hasContract, href: "/admin/contracts/create" },
    { key: "employee", label: "4. Alocar colaborador", done: hasEmployee, href: "/admin/employees#novo-colaborador" },
    { key: "os", label: "5. Primeira ordem de serviço", done: hasOS, href: "/admin/service-orders#nova-os" },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const totalCount = steps.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Primeiros passos da empresa: ${completedCount} de ${totalCount} concluídos. Clique para ver o checklist`}
        title={`Primeiros passos (${completedCount}/${totalCount}) — ${nextLabel}`}
        className="min-h-10 inline-flex items-center gap-2 rounded-full border border-blue-200/90 dark:border-blue-500/30 bg-blue-50/85 dark:bg-blue-950/45 px-3 py-1.5 text-xs font-semibold text-[#3B68F7] dark:text-blue-300 hover:bg-blue-100/90 dark:hover:bg-blue-950/75 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
      >
        <ListChecks className="size-4 shrink-0" aria-hidden="true" />
        <span className="hidden md:inline">Primeiros passos</span>
        <span className="rounded-full bg-[#3B68F7] px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums leading-none">
          {completedCount}/{totalCount}
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Primeiros passos · ${tenantName}`}
        description="Conclua os 5 passos iniciais para ativar toda a operação da empresa. Ao finalizar, este botão some automaticamente."
        size="md"
      >
        <div className="space-y-4">
          {/* Progress summary */}
          <div className="rounded-2xl border border-blue-200/80 dark:border-blue-500/25 bg-blue-50/60 dark:bg-blue-950/30 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-900 dark:text-white">
                Progresso da implantação
              </span>
              <span className="font-bold text-[#3B68F7] dark:text-blue-300 tabular-nums">
                {completedCount} de {totalCount} concluídos
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#3B68F7] to-[#5346E8] transition-transform"
                style={{ width: `${Math.round((completedCount / totalCount) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {nextHint}
            </p>
          </div>

          {/* Checklist */}
          <ol className="space-y-2">
            {steps.map((step) => (
              <li key={step.key}>
                <Link
                  href={step.href}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-11 items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] ${step.done
                    ? "border-emerald-200/90 dark:border-emerald-800/50 bg-emerald-50/70 dark:bg-emerald-950/35 text-emerald-800 dark:text-emerald-300"
                    : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 hover:border-[#3B68F7]"
                    }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    {step.done ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                    )}
                    <span className="truncate">{step.label}</span>
                  </span>
                  <span className="text-[11px] font-bold shrink-0">
                    {step.done ? "Concluído" : "Ir agora"}
                  </span>
                </Link>
              </li>
            ))}
          </ol>

          <div className="flex justify-end pt-1">
            <Link
              href={nextHref}
              onClick={() => setOpen(false)}
              className="pill-gradient min-h-11 inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              <span>{nextLabel}</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </Modal>
    </>
  );
}
