"use client";

import { useActionState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { login } from "@/app/actions/auth";
import { Field } from "./field";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.message && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-xs font-bold text-red-700 dark:text-red-300"
        >
          {state.message}
        </p>
      )}
      <Field
        id="email"
        label="E-mail Corporativo"
        type="email"
        autoComplete="email"
        spellCheck={false}
        placeholder="phelipegabriel1988@gmail.com…"
        defaultValue={state?.values?.email ?? "phelipegabriel1988@gmail.com"}
        errors={state?.errors?.email}
        required
      />
      <Field
        id="password"
        label="Senha de Acesso"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••…"
        defaultValue="password"
        errors={state?.errors?.password}
        required
      />

      <div className="rounded-2xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/70 dark:bg-blue-950/35 p-4 text-xs">
        <div className="flex items-center gap-2 font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          <span>Acesso Nível Desenvolvedor (Multi-Empresas)</span>
        </div>
        <p className="mt-1.5 font-mono text-[11px] font-bold text-gray-600 dark:text-blue-200/80">
          E-mail: phelipegabriel1988@gmail.com • Senha: password
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full min-h-12 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-black py-3.5 px-6 rounded-xl shadow-lg shadow-blue-500/25 uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        <span>Entrar no Painel Administrativo</span>
      </button>
    </form>
  );
}
