"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { register } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "./field";

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined);

  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.message && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {state.message}
        </p>
      )}
      <Field
        id="companyName"
        label="Razão Social da Empresa Prestadora"
        type="text"
        placeholder="Ex.: Nova Terceirização & Serviços Ltda…"
        defaultValue={state?.values?.companyName}
        errors={state?.errors?.companyName}
        required
      />
      <Field
        id="cnpj"
        label="CNPJ da Empresa"
        type="text"
        placeholder="00.000.000/0001-00…"
        defaultValue={state?.values?.cnpj}
        errors={state?.errors?.cnpj}
        required
      />
      <Field
        id="name"
        label="Seu Nome Completo"
        type="text"
        autoComplete="name"
        placeholder="Nome do gestor responsável…"
        defaultValue={state?.values?.name}
        errors={state?.errors?.name}
        required
      />
      <Field
        id="email"
        label="E-mail"
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
        label="Senha"
        type="password"
        autoComplete="new-password"
        placeholder="Mínimo 6 caracteres…"
        errors={state?.errors?.password}
        required
      />
      <Button type="submit" className="w-full min-h-11 text-sm font-semibold" disabled={pending}>
        {pending && <Loader2 className="animate-spin mr-1.5" aria-hidden="true" />}
        Cadastrar Empresa e Entrar
      </Button>
    </form>
  );
}
