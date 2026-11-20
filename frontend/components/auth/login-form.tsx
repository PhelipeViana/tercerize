"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, PlayCircle } from "lucide-react";
import { login, loginDemoAction } from "@/app/actions/auth";
import { Field } from "./field";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4" noValidate>
        {state?.message && (
          <p
            role="alert"
            className="rounded-2xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/95 dark:bg-rose-950/60 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-300"
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
          placeholder="nome@suaempresa.com.br"
          defaultValue={state?.values?.email ?? ""}
          errors={state?.errors?.email}
          required
        />
        <div className="space-y-1.5">
          <Field
            id="password"
            label="Senha"
            type="password"
            autoComplete="current-password"
            placeholder="Digite sua senha"
            errors={state?.errors?.password}
            required
          />
          <div className="flex justify-end pr-1 pt-0.5">
            <Link
              href="/recuperar-senha"
              className="text-xs font-semibold text-[#3B68F7] dark:text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] rounded"
            >
              Esqueceu sua senha?
            </Link>
          </div>
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

      {/* Entrada separada e identificada para o modo demonstração */}
      <div className="border-t border-slate-200/70 dark:border-white/10 pt-4">
        <form action={loginDemoAction}>
          <button
            type="submit"
            className="w-full min-h-11 rounded-full border border-slate-300/90 dark:border-white/15 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            <PlayCircle className="size-4 text-[#3B68F7] dark:text-blue-400" aria-hidden="true" />
            <span>Acessar ambiente de demonstração</span>
          </button>
        </form>
      </div>
    </div>
  );
}
