"use client";

import { useActionState } from "react";
import Link from "next/link";
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
          className="rounded-2xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/90 dark:bg-rose-950/50 px-4 py-3 text-xs font-medium text-rose-700 dark:text-rose-300"
        >
          {state.message}
        </p>
      )}
      <Field
        id="email"
        label="E-mail corporativo"
        type="email"
        autoComplete="email"
        spellCheck={false}
        placeholder="phelipegabriel1988@gmail.com…"
        defaultValue={state?.values?.email ?? "phelipegabriel1988@gmail.com"}
        errors={state?.errors?.email}
        required
      />
      <div className="space-y-1.5">
        <Field
          id="password"
          label="Senha"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••…"
          defaultValue="password"
          errors={state?.errors?.password}
          required
        />
        <div className="flex justify-end pr-1 pt-0.5">
          <Link
            href="/recuperar-senha"
            className="text-xs font-semibold text-[#3B68F7] dark:text-blue-400 hover:underline"
          >
            Esqueceu sua senha?
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-200/70 dark:border-blue-500/20 bg-blue-50/60 dark:bg-blue-950/30 p-3.5 text-xs">
        <div className="flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-300">
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          <span>Credencial desenvolvedor multi-empresas</span>
        </div>
        <p className="mt-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
          phelipegabriel1988@gmail.com • Senha: password
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full min-h-12 pill-gradient py-3 px-6 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        <span>Entrar na plataforma</span>
      </button>
    </form>
  );
}
