"use client";

import { useActionState, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { register } from "@/app/actions/auth";
import { formatCNPJ } from "@/lib/utils/cnpj";
import { Field } from "./field";

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined);
  const [cnpj, setCnpj] = useState(state?.values?.cnpj ?? "");

  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="rounded-2xl border border-blue-200/80 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-950/40 px-4 py-3 text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2.5">
        <Building2 className="size-4 shrink-0 text-[#3B68F7] dark:text-blue-400 mt-0.5" aria-hidden="true" />
        <div>
          <p className="font-bold text-slate-900 dark:text-white">Ambiente corporativo isolado</p>
          <p className="mt-0.5 text-slate-600 dark:text-slate-300">
            Ao concluir, sua empresa será ativada automaticamente e você será guiado ao cadastro do primeiro cliente.
          </p>
        </div>
      </div>

      {state?.message && (
        <p
          role="alert"
          className="rounded-2xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/90 dark:bg-rose-950/50 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-300"
        >
          {state.message}
        </p>
      )}
      <Field
        id="companyName"
        label="Razão social da empresa *"
        type="text"
        placeholder="Ex.: Horizonte Facilities & Serviços Ltda"
        defaultValue={state?.values?.companyName}
        errors={state?.errors?.companyName}
        required
      />
      <Field
        id="cnpj"
        label="CNPJ da empresa *"
        hint="14 dígitos com verificador válido"
        type="text"
        inputMode="numeric"
        placeholder="00.000.000/0001-00"
        value={cnpj}
        onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
        errors={state?.errors?.cnpj}
        required
      />
      <Field
        id="name"
        label="Nome do gestor responsável *"
        type="text"
        autoComplete="name"
        placeholder="Seu nome completo"
        defaultValue={state?.values?.name}
        errors={state?.errors?.name}
        required
      />
      <Field
        id="email"
        label="E-mail corporativo *"
        type="email"
        autoComplete="email"
        spellCheck={false}
        placeholder="gestor@empresa.com.br"
        defaultValue={state?.values?.email}
        errors={state?.errors?.email}
        required
      />
      <Field
        id="password"
        label="Senha de acesso *"
        hint="Regra: mínimo de 6 caracteres"
        type="password"
        autoComplete="new-password"
        placeholder="Crie uma senha com ao menos 6 caracteres"
        errors={state?.errors?.password}
        required
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full min-h-12 pill-gradient py-3 px-6 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        <span>Criar empresa e iniciar operação</span>
      </button>
    </form>
  );
}
