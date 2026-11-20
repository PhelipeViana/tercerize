"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { register } from "@/app/actions/auth";
import { Field } from "./field";

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined);

  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.message && (
        <p
          role="alert"
          className="rounded-2xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/90 dark:bg-rose-950/50 px-4 py-3 text-xs font-medium text-rose-700 dark:text-rose-300"
        >
          {state.message}
        </p>
      )}
      <Field
        id="companyName"
        label="Razão social da empresa"
        type="text"
        placeholder="Ex.: Horizonte Facilities & Serviços Ltda…"
        defaultValue={state?.values?.companyName}
        errors={state?.errors?.companyName}
        required
      />
      <Field
        id="cnpj"
        label="CNPJ"
        type="text"
        placeholder="00.000.000/0001-00…"
        defaultValue={state?.values?.cnpj}
        errors={state?.errors?.cnpj}
        required
      />
      <Field
        id="name"
        label="Nome do gestor responsável"
        type="text"
        autoComplete="name"
        placeholder="Seu nome completo…"
        defaultValue={state?.values?.name}
        errors={state?.errors?.name}
        required
      />
      <Field
        id="email"
        label="E-mail corporativo"
        type="email"
        autoComplete="email"
        spellCheck={false}
        placeholder="gestor@empresa.com.br…"
        defaultValue={state?.values?.email}
        errors={state?.errors?.email}
        required
      />
      <Field
        id="password"
        label="Crie uma senha"
        type="password"
        autoComplete="new-password"
        placeholder="Mínimo 6 caracteres…"
        errors={state?.errors?.password}
        required
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full min-h-12 pill-gradient py-3 px-6 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        <span>Cadastrar empresa</span>
      </button>
    </form>
  );
}
