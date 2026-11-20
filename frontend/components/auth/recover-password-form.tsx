"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { recoverPasswordAction } from "@/app/actions/auth";
import { Field } from "./field";

export function RecoverPasswordForm() {
  const [state, action, pending] = useActionState(recoverPasswordAction, { step: "request" });
  const step = state?.step ?? "request";

  if (step === "done") {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Senha atualizada com sucesso</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{state?.message}</p>
        </div>
        <Link
          href="/login"
          className="w-full min-h-12 pill-gradient py-3 px-6 text-sm inline-flex items-center justify-center"
        >
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="intent" value={step === "verify" ? "verify" : "request"} />

      {state?.error && (
        <p
          role="alert"
          className="rounded-2xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/90 dark:bg-rose-950/50 px-4 py-3 text-xs font-medium text-rose-700 dark:text-rose-300"
        >
          {state.error}
        </p>
      )}

      {state?.message && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/90 dark:bg-emerald-950/40 p-3.5 text-xs text-emerald-800 dark:text-emerald-200 space-y-1"
        >
          <p className="font-semibold">{state.message}</p>
          {state.previewCode && (
            <p className="font-mono text-[11px] flex items-center gap-1.5">
              <KeyRound className="size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Código gerado: <strong className="text-sm">{state.previewCode}</strong>
              </span>
            </p>
          )}
        </div>
      )}

      <Field
        id="email"
        label="E-mail cadastrado"
        type="email"
        autoComplete="email"
        spellCheck={false}
        placeholder="seu@email.com.br…"
        defaultValue={state?.email ?? "phelipegabriel1988@gmail.com"}
        readOnly={step === "verify"}
        required
      />

      {step === "verify" && (
        <>
          <Field
            id="code"
            label="Código de verificação (6 dígitos)"
            type="text"
            inputMode="numeric"
            placeholder="000000…"
            defaultValue={state?.previewCode ?? ""}
            required
          />
          <Field
            id="newPassword"
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres…"
            required
          />
        </>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full min-h-12 pill-gradient py-3 px-6 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        <span>{step === "verify" ? "Redefinir senha" : "Enviar código de recuperação"}</span>
      </button>
    </form>
  );
}
