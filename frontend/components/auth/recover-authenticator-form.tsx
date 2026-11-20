"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { recoverAuthenticatorStepAction } from "@/app/actions/auth";
import { formatCNPJ } from "@/lib/utils/cnpj";
import { Field } from "./field";

export function RecoverAuthenticatorForm() {
  const [state, action, pending] = useActionState(recoverAuthenticatorStepAction, { step: "email" });
  const [cnpjValue, setCnpjValue] = useState("");

  useEffect(() => {
    if (state?.cnpj) {
      setCnpjValue(state.cnpj);
    } else if (state?.step === "email") {
      setCnpjValue("");
    }
  }, [state]);

  const step = state?.step ?? "email";

  if (step === "sent") {
    return (
      <div className="space-y-5 text-center py-2">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
            Link de recuperação enviado!
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {state?.successMessage}
          </p>
          {state?.companyName && (
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 pt-1">
              Vínculo confirmado na empresa: <strong>{state.companyName}</strong>
            </p>
          )}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Abra o e-mail enviado para <strong>{state?.email}</strong> e clique no botão para configurar o Google
          Authenticator sem QR Code.
        </p>
        <Link
          href="/login"
          className="inline-flex min-h-11 w-full items-center justify-center pill-gradient px-6 py-2.5 text-sm"
        >
          Voltar para o login
        </Link>
      </div>
    );
  }

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
            step === "confirm"
              ? "border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-950/50 text-[#3B68F7] dark:text-blue-300"
              : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/40 text-slate-400"
          }`}
        >
          {step === "confirm" && !state?.requiresCnpj ? "2. Enviar link" : "2. Validar CNPJ e enviar"}
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
            label="E-mail cadastrado *"
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
          <input type="hidden" name="intent" value="send-link" />
          <input type="hidden" name="email" value={state?.email ?? ""} />

          {/* Resumo da conta validada na Etapa 1 */}
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

          {state?.requiresCnpj ? (
            <>
              <div className="rounded-2xl border border-blue-200/80 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-950/35 px-4 py-3 text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2.5">
                <Building2 className="size-4 shrink-0 text-[#3B68F7] dark:text-blue-400 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Confirmação de vínculo empresarial</p>
                  <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                    Para sua segurança, informe o <strong>CNPJ de qualquer empresa</strong> à qual este e-mail esteja
                    vinculado antes de enviarmos o link de recuperação.
                  </p>
                </div>
              </div>

              <Field
                id="cnpj"
                label="CNPJ de uma empresa vinculada *"
                hint="14 dígitos válidos"
                type="text"
                inputMode="numeric"
                autoFocus
                placeholder="00.000.000/0001-00"
                value={cnpjValue}
                onChange={(e) => setCnpjValue(formatCNPJ(e.target.value))}
                errors={state?.errors?.cnpj}
                required
              />
            </>
          ) : (
            <div className="rounded-2xl border border-blue-200/80 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-950/35 px-4 py-3 text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2.5">
              <ShieldCheck className="size-4 shrink-0 text-[#3B68F7] dark:text-blue-400 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Acesso Master identificado</p>
                <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                  Clique no botão abaixo para receber o link de configuração do Google Authenticator no seu e-mail.
                </p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full min-h-12 pill-gradient py-3 px-6 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Mail className="size-4" aria-hidden="true" />
            )}
            <span>
              {state?.requiresCnpj
                ? "Validar CNPJ e enviar link por e-mail"
                : "Enviar link de recuperação por e-mail"}
            </span>
          </button>
        </form>
      )}
    </div>
  );
}
