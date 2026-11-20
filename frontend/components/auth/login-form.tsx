"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { login, requestSetupLinkAction } from "@/app/actions/auth";
import { Field } from "./field";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const [linkState, linkAction, linkPending] = useActionState(requestSetupLinkAction, undefined);
  const [showRequestLink, setShowRequestLink] = useState(false);
  const [emailValue, setEmailValue] = useState(state?.values?.email ?? "");
  const [codeValue, setCodeValue] = useState("");

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-200/80 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-950/35 px-4 py-3 text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2.5">
        <ShieldCheck className="size-4 shrink-0 text-[#3B68F7] dark:text-blue-400 mt-0.5" aria-hidden="true" />
        <div>
          <p className="font-bold text-slate-900 dark:text-white">Acesso exclusivo via Google Authenticator</p>
          <p className="mt-0.5 text-slate-600 dark:text-slate-300">
            Informe seu e-mail corporativo e o código de 6 dígitos gerado no aplicativo Google Authenticator.
          </p>
        </div>
      </div>

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
          label="E-mail corporativo *"
          type="email"
          autoComplete="email"
          spellCheck={false}
          placeholder="nome@suaempresa.com.br"
          value={emailValue}
          onChange={(e) => setEmailValue(e.target.value)}
          errors={state?.errors?.email}
          required
        />

        <Field
          id="code"
          label="Senha do Google Authenticator *"
          hint="Código de 6 dígitos"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
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

      {/* Envio de link de configuração do Google Authenticator por e-mail (sem QR Code) */}
      <div className="border-t border-slate-200/70 dark:border-white/10 pt-4 space-y-3">
        <button
          type="button"
          onClick={() => setShowRequestLink((v) => !v)}
          className="w-full text-center text-xs font-semibold text-[#3B68F7] dark:text-blue-400 hover:underline cursor-pointer"
        >
          {showRequestLink
            ? "Ocultar reenvio de link"
            : "Primeiro acesso ou trocou de aparelho? Enviar link do autenticador para meu e-mail"}
        </button>

        {showRequestLink && (
          <form
            action={linkAction}
            className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-800/50 p-4 space-y-3"
          >
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Enviaremos um link pessoal para o seu e-mail cadastrado configurar o Google Authenticator sem QR Code.
            </p>

            {linkState?.ok && linkState.message && (
              <div
                role="status"
                className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-start gap-2"
              >
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" aria-hidden="true" />
                <span>{linkState.message}</span>
              </div>
            )}

            {linkState?.error && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300"
              >
                {linkState.error}
              </p>
            )}

            <div className="space-y-1">
              <label htmlFor="setup-email" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                Seu e-mail cadastrado
              </label>
              <input
                id="setup-email"
                name="email"
                type="email"
                required
                defaultValue={emailValue || linkState?.email || ""}
                placeholder="nome@suaempresa.com.br"
                className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              />
            </div>

            <button
              type="submit"
              disabled={linkPending}
              className="w-full min-h-10 rounded-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-bold py-2 px-4 text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {linkPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Mail className="size-3.5" aria-hidden="true" />
              )}
              <span>Enviar link para meu e-mail</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
