"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, KeyRound, Loader2, ShieldCheck, UserCheck } from "lucide-react";
import { loginTwoStepAction } from "@/app/actions/auth";
import { Field } from "./field";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginTwoStepAction, { step: "email" });
  const [codeValue, setCodeValue] = useState("");

  const step = state?.step ?? "email";

  return (
    <div className="space-y-5">
      {/* Indicador de 2 etapas */}
      <div className="flex items-center gap-2 text-xs font-semibold">
        <span
          className={`flex-1 rounded-full px-3 py-1.5 text-center border ${
            step === "email"
              ? "border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-950/50 text-[#3B68F7] dark:text-blue-300"
              : "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          1. Validar e-mail
        </span>
        <span
          className={`flex-1 rounded-full px-3 py-1.5 text-center border ${
            step === "code"
              ? "border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-950/50 text-[#3B68F7] dark:text-blue-300"
              : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/40 text-slate-400"
          }`}
        >
          2. Google Authenticator
        </span>
      </div>

      {state?.message && (
        <p
          role="alert"
          className="rounded-2xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/95 dark:bg-rose-950/60 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-300"
        >
          {state.message}
        </p>
      )}

      {step === "email" ? (
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="intent" value="check-email" />

          <Field
            id="email"
            label="E-mail corporativo *"
            type="email"
            autoComplete="email"
            spellCheck={false}
            autoFocus
            placeholder="nome@suaempresa.com.br"
            defaultValue={state?.email ?? ""}
            errors={state?.errors?.email}
            required
          />

          <button
            type="submit"
            disabled={pending}
            className="w-full min-h-12 pill-gradient py-3 px-6 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <>
                <span>Continuar</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      ) : (
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="intent" value="verify-code" />
          <input type="hidden" name="email" value={state?.email ?? ""} />

          {/* Resumo do e-mail validado na Etapa 1 */}
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/40 p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <UserCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {state?.userName || "Conta verificada"}
                  {state?.isMaster ? " · Master" : ""}
                </p>
                <p className="font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate">
                  {state?.email}
                </p>
              </div>
            </div>
            <button
              type="submit"
              name="intent"
              value="reset"
              formNoValidate
              className="shrink-0 inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-[#3B68F7] cursor-pointer"
            >
              <ArrowLeft className="size-3" aria-hidden="true" />
              <span>Trocar</span>
            </button>
          </div>

          <Field
            id="code"
            label="Senha do Google Authenticator *"
            hint="Código de 6 dígitos"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            placeholder="000000"
            value={codeValue}
            onChange={(e) => setCodeValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
            errors={state?.errors?.code}
            required
          />

          <button
            type="submit"
            disabled={pending}
            className="w-full min-h-12 pill-gradient py-3 px-6 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <KeyRound className="size-4" aria-hidden="true" />
            )}
            <span>Entrar com Google Authenticator</span>
          </button>
        </form>
      )}

      {/* Link para a página dedicada de Recuperação de Autenticação */}
      <div className="border-t border-slate-200/70 dark:border-white/10 pt-4 text-center space-y-1">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Primeiro acesso ou perdeu o aplicativo Google Authenticator?
        </p>
        <Link
          href="/recuperar-autenticador"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3B68F7] dark:text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] rounded"
        >
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          <span>Recuperar ou configurar autenticação</span>
        </Link>
      </div>
    </div>
  );
}
